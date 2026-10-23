-- Banana Burn · 0026 tarjeta guardada y prueba de 7 días con cobro el día 7
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0025.
-- Qué hace (decisión del dueño, octubre de 2026):
--   1. payment_methods: la tarjeta que la persona guardó en ONVO. Solo IDs de ONVO, marca, últimos 4 y vencimiento:
--      el número nunca pasa por nuestro servidor (va del navegador a ONVO con la llave publicable).
--      La persona lee su marca, últimos 4, vencimiento y estado (no los IDs). Solo service_role escribe.
--   2. trial_charges: el primer cobro que programamos nosotros (ONVO no documenta pruebas gratis nativas).
--      Una fila por persona y para siempre: una sola prueba por cuenta. idem_key único = clave de idempotencia.
--        prueba     cuenta creada desde el fin de la beta: 7 días con todo y cobro al terminar (día 7).
--        beta       cuenta de la beta que guardó tarjeta antes del fin de la beta: se cobra al terminar la beta (sin días extra).
--        inmediato  cuenta de la beta que guarda tarjeta después del fin de la beta: se cobra en ese momento.
--      Solo service_role escribe. El acceso pagado lo sigue dando SOLO el webhook de ONVO (profiles.plan).
--   3. _trial_live(): prueba de 7 días vigente = cuenta creada desde el fin de la beta + tarjeta guardada (fila en
--      payment_methods) + cobro programado o cancelado antes del día 7 + todavía no llega el día del cobro.
--   4. _has_app_access(), _has_nutrition_access() y _access_covered_until() usan esa prueba en vez de
--      "created_at + 7 días". Quien se registró antes del fin de la beta sin tarjeta no tiene días extra.
--      La fecha del fin de la beta sigue viviendo solo en public._beta_ends_at() (0025).

-- ───────────── 1. Tarjeta guardada ─────────────
create table if not exists public.payment_methods (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'onvo' check (provider = 'onvo'),
  provider_customer_id text not null check (char_length(provider_customer_id) between 1 and 100),
  provider_payment_method_id text not null unique check (char_length(provider_payment_method_id) between 1 and 100),
  brand text check (brand is null or brand ~ '^[a-z_]{1,20}$'),
  last4 text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  exp_month smallint check (exp_month is null or exp_month between 1 and 12),
  exp_year smallint check (exp_year is null or exp_year between 2000 and 2100),
  status text not null default 'active' check (status in ('active', 'disconnected')),
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payment_methods enable row level security;
-- Mínimo privilegio: nadie escribe por la API; la persona solo lee columnas sin IDs del procesador.
revoke all on public.payment_methods from public, anon, authenticated;
grant select (user_id, brand, last4, exp_month, exp_year, status, created_at, updated_at) on public.payment_methods to authenticated;
drop policy if exists "tarjeta: leer la propia" on public.payment_methods;
create policy "tarjeta: leer la propia" on public.payment_methods for select to authenticated using (user_id = auth.uid());

-- ───────────── 2. Primer cobro programado ─────────────
create table if not exists public.trial_charges (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  idem_key text not null unique check (idem_key ~ '^trial:[0-9a-f-]{36}$'),
  kind text not null check (kind in ('prueba', 'beta', 'inmediato')),
  plan text not null check (plan in ('entreno', 'completo')),
  billing text not null check (billing in ('mes', 'anual')),
  amount_minor int not null check (amount_minor between 50 and 1000000),
  currency text not null default 'USD' check (currency = 'USD'),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null,
  charge_at timestamptz not null,
  next_attempt_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'charging', 'pending', 'unknown', 'retry_scheduled', 'failed', 'succeeded', 'canceled', 'superseded')),
  attempts smallint not null default 0 check (attempts between 0 and 6),
  last_attempt_at timestamptz,
  provider_subscription_id text check (provider_subscription_id is null or char_length(provider_subscription_id) between 1 and 100),
  last_error text check (last_error is null or char_length(last_error) <= 300),
  reminder_sent_at timestamptz,
  failure_notified_attempt smallint,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trial_charges_dates check (trial_ends_at >= trial_started_at and charge_at = trial_ends_at),
  -- La prueba dura exactamente 7 días: nadie la alarga con una fila mal armada.
  constraint trial_charges_seven_days check (kind <> 'prueba' or trial_ends_at = trial_started_at + interval '7 days'),
  constraint trial_charges_due check (status not in ('scheduled', 'retry_scheduled') or next_attempt_at is not null)
);
create index if not exists trial_charges_due_idx on public.trial_charges (next_attempt_at) where status in ('scheduled', 'retry_scheduled');
create index if not exists trial_charges_reminder_idx on public.trial_charges (charge_at) where status = 'scheduled' and reminder_sent_at is null;
create index if not exists trial_charges_open_idx on public.trial_charges (updated_at) where status in ('charging', 'unknown', 'pending');
create index if not exists trial_charges_sub_idx on public.trial_charges (provider_subscription_id);
alter table public.trial_charges enable row level security;
revoke insert, update, delete on public.trial_charges from public, anon, authenticated;
revoke all on public.trial_charges from anon;
drop policy if exists "cobro programado: leer el propio" on public.trial_charges;
create policy "cobro programado: leer el propio" on public.trial_charges for select to authenticated using (user_id = auth.uid());

-- ───────────── 3. Prueba de 7 días con tarjeta ─────────────
create or replace function public._trial_live(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and exists (
    select 1
      from public.trial_charges t
      join public.payment_methods m on m.user_id = t.user_id
      join public.profiles p on p.id = t.user_id
     where t.user_id = p_user
       and t.kind = 'prueba'
       and t.status in ('scheduled', 'canceled')
       and p.created_at >= public._beta_ends_at()
       and now() < t.trial_ends_at);
$$;
revoke all on function public._trial_live(uuid) from public, anon, authenticated;

-- ───────────── 4. Acceso: la prueba de 7 días sale de trial_charges, no de created_at ─────────────
create or replace function public._has_app_access(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    now() < public._beta_ends_at()
    or exists (
      select 1 from public.profiles p where p.id = p_user and (
        p.role::text in ('coach','support','admin','superadmin')
        or p.plan in ('entreno','completo','pro')))
    or exists (
      select 1 from public.comp_grants g where g.user_id = p_user and g.revoked_at is null and g.starts_at <= now() and g.expires_at > now())
    or public._trial_live(p_user)
  );
$$;
revoke all on function public._has_app_access(uuid) from public, anon, authenticated;

create or replace function public._has_nutrition_access(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    now() < public._beta_ends_at()
    or exists (
      select 1 from public.profiles p where p.id = p_user and (
        p.role::text in ('coach','support','admin','superadmin')
        or p.plan in ('completo','pro')))
    or exists (
      select 1 from public.comp_grants g where g.user_id = p_user and g.revoked_at is null and g.starts_at <= now() and g.expires_at > now()
        and (g.plan = 'completo' or g.source = 'cortesia'))
    or public._trial_live(p_user)
  );
$$;
revoke all on function public._has_nutrition_access(uuid) from public, anon, authenticated;

-- Un regalo nuevo empieza cuando termina lo que ya cubre a la persona: beta, prueba con tarjeta, regalos y plan pagado.
create or replace function public._access_covered_until(p_user uuid, p_plan text)
returns timestamptz language sql stable security definer set search_path = public as $$
  select greatest(
    now(),
    (select public._beta_ends_at() where public._beta_ends_at() > now()),
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

-- Comprobación (solo lee): cobros programados que siguen abiertos.
select status, kind, count(*) from public.trial_charges group by 1, 2 order by 1, 2;
