-- Banana Burn · 0013 acceso por plan, comunidad, retos y moderación
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001–0012.
-- Qué hace:
--   1. Acceso: prueba gratis de 7 días desde profiles.created_at; después, plan (o cortesía, o staff). has_app_access().
--      El coach (coach_consume) y la comunidad (publicar/comentar) lo validan en la base de datos.
--   2. Suspensión: profiles.suspended_at / suspended_reason; el usuario no puede tocarlas; admin_set_suspended() audita.
--      Un usuario suspendido no puede publicar ni comentar (RLS).
--   3. Retos: estados 'fallido' y 'vencido'; el usuario solo se une (hoy, máx. 3 activos) o abandona;
--      completar/fallar/vencer y los check-ins automáticos los escribe el servidor (service_role).
--      challenge_checkins: el usuario solo inserta el día de HOY y solo en retos manuales activos.
--   4. Ranking semanal con la semana LOCAL de quien lo mira (lunes 00:00 en su zona horaria de notification_prefs;
--      sin zona guardada, America/Costa_Rica), en vez de la semana UTC de 0012.
--   5. Perfil público de la comunidad con contadores (community_profile).
--   6. Interés en relojes (device_interest) para priorizar integraciones.

-- ───────────── 1. Acceso por plan ─────────────
-- Fuente de verdad en la app: src/lib/entitlements.ts (misma regla). Aquí: staff, plan pagado/asignado,
-- cortesía vigente o prueba de 7 días. profiles.plan lo mantienen el webhook de pagos y las cortesías.
create or replace function public._has_app_access(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    exists (
      select 1 from public.profiles p where p.id = p_user and (
        p.role::text in ('coach','support','admin','superadmin')
        or p.plan in ('entreno','completo','pro')
        or p.created_at > now() - interval '7 days'))
    or exists (
      select 1 from public.comp_grants g where g.user_id = p_user and g.revoked_at is null and g.starts_at <= now() and g.expires_at > now())
  );
$$;
revoke all on function public._has_app_access(uuid) from public, anon, authenticated;

/** ¿El usuario actual tiene prueba vigente o plan? */
create or replace function public.has_app_access()
returns boolean language sql stable security definer set search_path = public as $$
  select public._has_app_access(auth.uid());
$$;
revoke execute on function public.has_app_access() from public, anon;
grant execute on function public.has_app_access() to authenticated;

-- ───────────── 2. Suspensión en la comunidad ─────────────
alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;
alter table public.profiles drop constraint if exists profiles_suspended_reason_len;
alter table public.profiles add constraint profiles_suspended_reason_len check (suspended_reason is null or char_length(suspended_reason) <= 300) not valid;

/** ¿El usuario actual está suspendido? (definer: lee su propio perfil sin depender del RLS de profiles). */
create or replace function public.is_suspended()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select suspended_at is not null from public.profiles where id = auth.uid()), false);
$$;
revoke execute on function public.is_suspended() from public, anon;
grant execute on function public.is_suspended() to authenticated;

-- El guard de 0012 + la suspensión: nadie se des-suspende por la API REST.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql as $$
begin
  if (new.role is distinct from old.role or new.plan is distinct from old.plan) and public.is_api_role() then
    raise exception 'No autorizado para cambiar rol o plan' using errcode = '42501';
  end if;
  if (new.suspended_at is distinct from old.suspended_at or new.suspended_reason is distinct from old.suspended_reason) and public.is_api_role() then
    raise exception 'No autorizado para cambiar la suspensión' using errcode = '42501';
  end if;
  if public.is_api_role() then
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

