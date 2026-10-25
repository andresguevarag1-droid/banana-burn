-- Banana Burn · 0051 programa de referidores (afiliados)
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0050.
-- Qué hace (decisión del dueño, oct 2026):
--   1. Rol de referidor: una fila en `affiliates` (no es un rol de staff). Solo superadmin la crea, la edita o la revoca.
--      Revocar deja las comisiones ya ganadas, pero corta la atribución y las comisiones nuevas.
--   2. Invitaciones de un solo uso por correo (hash del token, vencen a los 14 días). Las canjea el servidor (service_role).
--   3. Atribución: `affiliate_referrals` (una fila por cuenta referida, para siempre). Solo el servidor la escribe, solo para
--      cuentas nuevas (menos de 72 h) y nunca a la misma persona. La cuenta referida no la ve ni la cambia.
--   4. Clics: conteo liviano con hash de red (sin IP ni datos personales); se borran a los 180 días.
--   5. Libro de comisiones: una línea por pago verificado (`payment_ref` único = idempotente). pending → available (tras la
--      espera) → paid, o reversed. Ajustes negativos para reembolsos de líneas ya pagadas. Solo service_role escribe.
--   6. Pagos manuales mensuales y método de pago (SINPE Móvil o IBAN). El método lo ve solo su dueño y el superadmin.
--   7. Ajustes del programa (comisiones de los procesadores, impuesto, espera, mínimo, niveles). Solo superadmin.
--   8. comp_grants.source admite 'afiliado' (acceso gratis del nivel 40 %).
-- Lectura: cada referidor ve solo lo suyo; sus referidos llegan anonimizados por my_affiliate_referrals().

-- ───────────── 1. Referidores ─────────────
create table if not exists public.affiliates (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  perk_since timestamptz,
  perk_notice_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.affiliates enable row level security;
revoke all on public.affiliates from public, anon, authenticated;
grant select on public.affiliates to authenticated;
drop policy if exists "referidores: el propio o superadmin" on public.affiliates;
create policy "referidores: el propio o superadmin" on public.affiliates for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_superadmin()));

