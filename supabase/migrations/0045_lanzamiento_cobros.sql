-- Banana Burn · 0045 lanzamiento: 7 días más para las cuentas de la beta, huella de tarjeta para la promoción
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0043 (y 0044 si existe).
-- Qué hace (decisiones del dueño, 24 de octubre de 2026):
--   1. Las cuentas creadas durante la beta (antes de _beta_ends_at(), el lanzamiento del 1 de noviembre) siguen con acceso
--      completo y gratis 7 días después del lanzamiento: hasta _beta_grace_until() = _beta_ends_at() + 7 días (final del
--      7 de noviembre en Costa Rica, 2026-11-08 06:00 UTC). Misma fecha que BETA_GRACE_UNTIL en src/lib/plans.ts.
--      _trial_live() la incluye, así que _has_app_access() y _has_nutrition_access() (0026) la respetan sin cambiarlas.
--      Las cuentas nuevas desde el lanzamiento siguen con sus 7 días desde el registro (0043).
--   2. Ninguna cuenta de la beta se cobra antes de esa fecha: los cobros programados de la beta (kind 'beta') que caían
--      antes pasan a _beta_grace_until() (fin de la prueba, cobro y próximo intento; el aviso de 2 días antes vuelve a
--      salir para la fecha nueva). El servidor además nunca cobra una fila 'beta' antes de esa fecha (trial-billing.ts).
--   3. card_fingerprints: huella (sha256) de cada tarjeta guardada, por cuenta. La promoción del 50 % del primer mes no se
--      da a una tarjeta que ya la recibió o ya pagó en otra cuenta. Solo service_role lee y escribe: nadie la ve por la API.

-- ───────────── 1. Fin del acceso gratis de las cuentas de la beta ─────────────
create or replace function public._beta_grace_until()
returns timestamptz language sql stable set search_path = public as $$
  select public._beta_ends_at() + interval '7 days';
$$;
revoke all on function public._beta_grace_until() from public, anon, authenticated;

create or replace function public._trial_live(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    -- 0043: cuenta nueva desde el lanzamiento, 7 días desde el registro.
    exists (
      select 1 from public.profiles p
       where p.id = p_user
         and p.created_at >= public._beta_ends_at()
         and now() < p.created_at + interval '7 days')
    -- 0045: cuenta de la beta, gratis hasta 7 días después del lanzamiento.
    or exists (
      select 1 from public.profiles p
       where p.id = p_user
         and p.created_at < public._beta_ends_at()
         and now() < public._beta_grace_until())
    -- Regla de 0026 (prueba con tarjeta): se conserva para quien ya la tenía.
    or exists (
      select 1
        from public.trial_charges t
        join public.payment_methods m on m.user_id = t.user_id
        join public.profiles p on p.id = t.user_id
       where t.user_id = p_user
         and t.kind = 'prueba'
         and t.status in ('scheduled', 'canceled')
         and p.created_at >= public._beta_ends_at()
         and now() < t.trial_ends_at));
$$;
revoke all on function public._trial_live(uuid) from public, anon, authenticated;

-- Regalos: un regalo para una cuenta de la beta empieza al terminar sus 7 días después del lanzamiento.
create or replace function public._access_covered_until(p_user uuid, p_plan text)
returns timestamptz language sql stable security definer set search_path = public as $$
  select greatest(
    now(),
    (select public._beta_ends_at() where public._beta_ends_at() > now()),
    (select public._beta_grace_until() from public.profiles p
      where p.id = p_user and p.created_at < public._beta_ends_at() and public._beta_grace_until() > now()),
    (select p.created_at + interval '7 days' from public.profiles p
      where p.id = p_user and p.created_at >= public._beta_ends_at() and p.created_at + interval '7 days' > now()),
    (select t.trial_ends_at from public.trial_charges t where t.user_id = p_user and public._trial_live(p_user)),
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

-- ───────────── 2. Cobros de la beta: nunca antes del fin de sus 7 días ─────────────
-- Filas movidas por el mes de tester (0029, moved_from): si el cobro ya quedaba después, solo se alarga el fin de la prueba
-- (trial_charges_dates permite charge_at > trial_ends_at con moved_from); si quedaba antes, ambos pasan a la fecha nueva.
update public.trial_charges
   set trial_ends_at = greatest(trial_ends_at, public._beta_grace_until()),
       charge_at = greatest(charge_at, public._beta_grace_until()),
       next_attempt_at = case when next_attempt_at is null then null else greatest(next_attempt_at, public._beta_grace_until()) end,
       reminder_sent_at = case when charge_at < public._beta_grace_until() then null else reminder_sent_at end,
       updated_at = now()
 where kind = 'beta'
   and status in ('scheduled', 'retry_scheduled')
   and (charge_at < public._beta_grace_until() or trial_ends_at < public._beta_grace_until());

-- ───────────── 3. Huella de tarjeta (promoción una vez por tarjeta) ─────────────
create table if not exists public.card_fingerprints (
  key text primary key check (char_length(key) between 10 and 200),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null check (provider in ('onvo', 'tilopay')),
  promo boolean not null default false,
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists card_fingerprints_fp_idx on public.card_fingerprints (fingerprint);
create index if not exists card_fingerprints_user_idx on public.card_fingerprints (user_id);
alter table public.card_fingerprints enable row level security;
revoke all on public.card_fingerprints from public, anon, authenticated;

-- Comprobación (solo lee).
select 'ok 0045' as migracion,
  to_regprocedure('public._beta_grace_until()') is not null as grace,
  public._beta_grace_until() = public._beta_ends_at() + interval '7 days' as grace_7_dias,
  to_regclass('public.card_fingerprints') is not null as huellas,
  (select count(*) from public.trial_charges where kind = 'beta' and status in ('scheduled', 'retry_scheduled') and charge_at < public._beta_grace_until()) = 0 as cobros_beta_movidos;
