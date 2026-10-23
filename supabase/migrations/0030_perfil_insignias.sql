-- Banana Burn, 0030: perfil con poder, insignias en la comunidad y verificación de identidad.
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0027.
-- Qué hace:
--   1. Poder del perfil (niveles de perfil Semilla, Racimo, Cosecha, Platanal y Banana de oro). Se calcula SOLO con datos
--      reales de la base: programas Premium que tienes, programas y retos Premium completados (certificados), retos
--      gratis completados (medallas), nivel por XP, mejor racha y verificación. La regla vive en _power_points/_power_tier
--      y la repite src/lib/profile-power.ts (probada en profile-power.test.ts). profile_flair guarda el resultado para
--      que la comunidad lo lea rápido; lo actualizan triggers en compras, programas, retos, XP y verificación, y
--      avisa (campanita) cuando subes de nivel de perfil.
--   2. Insignias: lo que la persona ganó (certificados, medallas, nivel, racha, verificado, colección, récord, entrenos).
--      set_featured_badge() solo deja destacar una insignia ganada (se valida aquí, no en el cliente).
--   3. Comunidad: community_flair(ids) devuelve nivel de perfil, insignia destacada y verificado para las insignias
--      junto al nombre, con la misma regla de visibilidad de community_levels (0019). community_profile_power(usuario)
--      arma la vitrina de un perfil con la regla de community_profile_stats (0019). La racha solo la ves tú.
--   4. Verificación de identidad (Ley 8968): identity_verifications guarda SOLO tipo de documento, país, últimos 3
--      caracteres, estado, quién revisó, fechas y motivo de rechazo. Nunca el número completo. El nombre como aparece en
--      el documento se guarda solo mientras está en revisión. Las fotos van a un bucket PRIVADO ('identidad') y se
--      borran al decidir (y como respaldo, el cron borra todo lo vencido: máximo 30 días). Nadie escribe directo en la
--      tabla: identity_submit / identity_withdraw (la persona) y admin_identity_* (soporte y admin, auditadas).

-- ───────────── Ayudas: nivel por XP y mejor racha ─────────────
/** Nivel (1 a 8) por XP total. Igual que LEVELS en src/lib/gamify.ts. */
create or replace function public._level_idx(p_xp bigint)
returns int language sql immutable as $$
  select case when p_xp >= 12000 then 8 when p_xp >= 8000 then 7 when p_xp >= 5000 then 6 when p_xp >= 3000 then 5
              when p_xp >= 1600 then 4 when p_xp >= 800 then 3 when p_xp >= 300 then 2 else 1 end;
$$;

/** Mejor racha (días seguidos con entreno, registro diario o pesaje) del último año y algo. Igual regla que la racha de Hoy. */
create or replace function public._best_streak(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  with d as (
    select day from public.workouts where user_id = p_user and day >= current_date - 400
    union select day from public.daily_logs where user_id = p_user and day >= current_date - 400
    union select day from public.weights where user_id = p_user and day >= current_date - 400
  ), g as (select day - (row_number() over (order by day))::int as grp from d)
  select coalesce(max(n), 0)::int from (select count(*) as n from g group by grp) x;
$$;
revoke all on function public._best_streak(uuid) from public, anon, authenticated;

-- ───────────── 4a. Verificación de identidad (la tabla va antes: el poder del perfil la lee) ─────────────
create table if not exists public.identity_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada')),
  doc_type text not null check (doc_type in ('cedula_cr', 'dimex', 'pasaporte', 'documento_nacional')),
  country text not null check (country ~ '^[A-Z]{2}$'),
  -- Solo los últimos 3 caracteres: sirven para que quien revisa compare con la foto. Nunca el número completo.
  last3 text check (last3 is null or last3 ~ '^[0-9A-Z]{3}$'),
  -- Nombre como aparece en el documento: solo mientras está en revisión (se borra al decidir).
  full_name text check (full_name is null or char_length(full_name) between 4 and 120),
  front_path text check (front_path is null or front_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}$'),
  selfie_path text check (selfie_path is null or selfie_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}$'),
  consent_version text not null check (char_length(consent_version) between 1 and 20),
  consent_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  attempts smallint not null default 1 check (attempts between 0 and 100),
  attempts_day date not null default current_date,
  reviewed_at timestamptz,
  reviewer uuid references auth.users(id) on delete set null,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) between 4 and 300),
  files_deleted_at timestamptz,
  -- Cuándo se deben borrar las fotos a más tardar: 30 días desde el envío; al decidir, de inmediato.
  purge_after timestamptz not null default now() + interval '30 days',
  updated_at timestamptz not null default now(),
  check (status = 'pendiente' or reviewed_at is not null),
  check (doc_type not in ('cedula_cr', 'dimex') or country = 'CR'),
  check (front_path is null or split_part(front_path, '/', 1) = user_id::text),
  check (selfie_path is null or split_part(selfie_path, '/', 1) = user_id::text),
  check (status <> 'rechazada' or rejection_reason is not null)
);
create index if not exists identity_verifications_queue on public.identity_verifications (status, submitted_at);
create index if not exists identity_verifications_purge on public.identity_verifications (purge_after) where files_deleted_at is null;
alter table public.identity_verifications enable row level security;
drop policy if exists "identidad: propia lee" on public.identity_verifications;
-- Solo la propia fila. El staff NO lee la tabla directo: usa las funciones admin_identity_* (validan rol y auditan).
create policy "identidad: propia lee" on public.identity_verifications for select using (user_id = auth.uid());
revoke insert, update, delete on public.identity_verifications from anon, authenticated;
revoke all on public.identity_verifications from anon;

