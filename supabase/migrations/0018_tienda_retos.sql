-- Banana Burn, 0018: tienda de retos (gratis y Premium), niveles con beneficios y bono de racha
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001–0016 (no depende de 0017).
-- Qué hace:
--   1. challenges_catalog pasa a ser la tienda: estado (borrador, publicado, oculto, archivado), precio en USD,
--      ID de precio de ONVO (opcional), dificultad, minutos al día, portada, recompensas, fecha de inicio y destacado.
--      `active` queda sincronizado con estado = publicado (lo usa el código de 0005–0013).
--   2. challenge_plans: plan día a día. Solo el staff lo lee directo; la app lo pide con challenge_plan(), que
--      muestra los primeros 3 días de un reto de pago a quien no lo compró.
--   3. challenge_purchases (compras con ONVO) y challenge_entitlements (acceso a retos de pago). Solo los escribe el
--      webhook (service_role) o el staff con admin_grant_challenge(), que audita.
--   4. Unirse a un reto: debe estar publicado y abierto; los de pago exigen haberlo comprado (o cortesía).
--      Cada inscripción guarda los comodines extra por nivel (bonus_grace).
--   5. Hitos de reto (días 7 y 14) y bono de racha: XP que solo otorga el servidor, una vez.
--   6. Lecturas agregadas: personas en cada reto (challenge_participants) y ventas para el admin (admin_challenge_stats).
--   7. Siembra: los 6 retos de siempre y 8 nuevos (no pisa lo que el admin ya editó).

-- ───────────── 1. Catálogo = tienda ─────────────
alter table public.challenges_catalog
  add column if not exists status text not null default 'borrador',
  add column if not exists price_usd numeric(7,2) not null default 0,
  add column if not exists onvo_price_id text,
  add column if not exists difficulty text not null default 'media',
  add column if not exists minutes int not null default 10,
  add column if not exists cover text not null default 'banana',
  add column if not exists icon text,
  add column if not exists verify text,
  add column if not exists grace int,
  add column if not exists xp int,
  add column if not exists steps_goal int,
  add column if not exists badge text,
  add column if not exists reward_title text,
  add column if not exists start_mode text not null default 'libre',
  add column if not exists start_date date,
  add column if not exists featured boolean not null default false,
  add column if not exists coming_soon boolean not null default false,
  add column if not exists safety_note text,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

-- Filas creadas antes de 0018: el estado sale de `active` y lo demás de `rules` (una sola vez: solo si siguen sin verify).
update public.challenges_catalog set
  status = case when active then 'publicado' else 'borrador' end,
  verify = coalesce(nullif(rules->>'verify', ''), 'manual'),
  icon = coalesce(icon, nullif(rules->>'icono', '')),
  steps_goal = coalesce(steps_goal, case when (rules->>'pasosMin') ~ '^\d+$' then (rules->>'pasosMin')::int end),
  grace = coalesce(grace, case when (rules->>'comodines') ~ '^\d+$' then least((rules->>'comodines')::int, greatest(days - 1, 0)) end),
  xp = coalesce(xp, case when coalesce(rules->>'xp', rules->>'xpBonus') ~ '^\d+$' then least(coalesce(rules->>'xp', rules->>'xpBonus')::int, 400) end)
where verify is null;
update public.challenges_catalog set verify = 'manual' where verify not in ('manual','workout','steps','protein','water');

do $$ begin
  alter table public.challenges_catalog drop constraint if exists challenges_catalog_store_check;
  alter table public.challenges_catalog add constraint challenges_catalog_store_check check (
    status in ('borrador','publicado','oculto','archivado')
    and price_usd >= 0 and price_usd <= 200 and (price_usd = 0 or price_usd >= 0.5)
    and difficulty in ('facil','media','dificil')
    and minutes between 1 and 240
    and cover in ('banana','ember','sky','peel','noche','selva')
    and (verify is null or verify in ('manual','workout','steps','protein','water'))
    and (grace is null or grace between 0 and 60)
    and (xp is null or xp between 0 and 400)
    and (steps_goal is null or steps_goal between 1000 and 50000)
    and start_mode in ('libre','fecha') and (start_mode = 'libre' or start_date is not null)
    and (onvo_price_id is null or char_length(onvo_price_id) <= 80)
    and (badge is null or char_length(badge) <= 60)
    and (reward_title is null or char_length(reward_title) <= 40)
    and (icon is null or char_length(icon) <= 24)
    and (safety_note is null or char_length(safety_note) <= 600)
  );
end $$;

/** `active` = publicado (compatibilidad con 0005–0013) y fecha de edición. */
create or replace function public.sync_challenge_active()
returns trigger language plpgsql as $$
begin
  new.active := (new.status = 'publicado');
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists challenges_catalog_sync on public.challenges_catalog;
create trigger challenges_catalog_sync before insert or update on public.challenges_catalog for each row execute function public.sync_challenge_active();
create index if not exists challenges_catalog_status_sort on public.challenges_catalog (status, sort);

-- Lectura: la app ve solo lo publicado (borrador, oculto y archivado no). El staff ve todo para administrar.
drop policy if exists "retos: leer activos" on public.challenges_catalog;
drop policy if exists "retos: leer publicados" on public.challenges_catalog;
create policy "retos: leer publicados" on public.challenges_catalog for select using (status = 'publicado' or public.is_staff());
-- Escritura: solo quien edita contenido (coach, admin, superadmin), igual que 0005.
drop policy if exists "retos: editores" on public.challenges_catalog;
create policy "retos: editores" on public.challenges_catalog for all
  using (public.is_content_editor()) with check (public.is_content_editor());
revoke delete on public.challenges_catalog from anon;