-- ───────────── 2. Invitaciones ─────────────
create table if not exists public.affiliate_invites (
  id bigint generated always as identity primary key,
  email_norm text not null check (char_length(email_norm) between 3 and 254),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  code text check (code is null or code ~ '^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  canceled_at timestamptz
);
create index if not exists affiliate_invites_email_idx on public.affiliate_invites (email_norm);
alter table public.affiliate_invites enable row level security;
revoke all on public.affiliate_invites from public, anon, authenticated;
grant select on public.affiliate_invites to authenticated;
drop policy if exists "invitaciones de referidor: superadmin" on public.affiliate_invites;
create policy "invitaciones de referidor: superadmin" on public.affiliate_invites for select to authenticated using ((select public.is_superadmin()));

-- ───────────── 3. Atribución ─────────────
create table if not exists public.affiliate_referrals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  affiliate_id uuid not null references public.affiliates(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  clicked_at timestamptz,
  utm jsonb not null default '{}'::jsonb check (pg_column_size(utm) <= 2000),
  check (user_id <> affiliate_id)
);
create index if not exists affiliate_referrals_aff_idx on public.affiliate_referrals (affiliate_id, created_at desc);
alter table public.affiliate_referrals enable row level security;
revoke all on public.affiliate_referrals from public, anon, authenticated;
grant select on public.affiliate_referrals to authenticated;
drop policy if exists "atribución: superadmin" on public.affiliate_referrals;
create policy "atribución: superadmin" on public.affiliate_referrals for select to authenticated using ((select public.is_superadmin()));

-- ───────────── 4. Clics ─────────────
create table if not exists public.affiliate_clicks (
  id bigint generated always as identity primary key,
  affiliate_id uuid not null references public.affiliates(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  ip_hash text check (ip_hash is null or char_length(ip_hash) <= 64),
  path text check (path is null or char_length(path) <= 200),
  utm jsonb not null default '{}'::jsonb check (pg_column_size(utm) <= 2000)
);
create index if not exists affiliate_clicks_aff_idx on public.affiliate_clicks (affiliate_id, created_at desc);
alter table public.affiliate_clicks enable row level security;
revoke all on public.affiliate_clicks from public, anon, authenticated;

-- ───────────── 5. Libro de comisiones ─────────────
create table if not exists public.affiliate_payouts (
  id bigint generated always as identity primary key,
  affiliate_id uuid not null references public.affiliates(user_id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  amount_minor integer not null check (amount_minor > 0),
  status text not null default 'pendiente' check (status in ('pendiente', 'pagado', 'anulado')),
  method jsonb not null default '{}'::jsonb,
  reference text check (reference is null or char_length(reference) <= 120),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  paid_by uuid references auth.users(id) on delete set null
);
create unique index if not exists affiliate_payouts_open_idx on public.affiliate_payouts (affiliate_id, period) where status <> 'anulado';
alter table public.affiliate_payouts enable row level security;
revoke all on public.affiliate_payouts from public, anon, authenticated;
grant select on public.affiliate_payouts to authenticated;
drop policy if exists "pagos a referidores: propios o superadmin" on public.affiliate_payouts;
create policy "pagos a referidores: propios o superadmin" on public.affiliate_payouts for select to authenticated
  using (affiliate_id = (select auth.uid()) or (select public.is_superadmin()));

create table if not exists public.affiliate_commissions (
  id bigint generated always as identity primary key,
  affiliate_id uuid not null references public.affiliates(user_id) on delete cascade,
  referred_user uuid references auth.users(id) on delete set null,
  payment_ref text not null unique check (char_length(payment_ref) between 3 and 200),
  kind text not null default 'pago' check (kind in ('pago', 'ajuste')),
  provider text check (provider is null or provider in ('onvo', 'tilopay')),
  plan text,
  billing text,
  gross_minor integer not null default 0,
  currency text not null default 'USD',
  fee_minor integer not null default 0,
  tax_minor integer not null default 0,
  net_minor integer not null default 0,
  active_count integer not null default 0,
  rate_pct numeric(5,2) not null default 0 check (rate_pct between 0 and 100),
  commission_minor integer not null,
  status text not null default 'pending' check (status in ('pending', 'available', 'paid', 'reversed')),
  available_at timestamptz not null default now(),
  payout_id bigint references public.affiliate_payouts(id) on delete set null,
  note text check (note is null or char_length(note) <= 300),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  check (kind = 'ajuste' or commission_minor >= 0)
);
create index if not exists affiliate_commissions_aff_idx on public.affiliate_commissions (affiliate_id, created_at desc);
create index if not exists affiliate_commissions_due_idx on public.affiliate_commissions (available_at) where status = 'pending';
create index if not exists affiliate_commissions_payout_idx on public.affiliate_commissions (payout_id);
create index if not exists affiliate_commissions_ref_user_idx on public.affiliate_commissions (referred_user);
alter table public.affiliate_commissions enable row level security;
revoke all on public.affiliate_commissions from public, anon, authenticated;
grant select on public.affiliate_commissions to authenticated;
drop policy if exists "comisiones: propias o superadmin" on public.affiliate_commissions;
create policy "comisiones: propias o superadmin" on public.affiliate_commissions for select to authenticated
  using (affiliate_id = (select auth.uid()) or (select public.is_superadmin()));

-- ───────────── 6. Método de pago del referidor ─────────────
create table if not exists public.affiliate_payout_methods (
  user_id uuid primary key references public.affiliates(user_id) on delete cascade,
  kind text not null check (kind in ('sinpe', 'iban')),
  sinpe_phone text check (sinpe_phone is null or sinpe_phone ~ '^[0-9]{8}$'),
  iban text check (iban is null or iban ~ '^[A-Z]{2}[0-9A-Z]{10,32}$'),
  holder_name text not null check (char_length(holder_name) between 2 and 120),
  id_number text check (id_number is null or id_number ~ '^[0-9A-Za-z-]{5,20}$'),
  updated_at timestamptz not null default now(),
  check ((kind = 'sinpe' and sinpe_phone is not null) or (kind = 'iban' and iban is not null))
);
alter table public.affiliate_payout_methods enable row level security;
revoke all on public.affiliate_payout_methods from public, anon, authenticated;
grant select, insert, update, delete on public.affiliate_payout_methods to authenticated;
drop policy if exists "método de pago: el propio o superadmin" on public.affiliate_payout_methods;
create policy "método de pago: el propio o superadmin" on public.affiliate_payout_methods for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_superadmin()));
drop policy if exists "método de pago: crear el propio" on public.affiliate_payout_methods;
create policy "método de pago: crear el propio" on public.affiliate_payout_methods for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.affiliates a where a.user_id = (select auth.uid()) and a.active));
drop policy if exists "método de pago: cambiar el propio" on public.affiliate_payout_methods;
create policy "método de pago: cambiar el propio" on public.affiliate_payout_methods for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "método de pago: borrar el propio" on public.affiliate_payout_methods;
create policy "método de pago: borrar el propio" on public.affiliate_payout_methods for delete to authenticated
  using (user_id = (select auth.uid()));

