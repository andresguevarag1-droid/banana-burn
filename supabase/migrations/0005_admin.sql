-- Banana Burn · Panel de administración v1
-- Tablas de contenido editable, cortesías, moderación y funciones de KPIs.
-- Todas las funciones de staff son SECURITY DEFINER y validan el rol del que llama (auth.uid()).
-- No modifica 0001–0004: solo agrega objetos y reemplaza el guard de privilegios para permitir RPCs de staff.

-- ───────────── Helpers de rol ─────────────
create or replace function public.is_content_editor() returns boolean language sql stable as $$
  select public.has_role(array['coach','admin','superadmin']::public.app_role[]);
$$;
create or replace function public.is_billing_staff() returns boolean language sql stable as $$
  select public.has_role(array['support','admin','superadmin']::public.app_role[]);
$$;
create or replace function public.is_superadmin() returns boolean language sql stable as $$
  select public.has_role(array['superadmin']::public.app_role[]);
$$;
create or replace function public.cr_today() returns date language sql stable as $$
  select (now() at time zone 'America/Costa_Rica')::date;
$$;

-- El guard original solo deja a admin cambiar role/plan. Ahora se aplica únicamente a los roles de la API
-- (authenticated/anon): las funciones SECURITY DEFINER de abajo corren como su dueño, validan el rol del
-- que llama (auth.uid()) por su cuenta y así soporte puede otorgar cortesías sin poder tocar el plan directo.
-- (No usamos un flag de sesión: set_config a nivel de sesión permitiría saltarse el guard.)
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql as $$
begin
  if (new.role is distinct from old.role or new.plan is distinct from old.plan)
     and auth.uid() is not null
     and current_user in ('authenticated', 'anon')
     and not public.is_admin() then
    raise exception 'No autorizado para cambiar rol o plan';
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ───────────── Cortesías (plan regalado con vencimiento) ─────────────
create table if not exists public.comp_grants (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('entreno','completo')),
  previous_plan text,
  reason text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  granted_by uuid references auth.users(id),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);
create index if not exists comp_grants_user_idx on public.comp_grants (user_id, expires_at desc);
alter table public.comp_grants enable row level security;
create policy "cortesías: propia o staff de cuentas" on public.comp_grants
  for select using (user_id = auth.uid() or public.is_billing_staff());
-- Escrituras solo vía admin_grant_comp / admin_revoke_comp / expire_comp_grants.

-- ───────────── Overrides del catálogo de ejercicios ─────────────
create table if not exists public.exercise_overrides (
  exercise_id text primary key check (exercise_id ~ '^[a-z0-9_]{1,40}$'),
  name text check (char_length(name) <= 80),
  cues text[] not null default '{}',
  enabled boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.exercise_overrides enable row level security;
create policy "ejercicios: leer" on public.exercise_overrides for select using (true);
create policy "ejercicios: editores" on public.exercise_overrides for all
  using (public.is_content_editor()) with check (public.is_content_editor());

-- ───────────── Alimentos: columnas extra + coach puede editar ─────────────
alter table public.foods
  add column if not exists slug text,
  add column if not exists grp text,
  add column if not exists updated_at timestamptz not null default now();
create unique index if not exists foods_slug_key on public.foods (slug) where slug is not null;
create policy "alimentos: coach" on public.foods for all
  using (public.has_role(array['coach']::public.app_role[])) with check (public.has_role(array['coach']::public.app_role[]));

-- ───────────── Retos ─────────────
create table if not exists public.challenges_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  title text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 600),
  days int not null check (days between 1 and 365),
  rules jsonb not null default '{}'::jsonb check (jsonb_typeof(rules) = 'object'),
  active boolean not null default false,
  sort int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.challenges_catalog enable row level security;
create policy "retos: leer activos" on public.challenges_catalog for select using (active or public.is_staff());
create policy "retos: editores" on public.challenges_catalog for all
  using (public.is_content_editor()) with check (public.is_content_editor());

