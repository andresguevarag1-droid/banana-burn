-- 0054_running_carrera.sql: "Mi carrera objetivo" (Banana Run, /app/correr).
--   1. public.race_goals: una carrera objetivo por persona (la próxima). Fecha, distancia, meta de tiempo (o solo
--      terminarla), un resultado reciente para estimar su forma, y si ya sigue su propio plan de carrera (club o
--      entrenador): en ese caso Banana Burn solo arma fuerza, movilidad y técnica alrededor de sus días.
--      El plan por semanas se calcula en el servidor (src/lib/run-plan.ts); aquí solo los datos de la persona.
--   2. Tras la carrera: su tiempo oficial (o el de su carrera con GPS) para celebrar y armar la semana de recuperación.
--   3. Filas propias. Crear o editar necesita acceso a la app (plan o prueba). Borrar, siempre.

create table if not exists public.race_goals (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  name text check (name is null or char_length(name) between 1 and 80),
  race_date date not null,
  kind text not null check (kind in ('5k', '10k', '21k', '42k', 'trail')),
  distance_m int not null check (distance_m between 1000 and 120000),
  goal_s int check (goal_s is null or goal_s between 600 and 172800),
  recent_distance_m int check (recent_distance_m is null or recent_distance_m between 1000 and 42195),
  recent_s int check (recent_s is null or recent_s between 180 and 36000),
  own_plan boolean not null default false,
  -- Días (0 = lunes) en que hace series o tempo con su propio plan: la fuerza pesada no va ni ese día ni el anterior.
  hard_days smallint[] not null default '{}' check (cardinality(hard_days) <= 7 and hard_days <@ array[0,1,2,3,4,5,6]::smallint[]),
  plan_start date not null default current_date,
  result_s int check (result_s is null or result_s between 600 and 172800),
  result_run uuid references public.runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recent_s is null or recent_distance_m is not null),
  check (race_date >= plan_start - 7 and race_date <= plan_start + 400)
);

alter table public.race_goals enable row level security;
drop policy if exists "carrera objetivo: ver la propia" on public.race_goals;
create policy "carrera objetivo: ver la propia" on public.race_goals for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "carrera objetivo: crear con plan" on public.race_goals;
create policy "carrera objetivo: crear con plan" on public.race_goals for insert to authenticated with check (user_id = (select auth.uid()) and (select public.has_app_access()));
drop policy if exists "carrera objetivo: editar con plan" on public.race_goals;
create policy "carrera objetivo: editar con plan" on public.race_goals for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (select public.has_app_access()));
drop policy if exists "carrera objetivo: borrar la propia" on public.race_goals;
create policy "carrera objetivo: borrar la propia" on public.race_goals for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.race_goals from anon;
grant select, insert, update, delete on public.race_goals to authenticated;