-- ───────────── 7. Ajustes del programa ─────────────
-- Valores por defecto: comisiones de los procesadores A VERIFICAR con los contratos reales de ONVO y Tilopay.
create table if not exists public.affiliate_settings (
  id smallint primary key default 1 check (id = 1),
  onvo_fee_pct numeric(5,2) not null default 3.90 check (onvo_fee_pct between 0 and 20),
  onvo_fee_fixed_minor integer not null default 35 check (onvo_fee_fixed_minor between 0 and 500),
  tilopay_fee_pct numeric(5,2) not null default 4.25 check (tilopay_fee_pct between 0 and 20),
  tilopay_fee_fixed_minor integer not null default 35 check (tilopay_fee_fixed_minor between 0 and 500),
  tax_pct numeric(5,2) not null default 13.00 check (tax_pct between 0 and 40),
  hold_days integer not null default 30 check (hold_days between 0 and 120),
  min_payout_minor integer not null default 2000 check (min_payout_minor between 0 and 100000),
  cookie_days integer not null default 60 check (cookie_days between 1 and 365),
  tiers jsonb not null default '[{"min":1,"rate":10},{"min":11,"rate":20},{"min":21,"rate":30},{"min":31,"rate":40}]'::jsonb,
  perk_min integer not null default 31 check (perk_min between 1 and 10000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.affiliate_settings (id) values (1) on conflict (id) do nothing;
alter table public.affiliate_settings enable row level security;
revoke all on public.affiliate_settings from public, anon, authenticated;
grant select on public.affiliate_settings to authenticated;
drop policy if exists "ajustes de referidores: referidores y superadmin" on public.affiliate_settings;
create policy "ajustes de referidores: referidores y superadmin" on public.affiliate_settings for select to authenticated
  using ((select public.is_superadmin()) or exists (select 1 from public.affiliates a where a.user_id = (select auth.uid())));

-- ───────────── 8. Acceso gratis del nivel máximo ─────────────
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'comp_grants_source_check' and conrelid = 'public.comp_grants'::regclass) then
    alter table public.comp_grants drop constraint comp_grants_source_check;
  end if;
  alter table public.comp_grants add constraint comp_grants_source_check check (source in ('cortesia', 'regalo', 'referido', 'tester', 'afiliado'));
end $$;

-- ───────────── 9. Funciones ─────────────
-- Referidos pagando HOY: suscripción pagada vigente (o en pago fallido dentro de 3 días de gracia). La prueba gratis, las
-- cortesías y las compras de retos no cuentan. El primer mes con 50 % sí cuenta (es una suscripción pagada).
create or replace function public.affiliate_active_count(p_affiliate uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(distinct r.user_id)::int
  from public.affiliate_referrals r
  join public.subscriptions s on s.user_id = r.user_id
  where r.affiliate_id = p_affiliate
    and s.plan in ('entreno', 'completo')
    and ((s.status = 'active' and coalesce(s.current_period_end, now()) > now())
      or (s.status = 'past_due' and coalesce(s.current_period_end, now()) > now() - interval '3 days'));
$$;
revoke all on function public.affiliate_active_count(uuid) from public, anon, authenticated;

-- Atribución (service_role, al crear la cuenta). Nunca a sí mismo, solo cuentas de menos de 72 h, una sola vez.
create or replace function public.affiliate_attribute(p_user uuid, p_code text, p_utm jsonb default '{}'::jsonb, p_clicked_at timestamptz default null)
returns text language plpgsql security definer set search_path = public as $$
declare a public.affiliates; created timestamptz;
begin
  if p_user is null or p_code is null then return 'sin_datos'; end if;
  select * into a from public.affiliates where code = lower(p_code) and active;
  if not found then return 'codigo_invalido'; end if;
  if a.user_id = p_user then return 'propio'; end if;
  if exists (select 1 from public.affiliates where user_id = p_user) then return 'es_referidor'; end if;
  select u.created_at into created from auth.users u where u.id = p_user;
  if created is null or created < now() - interval '72 hours' then return 'cuenta_existente'; end if;
  if exists (select 1 from public.subscriptions s where s.user_id = p_user and s.status in ('active', 'past_due', 'canceled')) then return 'ya_pagaba'; end if;
  insert into public.affiliate_referrals (user_id, affiliate_id, utm, clicked_at)
    values (p_user, a.user_id, coalesce(p_utm, '{}'::jsonb), p_clicked_at)
    on conflict (user_id) do nothing;
  if not found then return 'ya_atribuida'; end if;
  return 'atribuida';
end $$;
revoke all on function public.affiliate_attribute(uuid, text, jsonb, timestamptz) from public, anon, authenticated;

-- Panel del referidor: sus referidos anonimizados (nombre e inicial del apellido, plan y estado). Sin correos.
create or replace function public.my_affiliate_referrals()
returns table (label text, created_at timestamptz, plan text, status text, earned_minor bigint)
language sql stable security definer set search_path = public as $$
  select
    coalesce(nullif(split_part(trim(p.full_name), ' ', 1), ''), 'Persona') ||
      case when split_part(trim(p.full_name), ' ', 2) <> '' then ' ' || upper(left(split_part(trim(p.full_name), ' ', 2), 1)) || '.' else '' end as label,
    r.created_at,
    s.plan,
    case
      when s.status = 'active' and coalesce(s.current_period_end, now()) > now() then 'pagando'
      when s.status = 'past_due' then 'pago_fallido'
      when s.status = 'canceled' then 'cancelado'
      else 'registrado'
    end as status,
    coalesce((select sum(c.commission_minor) from public.affiliate_commissions c where c.affiliate_id = r.affiliate_id and c.referred_user = r.user_id and c.status <> 'reversed'), 0) as earned_minor
  from public.affiliate_referrals r
  left join public.profiles p on p.id = r.user_id
  left join lateral (select s1.plan, s1.status, s1.current_period_end from public.subscriptions s1 where s1.user_id = r.user_id order by s1.created_at desc limit 1) s on true
  where r.affiliate_id = (select auth.uid())
  order by r.created_at desc
  limit 500;
$$;
revoke all on function public.my_affiliate_referrals() from public, anon;
grant execute on function public.my_affiliate_referrals() to authenticated;

-- Conteos del referidor (clics y registros del mes y totales).
create or replace function public.my_affiliate_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'clicks_total', (select count(*) from public.affiliate_clicks where affiliate_id = (select auth.uid())),
    'clicks_month', (select count(*) from public.affiliate_clicks where affiliate_id = (select auth.uid()) and created_at >= date_trunc('month', now())),
    'signups_total', (select count(*) from public.affiliate_referrals where affiliate_id = (select auth.uid())),
    'signups_month', (select count(*) from public.affiliate_referrals where affiliate_id = (select auth.uid()) and created_at >= date_trunc('month', now())),
    'active', public.affiliate_active_count((select auth.uid()))
  ) where exists (select 1 from public.affiliates where user_id = (select auth.uid()));
$$;
revoke all on function public.my_affiliate_stats() from public, anon;
grant execute on function public.my_affiliate_stats() to authenticated;

-- Limpieza: clics de más de 180 días (lo llama el cron con service_role).
create or replace function public.affiliate_clicks_purge(p_days integer default 180)
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.affiliate_clicks where created_at < now() - make_interval(days => greatest(30, p_days));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.affiliate_clicks_purge(integer) from public, anon, authenticated;