create or replace function public._is_verified(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.identity_verifications where user_id = p_user and status = 'aprobada');
$$;
revoke all on function public._is_verified(uuid) from public, anon, authenticated;

-- Bucket PRIVADO para las fotos del documento. Cada persona sube solo a su carpeta {uid}/archivo, sin subcarpetas.
-- Puede leer y borrar lo propio (para retirar un envío); nadie lee lo ajeno. Soporte ve las fotos solo con enlaces
-- firmados de 60 segundos que genera el servidor (service_role) después de admin_identity_files (auditada).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identidad', 'identidad', false, 6291456, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "identidad: subir propio" on storage.objects;
drop policy if exists "identidad: leer propio" on storage.objects;
drop policy if exists "identidad: borrar propio" on storage.objects;
create policy "identidad: subir propio" on storage.objects for insert to authenticated
  with check (bucket_id = 'identidad' and auth.uid() is not null and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}$'));
create policy "identidad: leer propio" on storage.objects for select to authenticated
  using (bucket_id = 'identidad' and auth.uid() is not null and split_part(name, '/', 1) = auth.uid()::text);
create policy "identidad: borrar propio" on storage.objects for delete to authenticated
  using (bucket_id = 'identidad' and auth.uid() is not null and split_part(name, '/', 1) = auth.uid()::text);

-- ───────────── 1. Poder del perfil ─────────────
create table if not exists public.profile_flair (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier smallint not null default 1 check (tier between 1 and 5),
  points int not null default 0 check (points >= 0),
  -- Insignia que la persona destaca junto a su nombre (validada con set_featured_badge).
  featured text check (featured is null or featured ~ '^[a-z0-9][a-z0-9:._-]{0,79}$'),
  -- Nivel de perfil más alto ya avisado (no se repite el aviso si baja y vuelve a subir).
  tier_notified smallint not null default 1 check (tier_notified between 1 and 5),
  updated_at timestamptz not null default now()
);
alter table public.profile_flair enable row level security;
drop policy if exists "insignias: propias o staff" on public.profile_flair;
create policy "insignias: propias o staff" on public.profile_flair for select using (user_id = auth.uid() or public.is_staff());
revoke insert, update, delete on public.profile_flair from anon, authenticated; -- solo set_featured_badge y _power_refresh

/**
 * Datos reales que mueven el poder del perfil:
 *  premium_owned: programas o retos Premium que tienes (compra o cortesía).
 *  certs: programas completados (todos) más retos Premium completados (certificados), sin repetir.
 *  retos_done: retos gratis completados (medallas), sin repetir.
 */
create or replace function public._power_stats(p_user uuid)
returns table (premium_owned int, certs int, retos_done int, total_xp bigint, level_idx int, best_streak int, verified boolean)
language sql stable security definer set search_path = public as $$
  with xp as (select coalesce(sum(x.xp), 0)::bigint as t from public.xp_events x where x.user_id = p_user)
  select
    (select count(distinct e.challenge_slug) from public.challenge_entitlements e where e.user_id = p_user)::int,
    (select count(*) from (
      select up.slug from public.user_programs up where up.user_id = p_user and up.status = 'completado'
      union
      select uc.challenge_id from public.user_challenges uc join public.challenges_catalog c on c.slug = uc.challenge_id
       where uc.user_id = p_user and uc.status = 'completado' and c.price_usd > 0) s)::int,
    (select count(distinct uc.challenge_id) from public.user_challenges uc
      where uc.user_id = p_user and uc.status = 'completado'
        and not exists (select 1 from public.challenges_catalog c where c.slug = uc.challenge_id and c.price_usd > 0))::int,
    xp.t, public._level_idx(xp.t), public._best_streak(p_user), public._is_verified(p_user)
  from xp;
