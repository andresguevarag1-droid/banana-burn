-- Banana Burn · 0062 llave única de cobro: un mismo cobro nunca se hace dos veces
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0061.
-- Qué hace:
--   charge_keys: antes de llamar a ONVO o Tilopay, el cron (trial-billing.ts, onvo-intro.ts y tilopay-billing.ts) reserva
--   la llave (usuario, periodo, procesador). El índice único parcial deja UNA sola llave "reservado" por combinación: si
--   otro proceso (o una fila duplicada de la misma persona) ya la tiene, el INSERT falla y no se llama al procesador.
--     periodo   'primer_cobro' (el primer cobro de la prueba o de la beta, una vez por cuenta) o el inicio del periodo que
--               se cobra en ISO UTC (renovación de Tilopay, paso a la suscripción normal de ONVO después del 50 %).
--     estado    reservado = se mandó el cobro (cobrado o por confirmar): bloquea otro cobro del mismo periodo.
--               liberado  = se sabe que no se cobró (rechazo, intento devuelto): permite el reintento del mismo periodo.
--   Sin datos personales: solo el id de la cuenta y la referencia del intento (orden o clave, nunca correo ni tarjeta).
--   Solo service_role lee y escribe (RLS sin políticas y sin privilegios para anon ni authenticated).

create table if not exists public.charge_keys (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  periodo text not null check (periodo = 'primer_cobro' or periodo ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'),
  procesador text not null check (procesador in ('onvo', 'tilopay')),
  origen text not null check (origen in ('primer_cobro', 'primer_mes_normal', 'cambio_tarjeta', 'renovacion')),
  referencia text not null check (char_length(referencia) between 1 and 120),
  estado text not null default 'reservado' check (estado in ('reservado', 'liberado')),
  motivo text check (motivo is null or char_length(motivo) <= 120),
  created_at timestamptz not null default now(),
  released_at timestamptz,
  constraint charge_keys_liberada check ((estado = 'liberado') = (released_at is not null))
);
-- La llave: una sola reservada por usuario, periodo y procesador.
create unique index if not exists charge_keys_unica on public.charge_keys (user_id, periodo, procesador) where estado = 'reservado';
create index if not exists charge_keys_user_idx on public.charge_keys (user_id, created_at desc);
alter table public.charge_keys enable row level security;
revoke all on public.charge_keys from public, anon, authenticated;
grant select, insert, update on public.charge_keys to service_role;

comment on table public.charge_keys is 'Llave única de cobro (usuario, periodo, procesador). La reserva el cron antes de llamar a ONVO o Tilopay; se libera solo si no se cobró. Solo service_role.';