-- ───────────── Anuncios / banners ─────────────
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 90),
  body text check (char_length(body) <= 400),
  audience text not null default 'todos' check (audience in ('todos','free','pago','staff')),
  tone text not null default 'banana' check (tone in ('banana','ember','sky','peel')),
  cta_label text check (char_length(cta_label) <= 30),
  cta_href text check (cta_href ~ '^(/|https://)'),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists announcements_live_idx on public.announcements (active, starts_at, ends_at);

create or replace function public.announcement_audience_ok(a text)
returns boolean language sql stable security definer set search_path = public as $$
  select case a
    when 'todos' then true
    when 'staff' then public.is_staff()
    when 'free'  then exists (select 1 from public.profiles where id = auth.uid() and plan = 'free')
    when 'pago'  then exists (select 1 from public.profiles where id = auth.uid() and plan <> 'free')
    else false end;
$$;

alter table public.announcements enable row level security;
create policy "anuncios: vigentes para su audiencia" on public.announcements for select using (
  public.is_staff() or (
    active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
    and public.announcement_audience_ok(audience)
  )
);
create policy "anuncios: admin" on public.announcements for all using (public.is_admin()) with check (public.is_admin());

-- ───────────── Reportes de moderación (genérico: post, comentario, perfil…) ─────────────
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type ~ '^[a-z_]{2,30}$'),
  target_id text not null check (char_length(target_id) <= 64),
  reporter uuid references auth.users(id) on delete set null,
  reason text not null check (reason in ('spam','acoso','contenido_inapropiado','desinformacion_salud','otro')),
  details text check (char_length(details) <= 500),
  excerpt text check (char_length(excerpt) <= 280),   -- copia corta del contenido reportado para el moderador
  status text not null default 'abierto' check (status in ('abierto','resuelto','oculto','descartado')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolution_note text check (char_length(resolution_note) <= 300),
  created_at timestamptz not null default now(),
  unique (reporter, target_type, target_id)
);
create index if not exists reports_queue_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);
alter table public.reports enable row level security;
create policy "reportes: crear propio" on public.reports for insert
  with check (reporter = auth.uid() and status = 'abierto' and resolved_by is null);
create policy "reportes: ver propio o staff" on public.reports for select using (reporter = auth.uid() or public.is_staff());
create policy "reportes: staff modera" on public.reports for update using (public.is_staff()) with check (public.is_staff());

/** La función de comunidad debe filtrar contenido oculto por moderación con esto. */
create or replace function public.is_hidden(p_type text, p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.reports where target_type = p_type and target_id = p_id and status = 'oculto');
$$;

-- ───────────── Auditoría: índices para el visor ─────────────
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_action_idx on public.audit_log (action, created_at desc);
create index if not exists audit_log_target_idx on public.audit_log (target);

