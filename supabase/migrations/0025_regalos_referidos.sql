-- Banana Burn · 0025 regalos de meses, referidos y acceso con plan en la base
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0024.
-- Qué hace:
--   1. Fin de la beta en UN solo lugar: public._beta_ends_at(). _has_app_access() y _has_nutrition_access() lo leen.
--      Misma fecha que BETA_ENDS_AT en src/lib/plans.ts: si mueves una, mueve la otra.
--   2. Regalos (comp_grants.source = 'regalo' | 'referido'): respetan el plan elegido (Entreno o Entreno + Nutrición),
--      se apilan (empiezan cuando termina el acceso que ya tiene la persona) y nunca tocan profiles.plan.
--      Las cortesías de siempre (source = 'cortesia') siguen igual: valen como plan completo.
--   3. Escribir entrenos, pesos, medidas, registro diario y fotos pide plan, prueba o beta (has_app_access()).
--      Leer y borrar lo propio sigue abierto: el muro de planes nunca borra nada.
--   4. Referidos: código por persona, atribución una sola vez y solo desde el servidor (service_role), calificación con
--      señales anti abuso y recompensas idempotentes. Detalle de las reglas en la sección 5.
-- Lectura: cada persona ve solo lo suyo (sus regalos, su código, sus recompensas, y sus referidos con inicial y estado
-- vía my_referrals()). El staff lee por funciones que validan el rol; las acciones de staff quedan en audit_log.

-- ───────────── 1. Fin de la beta ─────────────
create or replace function public._beta_ends_at()
returns timestamptz language sql stable set search_path = public as $$
  select timestamptz '2026-11-01 06:00:00+00';
$$;
revoke all on function public._beta_ends_at() from public, anon, authenticated;

-- ───────────── 2. Regalos sobre comp_grants ─────────────
alter table public.comp_grants add column if not exists source text not null default 'cortesia';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'comp_grants_source_check' and conrelid = 'public.comp_grants'::regclass) then
    alter table public.comp_grants add constraint comp_grants_source_check check (source in ('cortesia', 'regalo', 'referido'));
  end if;
end $$;
alter table public.comp_grants add column if not exists months smallint;
alter table public.comp_grants add column if not exists message text;
alter table public.comp_grants add column if not exists seen_at timestamptz;
alter table public.comp_grants add column if not exists notified_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'comp_grants_months_check' and conrelid = 'public.comp_grants'::regclass) then
    alter table public.comp_grants add constraint comp_grants_months_check check (months is null or months between 1 and 24);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'comp_grants_message_check' and conrelid = 'public.comp_grants'::regclass) then
    alter table public.comp_grants add constraint comp_grants_message_check check (message is null or char_length(message) <= 280);
  end if;
end $$;
create index if not exists comp_grants_gifts_unseen on public.comp_grants (user_id) where seen_at is null and revoked_at is null and source <> 'cortesia';
create index if not exists comp_grants_gifts_pending on public.comp_grants (created_at) where notified_at is null and source <> 'cortesia';
-- La persona lee sus filas (política de 0005) pero no las cambia: marcar "visto" es gifts_mark_seen().
revoke insert, update, delete on public.comp_grants from anon, authenticated;

-- Acceso a la app: staff, plan del perfil, cualquier cortesía o regalo vigente, prueba de 7 días o beta.
create or replace function public._has_app_access(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    now() < public._beta_ends_at()
    or exists (
      select 1 from public.profiles p where p.id = p_user and (
        p.role::text in ('coach','support','admin','superadmin')
        or p.plan in ('entreno','completo','pro')
        or p.created_at > now() - interval '7 days'))
    or exists (
      select 1 from public.comp_grants g where g.user_id = p_user and g.revoked_at is null and g.starts_at <= now() and g.expires_at > now())
  );
$$;
revoke all on function public._has_app_access(uuid) from public, anon, authenticated;

-- Nutrición: igual, pero los regalos solo cuentan si son de Entreno + Nutrición. Las cortesías siempre (como en la app).
create or replace function public._has_nutrition_access(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    now() < public._beta_ends_at()
    or exists (
      select 1 from public.profiles p where p.id = p_user and (
        p.role::text in ('coach','support','admin','superadmin')
        or p.plan in ('completo','pro')
        or p.created_at > now() - interval '7 days'))
    or exists (
      select 1 from public.comp_grants g where g.user_id = p_user and g.revoked_at is null and g.starts_at <= now() and g.expires_at > now()
        and (g.plan = 'completo' or g.source = 'cortesia'))
  );
$$;
revoke all on function public._has_nutrition_access(uuid) from public, anon, authenticated;

/**
 * Hasta cuándo la persona ya tiene acceso igual o mejor que `p_plan` (nunca antes de ahora): prueba o beta vigente,
 * cortesías y regalos vigentes o programados, y suscripción pagada vigente. Un regalo nuevo empieza aquí.
 */