$$;
revoke all on function public._power_stats(uuid) from public, anon, authenticated;

/** Puntos de perfil. Igual que pointsFor() en src/lib/profile-power.ts. */
create or replace function public._power_points(p_owned int, p_certs int, p_retos int, p_level int, p_streak int, p_verified boolean)
returns int language sql immutable as $$
  select greatest(0, coalesce(p_owned, 0)) * 20 + greatest(0, coalesce(p_certs, 0)) * 25 + least(10, greatest(0, coalesce(p_retos, 0))) * 5
       + (least(8, greatest(1, coalesce(p_level, 1))) - 1) * 5
       + case when coalesce(p_streak, 0) >= 30 then 15 when coalesce(p_streak, 0) >= 7 then 5 else 0 end
       + case when p_verified then 10 else 0 end;
$$;

/** Nivel de perfil por puntos: 1 Semilla, 2 Racimo (30), 3 Cosecha (80), 4 Platanal (150), 5 Banana de oro (250). */
create or replace function public._power_tier(p_points int)
returns int language sql immutable as $$
  select case when p_points >= 250 then 5 when p_points >= 150 then 4 when p_points >= 80 then 3 when p_points >= 30 then 2 else 1 end;
$$;

/** Insignias ganadas (id, nombre del catálogo si aplica, ícono, portada, tipo, fecha). La racha solo cuenta para ti. */
create or replace function public._insignias(p_user uuid)
returns table (id text, label text, detail text, icon text, cover text, kind text, earned_at timestamptz)
language sql stable security definer set search_path = public as $$
  with st as (select * from public._power_stats(p_user)),
  wk as (select count(*) as n from public.workouts where user_id = p_user)
  select 'prog:' || c.slug, coalesce(nullif(c.reward_title, ''), c.badge), c.title, c.icon, c.cover, 'certificado', up.completed_at
    from public.user_programs up join public.challenges_catalog c on c.slug = up.slug
   where up.user_id = p_user and up.status = 'completado'
  union all
  select distinct on (c.slug) 'reto:' || c.slug, c.badge, c.title, c.icon, c.cover, case when c.price_usd > 0 then 'certificado' else 'medalla' end, uc.completed_at
    from public.user_challenges uc join public.challenges_catalog c on c.slug = uc.challenge_id
   where uc.user_id = p_user and uc.status = 'completado'
     and not exists (select 1 from public.user_programs up where up.user_id = p_user and up.slug = c.slug and up.status = 'completado')
  union all select 'nivel', null, null, null, null, 'nivel', null from st
  union all select 'racha7', null, null, null, null, 'racha', null from st where st.best_streak >= 7
  union all select 'racha30', null, null, null, null, 'racha', null from st where st.best_streak >= 30
  union all select 'verificado', null, null, null, null, 'verificado', (select reviewed_at from public.identity_verifications where user_id = p_user) from st where st.verified
  union all select 'coleccion', null, null, null, null, 'coleccion', null from st where st.premium_owned >= 3
  union all select 'pr', null, null, null, null, 'logro', null where exists (select 1 from public.xp_events where user_id = p_user and kind = 'pr')
  union all select 'w10', null, null, null, null, 'logro', null from wk where wk.n >= 10
  union all select 'w50', null, null, null, null, 'logro', null from wk where wk.n >= 50;
$$;
revoke all on function public._insignias(uuid) from public, anon, authenticated;

/**
 * Recalcula y guarda el poder del perfil. Si subió a un nivel que no se había avisado, deja un aviso en la campanita.
 * Si la insignia destacada ya no está ganada (p. ej. retiró su verificación), se quita. Devuelve el nivel de perfil.
 */
create or replace function public._power_refresh(p_user uuid, p_notify boolean default true)
returns int language plpgsql security definer set search_path = public as $$
declare s record; v_points int; v_tier int; cur public.profile_flair%rowtype;
  names text[] := array['Semilla', 'Racimo', 'Cosecha', 'Platanal', 'Banana de oro'];
