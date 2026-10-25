-- Banana Burn · 0053 condominios afiliados (enlace del condominio y primer mes gratis para sus residentes)
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0052.
-- Qué hace (decisión del dueño, oct 2026):
--   1. condos: cada condominio afiliado, con su código único para el enlace https://www.bananaburn.app/c/<código>.
--      Estados: 'mes_gratis' (fechas del mes gratis), 'activo' (el condominio eligió plan y lo paga fuera de la app hasta
--      paid_until) y 'terminado' (el enlace deja de servir y no se extiende el acceso de nadie).
--   2. condo_members: qué cuenta se vinculó a qué condominio. Una cuenta pertenece a un solo condominio.
--   3. comp_grants.source admite 'condominio': el acceso de los residentes es una cortesía (plan completo el mes gratis,
--      el plan que elija el condominio después). Una sola fila 'condominio' por cuenta (índice único): el mes gratis
--      se da una vez por cuenta. Las cortesías no generan comisión de referidores (regla de 0051).
--   4. Escriben solo el servidor (service_role) y el panel (por el servidor). Un residente ve solo su vínculo y el nombre
--      y estado de su condominio; nadie ve otros condominios ni quién más vive ahí. El staff de soporte lee todo.
--   5. b2b_leads.portfolio: "¿Administran varios condominios? ¿Cuántos?" del formulario de /condominios.

-- ───────────── 1. Solicitudes: cuántos condominios administran ─────────────
alter table public.b2b_leads add column if not exists portfolio text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'b2b_leads_portfolio_len' and conrelid = 'public.b2b_leads'::regclass) then
    alter table public.b2b_leads add constraint b2b_leads_portfolio_len check (portfolio is null or char_length(portfolio) <= 40);
  end if;
end $$;

-- ───────────── 2. Condominios afiliados ─────────────
create table if not exists public.condos (
  id bigint generated always as identity primary key,
  code text not null unique check (code ~ '^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$'),
  name text not null check (char_length(name) between 2 and 80),
  admin_company text check (admin_company is null or char_length(admin_company) <= 100),
  units integer check (units is null or units between 1 and 20000),
  status text not null default 'mes_gratis' check (status in ('mes_gratis', 'activo', 'terminado')),
  free_starts_at timestamptz not null default now(),
  free_ends_at timestamptz not null default (now() + interval '30 days'),
  paid_plan text check (paid_plan is null or paid_plan in ('entreno', 'completo')),
  paid_until timestamptz,
  lead_id bigint references public.b2b_leads(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (free_ends_at > free_starts_at),
  check (status <> 'activo' or (paid_plan is not null and paid_until is not null))
);
create index if not exists condos_status_idx on public.condos (status, created_at desc);

drop trigger if exists condos_touch on public.condos;
create trigger condos_touch before update on public.condos for each row execute function public.touch_updated_at();

-- ───────────── 3. Residentes vinculados ─────────────
create table if not exists public.condo_members (
  id bigint generated always as identity primary key,
  condo_id bigint not null references public.condos(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  grant_id bigint references public.comp_grants(id) on delete set null,
  joined_at timestamptz not null default now(),
  ending_notified_at timestamptz
);
create index if not exists condo_members_condo_idx on public.condo_members (condo_id, joined_at desc);

-- ───────────── 4. Cortesía del condominio ─────────────
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'comp_grants_source_check' and conrelid = 'public.comp_grants'::regclass) then
    alter table public.comp_grants drop constraint comp_grants_source_check;
  end if;
  alter table public.comp_grants add constraint comp_grants_source_check check (source in ('cortesia', 'regalo', 'referido', 'tester', 'afiliado', 'condominio'));
end $$;
create unique index if not exists comp_grants_condo_once on public.comp_grants (user_id) where source = 'condominio';

-- ───────────── 5. Permisos ─────────────
-- condos: un residente lee solo su condominio y solo columnas sin datos internos (sin notas, sin quién lo creó).
alter table public.condos enable row level security;
revoke all on public.condos from public, anon, authenticated;
grant select (id, code, name, status, free_ends_at, paid_plan, paid_until) on public.condos to authenticated;
drop policy if exists "condominios: el propio o staff de soporte" on public.condos;
create policy "condominios: el propio o staff de soporte" on public.condos for select to authenticated
  using ((select public.is_support_staff()) or exists (select 1 from public.condo_members m where m.condo_id = condos.id and m.user_id = (select auth.uid())));

-- condo_members: cada persona ve solo su propio vínculo; nadie ve quién más vive en el condominio.
alter table public.condo_members enable row level security;
revoke all on public.condo_members from public, anon, authenticated;
grant select on public.condo_members to authenticated;
drop policy if exists "residentes de condominio: el propio o staff de soporte" on public.condo_members;
create policy "residentes de condominio: el propio o staff de soporte" on public.condo_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_support_staff()));
