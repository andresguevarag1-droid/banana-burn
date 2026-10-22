-- Banana Burn · Pagos con ONVO Pay
-- Solo el webhook (service_role) otorga planes pagados. El cliente nunca escribe en estas tablas.

-- ───────────── Suscripciones: datos del plan y del ciclo ─────────────
alter table public.subscriptions
  add column if not exists plan text check (plan in ('entreno','completo')),
  add column if not exists billing text check (billing in ('mes','anual')),
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists canceled_at timestamptz,
  add column if not exists current_period_start timestamptz,
  add column if not exists last_event_at timestamptz;

-- Estados usados por la app:
--   incomplete  creada en ONVO, esperando el primer pago (sin acceso)
--   active      pagada y vigente
--   past_due    falló una renovación (acceso con gracia hasta current_period_end + 3 días)
--   canceled    cancelada (acceso hasta current_period_end si cancel_at_period_end)
--   expired     venció sin renovar
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('incomplete','active','trialing','past_due','canceled','expired'));

create index if not exists subscriptions_user_created_idx on public.subscriptions (user_id, created_at desc);

-- ───────────── Cliente de ONVO por usuario ─────────────
create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'onvo',
  provider_customer_id text not null unique,
  created_at timestamptz not null default now()
);

alter table public.billing_customers enable row level security;
create policy "cliente de pago: leer propio o staff" on public.billing_customers
  for select using (user_id = auth.uid() or public.is_staff());
-- escrituras solo con service_role (bypassa RLS)

-- ───────────── Bitácora de eventos de pago (idempotencia del webhook) ─────────────
create table if not exists public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null default 'onvo',
  event_key text not null unique,            -- clave de idempotencia derivada del evento
  type text not null,                        -- p. ej. subscription.renewal.succeeded, app.cancel_requested
  user_id uuid references auth.users(id) on delete set null,
  provider_subscription_id text,
  provider_payment_intent_id text,
  amount_minor bigint,                       -- centavos (unidad mínima de la moneda)
  currency text,
  period_start timestamptz,
  period_end timestamptz,
  status text not null default 'received' check (status in ('received','processed','ignored','error')),
  note text,
  payload jsonb not null default '{}'::jsonb,
  attempts int not null default 1,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists payment_events_user_idx on public.payment_events (user_id, received_at desc);
create index if not exists payment_events_sub_idx on public.payment_events (provider_subscription_id);

alter table public.payment_events enable row level security;
create policy "eventos de pago: leer propios o staff" on public.payment_events
  for select using (user_id = auth.uid() or public.is_staff());
-- escrituras solo con service_role (bypassa RLS)