/** Suspende (true) o reactiva (false) a un usuario. Soporte, admin y superadmin. Audita en la misma transacción. */
create or replace function public.admin_set_suspended(p_target uuid, p_suspend boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_role public.app_role;
begin
  if not public.has_role(array['support','admin','superadmin']::public.app_role[]) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_target = v_actor then raise exception 'No puedes suspenderte a ti mismo' using errcode = 'P0001'; end if;
  select role into v_role from public.profiles where id = p_target for update;
  if not found then raise exception 'Usuario no encontrado' using errcode = 'P0001'; end if;
  if v_role in ('admin','superadmin') and not public.is_superadmin() then
    raise exception 'Solo un superadmin puede suspender a un admin' using errcode = '42501';
  end if;
  if p_suspend and (p_reason is null or char_length(trim(p_reason)) < 4) then raise exception 'Escribe el motivo de la suspensión' using errcode = 'P0001'; end if;
  update public.profiles
     set suspended_at = case when p_suspend then coalesce(suspended_at, now()) else null end,
         suspended_reason = case when p_suspend then left(p_reason, 300) else null end
   where id = p_target;
  insert into public.audit_log (actor, action, target, meta)
  values (v_actor, case when p_suspend then 'user.suspend' else 'user.unsuspend' end, p_target::text, jsonb_build_object('reason', left(p_reason, 300)));
end $$;
revoke execute on function public.admin_set_suspended(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_suspended(uuid, boolean, text) to authenticated;

-- Publicar y comentar: dueño, con acceso (prueba o plan) y sin suspensión.
drop policy if exists "posts: crear" on public.posts;
create policy "posts: crear" on public.posts for insert
  with check (user_id = auth.uid() and not public.is_suspended() and public.has_app_access());

drop policy if exists "comments: crear" on public.comments;
create policy "comments: crear" on public.comments for insert
  with check (
    user_id = auth.uid() and not public.is_suspended() and public.has_app_access()
    and exists (select 1 from public.posts p where p.id = post_id and public.can_see_post(p.user_id, p.visibility, p.hidden))
  );

-- Coach IA: además del cupo diario, exige prueba vigente o plan.
create or replace function public.coach_consume(p_kind text)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); lim int; used int;
begin
  if uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if not public._has_app_access(uid) then raise exception 'Sin plan activo' using errcode = '42501'; end if;
  lim := case p_kind when 'chat' then 40 when 'feedback' then 20 else null end;
  if lim is null then raise exception 'Tipo inválido' using errcode = '22023'; end if;
  insert into public.coach_usage as cu (user_id, day, kind, n) values (uid, public.cr_today(), p_kind, 1)
  on conflict (user_id, day, kind) do update set n = cu.n + 1 where cu.n < lim
  returning n into used;
  if used is null then return -1; end if;
  return lim - used;
end $$;
revoke execute on function public.coach_consume(text) from public, anon;
grant execute on function public.coach_consume(text) to authenticated;

-- ───────────── 3. Retos: estados, anti-trampa y cupo ─────────────
alter table public.user_challenges drop constraint if exists user_challenges_status_check;
alter table public.user_challenges add constraint user_challenges_status_check
  check (status in ('activo','completado','abandonado','fallido','vencido'));
create index if not exists user_challenges_user_status on public.user_challenges (user_id, status);
create index if not exists challenge_checkins_uc on public.challenge_checkins (user_challenge_id);

/** "Hoy" en algún lugar del mundo (UTC−12 a UTC+14): sin fechas pasadas ni futuras, sea cual sea la zona del usuario. */
create or replace function public._is_today_somewhere(p_day date)
returns boolean language sql stable as $$
  select p_day between (now() at time zone 'Etc/GMT+12')::date and (now() at time zone 'Etc/GMT-14')::date;
$$;

/** Retos del catálogo base (src/lib/challenges.ts) o del panel (challenges_catalog activo). */
create or replace function public.challenge_exists(p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_id in ('banana-30','flexiones-30','plancha-30','pasos-30','proteina-21','agua-21')
      or exists (select 1 from public.challenges_catalog where slug = p_id and active);
$$;

/** ¿Lo marca el usuario a mano? Si el panel lo define, manda su `rules.verify`; si no, el catálogo base. */
create or replace function public.challenge_is_manual(p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select coalesce(rules->>'verify', 'manual') not in ('workout','steps','protein','water') from public.challenges_catalog where slug = p_id and active limit 1),
    p_id in ('flexiones-30','plancha-30'));
$$;

create or replace function public.guard_user_challenge()
returns trigger language plpgsql set search_path = public as $$
declare n int;
begin
  if not public.is_api_role() then return new; end if; -- servidor (service_role) cierra retos y otorga XP
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then raise exception 'No autorizado' using errcode = '42501'; end if;
    if not public.has_app_access() then raise exception 'Sin plan activo' using errcode = '42501'; end if;
    if not public.challenge_exists(new.challenge_id) then raise exception 'Reto inválido' using errcode = '22023'; end if;
    if new.started_on is null or not public._is_today_somewhere(new.started_on) then raise exception 'Fecha de inicio inválida' using errcode = '22023'; end if;
    select count(*) into n from public.user_challenges where user_id = new.user_id and status = 'activo';
    if n >= 3 then raise exception 'Máximo 3 retos a la vez' using errcode = 'P0001'; end if;
    new.status := 'activo'; new.completed_at := null; new.created_at := now();
    return new;
  end if;
  -- UPDATE: el usuario solo puede abandonar un reto activo (nada más cambia).
  if old.status = 'activo' and new.status = 'abandonado'
     and new.user_id = old.user_id and new.challenge_id = old.challenge_id and new.started_on = old.started_on
     and new.completed_at is not distinct from old.completed_at and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'Solo puedes abandonar un reto en curso' using errcode = '42501';
end $$;
drop trigger if exists user_challenges_guard on public.user_challenges;
create trigger user_challenges_guard before insert or update on public.user_challenges for each row execute function public.guard_user_challenge();

drop policy if exists "retos: propios" on public.user_challenges;
drop policy if exists "retos: ver propios" on public.user_challenges;
drop policy if exists "retos: unirse" on public.user_challenges;
drop policy if exists "retos: abandonar" on public.user_challenges;
create policy "retos: ver propios" on public.user_challenges for select using (user_id = auth.uid());
create policy "retos: unirse" on public.user_challenges for insert with check (user_id = auth.uid() and status = 'activo');
create policy "retos: abandonar" on public.user_challenges for update using (user_id = auth.uid() and status = 'activo') with check (user_id = auth.uid() and status = 'abandonado');
revoke delete on public.user_challenges from authenticated, anon;

drop policy if exists "checkins: propios" on public.challenge_checkins;
drop policy if exists "checkins: ver propios" on public.challenge_checkins;
drop policy if exists "checkins: marcar hoy (manual)" on public.challenge_checkins;
create policy "checkins: ver propios" on public.challenge_checkins for select using (user_id = auth.uid());
create policy "checkins: marcar hoy (manual)" on public.challenge_checkins for insert with check (
  user_id = auth.uid()
  and public._is_today_somewhere(day)
  and exists (
    select 1 from public.user_challenges uc
     where uc.id = user_challenge_id and uc.user_id = auth.uid() and uc.status = 'activo'
       and uc.started_on <= day and public.challenge_is_manual(uc.challenge_id)
  )
);
revoke update, delete on public.challenge_checkins from authenticated, anon;
drop policy if exists "checkins: staff lee" on public.challenge_checkins;
create policy "checkins: staff lee" on public.challenge_checkins for select using (public.is_staff());

-- ───────────── 4. Ranking semanal en la semana local ─────────────
create or replace function public.weekly_leaderboard()
returns table (user_id uuid, username text, full_name text, workouts bigint, xp bigint)
language sql stable security definer set search_path = public as $$
  with me as (
    select coalesce((select np.timezone from notification_prefs np where np.user_id = auth.uid() and np.timezone is not null
                       and exists (select 1 from pg_timezone_names z where z.name = np.timezone)), 'America/Costa_Rica') as tz
  ), wk as (
    -- Lunes 00:00 en la zona de quien mira: como fecha (workouts.day es fecha local) y como instante (xp_events.created_at).
    select date_trunc('week', now() at time zone me.tz)::date as d,
           (date_trunc('week', now() at time zone me.tz) at time zone me.tz) as ts
    from me
  ), circle as (select auth.uid() as id union select followee from follows where follower = auth.uid())
  select p.id, p.username, p.full_name,
    (select count(distinct w.day) from workouts w, wk where w.user_id = p.id and w.day >= wk.d),
    (select coalesce(sum(x.xp), 0) from xp_events x, wk where x.user_id = p.id and x.created_at >= wk.ts)
  from profiles p join circle c on c.id = p.id
  where auth.uid() is not null and (p.id = auth.uid() or (p.visibility <> 'privado' and p.share_workouts))
  order by 5 desc limit 50;
$$;
revoke execute on function public.weekly_leaderboard() from public, anon;
grant execute on function public.weekly_leaderboard() to authenticated;

-- ───────────── 5. Perfil público ─────────────
/** Perfil por usuario con contadores. Nada si es privado (salvo el propio). Sin datos de salud. */
create or replace function public.community_profile(p_username text)
returns table (id uuid, username text, full_name text, bio text, visibility text, followers bigint, following bigint, i_follow boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.full_name, p.bio, p.visibility,
    (select count(*) from follows f where f.followee = p.id),
    (select count(*) from follows f where f.follower = p.id),
    exists (select 1 from follows f where f.follower = auth.uid() and f.followee = p.id)
  from profiles p
  where auth.uid() is not null and p.username = lower(p_username) and (p.visibility <> 'privado' or p.id = auth.uid());
$$;
revoke execute on function public.community_profile(text) from public, anon;
grant execute on function public.community_profile(text) to authenticated;

-- ───────────── 6. Interés en relojes ─────────────
create table if not exists public.device_interest (
  user_id uuid not null references auth.users(id) on delete cascade,
  device text not null check (device in ('apple','android','garmin','fitbit','strava','whoop_oura')),
  created_at timestamptz not null default now(),
  primary key (user_id, device)
);
alter table public.device_interest enable row level security;
drop policy if exists "relojes: propios" on public.device_interest;
drop policy if exists "relojes: staff lee" on public.device_interest;
create policy "relojes: propios" on public.device_interest for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "relojes: staff lee" on public.device_interest for select using (public.is_staff());