begin
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then return 1; end if;
  select * into s from public._power_stats(p_user);
  v_points := public._power_points(s.premium_owned, s.certs, s.retos_done, s.level_idx, s.best_streak, s.verified);
  v_tier := public._power_tier(v_points);
  select * into cur from public.profile_flair where user_id = p_user for update;
  if cur.user_id is null then
    insert into public.profile_flair (user_id, tier, points, tier_notified) values (p_user, v_tier, v_points, case when p_notify then 1 else v_tier end)
    on conflict (user_id) do nothing;
    select * into cur from public.profile_flair where user_id = p_user for update;
  end if;
  update public.profile_flair set tier = v_tier, points = v_points, updated_at = now(),
         featured = case when featured is null or exists (select 1 from public._insignias(p_user) i where i.id = featured) then featured else null end
   where user_id = p_user;
  if v_tier > cur.tier_notified then
    update public.profile_flair set tier_notified = v_tier where user_id = p_user;
    if p_notify then
      insert into public.notifications (user_id, kind, title, body, url)
      values (p_user, 'perfil_nivel', 'Tu perfil subió a ' || names[v_tier],
              'Tu perfil ahora se ve como ' || names[v_tier] || ' en la comunidad. Mira lo que desbloqueaste.', '/app/perfil#poder');
    end if;
  end if;
  return v_tier;
end $$;
revoke all on function public._power_refresh(uuid, boolean) from public, anon, authenticated;

/** Trigger: recalcula el poder sin bloquear nunca la escritura que lo dispara. */
create or replace function public._power_touch()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if tg_op = 'DELETE' then v_uid := old.user_id; else v_uid := new.user_id; end if;
  begin
    perform public._power_refresh(v_uid, true);
  exception when others then null; -- el poder del perfil nunca rompe una compra, un entreno ni un reto
  end;
  return null;
end $$;
revoke all on function public._power_touch() from public, anon, authenticated;

drop trigger if exists power_entitlements on public.challenge_entitlements;
create trigger power_entitlements after insert or delete on public.challenge_entitlements for each row execute function public._power_touch();
drop trigger if exists power_programs on public.user_programs;
create trigger power_programs after insert or update of status on public.user_programs for each row execute function public._power_touch();
drop trigger if exists power_challenges on public.user_challenges;
create trigger power_challenges after update of status on public.user_challenges for each row when (new.status = 'completado' or old.status = 'completado') execute function public._power_touch();
drop trigger if exists power_xp on public.xp_events;
create trigger power_xp after insert on public.xp_events for each row execute function public._power_touch();
drop trigger if exists power_identity on public.identity_verifications;
create trigger power_identity after insert or update of status or delete on public.identity_verifications for each row execute function public._power_touch();

/** Vitrina: programas y retos Premium que tiene o completó, con su portada. */
create or replace function public._showcase(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.done_at desc nulls last, x.sort), '[]'::jsonb) from (
    select c.slug, c.title, c.icon, c.cover, c.kind, c.badge, c.reward_title, c.sort,
           exists (select 1 from public.challenge_entitlements e where e.user_id = p_user and e.challenge_slug = c.slug) as owned,
           coalesce((select max(up.completed_at) from public.user_programs up where up.user_id = p_user and up.slug = c.slug and up.status = 'completado'),
                    (select max(uc.completed_at) from public.user_challenges uc where uc.user_id = p_user and uc.challenge_id = c.slug and uc.status = 'completado' and c.price_usd > 0)) as done_at
      from public.challenges_catalog c
     where c.slug in (select e.challenge_slug from public.challenge_entitlements e where e.user_id = p_user
                      union select up.slug from public.user_programs up where up.user_id = p_user and up.status = 'completado')
     limit 24
  ) x;
$$;
revoke all on function public._showcase(uuid) from public, anon, authenticated;