create or replace function public._access_covered_until(p_user uuid, p_plan text)
returns timestamptz language sql stable security definer set search_path = public as $$
  select greatest(
    now(),
    (select case when public._beta_ends_at() > now() then greatest(p.created_at + interval '7 days', public._beta_ends_at())
                 else p.created_at + interval '7 days' end
       from public.profiles p where p.id = p_user),
    (select max(g.expires_at) from public.comp_grants g
      where g.user_id = p_user and g.revoked_at is null and g.expires_at > now()
        and (p_plan = 'entreno' or g.plan = 'completo' or g.source = 'cortesia')),
    (select max(s.current_period_end) from public.subscriptions s
      where s.user_id = p_user and s.current_period_end > now()
        and (s.status in ('active','trialing','past_due') or (s.status = 'canceled' and s.cancel_at_period_end))
        and (p_plan = 'entreno' or s.plan = 'completo'))
  );
$$;
revoke all on function public._access_covered_until(uuid, text) from public, anon, authenticated;

/**
 * Crea un regalo de `p_months` meses (interno: lo llaman admin_gift_months y las recompensas de referidos).
 * Se apila: empieza cuando termina el acceso que ya tiene. No toca profiles.plan (la app y _has_app_access leen
 * comp_grants). Deja el aviso en la campanita; correo y push los manda el servidor (comp_grants.notified_at).
 */
