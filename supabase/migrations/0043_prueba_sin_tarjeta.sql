-- Banana Burn · 0043 prueba sin tarjeta y 50 % del primer mes por dejar la tarjeta lista
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0042.
-- Qué hace (decisión del dueño, 24 de octubre de 2026):
--   1. La prueba de 7 días NO pide tarjeta: cada cuenta creada desde el fin de la beta tiene acceso completo durante 7 días
--      desde su registro (profiles.created_at, que la persona no puede cambiar: guard_profile_privileges). Al terminar sin
--      plan: muro, como antes. Las cuentas de la beta siguen sin días extra. Se mantiene la regla de 0026 (fila de prueba
--      con tarjeta) para no quitarle días a nadie que ya los tenía.
--   2. trial_charges.promo: 'primer_mes_50' cuando la persona dejó su tarjeta lista antes de su primer cobro y nunca pagó
--      (lo decide el servidor). Si el plan es mensual, amount_minor ya es el monto con el 50 % (lo calcula el servidor con
--      plans.ts); el anual va a precio normal. Solo en cobros de la prueba o de la beta (nunca "inmediato").
--      Solo service_role escribe (igual que el resto de trial_charges, 0026); la persona lee su fila.
--   3. _access_covered_until: un regalo nuevo empieza cuando termina la prueba de 7 días (con o sin tarjeta).
--   El acceso pagado lo sigue dando solo un cobro verificado por el servidor (webhook de ONVO o respuesta de Tilopay/ONVO).

-- ───────────── 1. Promoción del primer mes ─────────────
alter table public.trial_charges add column if not exists promo text;
alter table public.trial_charges drop constraint if exists trial_charges_promo_ok;
alter table public.trial_charges add constraint trial_charges_promo_ok
  check (promo is null or (promo = 'primer_mes_50' and kind in ('prueba', 'beta')));
-- Mínimo privilegio (como en 0026): la persona solo lee; nadie escribe por la API.
revoke insert, update, delete on public.trial_charges from public, anon, authenticated;

-- ───────────── 2. Prueba de 7 días desde el registro, sin tarjeta ─────────────
create or replace function public._trial_live(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    exists (
      select 1 from public.profiles p
       where p.id = p_user
         and p.created_at >= public._beta_ends_at()
         and now() < p.created_at + interval '7 days')
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

-- ───────────── 3. Regalos: empiezan al terminar la prueba (con o sin tarjeta) ─────────────
create or replace function public._access_covered_until(p_user uuid, p_plan text)
returns timestamptz language sql stable security definer set search_path = public as $$
  select greatest(
    now(),
    (select public._beta_ends_at() where public._beta_ends_at() > now()),
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

-- ───────────── 4. El primer mes con 50 % en ONVO se cobra como pago único (onvo-pi:<id>) ─────────────
-- Al terminar ese mes, el servidor crea la suscripción normal; el barrido busca solo esas filas.
create index if not exists subscriptions_onvo_intro_idx on public.subscriptions (current_period_end)
  where provider = 'onvo' and provider_subscription_id like 'onvo-pi:%' and status in ('active', 'past_due');

-- Comprobación (solo lee).
select 'ok 0043' as migracion,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'trial_charges' and column_name = 'promo') as promo,
  exists (select 1 from pg_constraint where conname = 'trial_charges_promo_ok') as check_promo;