/** Destaca una insignia ganada (o ninguna con null). Validada aquí: el cliente no decide qué ganaste. */
create or replace function public.set_featured_badge(p_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_id is not null and (p_id !~ '^[a-z0-9][a-z0-9:._-]{0,79}$' or not exists (select 1 from public._insignias(v_uid) i where i.id = p_id)) then
    raise exception 'Esa insignia todavía no es tuya' using errcode = '42501';
  end if;
  -- La racha solo la ves tú (igual que en el perfil): no se puede mostrar junto a tu nombre.
  if p_id like 'racha%' then raise exception 'La racha solo la ves tú' using errcode = '42501'; end if;
  perform public._power_refresh(v_uid, false);
  update public.profile_flair set featured = p_id, updated_at = now() where user_id = v_uid;
end $$;
revoke execute on function public.set_featured_badge(text) from public, anon;
grant execute on function public.set_featured_badge(text) to authenticated;

-- ───────────── 3. Comunidad ─────────────
/**
 * Insignias junto al nombre para una lista de personas (máx. 100). Verificado: siempre (es una señal de confianza que la
 * persona aceptó mostrar al verificarse). Nivel de perfil, XP e insignia destacada: solo con la regla de community_levels
 * (eres tú, o su perfil no es privado y comparte sus entrenos).
 */
drop function if exists public.community_flair(uuid[]);
create function public.community_flair(p_ids uuid[])
returns table (user_id uuid, verified boolean, tier int, total_xp bigint, featured text, featured_label text, featured_icon text, featured_cover text)
language sql stable security definer set search_path = public as $$
  select p.id, public._is_verified(p.id),
    case when vis.ok then coalesce(f.tier, 1)::int end,
    case when vis.ok then (select coalesce(sum(x.xp), 0) from public.xp_events x where x.user_id = p.id)::bigint end,
    case when vis.ok then f.featured end,
    case when vis.ok and (f.featured like 'prog:%' or f.featured like 'reto:%') then
      (select coalesce(case when f.featured like 'prog:%' then nullif(c.reward_title, '') end, c.badge) from public.challenges_catalog c where c.slug = split_part(f.featured, ':', 2)) end,
    case when vis.ok and (f.featured like 'prog:%' or f.featured like 'reto:%') then (select c.icon from public.challenges_catalog c where c.slug = split_part(f.featured, ':', 2)) end,
    case when vis.ok and (f.featured like 'prog:%' or f.featured like 'reto:%') then (select c.cover from public.challenges_catalog c where c.slug = split_part(f.featured, ':', 2)) end
  from public.profiles p
  left join public.profile_flair f on f.user_id = p.id
  cross join lateral (select (p.id = auth.uid() or (p.visibility <> 'privado' and p.share_workouts)) as ok) vis
  where auth.uid() is not null and p.id = any (p_ids[1:100]);
$$;
revoke execute on function public.community_flair(uuid[]) from public, anon;
grant execute on function public.community_flair(uuid[]) to authenticated;

/**
 * Poder y vitrina de un perfil que puedes ver (regla de community_profile_stats: eres tú, o comparte sus entrenos y es
 * público, o lo sigues y es para seguidores). Sin acceso: solo si está verificado. La racha y sus insignias, solo tuyas.
 */
drop function if exists public.community_profile_power(uuid);
create function public.community_profile_power(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me boolean := p_user = auth.uid(); ok boolean; s record; f public.profile_flair%rowtype; v_points int;
begin
  if auth.uid() is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  select me or (p.share_workouts and p.suspended_at is null and (p.visibility = 'publico'
           or (p.visibility = 'seguidores' and exists (select 1 from public.follows fo where fo.follower = auth.uid() and fo.followee = p.id))))
    into ok from public.profiles p where p.id = p_user;
  if ok is null then return null; end if;
  if not ok then return jsonb_build_object('visible', false, 'verified', public._is_verified(p_user)); end if;
  select * into s from public._power_stats(p_user);
  select * into f from public.profile_flair where user_id = p_user;
  -- La racha no se muestra a otros: los puntos públicos se calculan igual (el nivel de perfil es uno solo).
  v_points := public._power_points(s.premium_owned, s.certs, s.retos_done, s.level_idx, s.best_streak, s.verified);
  return jsonb_build_object(
    'visible', true, 'premium_owned', s.premium_owned, 'certs', s.certs, 'retos_done', s.retos_done, 'total_xp', s.total_xp,
    'level_idx', s.level_idx, 'best_streak', case when me then s.best_streak end, 'verified', s.verified,
    'points', v_points, 'tier', public._power_tier(v_points), 'featured', f.featured,
    'insignias', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'label', i.label, 'detail', i.detail, 'icon', i.icon, 'cover', i.cover, 'kind', i.kind, 'at', i.earned_at))
                             from public._insignias(p_user) i where me or i.kind <> 'racha'), '[]'::jsonb),
    'showcase', public._showcase(p_user));
end $$;
revoke execute on function public.community_profile_power(uuid) from public, anon;
grant execute on function public.community_profile_power(uuid) to authenticated;