create or replace function public._gift_grant(p_user uuid, p_plan text, p_months int, p_source text, p_message text, p_actor uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_start timestamptz; v_end timestamptz; v_prev text; v_id bigint; v_name text; v_title text; v_body text;
begin
  if p_plan not in ('entreno','completo') then raise exception 'Plan inválido' using errcode = '22023'; end if;
  if p_months is null or p_months not between 1 and 24 then raise exception 'Meses fuera de rango (1 a 24)' using errcode = '22023'; end if;
  if p_source not in ('regalo','referido') then raise exception 'Origen inválido' using errcode = '22023'; end if;
  -- Un regalo a la vez por persona: dos regalos simultáneos no se encimarían en las mismas fechas.
  select plan into v_prev from public.profiles where id = p_user for update;
  if not found then raise exception 'Usuario no encontrado' using errcode = 'P0001'; end if;
  -- Plan "de base" para cuando todo venza: el previo a una cortesía vigente, o el del perfil.
  v_prev := coalesce((select g.previous_plan from public.comp_grants g where g.user_id = p_user and g.source = 'cortesia'
                       and g.revoked_at is null and g.expires_at > now() order by g.created_at desc limit 1), v_prev);
  v_start := public._access_covered_until(p_user, p_plan);
  v_end := v_start + make_interval(months => p_months);
  insert into public.comp_grants (user_id, plan, previous_plan, reason, starts_at, expires_at, granted_by, source, months, message)
  values (p_user, p_plan, v_prev, case p_source when 'regalo' then 'Regalo' else 'Recompensa por referidos' end, v_start, v_end, p_actor,
          p_source, p_months, nullif(left(btrim(coalesce(p_message, '')), 280), ''))
  returning id into v_id;
  v_name := case p_plan when 'completo' then 'Entreno + Nutrición' else 'Entreno' end;
  v_title := case p_source when 'regalo' then 'Te regalaron ' else 'Ganaste ' end
             || p_months || case when p_months = 1 then ' mes' else ' meses' end || ' de ' || v_name;
  v_body := case when v_start <= now() + interval '1 minute' then 'Ya está activo en tu cuenta.'
                 else 'Empieza cuando termine el acceso que ya tienes. Míralo en Mi plan.' end;
  insert into public.notifications (user_id, kind, title, body, url) values (p_user, p_source, v_title, v_body, '/app/suscripcion');
  return v_id;
end $$;
revoke all on function public._gift_grant(uuid, text, int, text, text, uuid) from public, anon, authenticated;

/** Panel: regalar meses (solo admin y superadmin). El motivo interno queda en auditoría, nunca en la fila que ve la persona. */
create or replace function public.admin_gift_months(p_target uuid, p_plan text, p_months int, p_message text default null, p_reason text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_id bigint; g public.comp_grants;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if coalesce(char_length(btrim(p_reason)), 0) < 4 then raise exception 'Escribe el motivo del regalo' using errcode = 'P0001'; end if;
  if p_message is not null and char_length(p_message) > 280 then raise exception 'El mensaje puede tener hasta 280 caracteres' using errcode = 'P0001'; end if;
  v_id := public._gift_grant(p_target, p_plan, p_months, 'regalo', p_message, v_actor);
  select * into g from public.comp_grants where id = v_id;
  insert into public.audit_log (actor, action, target, meta)
  values (v_actor, 'user.gift', p_target::text, jsonb_build_object('grant', v_id, 'plan', p_plan, 'months', p_months,
          'starts_at', g.starts_at, 'expires_at', g.expires_at, 'reason', left(p_reason, 300), 'message', g.message is not null));
  return v_id;
end $$;

/** Panel: el mismo regalo a varias personas (máx. 200 por vez). Devuelve cuántos se crearon. Todo o nada si algo falla. */
create or replace function public.admin_gift_months_bulk(p_targets uuid[], p_plan text, p_months int, p_message text default null, p_reason text default null)
returns int language plpgsql security definer set search_path = public as $$
declare t uuid; n int := 0;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_targets is null or cardinality(p_targets) = 0 then return 0; end if;
  if cardinality(p_targets) > 200 then raise exception 'Máximo 200 personas por vez' using errcode = 'P0001'; end if;
  -- Ids repetidos cuentan una vez; ids que ya no existen (cuenta borrada) se saltan.
  foreach t in array (select array_agg(distinct x) from unnest(p_targets) x) loop
    if exists (select 1 from public.profiles where id = t) then
      perform public.admin_gift_months(t, p_plan, p_months, p_message, p_reason);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

/** La persona cerró el aviso de regalo: no se vuelve a mostrar. */
create or replace function public.gifts_mark_seen()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.comp_grants set seen_at = now() where user_id = auth.uid() and seen_at is null and source <> 'cortesia';
  get diagnostics n = row_count;
  return n;
end $$;

-- Las cortesías de siempre: una vigente a la vez, pero ya no revocan regalos ni recompensas.
create or replace function public.admin_grant_comp(p_target uuid, p_plan text, p_expires timestamptz, p_reason text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_prev text; v_id bigint;
begin
  if not public.is_billing_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_plan not in ('entreno','completo') then raise exception 'Plan inválido'; end if;
  if p_expires <= now() or p_expires > now() + interval '366 days' then raise exception 'Vencimiento fuera de rango (máx. 1 año)'; end if;
  select plan into v_prev from public.profiles where id = p_target for update;
  if not found then raise exception 'Usuario no encontrado'; end if;
  v_prev := coalesce((select g.previous_plan from public.comp_grants g where g.user_id = p_target and g.source = 'cortesia'
                       and g.revoked_at is null and g.expires_at > now() order by g.created_at desc limit 1), v_prev);
  update public.comp_grants set revoked_at = now(), revoked_by = v_actor
   where user_id = p_target and source = 'cortesia' and revoked_at is null and expires_at > now();
  insert into public.comp_grants (user_id, plan, previous_plan, reason, expires_at, granted_by)
  values (p_target, p_plan, v_prev, left(p_reason, 300), p_expires, v_actor) returning id into v_id;
  update public.profiles set plan = p_plan where id = p_target;
  insert into public.audit_log (actor, action, target, meta)
  values (v_actor, 'user.comp_grant', p_target::text, jsonb_build_object('grant', v_id, 'plan', p_plan, 'previous_plan', v_prev, 'expires_at', p_expires, 'reason', left(p_reason, 300)));
  return v_id;
end $$;

-- Al terminar una cortesía: el plan del perfil sale de lo que de verdad sigue vigente (suscripción pagada o cortesía).
-- El plan previo solo se restaura si la persona nunca pagó (si no, un plan pagado vencido quedaba pegado en el perfil).
create or replace function public._restore_plan_after_comp(p_user uuid, p_prev text)
returns text language plpgsql security definer set search_path = public as $$
declare v_plan text; v_live text[];
begin
  select array_agg(x) into v_live from (
    select s.plan as x from public.subscriptions s
     where s.user_id = p_user and s.plan in ('entreno','completo') and (
       (s.status in ('active','trialing') and (s.current_period_end is null or s.current_period_end + interval '3 days' > now()))
       or (s.status = 'past_due' and s.current_period_end + interval '3 days' > now())
       or (s.status = 'canceled' and s.cancel_at_period_end and s.current_period_end > now()))
    union all
    select g.plan from public.comp_grants g
     where g.user_id = p_user and g.source = 'cortesia' and g.revoked_at is null and g.starts_at <= now() and g.expires_at > now()
  ) t;
  if 'completo' = any(coalesce(v_live, '{}')) then v_plan := 'completo';
  elsif 'entreno' = any(coalesce(v_live, '{}')) then v_plan := 'entreno';
  elsif exists (select 1 from public.subscriptions s where s.user_id = p_user and s.status <> 'incomplete') then v_plan := 'free';
  else v_plan := coalesce(p_prev, 'free');
  end if;
  if v_plan not in ('free','entreno','completo','pro') then v_plan := 'free'; end if;
  update public.profiles set plan = v_plan where id = p_user;
  return v_plan;
end $$;
revoke all on function public._restore_plan_after_comp(uuid, text) from public, anon, authenticated;

-- Vencimiento diario de cortesías: los regalos no se "revocan" al vencer (su historial muestra "Terminado").
create or replace function public.expire_comp_grants()
returns int language plpgsql security definer set search_path = public as $$
declare g record; n int := 0;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  for g in select * from public.comp_grants c where c.source = 'cortesia' and c.revoked_at is null and c.expires_at <= now() and
             not exists (select 1 from public.comp_grants g2 where g2.user_id = c.user_id and g2.source = 'cortesia' and g2.revoked_at is null
                          and g2.starts_at <= now() and g2.expires_at > now())
  loop
    update public.comp_grants set revoked_at = now() where id = g.id;
    perform public._restore_plan_after_comp(g.user_id, g.previous_plan);
    insert into public.audit_log (actor, action, target, meta)
    values (auth.uid(), 'user.comp_expire', g.user_id::text, jsonb_build_object('grant', g.id));
    n := n + 1;
  end loop;
  return n;
end $$;

-- ───────────── 3. Escribir datos de entreno pide plan, prueba o beta ─────────────
do $$
declare t text;
begin
  foreach t in array array['workouts','workout_sets','weights','measurements','daily_logs','progress_photos'] loop
    execute format('drop policy if exists "propio: todo" on public.%I', t);
    execute format('drop policy if exists "fotos: propias" on public.%I', t);
    execute format('drop policy if exists "%s: leer propias" on public.%I', t, t);
    execute format('drop policy if exists "%s: borrar propias" on public.%I', t, t);
    execute format('drop policy if exists "%s: crear con plan" on public.%I', t, t);
    execute format('drop policy if exists "%s: editar con plan" on public.%I', t, t);
    execute format('create policy "%s: leer propias" on public.%I for select using (user_id = auth.uid())', t, t);
    execute format('create policy "%s: borrar propias" on public.%I for delete using (user_id = auth.uid())', t, t);
    execute format('create policy "%s: crear con plan" on public.%I for insert with check (user_id = auth.uid() and public.has_app_access())', t, t);
    execute format('create policy "%s: editar con plan" on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_app_access())', t, t);
  end loop;
end $$;
drop policy if exists "progreso: subir propio" on storage.objects;
-- Igual que 0014 (máx. 40 subidas en 24 h y 1000 en total) y además con plan, prueba o beta.
create policy "progreso: subir propio" on storage.objects for insert with check (
  bucket_id = 'progreso' and (storage.foldername(name))[1] = auth.uid()::text
  and (select u.last_24h < 40 and u.total < 1000 from public._my_photo_uploads() u)
  and public.has_app_access()
);

-- ───────────── 4. Referidos: tablas ─────────────
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[a-hjkmnp-z2-9]{8}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id bigint generated always as identity primary key,
  referrer uuid not null references auth.users(id) on delete cascade,
  -- Si la persona referida borra su cuenta, la fila queda sin dueño (no libera su correo para otra atribución).
  referred uuid unique references auth.users(id) on delete set null,
  code text not null,
  status text not null default 'registrado' check (status in ('registrado','calificado','sospechoso','descartado')),
  flag text check (flag is null or char_length(flag) <= 60),
  -- HMAC del correo normalizado y del prefijo de red (los calcula el servidor con un secreto): sin datos legibles.
  email_hash text unique check (email_hash is null or char_length(email_hash) between 16 and 64),
  ip_hash text check (ip_hash is null or char_length(ip_hash) between 16 and 64),
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  annual_paid_at timestamptz,
  group_no int,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  check (referred is null or referred <> referrer)
);
create index if not exists referrals_referrer on public.referrals (referrer, status, qualified_at);
create index if not exists referrals_group on public.referrals (referrer, group_no) where group_no is not null;

create table if not exists public.referral_rewards (
  id bigint generated always as identity primary key,
  referrer uuid not null references auth.users(id) on delete cascade,
  group_no int not null check (group_no >= 1),
  months smallint not null check (months in (1, 3)),
  plan text not null check (plan in ('entreno','completo')),
  grant_ids bigint[] not null default '{}',
  created_at timestamptz not null default now(),
  upgraded_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoke_reason text check (revoke_reason is null or char_length(revoke_reason) <= 300),
  unique (referrer, group_no)
);

-- Señales anti abuso de quien invita (prefijo de red al abrir su página de referidos). Sin políticas: nadie la lee por la API.
create table if not exists public.referral_signals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ip_hash text check (ip_hash is null or char_length(ip_hash) between 16 and 64),
  updated_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_rewards enable row level security;
alter table public.referral_signals enable row level security;
drop policy if exists "referidos: mi código" on public.referral_codes;
create policy "referidos: mi código" on public.referral_codes for select using (user_id = auth.uid());
drop policy if exists "referidos: mis recompensas" on public.referral_rewards;
create policy "referidos: mis recompensas" on public.referral_rewards for select using (referrer = auth.uid());
-- referrals y referral_signals: sin políticas (la lista propia sale de my_referrals() con inicial y estado).
revoke all on public.referrals, public.referral_signals from anon, authenticated;
revoke insert, update, delete on public.referral_codes, public.referral_rewards from anon, authenticated;

-- Al borrar la cuenta referida también se va su prefijo de red.
create or replace function public._referrals_scrub()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.referred is null and old.referred is not null then new.ip_hash := null; end if;
  return new;
end $$;
drop trigger if exists referrals_scrub on public.referrals;
create trigger referrals_scrub before update on public.referrals for each row execute function public._referrals_scrub();

-- ───────────── 5. Referidos: reglas ─────────────
-- Calificado = la persona referida (a) terminó la bienvenida y (b) terminó al menos un entreno (que no sea descanso) o
--   registró un día (agua, pasos o sueño) dentro de sus primeros 7 días, y (c) no parece la misma persona:
--     - mismo correo normalizado que quien invita (sin +etiqueta; en Gmail sin puntos): se descarta;
--     - mismo prefijo de red que quien invita Y mismo dominio de correo: queda "en revisión" (un admin aprueba o descarta);
--     - ya hay 2 o más referidos de quien invita desde ese mismo prefijo de red en 30 días: "en revisión".
--   Una compra anual confirmada por el webhook saca a una persona de "en revisión" (pagar un año no es abuso).
-- Recompensa: los referidos calificados se ordenan por fecha de calificación y se agrupan de a 3 (grupo 1, 2, 3...).
--   Cada grupo completo da 1 mes gratis; si al menos una persona del grupo compró un plan ANUAL, ese grupo da 3 meses.
--   Si la compra anual llega después de entregar el mes, el grupo sube a 3 meses una sola vez (se suman 2 meses).
--   Un grupo nunca se recalcula ni se paga dos veces (unique (referrer, group_no) y group_no fijo en cada referido).
--   Tope: 12 recompensas en 365 días por persona; los calificados que pasen el tope esperan sin agruparse.
--   Plan del regalo: Entreno si quien invita tiene Entreno en su perfil; si no, Entreno + Nutrición.

create or replace function public._norm_email(p text)
returns text language sql immutable set search_path = public as $$
  with e as (select lower(btrim(coalesce(p, ''))) v),
       parts as (select split_part(v, '@', 1) l, split_part(v, '@', 2) d from e),
       n as (select split_part(l, '+', 1) l, case when d = 'googlemail.com' then 'gmail.com' else d end d from parts)
  select case when d = 'gmail.com' then replace(l, '.', '') else l end || '@' || d from n;
$$;
revoke all on function public._norm_email(text) from public, anon, authenticated;

/** Código propio para invitar (lo crea la primera vez). 8 caracteres sin 0, 1, i, l ni o. */
create or replace function public.my_referral_code()
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789'; b bytea; i int;
begin
  if auth.uid() is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  select code into v_code from public.referral_codes where user_id = auth.uid();
  if found then return v_code; end if;
  for attempt in 1..8 loop
    b := uuid_send(gen_random_uuid());
    v_code := '';
    for i in 0..7 loop v_code := v_code || substr(alphabet, (get_byte(b, i) % 31) + 1, 1); end loop;
    begin
      insert into public.referral_codes (user_id, code) values (auth.uid(), v_code);
      return v_code;
    exception when unique_violation then
      select code into v_code from public.referral_codes where user_id = auth.uid();
      if found then return v_code; end if; -- otra pestaña lo creó primero
    end;
  end loop;
  raise exception 'No se pudo crear el código. Intenta de nuevo.' using errcode = 'P0001';
end $$;

/** Mis referidos, con privacidad: solo la inicial del nombre, el estado y fechas. */
create or replace function public.my_referrals()
returns table (initial text, status text, created_at timestamptz, qualified_at timestamptz, annual boolean, group_no int, expired boolean)
language sql stable security definer set search_path = public as $$
  select upper(left(coalesce(nullif(btrim(p.full_name), ''), '?'), 1)), r.status, r.created_at, r.qualified_at, r.annual_paid_at is not null, r.group_no,
         r.status = 'registrado' and coalesce(p.created_at, r.created_at) + interval '7 days' < now()
  from public.referrals r left join public.profiles p on p.id = r.referred
  where r.referrer = auth.uid()
  order by r.created_at desc
  limit 200;
$$;

/** Agrupa los calificados de a 3 y entrega las recompensas pendientes. Idempotente. */
create or replace function public._referral_settle(p_referrer uuid)
returns int language plpgsql security definer set search_path = public as $$
declare ids bigint[]; v_group int; v_months int; v_plan text; v_grant bigint; n int := 0; v_annual boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('referral:' || p_referrer::text, 0));
  loop
    select array_agg(id order by qualified_at, id) into ids from (
      select id, qualified_at from public.referrals
       where referrer = p_referrer and status = 'calificado' and group_no is null
       order by qualified_at, id limit 3) t;
    exit when coalesce(cardinality(ids), 0) < 3;
    exit when (select count(*) from public.referral_rewards where referrer = p_referrer and revoked_at is null and created_at > now() - interval '365 days') >= 12;
    select coalesce(max(group_no), 0) + 1 into v_group from public.referral_rewards where referrer = p_referrer;
    select bool_or(annual_paid_at is not null) into v_annual from public.referrals where id = any(ids);
    v_months := case when v_annual then 3 else 1 end;
    v_plan := case when (select plan from public.profiles where id = p_referrer) = 'entreno' then 'entreno' else 'completo' end;
    update public.referrals set group_no = v_group where id = any(ids);
    v_grant := public._gift_grant(p_referrer, v_plan, v_months, 'referido',
      case when v_annual then 'Tres personas que invitaste ya entrenan con Banana Burn y una eligió el plan anual.'
           else 'Tres personas que invitaste ya entrenan con Banana Burn.' end, null);
    insert into public.referral_rewards (referrer, group_no, months, plan, grant_ids, upgraded_at)
    values (p_referrer, v_group, v_months, v_plan, array[v_grant], null);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public._referral_settle(uuid) from public, anon, authenticated;

/** ¿La persona referida ya califica? Se llama desde los triggers de actividad y al atribuir. */
create or replace function public._referral_try_qualify(p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.referrals; p record; v_deadline timestamptz;
begin
  if p_user is null then return false; end if;
  select * into r from public.referrals where referred = p_user and status = 'registrado' for update;
  if not found then return false; end if;
  select created_at, onboarded into p from public.profiles where id = p_user;
  if not found or not coalesce(p.onboarded, false) then return false; end if;
  v_deadline := p.created_at + interval '7 days';
  if not (
    exists (select 1 from public.workouts w where w.user_id = p_user and w.finished_at is not null and w.template <> 'descanso' and w.finished_at <= v_deadline)
    or exists (select 1 from public.daily_logs d where d.user_id = p_user and d.day <= (v_deadline at time zone 'America/Costa_Rica')::date
                 and (coalesce(d.water_glasses, 0) > 0 or coalesce(d.steps, 0) > 0 or coalesce(d.sleep_h, 0) > 0))
  ) then return false; end if;
  update public.referrals set status = 'calificado', qualified_at = now() where id = r.id;
  perform public._referral_settle(r.referrer);
  return true;
end $$;
revoke all on function public._referral_try_qualify(uuid) from public, anon, authenticated;

-- Triggers de actividad: nunca bloquean el entreno o el registro del usuario (cualquier error queda como aviso).
create or replace function public._referral_on_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if tg_table_name = 'profiles' then
    if not (coalesce(new.onboarded, false) and not coalesce(old.onboarded, false)) then return null; end if;
    uid := new.id;
  elsif tg_table_name = 'workouts' then
    if new.finished_at is null then return null; end if;
    uid := new.user_id;
  else
    uid := new.user_id;
  end if;
  if not exists (select 1 from public.referrals where referred = uid and status = 'registrado') then return null; end if;
  begin
    perform public._referral_try_qualify(uid);
  exception when others then
    raise warning 'referidos: no se pudo calificar (%)', sqlstate;
  end;
  return null;
end $$;
revoke all on function public._referral_on_activity() from public, anon, authenticated;
drop trigger if exists referral_on_workout on public.workouts;
create trigger referral_on_workout after insert or update of finished_at on public.workouts for each row execute function public._referral_on_activity();
drop trigger if exists referral_on_daily on public.daily_logs;
create trigger referral_on_daily after insert or update on public.daily_logs for each row execute function public._referral_on_activity();
drop trigger if exists referral_on_onboard on public.profiles;
create trigger referral_on_onboard after update of onboarded on public.profiles for each row execute function public._referral_on_activity();

/**
 * Atribuye una cuenta nueva a quien la invitó. SOLO service_role (el registro del servidor, con la cookie del enlace).
 * Una sola vez por cuenta y por correo, nunca a sí misma, y solo en las primeras 72 horas de la cuenta.
 * Devuelve el resultado ('registrado', 'sospechoso', 'descartado' o el motivo por el que no se atribuyó).
 */
create or replace function public.referral_attribute(p_referred uuid, p_code text, p_email_hash text default null, p_ip_hash text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text := lower(btrim(coalesce(p_code, ''))); v_ref uuid; v_created timestamptz; e_ref text; e_new text;
        v_status text := 'registrado'; v_flag text;
begin
  if auth.uid() is not null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_referred is null or v_code !~ '^[a-hjkmnp-z2-9]{8}$' then return 'codigo_invalido'; end if;
  if p_email_hash is not null and char_length(p_email_hash) not between 16 and 64 then return 'firma_invalida'; end if;
  if p_ip_hash is not null and char_length(p_ip_hash) not between 16 and 64 then return 'firma_invalida'; end if;
  select user_id into v_ref from public.referral_codes where code = v_code;
  if not found then return 'codigo_desconocido'; end if;
  if v_ref = p_referred then return 'auto_referido'; end if;
  select created_at into v_created from public.profiles where id = p_referred;
  if not found then return 'sin_perfil'; end if;
  if v_created < now() - interval '72 hours' then return 'cuenta_vieja'; end if;
  if exists (select 1 from public.referrals where referred = p_referred) then return 'ya_atribuido'; end if;
  if p_email_hash is not null and exists (select 1 from public.referrals where email_hash = p_email_hash) then return 'correo_repetido'; end if;
  select public._norm_email(email) into e_ref from auth.users where id = v_ref;
  select public._norm_email(email) into e_new from auth.users where id = p_referred;
  if e_ref is not null and e_ref = e_new then
    v_status := 'descartado'; v_flag := 'mismo_correo';
  elsif p_ip_hash is not null and p_ip_hash = (select s.ip_hash from public.referral_signals s where s.user_id = v_ref)
        and split_part(e_ref, '@', 2) = split_part(e_new, '@', 2) then
    v_status := 'sospechoso'; v_flag := 'misma_red_y_dominio';
  elsif p_ip_hash is not null and (select count(*) from public.referrals r where r.referrer = v_ref and r.ip_hash = p_ip_hash and r.created_at > now() - interval '30 days') >= 2 then
    v_status := 'sospechoso'; v_flag := 'varias_cuentas_misma_red';
  end if;
  begin
    insert into public.referrals (referrer, referred, code, status, flag, email_hash, ip_hash)
    values (v_ref, p_referred, v_code, v_status, v_flag, p_email_hash, p_ip_hash);
  exception when unique_violation then
    return 'ya_atribuido';
  end;
  if v_status = 'registrado' then perform public._referral_try_qualify(p_referred); end if;
  return v_status;
end $$;

/** Guarda el prefijo de red (HMAC) de quien invita, para detectar auto referidos. SOLO service_role. */
create or replace function public.referral_touch(p_user uuid, p_ip_hash text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_user is null or p_ip_hash is null or char_length(p_ip_hash) not between 16 and 64 then return; end if;
  insert into public.referral_signals (user_id, ip_hash, updated_at) values (p_user, p_ip_hash, now())
  on conflict (user_id) do update set ip_hash = excluded.ip_hash, updated_at = now();
end $$;

/**
 * Webhook de ONVO: la persona referida pagó un plan ANUAL. SOLO service_role. Idempotente (renovaciones no cuentan).
 * Si su grupo ya cobró 1 mes, sube a 3 (se suman 2 meses una sola vez); si aún no hay grupo, cuenta al completarse.
 */
create or replace function public.referral_annual_paid(p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
declare r public.referrals; w public.referral_rewards; v_grant bigint;
begin
  if auth.uid() is not null then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.referrals set annual_paid_at = now(),
         status = case when status = 'sospechoso' then 'registrado' else status end,
         flag = case when status = 'sospechoso' then 'aprobado_por_pago_anual' else flag end
   where referred = p_user and annual_paid_at is null and status <> 'descartado'
  returning * into r;
  if not found then return 'sin_cambio'; end if;
  if r.group_no is null then
    if r.status = 'registrado' then perform public._referral_try_qualify(p_user); end if;
    return 'anotado';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('referral:' || r.referrer::text, 0));
  select * into w from public.referral_rewards where referrer = r.referrer and group_no = r.group_no for update;
  if not found or w.revoked_at is not null or w.months <> 1 then return 'sin_cambio'; end if;
  v_grant := public._gift_grant(r.referrer, w.plan, 2, 'referido', 'Una persona que invitaste eligió el plan anual: tu mes gratis ahora es un trimestre.', null);
  update public.referral_rewards set months = 3, upgraded_at = now(), grant_ids = grant_ids || v_grant where id = w.id;
  return 'trimestre';
end $$;

-- ───────────── 6. Referidos: panel ─────────────
/** Ficha del usuario en el panel: su código, quién lo invitó, sus referidos y recompensas. Soporte y admin. */
create or replace function public.admin_referral_overview(p_target uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_billing_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'code', (select code from public.referral_codes where user_id = p_target),
    'referred_by', (select jsonb_build_object('id', r.referrer, 'name', p.full_name, 'status', r.status, 'created_at', r.created_at)
                      from public.referrals r left join public.profiles p on p.id = r.referrer where r.referred = p_target),
    'referrals', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'user_id', r.referred, 'name', p.full_name, 'status', r.status, 'flag', r.flag,
                      'created_at', r.created_at, 'qualified_at', r.qualified_at, 'annual', r.annual_paid_at is not null, 'group_no', r.group_no) order by r.created_at desc)
                      from (select * from public.referrals where referrer = p_target order by created_at desc limit 100) r
                      left join public.profiles p on p.id = r.referred), '[]'::jsonb),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'group_no', w.group_no, 'months', w.months, 'plan', w.plan, 'created_at', w.created_at,
                      'upgraded_at', w.upgraded_at, 'revoked_at', w.revoked_at, 'revoke_reason', w.revoke_reason) order by w.group_no)
                      from public.referral_rewards w where w.referrer = p_target), '[]'::jsonb)
  );
