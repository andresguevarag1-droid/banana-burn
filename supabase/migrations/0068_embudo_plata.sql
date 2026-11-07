-- 0068: Embudo de plata por semana en /admin/embudo (#279). Idempotente.
--   1. Índice por fecha de alta en profiles: el embudo lee solo las cuentas de las últimas 8 semanas.
--   2. Gasto en anuncios por semana (lunes de Costa Rica), escrito a mano por un admin. El resto de la página es solo lectura.

-- ───────────── 1. Índices ─────────────
create index if not exists profiles_created_idx on public.profiles (created_at desc);

-- ───────────── 2. Gasto en anuncios por semana ─────────────
create table if not exists public.ad_spend_weeks (
  week_start date primary key check (extract(isodow from week_start) = 1),
  amount_minor int not null check (amount_minor between 0 and 100000000),
  currency text not null default 'USD' check (currency = 'USD'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.ad_spend_weeks enable row level security;
revoke all on public.ad_spend_weeks from anon, authenticated;
grant select, insert, update on public.ad_spend_weeks to authenticated;
grant all on public.ad_spend_weeks to service_role;
drop policy if exists "gasto en anuncios: admin" on public.ad_spend_weeks;
create policy "gasto en anuncios: admin" on public.ad_spend_weeks for all
  using (public.is_admin()) with check (public.is_admin());

comment on table public.ad_spend_weeks is 'Gasto en anuncios por semana (lunes de Costa Rica), en centavos de USD. Lo escribe un admin en /admin/embudo (#279).';

-- Verificación al aplicar: debe salir true.
select count(*) = 1 as gasto_anuncios_con_rls from pg_policies where schemaname = 'public' and tablename = 'ad_spend_weeks';