-- ───────────── 4b. Verificación: funciones ─────────────
/**
 * Envía (o reenvía tras un rechazo) la verificación. Las fotos ya deben estar en el bucket 'identidad' dentro de tu
 * carpeta. Máximo 3 envíos por día (además del límite del servidor con rate_hit). No acepta números completos.
 */
create or replace function public.identity_submit(p_doc_type text, p_country text, p_last3 text, p_full_name text, p_front text, p_selfie text, p_consent_version text)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); cur public.identity_verifications%rowtype; v_name text; v_last3 text; v_country text;
  re text;
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_doc_type is null or p_doc_type not in ('cedula_cr', 'dimex', 'pasaporte', 'documento_nacional') then raise exception 'Tipo de documento inválido' using errcode = '22023'; end if;
  v_country := upper(coalesce(p_country, ''));
  if v_country !~ '^[A-Z]{2}$' then raise exception 'País inválido' using errcode = '22023'; end if;
  if p_doc_type in ('cedula_cr', 'dimex') and v_country <> 'CR' then raise exception 'Ese documento es de Costa Rica' using errcode = '22023'; end if;
  v_last3 := upper(coalesce(p_last3, ''));
  if v_last3 !~ '^[0-9A-Z]{3}$' or (p_doc_type in ('cedula_cr', 'dimex') and v_last3 !~ '^[0-9]{3}$') then raise exception 'Escribe solo los últimos 3 caracteres' using errcode = '22023'; end if;
  v_name := btrim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  if char_length(v_name) not between 4 and 120 or v_name ~ '[0-9@]' then raise exception 'Nombre inválido' using errcode = '22023'; end if;
  if p_consent_version is null or char_length(p_consent_version) not between 1 and 20 then raise exception 'Falta tu consentimiento' using errcode = '22023'; end if;
  re := '^' || v_uid::text || '/[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}$';
  if p_front is null or p_selfie is null or p_front !~ re or p_selfie !~ re or p_front = p_selfie then raise exception 'Fotos inválidas' using errcode = '22023'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'identidad' and o.name = p_front)
     or not exists (select 1 from storage.objects o where o.bucket_id = 'identidad' and o.name = p_selfie) then
    raise exception 'No encontramos tus fotos. Súbelas de nuevo.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('bb:identidad:' || v_uid::text, 0));
  select * into cur from public.identity_verifications where user_id = v_uid for update;
  if cur.user_id is not null then
    if cur.status = 'pendiente' then raise exception 'Ya tienes una verificación en revisión' using errcode = 'P0001'; end if;
    if cur.status = 'aprobada' then raise exception 'Tu identidad ya está verificada' using errcode = 'P0001'; end if;
    if cur.attempts_day = current_date and cur.attempts >= 3 then raise exception 'Llegaste al máximo de envíos de hoy. Intenta mañana.' using errcode = 'P0001'; end if;
    update public.identity_verifications set status = 'pendiente', doc_type = p_doc_type, country = v_country, last3 = v_last3, full_name = v_name,
           front_path = p_front, selfie_path = p_selfie, consent_version = p_consent_version, consent_at = now(), submitted_at = now(),
           attempts = case when attempts_day = current_date then attempts + 1 else 1 end, attempts_day = current_date,
           reviewed_at = null, reviewer = null, rejection_reason = null, files_deleted_at = null, purge_after = now() + interval '30 days', updated_at = now()
     where user_id = v_uid;
  else
    insert into public.identity_verifications (user_id, status, doc_type, country, last3, full_name, front_path, selfie_path, consent_version, consent_at)
    values (v_uid, 'pendiente', p_doc_type, v_country, v_last3, v_name, p_front, p_selfie, p_consent_version, now());
  end if;
  return 'pendiente';
end $$;
revoke execute on function public.identity_submit(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.identity_submit(text, text, text, text, text, text, text) to authenticated;

/** Retira tu verificación: borra la fila (pierdes el Verificado) y devuelve las fotos que el servidor debe borrar. */
create or replace function public.identity_withdraw()
returns table (front_path text, selfie_path text)
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); cur public.identity_verifications%rowtype;
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  delete from public.identity_verifications where user_id = v_uid returning * into cur;
  if cur.user_id is null then return; end if;
  insert into public.audit_log (actor, action, target, meta) values (v_uid, 'identity.withdraw', v_uid::text, jsonb_build_object('status', cur.status));
  return query select cur.front_path, cur.selfie_path;
