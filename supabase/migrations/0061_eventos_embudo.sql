-- 0061: Eventos del embudo guardados en la base (antes solo iban al log del servidor).
-- Sin esto no se podía saber cuántas personas abren el entreno, hacen su primera serie o se van a la mitad:
-- la fila de workouts solo existe cuando se guarda el entreno terminado.
-- Solo el servidor (service_role) escribe y lee: /api/track escribe; los totales se consultan desde el servidor.

create table if not exists public.funnel_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  path text check (path is null or char_length(path) <= 120),
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 2048),
  created_at timestamptz not null default now()
);
create index if not exists funnel_events_name_at on public.funnel_events (name, created_at desc);
create index if not exists funnel_events_user_at on public.funnel_events (user_id, created_at desc) where user_id is not null;
alter table public.funnel_events enable row level security;
revoke all on public.funnel_events from anon, authenticated;
grant select, insert, delete on public.funnel_events to service_role;

comment on table public.funnel_events is 'Eventos del embudo (abrir entreno, primera serie, resumen, guardado, salida). Escribe solo /api/track con service_role.';
