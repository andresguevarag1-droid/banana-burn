-- #269 (cambio del 10 nov 2026): la tarjeta obligatoria en el registro se adelanta al 1 de diciembre de 2026, 00:00 de
-- Costa Rica (06:00 UTC). La prueba sigue siendo de 7 días gratis. Solo cambia la fecha: _trial_live() (0067) ya la lee de
-- aquí. Misma fecha que CARD_REQUIRED_FROM en src/lib/card-required.ts.
-- Correr antes del 1 de diciembre. Si no se corre, la base seguiría con el 1 de enero y entre el 1 y el 31 de diciembre
-- daría la prueba sin tarjeta a cuentas que la app trata como "con tarjeta obligatoria".

create or replace function public._card_required_from()
returns timestamptz language sql immutable set search_path = public as $$
  select timestamptz '2026-12-01 06:00:00+00';
$$;
revoke all on function public._card_required_from() from public, anon, authenticated;