end $$;

/** Conteos por usuario para la lista del panel (máx. 100 ids por llamada). */
create or replace function public.admin_referral_counts(p_ids uuid[])
returns table (user_id uuid, total bigint, qualified bigint, rewards bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_ids is null or cardinality(p_ids) > 100 then raise exception 'Máximo 100 usuarios' using errcode = '22023'; end if;
  return query
    select u, (select count(*) from public.referrals r where r.referrer = u),
              (select count(*) from public.referrals r where r.referrer = u and r.status = 'calificado'),
              (select count(*) from public.referral_rewards w where w.referrer = u and w.revoked_at is null)
    from unnest(p_ids) u;
end $$;

/** Revoca una recompensa por fraude: quita sus meses y descarta los referidos de ese grupo. Solo admin. Auditada. */
create or replace function public.admin_revoke_referral_reward(p_reward bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); w public.referral_rewards;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if coalesce(char_length(btrim(p_reason)), 0) < 4 then raise exception 'Escribe el motivo' using errcode = 'P0001'; end if;
  select * into w from public.referral_rewards where id = p_reward for update;
  if not found or w.revoked_at is not null then raise exception 'Recompensa no encontrada o ya revocada' using errcode = 'P0001'; end if;
  update public.comp_grants set revoked_at = now(), revoked_by = v_actor where id = any(w.grant_ids) and revoked_at is null;
  update public.referral_rewards set revoked_at = now(), revoked_by = v_actor, revoke_reason = left(p_reason, 300) where id = w.id;
  update public.referrals set status = 'descartado', flag = 'recompensa_revocada', reviewed_by = v_actor, reviewed_at = now()
   where referrer = w.referrer and group_no = w.group_no;
  insert into public.audit_log (actor, action, target, meta)
  values (v_actor, 'referral.reward_revoke', w.referrer::text, jsonb_build_object('reward', w.id, 'group', w.group_no, 'months', w.months, 'reason', left(p_reason, 300)));
end $$;

/** Revisa un referido "en revisión": aprobar (vuelve a contar) o descartar. Solo admin. Auditada. */
create or replace function public.admin_review_referral(p_referral bigint, p_approve boolean, p_reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); r public.referrals;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into r from public.referrals where id = p_referral for update;
  if not found or r.status <> 'sospechoso' then raise exception 'Ese referido no está en revisión' using errcode = 'P0001'; end if;
  update public.referrals set status = case when p_approve then 'registrado' else 'descartado' end,
         flag = case when p_approve then 'aprobado' else coalesce(r.flag, 'descartado') end, reviewed_by = v_actor, reviewed_at = now()
   where id = r.id;
  insert into public.audit_log (actor, action, target, meta)
  values (v_actor, case when p_approve then 'referral.approve' else 'referral.reject' end, r.referrer::text,
          jsonb_build_object('referral', r.id, 'flag', r.flag, 'reason', left(p_reason, 300)));
  if p_approve and r.referred is not null then perform public._referral_try_qualify(r.referred); end if;
  return case when p_approve then 'registrado' else 'descartado' end;
end $$;

-- ───────────── 7. Permisos de las funciones ─────────────
revoke execute on function public.admin_gift_months(uuid, text, int, text, text) from public, anon;
revoke execute on function public.admin_gift_months_bulk(uuid[], text, int, text, text) from public, anon;
revoke execute on function public.gifts_mark_seen() from public, anon;
revoke execute on function public.admin_grant_comp(uuid, text, timestamptz, text) from public, anon;
revoke execute on function public.expire_comp_grants() from public, anon;
revoke execute on function public.my_referral_code() from public, anon;
revoke execute on function public.my_referrals() from public, anon;
revoke execute on function public.admin_referral_overview(uuid) from public, anon;
revoke execute on function public.admin_referral_counts(uuid[]) from public, anon;
revoke execute on function public.admin_revoke_referral_reward(bigint, text) from public, anon;
revoke execute on function public.admin_review_referral(bigint, boolean, text) from public, anon;
revoke execute on function public.referral_attribute(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.referral_touch(uuid, text) from public, anon, authenticated;
revoke execute on function public.referral_annual_paid(uuid) from public, anon, authenticated;
grant execute on function public.admin_gift_months(uuid, text, int, text, text) to authenticated;
grant execute on function public.admin_gift_months_bulk(uuid[], text, int, text, text) to authenticated;
grant execute on function public.gifts_mark_seen() to authenticated;
grant execute on function public.admin_grant_comp(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.expire_comp_grants() to authenticated, service_role;
grant execute on function public.my_referral_code() to authenticated;
grant execute on function public.my_referrals() to authenticated;
grant execute on function public.admin_referral_overview(uuid) to authenticated;
grant execute on function public.admin_referral_counts(uuid[]) to authenticated;
grant execute on function public.admin_revoke_referral_reward(bigint, text) to authenticated;
grant execute on function public.admin_review_referral(bigint, boolean, text) to authenticated;
grant execute on function public.referral_attribute(uuid, text, text, text) to service_role;
grant execute on function public.referral_touch(uuid, text) to service_role;
grant execute on function public.referral_annual_paid(uuid) to service_role;
