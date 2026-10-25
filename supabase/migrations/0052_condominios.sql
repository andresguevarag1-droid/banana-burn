-- Banana Burn · 0052 solicitudes de condominios (B2B)
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0051.
-- Qué hace (decisión del dueño, oct 2026):
--   1. b2b_leads: las solicitudes de reunión que llegan desde la página oculta /condominios (administraciones y juntas
--      directivas de condominios). Datos de contacto de una persona encargada, no de residentes.
--   2. Solo el servidor (service_role, desde la server action con límite de frecuencia y validación) inserta y cambia filas.
--      Lee solo el staff de soporte y administración (public.is_support_staff(), 0034): el mismo grupo que ve los casos.
--   3. Nadie más la ve: ni anon ni cuentas normales. Las columnas tienen topes para que nadie llene la tabla con basura.

create table if not exists public.b2b_leads (
  id bigint generated always as identity primary key,
  kind text not null default 'condominio' check (kind in ('condominio')),
  name text not null check (char_length(name) between 2 and 80),
  role text not null check (role in ('administrador', 'junta', 'otro')),
  org_name text not null check (char_length(org_name) between 2 and 100),
  units text check (units is null or char_length(units) <= 40),
  location text check (location is null or char_length(location) <= 100),
  email text not null check (char_length(email) between 5 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or char_length(phone) <= 30),
  times text[] not null default '{}' check (array_length(times, 1) is null or array_length(times, 1) <= 3),
  days text check (days is null or char_length(days) <= 80),
  comment text check (comment is null or char_length(comment) <= 1000),
  source text check (source is null or char_length(source) <= 60),
  status text not null default 'nuevo' check (status in ('nuevo', 'contactado', 'reunion', 'cerrado')),
  notes text check (notes is null or char_length(notes) <= 2000),
  ip_hash text check (ip_hash is null or char_length(ip_hash) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists b2b_leads_created_idx on public.b2b_leads (created_at desc);
create index if not exists b2b_leads_status_idx on public.b2b_leads (status, created_at desc);

alter table public.b2b_leads enable row level security;
revoke all on public.b2b_leads from public, anon, authenticated;
grant select on public.b2b_leads to authenticated;
drop policy if exists "solicitudes b2b: staff de soporte" on public.b2b_leads;
create policy "solicitudes b2b: staff de soporte" on public.b2b_leads for select to authenticated
  using ((select public.is_support_staff()));

drop trigger if exists b2b_leads_touch on public.b2b_leads;
create trigger b2b_leads_touch before update on public.b2b_leads for each row execute function public.touch_updated_at();