-- ───────────── Mutaciones de staff (validan rol + auditan en la misma transacción) ─────────────
create or replace function public.admin_set_role(p_target uuid, p_role public.app_role, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_old public.app_role;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_target = v_actor then raise exception 'No puedes cambiar tu propio rol'; end if;
  select role into v_old from public.profiles where id = p_target for update;
  if not found then raise exception 'Usuario no encontrado'; end if;
  if v_old = p_role then return; end if;
  if (p_role in ('admin','superadmin') or v_old in ('admin','superadmin')) and not public.is_superadmin() then
    raise exception 'Solo un superadmin puede otorgar o quitar roles admin/superadmin' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_target;
  insert into public.audit_log (actor, action, target, meta)
  values (v_actor, 'user.role_change', p_target::text, jsonb_build_object('from', v_old, 'to', p_role, 'reason', left(p_reason, 300)));
end $$;

create or replace function public.admin_grant_comp(p_target uuid, p_plan text, p_expires timestamptz, p_reason text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_prev text; v_id bigint;
begin
  if not public.is_billing_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_plan not in ('entreno','completo') then raise exception 'Plan inválido'; end if;
  if p_expires <= now() or p_expires > now() + interval '366 days' then raise exception 'Vencimiento fuera de rango (máx. 1 año)'; end if;
  select plan into v_prev from public.profiles where id = p_target for update;
  if not found then raise exception 'Usuario no encontrado'; end if;
  -- Una cortesía vigente a la vez: la anterior se revoca.
  update public.comp_grants set revoked_at = now(), revoked_by = v_actor
   where user_id = p_target and revoked_at is null and expires_at > now();
  insert into public.comp_grants (user_id, plan, previous_plan, reason, expires_at, granted_by)
  values (p_target, p_plan, v_prev, left(p_reason, 300), p_expires, v_actor) returning id into v_id;
  update public.profiles set plan = p_plan where id = p_target;
  insert into public.audit_log (actor, action, target, meta)
  values (v_actor, 'user.comp_grant', p_target::text, jsonb_build_object('grant', v_id, 'plan', p_plan, 'previous_plan', v_prev, 'expires_at', p_expires, 'reason', left(p_reason, 300)));
  return v_id;
end $$;

-- Restaura el plan que tenía antes (o el de una suscripción activa) al revocar/expirar.
create or replace function public._restore_plan_after_comp(p_user uuid, p_prev text)
returns text language plpgsql security definer set search_path = public as $$
declare v_plan text;
begin
  select coalesce(p_prev, 'free') into v_plan;
  if v_plan not in ('free','entreno','completo','pro') then v_plan := 'free'; end if;
  update public.profiles set plan = v_plan where id = p_user;
  return v_plan;
end $$;
revoke all on function public._restore_plan_after_comp(uuid, text) from public, anon, authenticated;

create or replace function public.admin_revoke_comp(p_grant bigint, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); g public.comp_grants; v_plan text;
begin
  if not public.is_billing_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into g from public.comp_grants where id = p_grant for update;
  if not found or g.revoked_at is not null then raise exception 'Cortesía no encontrada o ya revocada'; end if;
  update public.comp_grants set revoked_at = now(), revoked_by = v_actor where id = p_grant;
  v_plan := public._restore_plan_after_comp(g.user_id, g.previous_plan);
  insert into public.audit_log (actor, action, target, meta)
  values (v_actor, 'user.comp_revoke', g.user_id::text, jsonb_build_object('grant', p_grant, 'restored_plan', v_plan, 'reason', left(p_reason, 300)));
end $$;

/** Programar a diario (pg_cron o Vercel Cron con service_role): devuelve cuántas cortesías expiró. */
create or replace function public.expire_comp_grants()
returns int language plpgsql security definer set search_path = public as $$
declare g record; n int := 0;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  for g in select * from public.comp_grants where revoked_at is null and expires_at <= now() and
             not exists (select 1 from public.comp_grants g2 where g2.user_id = comp_grants.user_id and g2.revoked_at is null and g2.expires_at > now())
  loop
    update public.comp_grants set revoked_at = now() where id = g.id;
    perform public._restore_plan_after_comp(g.user_id, g.previous_plan);
    insert into public.audit_log (actor, action, target, meta)
    values (auth.uid(), 'user.comp_expire', g.user_id::text, jsonb_build_object('grant', g.id));
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.admin_reset_onboarding(p_target uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid();
begin
  if not public.is_billing_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.profiles set onboarded = false where id = p_target;
  if not found then raise exception 'Usuario no encontrado'; end if;
  insert into public.audit_log (actor, action, target, meta)
  values (v_actor, 'user.onboarding_reset', p_target::text, jsonb_build_object('reason', left(p_reason, 300)));
end $$;

-- ───────────── Lecturas agregadas para KPIs ─────────────
-- Días con actividad (entreno, pesaje, registro diario o comida). Interna: solo la usan otras funciones definer.
create or replace function public._activity_days(p_from date)
returns table (user_id uuid, day date) language sql stable security definer set search_path = public as $$
  select user_id, day from public.workouts   where day >= p_from
  union select user_id, day from public.weights    where day >= p_from
  union select user_id, day from public.daily_logs where day >= p_from
  union select user_id, day from public.meals      where day >= p_from;
$$;
revoke all on function public._activity_days(date) from public, anon, authenticated;

create or replace function public.admin_kpis()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t date := public.cr_today(); r jsonb;
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  with p as (select id, onboarded, (created_at at time zone 'America/Costa_Rica')::date d from public.profiles),
       a as (select * from public._activity_days(t - 29))
  select jsonb_build_object(
    'today', t,
    'users_total', (select count(*) from p),
    'onboarded',   (select count(*) from p where onboarded),
    'new_7',       (select count(*) from p where d > t - 7),
    'new_prev_7',  (select count(*) from p where d <= t - 7 and d > t - 14),
    'new_30',      (select count(*) from p where d > t - 30),
    'active_today',(select count(distinct user_id) from a where day = t),
    'active_7',    (select count(distinct user_id) from a where day > t - 7),
    'active_30',   (select count(distinct user_id) from a),
    'paying',      (select count(distinct user_id) from public.subscriptions where status in ('active','past_due')),
    'comps_active',(select count(*) from public.comp_grants where revoked_at is null and expires_at > now()),
    'workouts_today', (select count(*) from public.workouts where day = t),
    'workouts_7',  (select count(*) from public.workouts where day > t - 7)
  ) into r;
  return r;
end $$;

create or replace function public.admin_series(p_days int default 30)
returns table (day date, signups int, workouts int, active int)
language plpgsql stable security definer set search_path = public as $$
declare t date := public.cr_today(); n int := least(greatest(coalesce(p_days, 30), 7), 180);
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query
  with days as (select generate_series(t - (n - 1), t, interval '1 day')::date d),
       a as (select * from public._activity_days(t - (n - 1)))
  select days.d,
    (select count(*)::int from public.profiles p where (p.created_at at time zone 'America/Costa_Rica')::date = days.d),
    (select count(*)::int from public.workouts w where w.day = days.d),
    (select count(distinct a.user_id)::int from a where a.day = days.d)
  from days order by days.d;
end $$;

-- Ventanas iguales a src/lib/admin-kpis.ts: D1 = día 1; D7 = días 7–13; D30 = días 30–36. Solo cuentan usuarios con ventana cerrada.
create or replace function public.admin_retention(p_weeks int default 8)
returns table (cohort date, size int, d1 int, d1_eligible int, d7 int, d7_eligible int, d30 int, d30_eligible int)
language plpgsql stable security definer set search_path = public as $$
declare t date := public.cr_today(); w int := least(greatest(coalesce(p_weeks, 8), 1), 26);
        first_week date := date_trunc('week', t)::date - 7 * (w - 1);
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query
  with u as (
    select p.id, (p.created_at at time zone 'America/Costa_Rica')::date s from public.profiles p
    where (p.created_at at time zone 'America/Costa_Rica')::date >= first_week
  ), a as (select * from public._activity_days(first_week)),
  f as (
    select u.id, u.s,
      exists (select 1 from a where a.user_id = u.id and a.day = u.s + 1) r1,
      exists (select 1 from a where a.user_id = u.id and a.day between u.s + 7 and u.s + 13) r7,
      exists (select 1 from a where a.user_id = u.id and a.day between u.s + 30 and u.s + 36) r30
    from u
  )
  select date_trunc('week', f.s)::date, count(*)::int,
    count(*) filter (where f.s + 1 <= t and r1)::int,  count(*) filter (where f.s + 1 <= t)::int,
    count(*) filter (where f.s + 13 <= t and r7)::int, count(*) filter (where f.s + 13 <= t)::int,
    count(*) filter (where f.s + 36 <= t and r30)::int, count(*) filter (where f.s + 36 <= t)::int
  from f group by 1 order by 1 desc;
end $$;

-- Lista de usuarios con correo (auth.users) y última actividad. Filtros: texto, plan, rol, estado, rango de alta.
create or replace function public.admin_list_users(
  p_q text default null, p_plan text default null, p_role text default null, p_status text default null,
  p_from date default null, p_to date default null, p_limit int default 25, p_offset int default 0)
returns table (id uuid, full_name text, email text, role public.app_role, plan text, onboarded boolean,
               created_at timestamptz, last_active date, comp_until timestamptz, total bigint)
language plpgsql stable security definer set search_path = public as $$
declare t date := public.cr_today();
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query
  with base as (
    select p.id, p.full_name, u.email::text, p.role, p.plan, p.onboarded, p.created_at,
      greatest(
        (select max(w.day) from public.workouts w where w.user_id = p.id),
        (select max(x.day) from public.weights x where x.user_id = p.id),
        (select max(l.day) from public.daily_logs l where l.user_id = p.id),
        (select max(m.day) from public.meals m where m.user_id = p.id)
      ) last_active,
      (select max(g.expires_at) from public.comp_grants g where g.user_id = p.id and g.revoked_at is null and g.expires_at > now()) comp_until
    from public.profiles p left join auth.users u on u.id = p.id
    where (p_q is null or p_q = '' or p.full_name ilike '%' || p_q || '%' or u.email ilike '%' || p_q || '%' or p.id::text = p_q)
      and (p_plan is null or p_plan = '' or p.plan = p_plan)
      and (p_role is null or p_role = '' or p.role::text = p_role)
      and (p_from is null or (p.created_at at time zone 'America/Costa_Rica')::date >= p_from)
      and (p_to is null or (p.created_at at time zone 'America/Costa_Rica')::date <= p_to)
  ), filtered as (
    select * from base b where
      p_status is null or p_status = '' or
      (p_status = 'activo' and b.last_active > t - 7) or
      (p_status = 'inactivo' and b.onboarded and (b.last_active is null or b.last_active <= t - 7)) or
      (p_status = 'pendiente' and not b.onboarded) or
      (p_status = 'cortesia' and b.comp_until is not null)
  )
  select f.*, count(*) over () from filtered f
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;

create or replace function public.admin_user_account(p_target uuid)
returns table (email text, last_sign_in_at timestamptz, last_active date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query select u.email::text, u.last_sign_in_at,
    (select max(day) from public._activity_days('2000-01-01') a where a.user_id = p_target)
  from auth.users u where u.id = p_target;
end $$;

-- Las funciones de staff no se exponen a anon. (authenticated sí: cada una valida el rol adentro.)
revoke execute on function public.admin_set_role(uuid, public.app_role, text) from public, anon;
revoke execute on function public.admin_grant_comp(uuid, text, timestamptz, text) from public, anon;
revoke execute on function public.admin_revoke_comp(bigint, text) from public, anon;
revoke execute on function public.admin_reset_onboarding(uuid, text) from public, anon;
revoke execute on function public.expire_comp_grants() from public, anon;
revoke execute on function public.admin_kpis() from public, anon;
revoke execute on function public.admin_series(int) from public, anon;
revoke execute on function public.admin_retention(int) from public, anon;
revoke execute on function public.admin_list_users(text, text, text, text, date, date, int, int) from public, anon;
revoke execute on function public.admin_user_account(uuid) from public, anon;
grant execute on function public.admin_set_role(uuid, public.app_role, text) to authenticated;
grant execute on function public.admin_grant_comp(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.admin_revoke_comp(bigint, text) to authenticated;
grant execute on function public.admin_reset_onboarding(uuid, text) to authenticated;
grant execute on function public.expire_comp_grants() to authenticated, service_role;
grant execute on function public.admin_kpis() to authenticated;
grant execute on function public.admin_series(int) to authenticated;
grant execute on function public.admin_retention(int) to authenticated;
grant execute on function public.admin_list_users(text, text, text, text, date, date, int, int) to authenticated;
grant execute on function public.admin_user_account(uuid) to authenticated;