end $$;
revoke execute on function public.identity_withdraw() from public, anon;
grant execute on function public.identity_withdraw() to authenticated;

/** Panel (soporte y admin): verificaciones por estado. Sin fotos ni enlaces: esos los pide admin_identity_files. */
drop function if exists public.admin_identity_queue(text);
create function public.admin_identity_queue(p_status text default 'pendiente')
returns table (user_id uuid, name text, email text, username text, status text, doc_type text, country text, last3 text, id_name text,
  submitted_at timestamptz, attempts int, reviewed_at timestamptz, reviewer_name text, rejection_reason text, has_files boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_billing_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query
  select iv.user_id, p.full_name, u.email::text, p.username, iv.status, iv.doc_type, iv.country, iv.last3, iv.full_name, iv.submitted_at, iv.attempts::int,
         iv.reviewed_at, rp.full_name, iv.rejection_reason, (iv.files_deleted_at is null and iv.front_path is not null)
    from public.identity_verifications iv
    join public.profiles p on p.id = iv.user_id
    left join auth.users u on u.id = iv.user_id
    left join public.profiles rp on rp.id = iv.reviewer
   where iv.status = coalesce(p_status, 'pendiente')
   order by case when iv.status = 'pendiente' then iv.submitted_at end asc nulls last, iv.reviewed_at desc nulls last
   limit 100;
end $$;
revoke execute on function public.admin_identity_queue(text) from public, anon;
grant execute on function public.admin_identity_queue(text) to authenticated;

/** Panel: rutas de las fotos de una verificación PENDIENTE para firmarlas (60 s). Queda en la auditoría. */
create or replace function public.admin_identity_files(p_user uuid)
returns table (front_path text, selfie_path text)
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); cur public.identity_verifications%rowtype;
begin
  if not public.is_billing_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_user = v_actor then raise exception 'No puedes revisar tu propia verificación' using errcode = '42501'; end if;
  select * into cur from public.identity_verifications where user_id = p_user;
  if cur.user_id is null or cur.status <> 'pendiente' or cur.files_deleted_at is not null then raise exception 'No hay fotos para revisar' using errcode = 'P0001'; end if;
  insert into public.audit_log (actor, action, target, meta) values (v_actor, 'identity.view', p_user::text, jsonb_build_object('doc_type', cur.doc_type, 'country', cur.country));
  return query select cur.front_path, cur.selfie_path;
end $$;
revoke execute on function public.admin_identity_files(uuid) from public, anon;
grant execute on function public.admin_identity_files(uuid) to authenticated;

/**
 * Aprueba o rechaza (con motivo). Borra el nombre del documento, deja las fotos listas para borrar ya mismo y avisa a la
 * persona. Nadie decide su propia verificación. Devuelve las rutas de las fotos para que el servidor las borre.
 */
create or replace function public.admin_identity_decide(p_user uuid, p_approve boolean, p_reason text default null)
returns table (front_path text, selfie_path text)
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); cur public.identity_verifications%rowtype; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_billing_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_user is null or p_approve is null then raise exception 'Datos inválidos' using errcode = '22023'; end if;
  if p_user = v_actor then raise exception 'No puedes decidir tu propia verificación' using errcode = '42501'; end if;
  select * into cur from public.identity_verifications where user_id = p_user for update;
  if cur.user_id is null or cur.status <> 'pendiente' then raise exception 'Esta verificación ya no está pendiente' using errcode = 'P0001'; end if;
  if not p_approve and (v_reason is null or char_length(v_reason) < 4) then raise exception 'Escribe el motivo del rechazo' using errcode = 'P0001'; end if;
  update public.identity_verifications
     set status = case when p_approve then 'aprobada' else 'rechazada' end, reviewer = v_actor, reviewed_at = now(),
         rejection_reason = case when p_approve then null else left(v_reason, 300) end, full_name = null, purge_after = now(), updated_at = now()
   where user_id = p_user;
  -- Auditoría sin datos del documento (ni el número ni sus últimos dígitos ni el nombre).
  insert into public.audit_log (actor, action, target, meta)
  values (v_actor, case when p_approve then 'identity.approve' else 'identity.reject' end, p_user::text,
          jsonb_build_object('doc_type', cur.doc_type, 'country', cur.country, 'reason', case when p_approve then null else left(v_reason, 300) end));
  insert into public.notifications (user_id, kind, title, body, url)
  values (p_user, 'verificacion',
          case when p_approve then 'Tu identidad está verificada' else 'No pudimos verificar tu identidad' end,
          case when p_approve then 'Ya tienes el sello Verificado en tu perfil y en la comunidad. Borramos las fotos de tu documento.'
               else 'Motivo: ' || left(v_reason, 200) || '. Borramos las fotos; puedes enviarlas de nuevo.' end,
          case when p_approve then '/app/perfil#poder' else '/app/perfil/verificar' end);
  return query select cur.front_path, cur.selfie_path;
