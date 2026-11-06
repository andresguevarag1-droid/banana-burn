-- Banana Burn · 0067 tarjeta obligatoria en el registro desde el 1 de enero de 2027 (#269)
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0066.
-- Decisión del dueño (6 nov 2026): desde la medianoche de Costa Rica del 1 de enero de 2027 (2027-01-01 06:00 UTC), cada
-- cuenta nueva deja su tarjeta para empezar sus 7 días gratis. El día 8 se cobra el plan elegido, con el 50 % del primer
-- mes. Las cuentas creadas antes conservan sus reglas (beta, prueba sin tarjeta de 0043 y condominios ya vinculados).
--   1. _card_required_from(): la fecha, la misma que CARD_REQUIRED_FROM en src/lib/card-required.ts.
--   2. _trial_live(): una cuenta creada desde esa fecha tiene la prueba solo con su tarjeta activa y su cobro de la prueba
--      programado. Si ya la dejó y cancela antes del fin de la prueba, conserva el acceso hasta ese día (aunque pida quitar la
--      tarjeta), como promete Mi plan. Igual que entitlements.ts (cardTrialReady en src/lib/trial.ts).
--      _has_app_access() y _has_nutrition_access() la respetan sin cambiarlas.
--   El acceso de un condominio (comp_grants) no cambia: se sigue dando con su cortesía.

create or replace function public._card_required_from()
returns timestamptz language sql immutable set search_path = public as $$
  select timestamptz '2027-01-01 06:00:00+00';
$$;
revoke all on function public._card_required_from() from public, anon, authenticated;

create or replace function public._trial_live(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    -- 0043: cuenta nueva desde el lanzamiento, 7 días desde el registro. 0067: solo si se creó antes de la tarjeta obligatoria.
    exists (
      select 1 from public.profiles p
       where p.id = p_user
         and p.created_at >= public._beta_ends_at()
         and p.created_at < public._card_required_from()
         and now() < p.created_at + interval '7 days')
    -- 0045: cuenta de la beta, gratis hasta 7 días después del lanzamiento.
    or exists (
      select 1 from public.profiles p
       where p.id = p_user
         and p.created_at < public._beta_ends_at()
         and now() < public._beta_grace_until())
    -- Regla de 0026 (prueba con tarjeta). 0067: desde la tarjeta obligatoria, con la tarjeta activa.
    or exists (
      select 1
        from public.trial_charges t
        join public.payment_methods m on m.user_id = t.user_id
        join public.profiles p on p.id = t.user_id
       where t.user_id = p_user
         and t.kind = 'prueba'
         and t.status in ('scheduled', 'canceled')
         and p.created_at >= public._beta_ends_at()
         and (p.created_at < public._card_required_from() or t.status = 'canceled' or m.status = 'active')
         and now() < t.trial_ends_at));
$$;
revoke all on function public._trial_live(uuid) from public, anon, authenticated;