-- ───────────── 2. Plan día a día ─────────────
create table if not exists public.challenge_plans (
  slug text primary key references public.challenges_catalog(slug) on update cascade on delete cascade,
  days jsonb not null default '[]'::jsonb check (jsonb_typeof(days) = 'array' and jsonb_array_length(days) <= 365),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.challenge_plans enable row level security;
drop policy if exists "planes: staff lee" on public.challenge_plans;
drop policy if exists "planes: editores" on public.challenge_plans;
create policy "planes: staff lee" on public.challenge_plans for select using (public.is_staff());
create policy "planes: editores" on public.challenge_plans for all using (public.is_content_editor()) with check (public.is_content_editor());

-- ───────────── 3. Compras y acceso a retos de pago ─────────────
-- user_id queda en null si se borra la cuenta: el registro contable de la venta se conserva (igual que payment_events).
create table if not exists public.challenge_purchases (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  challenge_slug text not null,
  status text not null default 'pendiente' check (status in ('pendiente','pagado','fallido','reembolsado')),
  amount_minor int not null check (amount_minor >= 50),
  list_price_minor int not null check (list_price_minor >= amount_minor),
  discount_pct int not null default 0 check (discount_pct between 0 and 50),
  currency text not null default 'USD' check (currency = 'USD'),
  provider text not null default 'onvo',
  provider_payment_intent_id text unique,
  provider_customer_id text,
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists challenge_purchases_user on public.challenge_purchases (user_id, created_at desc);
create index if not exists challenge_purchases_slug on public.challenge_purchases (challenge_slug, status);
alter table public.challenge_purchases enable row level security;
drop policy if exists "compras de retos: propias o staff" on public.challenge_purchases;
create policy "compras de retos: propias o staff" on public.challenge_purchases for select using (user_id = auth.uid() or public.is_staff());
revoke insert, update, delete on public.challenge_purchases from anon, authenticated; -- solo service_role (checkout y webhook)

create table if not exists public.challenge_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_slug text not null,
  source text not null check (source in ('compra','cortesia')),
  purchase_id bigint references public.challenge_purchases(id) on delete set null,
  granted_by uuid references auth.users(id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  primary key (user_id, challenge_slug)
);
create index if not exists challenge_entitlements_slug on public.challenge_entitlements (challenge_slug);
alter table public.challenge_entitlements enable row level security;
drop policy if exists "acceso a retos: propio o staff" on public.challenge_entitlements;
create policy "acceso a retos: propio o staff" on public.challenge_entitlements for select using (user_id = auth.uid() or public.is_staff());
revoke insert, update, delete on public.challenge_entitlements from anon, authenticated; -- service_role o admin_grant_challenge()

/** ¿El usuario tiene un reto de pago (compra o cortesía)? */
create or replace function public._owns_challenge(p_user uuid, p_slug text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.challenge_entitlements where user_id = p_user and challenge_slug = p_slug);
$$;
revoke all on function public._owns_challenge(uuid, text) from public, anon, authenticated;
/** Lo mismo para la sesión actual (lo usa el guard de user_challenges, que corre con el rol del usuario). */
create or replace function public.i_own_challenge(p_slug text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public._owns_challenge(auth.uid(), p_slug);
$$;
revoke execute on function public.i_own_challenge(text) from public, anon;
grant execute on function public.i_own_challenge(text) to authenticated;

/** Cortesía: regala un reto de pago a un usuario. Soporte, admin y superadmin. Audita en la misma transacción. */
create or replace function public.admin_grant_challenge(p_target uuid, p_slug text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid();
begin
  if not public.is_billing_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 4 then raise exception 'Escribe el motivo de la cortesía' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where id = p_target) then raise exception 'Usuario no encontrado' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.challenges_catalog where slug = p_slug) then raise exception 'Reto no encontrado' using errcode = 'P0001'; end if;
  if exists (select 1 from public.challenge_entitlements where user_id = p_target and challenge_slug = p_slug) then
    raise exception 'El usuario ya tiene este reto' using errcode = 'P0001';
  end if;
  insert into public.challenge_entitlements (user_id, challenge_slug, source, granted_by, reason) values (p_target, p_slug, 'cortesia', v_actor, left(p_reason, 300));
  insert into public.audit_log (actor, action, target, meta) values (v_actor, 'challenge.grant', p_target::text, jsonb_build_object('challenge', p_slug, 'reason', left(p_reason, 300)));
end $$;
revoke execute on function public.admin_grant_challenge(uuid, text, text) from public, anon;
grant execute on function public.admin_grant_challenge(uuid, text, text) to authenticated;

-- ───────────── 4. Unirse a un reto ─────────────
alter table public.user_challenges add column if not exists bonus_grace int not null default 0;
alter table public.user_challenges drop constraint if exists user_challenges_bonus_grace_range;
alter table public.user_challenges add constraint user_challenges_bonus_grace_range check (bonus_grace between 0 and 5) not valid;

/** Comodines extra por nivel: +1 desde 800 XP (Banana madura) y +1 desde 5.000 XP (Gorila). Igual que gamify.ts. */
create or replace function public._level_bonus_grace(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  with t as (select coalesce(sum(xp), 0) as xp from public.xp_events where user_id = p_user)
  select (case when xp >= 800 then 1 else 0 end) + (case when xp >= 5000 then 1 else 0 end) from t;
$$;
revoke all on function public._level_bonus_grace(uuid) from public, anon, authenticated;
create or replace function public.my_bonus_grace()
returns int language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then 0 else public._level_bonus_grace(auth.uid()) end;
$$;
revoke execute on function public.my_bonus_grace() from public, anon;
grant execute on function public.my_bonus_grace() to authenticated;

/** ¿Se puede empezar hoy (p_day)? Publicado; si tiene fecha fija, solo durante sus primeros 3 días. */
create or replace function public.challenge_open(p_id text, p_day date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.challenges_catalog c
     where c.slug = p_id and c.status = 'publicado' and not c.coming_soon
       and (c.start_mode = 'libre' or p_day between c.start_date and c.start_date + 2));
$$;

/** Retos que existen para inscribirse (publicados). Reemplaza la lista fija de 0013: el catálogo vive en la BD. */
create or replace function public.challenge_exists(p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.challenges_catalog where slug = p_id and status = 'publicado');
$$;

/** ¿Lo marca el usuario a mano? Columna `verify` (0018) o `rules.verify` (0005); sin fila, los manuales de siempre. */
create or replace function public.challenge_is_manual(p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select coalesce(verify, rules->>'verify', 'manual') not in ('workout','steps','protein','water') from public.challenges_catalog where slug = p_id limit 1),
    p_id in ('flexiones-30','plancha-30'));
$$;

-- Basado en la versión de 0014 (con el candado por usuario), más compra, ventana de inscripción y comodines por nivel.
create or replace function public.guard_user_challenge()
returns trigger language plpgsql set search_path = public as $$
declare n int; v_price numeric;
begin
  if not public.is_api_role() then return new; end if; -- servidor (service_role) cierra retos y otorga XP
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then raise exception 'No autorizado' using errcode = '42501'; end if;
    if not public.challenge_exists(new.challenge_id) then raise exception 'Reto inválido' using errcode = '22023'; end if;
    if new.started_on is null or not public._is_today_somewhere(new.started_on) then raise exception 'Fecha de inicio inválida' using errcode = '22023'; end if;
    if not public.challenge_open(new.challenge_id, new.started_on) then raise exception 'Este reto todavía no abre o ya cerró inscripciones' using errcode = 'P0001'; end if;
    select price_usd into v_price from public.challenges_catalog where slug = new.challenge_id;
    if coalesce(v_price, 0) > 0 then
      -- Reto de pago: solo con compra confirmada por el webhook o cortesía del staff.
      if not public.i_own_challenge(new.challenge_id) then raise exception 'Compra este reto para empezarlo' using errcode = '42501'; end if;
    elsif not public.has_app_access() then
      raise exception 'Sin plan activo' using errcode = '42501';
    end if;
    -- Serializa las uniones de cada usuario (0014): dos "Unirme" simultáneos no superan el tope de 3.
    perform pg_advisory_xact_lock(hashtextextended('bb:retos:' || new.user_id::text, 0));
    select count(*) into n from public.user_challenges where user_id = new.user_id and status = 'activo';
    if n >= 3 then raise exception 'Máximo 3 retos a la vez' using errcode = 'P0001'; end if;
    new.status := 'activo'; new.completed_at := null; new.created_at := now();
    new.bonus_grace := public.my_bonus_grace();
    return new;
  end if;
  -- UPDATE: el usuario solo puede abandonar un reto activo (nada más cambia).
  if old.status = 'activo' and new.status = 'abandonado'
     and new.user_id = old.user_id and new.challenge_id = old.challenge_id and new.started_on = old.started_on
     and new.completed_at is not distinct from old.completed_at and new.created_at = old.created_at
     and new.bonus_grace = old.bonus_grace then
    return new;
  end if;
  raise exception 'Solo puedes abandonar un reto en curso' using errcode = '42501';
end $$;
drop trigger if exists user_challenges_guard on public.user_challenges;
create trigger user_challenges_guard before insert or update on public.user_challenges for each row execute function public.guard_user_challenge();

-- ───────────── Lecturas para la app ─────────────
/**
 * Plan de un reto para quien mira: completo si es gratis, si lo tiene (compra, cortesía o inscripción) o si es staff;
 * si es de pago y no lo tiene, solo los primeros 3 días. Nada de un reto no publicado salvo que ya esté inscrito.
 */
create or replace function public.challenge_plan(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c record; d jsonb; full_access boolean; enrolled boolean;
begin
  if auth.uid() is null then return null; end if;
  select slug, status, price_usd, days into c from public.challenges_catalog where slug = p_slug;
  if not found then return null; end if;
  enrolled := exists (select 1 from public.user_challenges where user_id = auth.uid() and challenge_id = p_slug);
  if c.status <> 'publicado' and not enrolled and not public.is_staff() then return null; end if;
  select days into d from public.challenge_plans where slug = p_slug;
  d := coalesce(d, '[]'::jsonb);
  full_access := c.price_usd = 0 or enrolled or public.is_staff() or public._owns_challenge(auth.uid(), p_slug);
  if full_access then return jsonb_build_object('days', d, 'locked', false, 'total', c.days); end if;
  return jsonb_build_object('days', coalesce((select jsonb_agg(x.e order by x.i) from jsonb_array_elements(d) with ordinality as x(e, i) where x.i <= 3), '[]'::jsonb), 'locked', true, 'total', c.days);
end $$;
revoke execute on function public.challenge_plan(text) from public, anon;
grant execute on function public.challenge_plan(text) to authenticated;

/** Definición de los retos en los que el usuario está o estuvo (aunque luego se ocultaran o archivaran), con su plan. */
create or replace function public.my_challenge_defs()
returns table (slug text, title text, description text, days int, rules jsonb, status text, price_usd numeric, difficulty text, minutes int, cover text, icon text,
  verify text, grace int, xp int, steps_goal int, badge text, reward_title text, start_mode text, start_date date, featured boolean, coming_soon boolean, safety_note text, sort int, plan jsonb)
language sql stable security definer set search_path = public as $$
  select c.slug, c.title, c.description, c.days, c.rules, c.status, c.price_usd, c.difficulty, c.minutes, c.cover, c.icon,
         c.verify, c.grace, c.xp, c.steps_goal, c.badge, c.reward_title, c.start_mode, c.start_date, c.featured, c.coming_soon, c.safety_note, c.sort,
         coalesce(p.days, '[]'::jsonb)
  from public.challenges_catalog c left join public.challenge_plans p on p.slug = c.slug
  where auth.uid() is not null and c.slug in (select challenge_id from public.user_challenges where user_id = auth.uid());
$$;
revoke execute on function public.my_challenge_defs() from public, anon;
grant execute on function public.my_challenge_defs() to authenticated;

/** Personas con el reto en curso hoy (dato real, agregado; sin identidades). */
create or replace function public.challenge_participants()
returns table (slug text, n bigint)
language sql stable security definer set search_path = public as $$
  select uc.challenge_id, count(*) from public.user_challenges uc
   join public.challenges_catalog c on c.slug = uc.challenge_id and c.status = 'publicado'
  where auth.uid() is not null and uc.status = 'activo'
  group by uc.challenge_id;
$$;
revoke execute on function public.challenge_participants() from public, anon;
grant execute on function public.challenge_participants() to authenticated;

/** Panel: participantes, compras e ingresos por reto. Ventas solo para staff de cuentas (soporte, admin, superadmin). */
create or replace function public.admin_challenge_stats()
returns table (slug text, active bigint, joined bigint, completed bigint, purchases bigint, revenue_minor bigint, comps bigint)
language plpgsql stable security definer set search_path = public as $$
declare sales boolean := public.is_billing_staff();
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query
  select c.slug,
    (select count(*) from public.user_challenges u where u.challenge_id = c.slug and u.status = 'activo'),
    (select count(*) from public.user_challenges u where u.challenge_id = c.slug),
    (select count(*) from public.user_challenges u where u.challenge_id = c.slug and u.status = 'completado'),
    case when sales then (select count(*) from public.challenge_purchases p where p.challenge_slug = c.slug and p.status = 'pagado') end,
    case when sales then (select coalesce(sum(p.amount_minor), 0)::bigint from public.challenge_purchases p where p.challenge_slug = c.slug and p.status = 'pagado') end,
    case when sales then (select count(*) from public.challenge_entitlements e where e.challenge_slug = c.slug and e.source = 'cortesia') end
  from public.challenges_catalog c;
end $$;
revoke execute on function public.admin_challenge_stats() from public, anon;
grant execute on function public.admin_challenge_stats() to authenticated;

/** Nivel visible en la comunidad (solo XP total, sin datos de salud). Nada si el perfil es privado (salvo el propio). */
create or replace function public.community_xp(p_user uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select case when auth.uid() is not null and (p_user = auth.uid() or coalesce(public.profile_visibility(p_user), 'privado') <> 'privado')
    then (select coalesce(sum(xp), 0) from public.xp_events where user_id = p_user) end;
$$;
revoke execute on function public.community_xp(uuid) from public, anon;
grant execute on function public.community_xp(uuid) to authenticated;

-- ───────────── 5. Hitos y bono de racha (solo servidor) ─────────────
create table if not exists public.challenge_milestones (
  user_challenge_id bigint not null references public.user_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone int not null check (milestone in (7, 14)),
  created_at timestamptz not null default now(),
  primary key (user_challenge_id, milestone)
);
alter table public.challenge_milestones enable row level security;
drop policy if exists "hitos: propios o staff" on public.challenge_milestones;
create policy "hitos: propios o staff" on public.challenge_milestones for select using (user_id = auth.uid() or public.is_staff());
revoke insert, update, delete on public.challenge_milestones from anon, authenticated;

/**
 * Bono de racha del día local `p_day`: deja el total del bono de ese día en `p_xp` si es mayor que lo ya otorgado
 * (nunca lo baja). Lo calcula el servidor (gamify.streakBonus) y solo lo llama service_role.
 */
create or replace function public.grant_streak_bonus(p_user uuid, p_day date, p_xp int)
returns int language plpgsql security definer set search_path = public as $$
declare have int; add_xp int;
begin
  -- Dentro de SECURITY DEFINER current_user es el dueño: el candado real es el GRANT (solo service_role). Además,
  -- una sesión de usuario (JWT con sub) nunca puede llamarla.
  if auth.uid() is not null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_xp is null or p_xp < 0 or p_xp > 150 then raise exception 'Bono fuera de rango' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('bb:xp-bonus:' || p_user::text || ':' || p_day::text, 0));
  select coalesce(sum(xp), 0) into have from public.xp_events where user_id = p_user and kind = 'streak_bonus' and ref_day = p_day;
  add_xp := p_xp - have;
  if add_xp <= 0 then return 0; end if;
  insert into public.xp_events (user_id, kind, xp, ref_day) values (p_user, 'streak_bonus', add_xp, p_day);
  return add_xp;
end $$;
revoke execute on function public.grant_streak_bonus(uuid, date, int) from public, anon, authenticated;
grant execute on function public.grant_streak_bonus(uuid, date, int) to service_role;

-- ───────────── 7. Siembra (generada con scripts/gen-retos-seed.ts; no pisa lo editado en el panel) ─────────────
insert into public.challenges_catalog (slug, title, description, days, rules, status, price_usd, difficulty, minutes, cover, icon, verify, grace, xp, steps_goal, badge, reward_title, start_mode, start_date, featured, coming_soon, safety_note, sort) values
  ('banana-30', '30 días Banana', 'Entrena 30 días: tu rutina, modo suave o un exprés de 10 min. Tienes 3 comodines por si un día no puedes.', 30, '{}'::jsonb, 'publicado', 0.00, 'media', 20, 'banana', 'banana', 'workout', 3, 400, null, 'Banana constante', 'Constante', 'libre', null, true, false, null, 10),
  ('flexiones-30', 'Reto de flexiones', 'De 10 a 100 flexiones al día en 30 días. Divídelas en las series que necesites.', 30, '{}'::jsonb, 'publicado', 0.00, 'media', 10, 'ember', 'barbell', 'manual', 3, 300, null, 'Pecho de acero', null, 'libre', null, false, false, null, 20),
  ('plancha-30', 'Plancha de acero', 'De 20 segundos a 3 minutos de plancha. Core de acero en un mes.', 30, '{}'::jsonb, 'publicado', 0.00, 'media', 5, 'sky', 'shield', 'manual', 3, 300, null, 'Core de acero', null, 'libre', null, false, false, null, 30),
  ('pasos-30', '10.000 pasos', '30 días caminando 10.000 pasos. La forma más fácil de sumar actividad todos los días.', 30, '{}'::jsonb, 'publicado', 0.00, 'facil', 60, 'peel', 'sneaker', 'steps', 3, 300, 10000, 'Caminante', null, 'libre', null, false, false, null, 40),
  ('proteina-21', 'Proteína perfecta', '21 días llegando a tu meta de proteína. El hábito que protege tu músculo mientras bajas de grasa.', 21, '{}'::jsonb, 'publicado', 0.00, 'facil', 5, 'ember', 'egg', 'protein', 2, 250, null, 'Proteína al día', null, 'libre', null, false, false, null, 50),
  ('agua-21', 'Hidratado', '21 días tomando 8 vasos de agua. Menos hambre y mejor energía en el gym.', 21, '{}'::jsonb, 'publicado', 0.00, 'facil', 2, 'sky', 'drop', 'water', 2, 200, null, 'Hidratado', null, 'libre', null, false, false, null, 60),
  ('pasos-14', '10.000 pasos en 14 días', 'Dos semanas para volver a moverte: 10.000 pasos diarios con una idea práctica cada día. Se marca solo al registrar tus pasos.', 14, '{}'::jsonb, 'publicado', 0.00, 'facil', 60, 'peel', 'steps', 'steps', 1, 150, 10000, 'Dos semanas en marcha', null, 'libre', null, false, false, null, 70),
  ('sin-azucar-7', 'Sin azúcar 7 días', 'Una semana sin azúcar añadida ni bebidas azucaradas. Cada día un paso concreto para que el antojo baje.', 7, '{}'::jsonb, 'publicado', 0.00, 'media', 5, 'selva', 'leaf', 'manual', 0, 120, null, 'Semana sin azúcar', null, 'libre', null, false, false, null, 80),
  ('movilidad-14', 'Movilidad diaria 14 días', '10 minutos al día para moverte mejor: cadera, hombros, columna y tobillos. Ideal si pasas muchas horas sentado.', 14, '{}'::jsonb, 'publicado', 0.00, 'facil', 10, 'sky', 'sparkle', 'manual', 2, 150, null, 'Cuerpo libre', null, 'libre', null, false, false, null, 90),
  ('abdomen-21', '21 días de abdomen', 'Circuito de core que sube cada semana: crunches, elevaciones de piernas, plancha y bicho muerto. Un día suave cada 7.', 21, '{}'::jsonb, 'publicado', 4.99, 'media', 12, 'noche', 'target', 'manual', 2, 300, null, 'Abdomen de acero', 'Core fuerte', 'libre', null, true, false, null, 100),
  ('gluteos-30', 'Glúteos de acero 30 días', 'Tres bloques que rotan (puentes, sentadillas, zancadas, patadas e hip thrust) y suben de repeticiones, con descanso activo cada 6 días. Sin equipo.', 30, '{}'::jsonb, 'publicado', 6.99, 'media', 15, 'ember', 'bolt', 'manual', 3, 350, null, 'Glúteos de acero', null, 'libre', null, false, false, null, 110),
  ('pierde-3kg-6-semanas', 'Pierde 3 kg en 6 semanas', 'Plan de 6 semanas que apunta a bajar unos 0,5 kg por semana: 3 días de fuerza, 2 caminatas largas, intervalos suaves y un día de revisión. El resultado depende de tu punto de partida y de cómo comes.', 42, '{}'::jsonb, 'publicado', 9.99, 'media', 45, 'banana', 'trendDown', 'manual', 6, 400, null, 'Seis semanas firmes', 'Disciplina', 'libre', null, true, false, 'Bajar alrededor de 0,5 kg por semana es un ritmo seguro para la mayoría de adultos. No es una garantía: cada cuerpo responde distinto. Si estás embarazada, tienes una condición médica o tomas medicamentos, consulta con tu médico antes de empezar.', 120),
  ('dominadas-desde-cero', 'Dominadas desde cero', 'De colgarte de la barra a intentar tu primera dominada estricta: colgadas, remo invertido, negativas y asistidas. Necesitas una barra.', 28, '{}'::jsonb, 'publicado', 7.99, 'dificil', 15, 'noche', 'barbell', 'manual', 3, 350, null, 'Primera dominada', 'Espalda fuerte', 'libre', null, false, false, null, 130),
  ('sprint-verano-28', 'Sprint de verano 28 días', 'Cuatro semanas de fuerza, intervalos y pasos para llegar con energía a fin de año. Empieza en la misma fecha para todos.', 28, '{}'::jsonb, 'publicado', 5.99, 'dificil', 40, 'selva', 'sun', 'manual', 3, 400, null, 'Sprint de verano', null, 'fecha', '2026-12-01', false, false, null, 140)
on conflict (slug) do nothing;

insert into public.challenge_plans (slug, days) values
  ('banana-30', $plan$[{"t":"Completa tu rutina de hoy (o un exprés de 10 min si vas con prisa)","type":"entreno"},{"t":"Completa cualquier entreno; si estás cansado, usa el modo suave","type":"entreno"},{"t":"Entrena hoy: aunque sea un exprés de 10 min cuenta","type":"entreno"},{"t":"Completa tu rutina de hoy (o un exprés de 10 min si vas con prisa)","type":"entreno"},{"t":"Completa cualquier entreno; si estás cansado, usa el modo suave","type":"entreno"},{"t":"Entrena hoy: aunque sea un exprés de 10 min cuenta","type":"entreno"},{"t":"Completa tu rutina de hoy (o un exprés de 10 min si vas con prisa)","type":"entreno"},{"t":"Completa cualquier entreno; si estás cansado, usa el modo suave","type":"entreno"},{"t":"Entrena hoy: aunque sea un exprés de 10 min cuenta","type":"entreno"},{"t":"Completa tu rutina de hoy (o un exprés de 10 min si vas con prisa)","type":"entreno"},{"t":"Completa cualquier entreno; si estás cansado, usa el modo suave","type":"entreno"},{"t":"Entrena hoy: aunque sea un exprés de 10 min cuenta","type":"entreno"},{"t":"Completa tu rutina de hoy (o un exprés de 10 min si vas con prisa)","type":"entreno"},{"t":"Completa cualquier entreno; si estás cansado, usa el modo suave","type":"entreno"},{"t":"Entrena hoy: aunque sea un exprés de 10 min cuenta","type":"entreno"},{"t":"Completa tu rutina de hoy (o un exprés de 10 min si vas con prisa)","type":"entreno"},{"t":"Completa cualquier entreno; si estás cansado, usa el modo suave","type":"entreno"},{"t":"Entrena hoy: aunque sea un exprés de 10 min cuenta","type":"entreno"},{"t":"Completa tu rutina de hoy (o un exprés de 10 min si vas con prisa)","type":"entreno"},{"t":"Completa cualquier entreno; si estás cansado, usa el modo suave","type":"entreno"},{"t":"Entrena hoy: aunque sea un exprés de 10 min cuenta","type":"entreno"},{"t":"Completa tu rutina de hoy (o un exprés de 10 min si vas con prisa)","type":"entreno"},{"t":"Completa cualquier entreno; si estás cansado, usa el modo suave","type":"entreno"},{"t":"Entrena hoy: aunque sea un exprés de 10 min cuenta","type":"entreno"},{"t":"Completa tu rutina de hoy (o un exprés de 10 min si vas con prisa)","type":"entreno"},{"t":"Completa cualquier entreno; si estás cansado, usa el modo suave","type":"entreno"},{"t":"Entrena hoy: aunque sea un exprés de 10 min cuenta","type":"entreno"},{"t":"Completa tu rutina de hoy (o un exprés de 10 min si vas con prisa)","type":"entreno"},{"t":"Completa cualquier entreno; si estás cansado, usa el modo suave","type":"entreno"},{"t":"Entrena hoy: aunque sea un exprés de 10 min cuenta","type":"entreno"}]$plan$::jsonb),
  ('flexiones-30', $plan$[{"t":"10 flexiones en total hoy (en las series que quieras)","type":"reps","target":10},{"t":"13 flexiones en total hoy (en las series que quieras)","type":"reps","target":13},{"t":"16 flexiones en total hoy (en las series que quieras)","type":"reps","target":16},{"t":"19 flexiones en total hoy (en las series que quieras)","type":"reps","target":19},{"t":"22 flexiones en total hoy (en las series que quieras)","type":"reps","target":22},{"t":"26 flexiones en total hoy (en las series que quieras)","type":"reps","target":26},{"t":"29 flexiones en total hoy (en las series que quieras)","type":"reps","target":29},{"t":"32 flexiones en total hoy (en las series que quieras)","type":"reps","target":32},{"t":"35 flexiones en total hoy (en las series que quieras)","type":"reps","target":35},{"t":"38 flexiones en total hoy (en las series que quieras)","type":"reps","target":38},{"t":"41 flexiones en total hoy (en las series que quieras)","type":"reps","target":41},{"t":"44 flexiones en total hoy (en las series que quieras)","type":"reps","target":44},{"t":"47 flexiones en total hoy (en las series que quieras)","type":"reps","target":47},{"t":"50 flexiones en total hoy (en las series que quieras)","type":"reps","target":50},{"t":"53 flexiones en total hoy (en las series que quieras)","type":"reps","target":53},{"t":"57 flexiones en total hoy (en las series que quieras)","type":"reps","target":57},{"t":"60 flexiones en total hoy (en las series que quieras)","type":"reps","target":60},{"t":"63 flexiones en total hoy (en las series que quieras)","type":"reps","target":63},{"t":"66 flexiones en total hoy (en las series que quieras)","type":"reps","target":66},{"t":"69 flexiones en total hoy (en las series que quieras)","type":"reps","target":69},{"t":"72 flexiones en total hoy (en las series que quieras)","type":"reps","target":72},{"t":"75 flexiones en total hoy (en las series que quieras)","type":"reps","target":75},{"t":"78 flexiones en total hoy (en las series que quieras)","type":"reps","target":78},{"t":"81 flexiones en total hoy (en las series que quieras)","type":"reps","target":81},{"t":"84 flexiones en total hoy (en las series que quieras)","type":"reps","target":84},{"t":"88 flexiones en total hoy (en las series que quieras)","type":"reps","target":88},{"t":"91 flexiones en total hoy (en las series que quieras)","type":"reps","target":91},{"t":"94 flexiones en total hoy (en las series que quieras)","type":"reps","target":94},{"t":"97 flexiones en total hoy (en las series que quieras)","type":"reps","target":97},{"t":"100 flexiones en total hoy (en las series que quieras)","type":"reps","target":100}]$plan$::jsonb),
  ('plancha-30', $plan$[{"t":"Plancha total de 20 s (puedes partirla)","type":"tiempo","target":20},{"t":"Plancha total de 26 s (puedes partirla)","type":"tiempo","target":26},{"t":"Plancha total de 31 s (puedes partirla)","type":"tiempo","target":31},{"t":"Plancha total de 37 s (puedes partirla)","type":"tiempo","target":37},{"t":"Plancha total de 42 s (puedes partirla)","type":"tiempo","target":42},{"t":"Plancha total de 48 s (puedes partirla)","type":"tiempo","target":48},{"t":"Plancha total de 53 s (puedes partirla)","type":"tiempo","target":53},{"t":"Plancha total de 59 s (puedes partirla)","type":"tiempo","target":59},{"t":"Plancha total de 1 min 4 s (puedes partirla)","type":"tiempo","target":64},{"t":"Plancha total de 1 min 10 s (puedes partirla)","type":"tiempo","target":70},{"t":"Plancha total de 1 min 15 s (puedes partirla)","type":"tiempo","target":75},{"t":"Plancha total de 1 min 21 s (puedes partirla)","type":"tiempo","target":81},{"t":"Plancha total de 1 min 26 s (puedes partirla)","type":"tiempo","target":86},{"t":"Plancha total de 1 min 32 s (puedes partirla)","type":"tiempo","target":92},{"t":"Plancha total de 1 min 37 s (puedes partirla)","type":"tiempo","target":97},{"t":"Plancha total de 1 min 43 s (puedes partirla)","type":"tiempo","target":103},{"t":"Plancha total de 1 min 48 s (puedes partirla)","type":"tiempo","target":108},{"t":"Plancha total de 1 min 54 s (puedes partirla)","type":"tiempo","target":114},{"t":"Plancha total de 1 min 59 s (puedes partirla)","type":"tiempo","target":119},{"t":"Plancha total de 2 min 5 s (puedes partirla)","type":"tiempo","target":125},{"t":"Plancha total de 2 min 10 s (puedes partirla)","type":"tiempo","target":130},{"t":"Plancha total de 2 min 16 s (puedes partirla)","type":"tiempo","target":136},{"t":"Plancha total de 2 min 21 s (puedes partirla)","type":"tiempo","target":141},{"t":"Plancha total de 2 min 27 s (puedes partirla)","type":"tiempo","target":147},{"t":"Plancha total de 2 min 32 s (puedes partirla)","type":"tiempo","target":152},{"t":"Plancha total de 2 min 38 s (puedes partirla)","type":"tiempo","target":158},{"t":"Plancha total de 2 min 43 s (puedes partirla)","type":"tiempo","target":163},{"t":"Plancha total de 2 min 49 s (puedes partirla)","type":"tiempo","target":169},{"t":"Plancha total de 2 min 54 s (puedes partirla)","type":"tiempo","target":174},{"t":"Plancha total de 3 min (puedes partirla)","type":"tiempo","target":180}]$plan$::jsonb),
  ('pasos-30', $plan$[{"t":"Llega a 10,000 pasos. Idea de hoy: camina después de comer: 10 min suman unos 1.000 pasos","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: usa escaleras en vez de ascensor","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: haz una llamada caminando","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: bájate una parada antes o estaciona más lejos","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: sal a caminar 20 min con música o un pódcast","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: camina mientras esperas el café o la comida","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: haz dos vueltas extra al súper o al parque","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: camina después de comer: 10 min suman unos 1.000 pasos","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: usa escaleras en vez de ascensor","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: haz una llamada caminando","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: bájate una parada antes o estaciona más lejos","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: sal a caminar 20 min con música o un pódcast","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: camina mientras esperas el café o la comida","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: haz dos vueltas extra al súper o al parque","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: camina después de comer: 10 min suman unos 1.000 pasos","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: usa escaleras en vez de ascensor","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: haz una llamada caminando","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: bájate una parada antes o estaciona más lejos","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: sal a caminar 20 min con música o un pódcast","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: camina mientras esperas el café o la comida","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: haz dos vueltas extra al súper o al parque","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: camina después de comer: 10 min suman unos 1.000 pasos","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: usa escaleras en vez de ascensor","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: haz una llamada caminando","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: bájate una parada antes o estaciona más lejos","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: sal a caminar 20 min con música o un pódcast","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: camina mientras esperas el café o la comida","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: haz dos vueltas extra al súper o al parque","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: camina después de comer: 10 min suman unos 1.000 pasos","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: usa escaleras en vez de ascensor","type":"pasos","target":10000}]$plan$::jsonb),
  ('proteina-21', $plan$[{"t":"Llega a tu meta de proteína. Idea de hoy: huevos o claras en el desayuno","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: pechuga, atún o pescado en el almuerzo","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: yogur griego como merienda","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: frijoles con queso bajo en grasa","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: un batido de proteína si no llegas","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: carne magra o cerdo sin grasa en la cena","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: requesón o queso cottage con fruta","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: huevos o claras en el desayuno","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: pechuga, atún o pescado en el almuerzo","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: yogur griego como merienda","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: frijoles con queso bajo en grasa","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: un batido de proteína si no llegas","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: carne magra o cerdo sin grasa en la cena","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: requesón o queso cottage con fruta","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: huevos o claras en el desayuno","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: pechuga, atún o pescado en el almuerzo","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: yogur griego como merienda","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: frijoles con queso bajo en grasa","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: un batido de proteína si no llegas","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: carne magra o cerdo sin grasa en la cena","type":"nutricion"},{"t":"Llega a tu meta de proteína. Idea de hoy: requesón o queso cottage con fruta","type":"nutricion"}]$plan$::jsonb),
  ('agua-21', $plan$[{"t":"Toma 8 vasos de agua. Truco: un vaso al despertar","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: una botella en el escritorio","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: un vaso antes de cada comida","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: agua con limón o pepino si te aburre","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: un vaso al llegar del gym","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: una alarma cada 2 horas","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: un vaso antes de dormir","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: un vaso al despertar","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: una botella en el escritorio","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: un vaso antes de cada comida","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: agua con limón o pepino si te aburre","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: un vaso al llegar del gym","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: una alarma cada 2 horas","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: un vaso antes de dormir","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: un vaso al despertar","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: una botella en el escritorio","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: un vaso antes de cada comida","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: agua con limón o pepino si te aburre","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: un vaso al llegar del gym","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: una alarma cada 2 horas","type":"habito","target":8},{"t":"Toma 8 vasos de agua. Truco: un vaso antes de dormir","type":"habito","target":8}]$plan$::jsonb),
  ('pasos-14', $plan$[{"t":"Llega a 10,000 pasos. Idea de hoy: camina después de comer: 10 min suman unos 1.000 pasos","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: usa escaleras en vez de ascensor","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: haz una llamada caminando","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: bájate una parada antes o estaciona más lejos","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: sal a caminar 20 min con música o un pódcast","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: camina mientras esperas el café o la comida","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: haz dos vueltas extra al súper o al parque","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: camina después de comer: 10 min suman unos 1.000 pasos","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: usa escaleras en vez de ascensor","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: haz una llamada caminando","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: bájate una parada antes o estaciona más lejos","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: sal a caminar 20 min con música o un pódcast","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: camina mientras esperas el café o la comida","type":"pasos","target":10000},{"t":"Llega a 10,000 pasos. Idea de hoy: haz dos vueltas extra al súper o al parque","type":"pasos","target":10000}]$plan$::jsonb),
  ('sin-azucar-7', $plan$[{"t":"Saca de casa o del escritorio los dulces y bebidas azucaradas","type":"habito"},{"t":"Cero refrescos y jugos: agua, café o té sin azúcar","type":"habito"},{"t":"Lee la etiqueta de 3 productos que comes seguido y busca azúcar añadida","type":"habito"},{"t":"Postre: fruta entera o yogur natural con canela","type":"nutricion"},{"t":"Café o té sin azúcar todo el día (puedes usar canela o vainilla)","type":"habito"},{"t":"Prepara una merienda con proteína para no llegar con hambre a la tarde","type":"nutricion"},{"t":"Día 7: anota cómo cambió tu energía y tu antojo de dulce","type":"habito"}]$plan$::jsonb),
  ('movilidad-14', $plan$[{"t":"10 min de movilidad de cadera (sigue la rutina guiada en Ejercicios)","type":"tiempo","target":600},{"t":"10 min de movilidad de hombros (sigue la rutina guiada en Ejercicios)","type":"tiempo","target":600},{"t":"10 min de movilidad de columna (sigue la rutina guiada en Ejercicios)","type":"tiempo","target":600},{"t":"10 min de movilidad de tobillos (sigue la rutina guiada en Ejercicios)","type":"tiempo","target":600},{"t":"10 min de movilidad de isquiotibiales (sigue la rutina guiada en Ejercicios)","type":"tiempo","target":600},{"t":"10 min de movilidad de pecho y espalda alta (sigue la rutina guiada en Ejercicios)","type":"tiempo","target":600},{"t":"10 min de movilidad de cuerpo completo (sigue la rutina guiada en Ejercicios)","type":"tiempo","target":600},{"t":"10 min de movilidad de cadera (sigue la rutina guiada en Ejercicios)","type":"tiempo","target":600},{"t":"10 min de movilidad de hombros (sigue la rutina guiada en Ejercicios)","type":"tiempo","target":600},{"t":"10 min de movilidad de columna (sigue la rutina guiada en Ejercicios)","type":"tiempo","target":600},{"t":"10 min de movilidad de tobillos (sigue la rutina guiada en Ejercicios)","type":"tiempo","target":600},{"t":"10 min de movilidad de isquiotibiales (sigue la rutina guiada en Ejercicios)","type":"tiempo","target":600},{"t":"10 min de movilidad de pecho y espalda alta (sigue la rutina guiada en Ejercicios)","type":"tiempo","target":600},{"t":"10 min de movilidad de cuerpo completo (sigue la rutina guiada en Ejercicios)","type":"tiempo","target":600}]$plan$::jsonb),
  ('abdomen-21', $plan$[{"t":"2 rondas: 12 crunches, 8 elevaciones de piernas, 25 s de plancha y 10 bichos muertos por lado","type":"reps","target":12},{"t":"2 rondas: 13 crunches, 8 elevaciones de piernas, 27 s de plancha y 10 bichos muertos por lado","type":"reps","target":13},{"t":"2 rondas: 14 crunches, 8 elevaciones de piernas, 29 s de plancha y 10 bichos muertos por lado","type":"reps","target":14},{"t":"2 rondas: 15 crunches, 8 elevaciones de piernas, 31 s de plancha y 10 bichos muertos por lado","type":"reps","target":15},{"t":"2 rondas: 16 crunches, 8 elevaciones de piernas, 33 s de plancha y 10 bichos muertos por lado","type":"reps","target":16},{"t":"2 rondas: 17 crunches, 8 elevaciones de piernas, 35 s de plancha y 10 bichos muertos por lado","type":"reps","target":17},{"t":"Día suave: 5 min de respiración diafragmática y 2 planchas de 30 s","type":"descanso"},{"t":"3 rondas: 16 crunches, 11 elevaciones de piernas, 35 s de plancha y 10 bichos muertos por lado","type":"reps","target":16},{"t":"3 rondas: 17 crunches, 11 elevaciones de piernas, 37 s de plancha y 10 bichos muertos por lado","type":"reps","target":17},{"t":"3 rondas: 18 crunches, 11 elevaciones de piernas, 39 s de plancha y 10 bichos muertos por lado","type":"reps","target":18},{"t":"3 rondas: 19 crunches, 11 elevaciones de piernas, 41 s de plancha y 10 bichos muertos por lado","type":"reps","target":19},{"t":"3 rondas: 20 crunches, 11 elevaciones de piernas, 43 s de plancha y 10 bichos muertos por lado","type":"reps","target":20},{"t":"3 rondas: 21 crunches, 11 elevaciones de piernas, 45 s de plancha y 10 bichos muertos por lado","type":"reps","target":21},{"t":"Día suave: 5 min de respiración diafragmática y 2 planchas de 30 s","type":"descanso"},{"t":"4 rondas: 20 crunches, 14 elevaciones de piernas, 45 s de plancha y 10 bichos muertos por lado","type":"reps","target":20},{"t":"4 rondas: 21 crunches, 14 elevaciones de piernas, 47 s de plancha y 10 bichos muertos por lado","type":"reps","target":21},{"t":"4 rondas: 22 crunches, 14 elevaciones de piernas, 49 s de plancha y 10 bichos muertos por lado","type":"reps","target":22},{"t":"4 rondas: 23 crunches, 14 elevaciones de piernas, 51 s de plancha y 10 bichos muertos por lado","type":"reps","target":23},{"t":"4 rondas: 24 crunches, 14 elevaciones de piernas, 53 s de plancha y 10 bichos muertos por lado","type":"reps","target":24},{"t":"4 rondas: 25 crunches, 14 elevaciones de piernas, 55 s de plancha y 10 bichos muertos por lado","type":"reps","target":25},{"t":"Día final: 4 rondas del circuito completo y anota cuántos crunches seguidos haces ahora","type":"reps","target":4}]$plan$::jsonb),
  ('gluteos-30', $plan$[{"t":"12 puentes de glúteo, 12 sentadillas y 10 zancadas por pierna, 3 rondas","type":"reps","target":12},{"t":"12 patadas de glúteo por pierna, 12 sentadillas sumo y 30 s de puente sostenido, 3 rondas","type":"reps","target":12},{"t":"13 hip thrust en el piso o sofá, 8 zancadas reversas por pierna y 20 abducciones por lado, 3 rondas","type":"reps","target":13},{"t":"13 puentes de glúteo, 13 sentadillas y 10 zancadas por pierna, 3 rondas","type":"reps","target":13},{"t":"14 patadas de glúteo por pierna, 14 sentadillas sumo y 30 s de puente sostenido, 3 rondas","type":"reps","target":14},{"t":"Descanso activo: camina 20 min y estira cadera y glúteos 5 min","type":"descanso"},{"t":"15 puentes de glúteo, 15 sentadillas y 10 zancadas por pierna, 3 rondas","type":"reps","target":15},{"t":"15 patadas de glúteo por pierna, 15 sentadillas sumo y 30 s de puente sostenido, 3 rondas","type":"reps","target":15},{"t":"16 hip thrust en el piso o sofá, 10 zancadas reversas por pierna y 20 abducciones por lado, 3 rondas","type":"reps","target":16},{"t":"16 puentes de glúteo, 16 sentadillas y 10 zancadas por pierna, 3 rondas","type":"reps","target":16},{"t":"16 patadas de glúteo por pierna, 16 sentadillas sumo y 30 s de puente sostenido, 3 rondas","type":"reps","target":16},{"t":"Descanso activo: camina 20 min y estira cadera y glúteos 5 min","type":"descanso"},{"t":"17 puentes de glúteo, 17 sentadillas y 10 zancadas por pierna, 3 rondas","type":"reps","target":17},{"t":"18 patadas de glúteo por pierna, 18 sentadillas sumo y 30 s de puente sostenido, 3 rondas","type":"reps","target":18},{"t":"18 hip thrust en el piso o sofá, 11 zancadas reversas por pierna y 20 abducciones por lado, 3 rondas","type":"reps","target":18},{"t":"19 puentes de glúteo, 19 sentadillas y 10 zancadas por pierna, 3 rondas","type":"reps","target":19},{"t":"19 patadas de glúteo por pierna, 19 sentadillas sumo y 30 s de puente sostenido, 3 rondas","type":"reps","target":19},{"t":"Descanso activo: camina 20 min y estira cadera y glúteos 5 min","type":"descanso"},{"t":"20 puentes de glúteo, 20 sentadillas y 10 zancadas por pierna, 3 rondas","type":"reps","target":20},{"t":"21 patadas de glúteo por pierna, 21 sentadillas sumo y 30 s de puente sostenido, 3 rondas","type":"reps","target":21},{"t":"21 hip thrust en el piso o sofá, 13 zancadas reversas por pierna y 20 abducciones por lado, 3 rondas","type":"reps","target":21},{"t":"21 puentes de glúteo, 21 sentadillas y 10 zancadas por pierna, 3 rondas","type":"reps","target":21},{"t":"22 patadas de glúteo por pierna, 22 sentadillas sumo y 30 s de puente sostenido, 3 rondas","type":"reps","target":22},{"t":"Descanso activo: camina 20 min y estira cadera y glúteos 5 min","type":"descanso"},{"t":"23 puentes de glúteo, 23 sentadillas y 10 zancadas por pierna, 3 rondas","type":"reps","target":23},{"t":"23 patadas de glúteo por pierna, 23 sentadillas sumo y 30 s de puente sostenido, 3 rondas","type":"reps","target":23},{"t":"24 hip thrust en el piso o sofá, 14 zancadas reversas por pierna y 20 abducciones por lado, 3 rondas","type":"reps","target":24},{"t":"24 puentes de glúteo, 24 sentadillas y 10 zancadas por pierna, 3 rondas","type":"reps","target":24},{"t":"25 patadas de glúteo por pierna, 25 sentadillas sumo y 30 s de puente sostenido, 3 rondas","type":"reps","target":25},{"t":"Descanso activo: camina 20 min y estira cadera y glúteos 5 min","type":"descanso"}]$plan$::jsonb),
  ('pierde-3kg-6-semanas', $plan$[{"t":"Entreno de fuerza de tu rutina y llega a tu proteína","type":"entreno"},{"t":"Caminata de 40 min a paso rápido y cena con media porción de carbohidrato","type":"pasos"},{"t":"Entreno de fuerza de tu rutina y registra todas tus comidas","type":"entreno"},{"t":"Intervalos suaves: 10 x (1 min rápido, 1 min lento) caminando o en bici","type":"entreno"},{"t":"Entreno de fuerza de tu rutina y 2 litros de agua","type":"entreno"},{"t":"Caminata de 50 min o actividad que disfrutes (bailar, nadar, bici)","type":"pasos"},{"t":"Descanso: pésate al despertar, revisa la semana y planea tus comidas","type":"descanso"},{"t":"Entreno de fuerza de tu rutina y llega a tu proteína","type":"entreno"},{"t":"Caminata de 40 min a paso rápido y cena con media porción de carbohidrato","type":"pasos"},{"t":"Entreno de fuerza de tu rutina y registra todas tus comidas","type":"entreno"},{"t":"Intervalos suaves: 10 x (1 min rápido, 1 min lento) caminando o en bici","type":"entreno"},{"t":"Entreno de fuerza de tu rutina y 2 litros de agua","type":"entreno"},{"t":"Caminata de 50 min o actividad que disfrutes (bailar, nadar, bici)","type":"pasos"},{"t":"Descanso: pésate al despertar, revisa la semana y planea tus comidas","type":"descanso"},{"t":"Entreno de fuerza de tu rutina y llega a tu proteína","type":"entreno"},{"t":"Caminata de 40 min a paso rápido y cena con media porción de carbohidrato","type":"pasos"},{"t":"Entreno de fuerza de tu rutina y registra todas tus comidas","type":"entreno"},{"t":"Intervalos suaves: 10 x (1 min rápido, 1 min lento) caminando o en bici","type":"entreno"},{"t":"Entreno de fuerza de tu rutina y 2 litros de agua","type":"entreno"},{"t":"Caminata de 50 min o actividad que disfrutes (bailar, nadar, bici)","type":"pasos"},{"t":"Descanso: pésate al despertar, revisa la semana y planea tus comidas","type":"descanso"},{"t":"Entreno de fuerza de tu rutina y llega a tu proteína","type":"entreno"},{"t":"Caminata de 40 min a paso rápido y cena con media porción de carbohidrato","type":"pasos"},{"t":"Entreno de fuerza de tu rutina y registra todas tus comidas","type":"entreno"},{"t":"Intervalos suaves: 10 x (1 min rápido, 1 min lento) caminando o en bici","type":"entreno"},{"t":"Entreno de fuerza de tu rutina y 2 litros de agua","type":"entreno"},{"t":"Caminata de 50 min o actividad que disfrutes (bailar, nadar, bici)","type":"pasos"},{"t":"Descanso: pésate al despertar, revisa la semana y planea tus comidas","type":"descanso"},{"t":"Entreno de fuerza de tu rutina y llega a tu proteína","type":"entreno"},{"t":"Caminata de 40 min a paso rápido y cena con media porción de carbohidrato","type":"pasos"},{"t":"Entreno de fuerza de tu rutina y registra todas tus comidas","type":"entreno"},{"t":"Intervalos suaves: 10 x (1 min rápido, 1 min lento) caminando o en bici","type":"entreno"},{"t":"Entreno de fuerza de tu rutina y 2 litros de agua","type":"entreno"},{"t":"Caminata de 50 min o actividad que disfrutes (bailar, nadar, bici)","type":"pasos"},{"t":"Descanso: pésate al despertar, revisa la semana y planea tus comidas","type":"descanso"},{"t":"Entreno de fuerza de tu rutina y llega a tu proteína","type":"entreno"},{"t":"Caminata de 40 min a paso rápido y cena con media porción de carbohidrato","type":"pasos"},{"t":"Entreno de fuerza de tu rutina y registra todas tus comidas","type":"entreno"},{"t":"Intervalos suaves: 10 x (1 min rápido, 1 min lento) caminando o en bici","type":"entreno"},{"t":"Entreno de fuerza de tu rutina y 2 litros de agua","type":"entreno"},{"t":"Caminata de 50 min o actividad que disfrutes (bailar, nadar, bici)","type":"pasos"},{"t":"Último día: pésate, toma tus medidas y compara con el día 1","type":"descanso"}]$plan$::jsonb),
  ('dominadas-desde-cero', $plan$[{"t":"4 colgadas de 10 s en barra y 3 x 8 remos invertidos bajo una mesa","type":"tiempo","target":10},{"t":"4 colgadas de 12 s en barra y 3 x 8 remos invertidos bajo una mesa","type":"tiempo","target":12},{"t":"Descanso: movilidad de hombros 5 min (círculos y estiramiento de dorsales)","type":"descanso"},{"t":"4 colgadas de 16 s en barra y 3 x 8 remos invertidos bajo una mesa","type":"tiempo","target":16},{"t":"4 colgadas de 18 s en barra y 3 x 8 remos invertidos bajo una mesa","type":"tiempo","target":18},{"t":"Descanso: movilidad de hombros 5 min (círculos y estiramiento de dorsales)","type":"descanso"},{"t":"4 colgadas de 22 s en barra y 3 x 8 remos invertidos bajo una mesa","type":"tiempo","target":22},{"t":"3 x 3 dominadas negativas (bajar en 5 s) y 3 x 10 remos invertidos","type":"reps","target":9},{"t":"Descanso: movilidad de hombros 5 min (círculos y estiramiento de dorsales)","type":"descanso"},{"t":"3 x 3 dominadas negativas (bajar en 5 s) y 3 x 10 remos invertidos","type":"reps","target":9},{"t":"3 x 3 dominadas negativas (bajar en 5 s) y 3 x 10 remos invertidos","type":"reps","target":9},{"t":"Descanso: movilidad de hombros 5 min (círculos y estiramiento de dorsales)","type":"descanso"},{"t":"4 x 3 dominadas negativas (bajar en 5 s) y 3 x 10 remos invertidos","type":"reps","target":12},{"t":"4 x 3 dominadas negativas (bajar en 5 s) y 3 x 10 remos invertidos","type":"reps","target":12},{"t":"Descanso: movilidad de hombros 5 min (círculos y estiramiento de dorsales)","type":"descanso"},{"t":"4 x 4 negativas de 5 s, 3 x 5 dominadas con banda o con pie de apoyo","type":"reps","target":16},{"t":"4 x 4 negativas de 5 s, 3 x 5 dominadas con banda o con pie de apoyo","type":"reps","target":16},{"t":"Descanso: movilidad de hombros 5 min (círculos y estiramiento de dorsales)","type":"descanso"},{"t":"5 x 4 negativas de 5 s, 3 x 5 dominadas con banda o con pie de apoyo","type":"reps","target":20},{"t":"5 x 4 negativas de 5 s, 3 x 5 dominadas con banda o con pie de apoyo","type":"reps","target":20},{"t":"Descanso: movilidad de hombros 5 min (círculos y estiramiento de dorsales)","type":"descanso"},{"t":"5 intentos de dominada estricta, 3 x 5 asistidas y 3 x 4 negativas","type":"reps","target":5},{"t":"5 intentos de dominada estricta, 3 x 5 asistidas y 3 x 4 negativas","type":"reps","target":5},{"t":"Descanso: movilidad de hombros 5 min (círculos y estiramiento de dorsales)","type":"descanso"},{"t":"5 intentos de dominada estricta, 3 x 5 asistidas y 3 x 4 negativas","type":"reps","target":5},{"t":"5 intentos de dominada estricta, 3 x 5 asistidas y 3 x 4 negativas","type":"reps","target":5},{"t":"Descanso: movilidad de hombros 5 min (círculos y estiramiento de dorsales)","type":"descanso"},{"t":"Prueba final: tu máximo de dominadas estrictas (o negativas controladas). Anótalo","type":"reps","target":5}]$plan$::jsonb),
  ('sprint-verano-28', $plan$[{"t":"Fuerza tren inferior de tu rutina y 8.000 pasos","type":"entreno"},{"t":"Intervalos: 8 x 30 s fuerte, 60 s suave (correr, bici o saltar cuerda)","type":"entreno"},{"t":"Fuerza tren superior de tu rutina y 8.000 pasos","type":"entreno"},{"t":"Caminata larga de 45 min o 10.000 pasos","type":"pasos"},{"t":"Circuito de cuerpo completo: 4 rondas de 10 sentadillas, 10 flexiones, 10 zancadas y 30 s de plancha","type":"entreno"},{"t":"Actividad libre al aire libre de 30 min","type":"habito"},{"t":"Descanso: estira 10 min y prepara tus comidas de la semana","type":"descanso"},{"t":"Fuerza tren inferior de tu rutina y 8.000 pasos","type":"entreno"},{"t":"Intervalos: 9 x 30 s fuerte, 60 s suave (correr, bici o saltar cuerda)","type":"entreno"},{"t":"Fuerza tren superior de tu rutina y 8.000 pasos","type":"entreno"},{"t":"Caminata larga de 45 min o 10.000 pasos","type":"pasos"},{"t":"Circuito de cuerpo completo: 4 rondas de 10 sentadillas, 10 flexiones, 10 zancadas y 30 s de plancha","type":"entreno"},{"t":"Actividad libre al aire libre de 30 min","type":"habito"},{"t":"Descanso: estira 10 min y prepara tus comidas de la semana","type":"descanso"},{"t":"Fuerza tren inferior de tu rutina y 8.000 pasos","type":"entreno"},{"t":"Intervalos: 10 x 30 s fuerte, 60 s suave (correr, bici o saltar cuerda)","type":"entreno"},{"t":"Fuerza tren superior de tu rutina y 8.000 pasos","type":"entreno"},{"t":"Caminata larga de 45 min o 10.000 pasos","type":"pasos"},{"t":"Circuito de cuerpo completo: 4 rondas de 10 sentadillas, 10 flexiones, 10 zancadas y 30 s de plancha","type":"entreno"},{"t":"Actividad libre al aire libre de 30 min","type":"habito"},{"t":"Descanso: estira 10 min y prepara tus comidas de la semana","type":"descanso"},{"t":"Fuerza tren inferior de tu rutina y 8.000 pasos","type":"entreno"},{"t":"Intervalos: 11 x 30 s fuerte, 60 s suave (correr, bici o saltar cuerda)","type":"entreno"},{"t":"Fuerza tren superior de tu rutina y 8.000 pasos","type":"entreno"},{"t":"Caminata larga de 45 min o 10.000 pasos","type":"pasos"},{"t":"Circuito de cuerpo completo: 4 rondas de 10 sentadillas, 10 flexiones, 10 zancadas y 30 s de plancha","type":"entreno"},{"t":"Actividad libre al aire libre de 30 min","type":"habito"},{"t":"Descanso: estira 10 min y prepara tus comidas de la semana","type":"descanso"}]$plan$::jsonb)
on conflict (slug) do nothing;