end $$;
revoke execute on function public.admin_identity_decide(uuid, boolean, text) from public, anon;
grant execute on function public.admin_identity_decide(uuid, boolean, text) to authenticated;

/** Marca las fotos como borradas (las borra el servidor en Storage). Staff o el servidor (service_role, cron). */
create or replace function public.identity_files_purged(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_billing_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.identity_verifications set front_path = null, selfie_path = null, files_deleted_at = now(), updated_at = now()
   where user_id = p_user and status <> 'pendiente' and files_deleted_at is null;
end $$;
revoke execute on function public.identity_files_purged(uuid) from public, anon;
grant execute on function public.identity_files_purged(uuid) to authenticated, service_role;

/**
 * Cron diario (solo service_role): las verificaciones sin revisar en 30 días vencen (rechazadas con aviso) y devuelve las
 * fotos que ya deben borrarse. El servidor las borra en Storage y llama identity_files_purged.
 */
create or replace function public.identity_purge_due(p_limit int default 200)
returns table (user_id uuid, front_path text, selfie_path text)
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if auth.uid() is not null then raise exception 'No autorizado' using errcode = '42501'; end if;
  for r in select iv.user_id from public.identity_verifications iv where iv.status = 'pendiente' and iv.submitted_at <= now() - interval '30 days' limit 500 loop
    update public.identity_verifications set status = 'rechazada', reviewed_at = now(), reviewer = null, full_name = null, purge_after = now(), updated_at = now(),
           rejection_reason = 'No alcanzamos a revisarla en 30 días' where identity_verifications.user_id = r.user_id and status = 'pendiente';
    insert into public.notifications (user_id, kind, title, body, url)
    values (r.user_id, 'verificacion', 'Tu verificación venció', 'No alcanzamos a revisarla en 30 días y borramos las fotos. Puedes enviarla de nuevo.', '/app/perfil/verificar');
  end loop;
  return query select iv.user_id, iv.front_path, iv.selfie_path from public.identity_verifications iv
   where iv.files_deleted_at is null and iv.status <> 'pendiente' and iv.purge_after <= now()
   order by iv.purge_after limit greatest(1, least(coalesce(p_limit, 200), 500));
end $$;
revoke execute on function public.identity_purge_due(int) from public, anon, authenticated;
grant execute on function public.identity_purge_due(int) to service_role;

/** Tu poder de perfil completo (recalcula y guarda; puede dejar el aviso de subida en la campanita). */
create or replace function public.my_profile_power()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); s record; f public.profile_flair%rowtype;
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  perform public._power_refresh(v_uid, true);
  select * into s from public._power_stats(v_uid);
  select * into f from public.profile_flair where user_id = v_uid;
  return jsonb_build_object(
    'visible', true, 'premium_owned', s.premium_owned, 'certs', s.certs, 'retos_done', s.retos_done, 'total_xp', s.total_xp, 'level_idx', s.level_idx,
    'best_streak', s.best_streak, 'verified', s.verified, 'points', f.points, 'tier', f.tier, 'featured', f.featured,
    'insignias', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'label', i.label, 'detail', i.detail, 'icon', i.icon, 'cover', i.cover, 'kind', i.kind, 'at', i.earned_at)) from public._insignias(v_uid) i), '[]'::jsonb),
    'showcase', public._showcase(v_uid));
end $$;
revoke execute on function public.my_profile_power() from public, anon;
grant execute on function public.my_profile_power() to authenticated;

-- ───────────── Estado inicial: nivel de perfil de quien ya tiene actividad (sin avisos) ─────────────
do $$
declare r record;
begin
  for r in select p.id from public.profiles p join auth.users u on u.id = p.id
            where not exists (select 1 from public.profile_flair f where f.user_id = p.id)
              and (exists (select 1 from public.xp_events x where x.user_id = p.id) or exists (select 1 from public.challenge_entitlements e where e.user_id = p.id))
  loop
    perform public._power_refresh(r.id, false);
  end loop;
end $$;
