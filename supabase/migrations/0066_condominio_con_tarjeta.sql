-- Banana Burn · 0066 condominio gratis hasta una fecha, con tarjeta (piloto Soho Paradisus, noviembre de 2026)
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0065.
-- Decisión del dueño (4 nov 2026): los residentes de Soho Paradisus entran gratis con todo incluido hasta el 31 de
-- diciembre de 2026. La única condición es dejar la tarjeta. Desde el 1 de enero de 2027 se cobra el plan que cada uno
-- eligió, a precio normal (sin el 50 % del primer mes). Solo para Soho Paradisus; los demás condominios siguen con el mes
-- gratis sin tarjeta de 0053.
--   1. condos.card_required: el acceso del condominio se da solo con una tarjeta activa y su cobro programado.
--   2. condos.free_until: el acceso gratis termina en esa fecha fija (no 30 días desde que se activa). El cobro programado
--      de la persona pasa a esa fecha (moved_from guarda la original, como en 0029) y va a precio normal.
--   3. Alta de Soho Paradisus: https://www.bananaburn.app/c/soho-paradisus
-- Medianoche de Costa Rica (UTC-6) del 1 de enero de 2027 = 2027-01-01 06:00 UTC.

alter table public.condos add column if not exists card_required boolean not null default false;
alter table public.condos add column if not exists free_until timestamptz;

insert into public.condos (code, name, status, free_ends_at, card_required, free_until, notes)
values ('soho-paradisus', 'Soho Paradisus', 'mes_gratis', '2027-01-01 06:00:00+00', true, '2027-01-01 06:00:00+00',
        'Piloto: gratis hasta el 31 dic 2026 con tarjeta. Desde el 1 ene 2027 se cobra el plan elegido a precio normal.')
on conflict (code) do update
  set card_required = true, free_until = excluded.free_until, free_ends_at = excluded.free_ends_at, status = 'mes_gratis', updated_at = now();
