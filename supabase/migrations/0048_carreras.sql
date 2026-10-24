-- 0048_carreras.sql: carreras con GPS (/app/correr).
--   1. public.runs: una fila por carrera, privada (solo su dueña o dueño la ve; ni el staff lee el recorrido).
--      El servidor recalcula distancia y tiempos con los puntos (src/lib/runs.ts) y guarda el mapa ya recortado
--      200 m al inicio y al final. Aquí van los topes de plausibilidad por si alguien escribe directo con su sesión.
--   2. Guardar es idempotente: (user_id, client_id) es único; reintentar con el mismo id de carrera no duplica.
--   3. Crear necesita acceso a la app (plan o prueba). Borrar, siempre. No se editan.

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null,
  day date not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  distance_m int not null check (distance_m between 100 and 200000),
  moving_s int not null check (moving_s between 30 and 86400),
  pace_s_km int check (pace_s_km is null or pace_s_km between 60 and 3600),
  splits jsonb not null default '[]'::jsonb check (jsonb_typeof(splits) = 'array' and jsonb_array_length(splits) <= 220),
  track jsonb not null default '[]'::jsonb check (jsonb_typeof(track) = 'array' and pg_column_size(track) <= 500000),
  created_at timestamptz not null default now(),
  unique (user_id, client_id),
  check (ended_at > started_at and ended_at - started_at <= interval '24 hours'),
  -- Más rápido que 25 km/h en promedio no es una carrera a pie.
  check (distance_m::numeric / moving_s <= 6.95)
);
create index if not exists runs_user_day on public.runs (user_id, day desc);

alter table public.runs enable row level security;
drop policy if exists "carreras: ver propias" on public.runs;
create policy "carreras: ver propias" on public.runs for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "carreras: crear con plan" on public.runs;
create policy "carreras: crear con plan" on public.runs for insert to authenticated with check (user_id = (select auth.uid()) and (select public.has_app_access()));
drop policy if exists "carreras: borrar propias" on public.runs;
create policy "carreras: borrar propias" on public.runs for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.runs from anon;
revoke update on public.runs from authenticated;
grant select, insert, delete on public.runs to authenticated;

-- 4. El panel de temporadas (0047) suma las carreras de la temporada (solo totales, sin recorridos).
create or replace function public.admin_season_stats(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select jsonb_build_object(
    'owners', (select count(*) from public.challenge_entitlements where challenge_slug = p_slug),
    'started', (select count(*) from public.user_programs where slug = p_slug),
    'feedback', coalesce((select jsonb_agg(jsonb_build_object('exercise_id', exercise_id, 'week', week, 'liked', liked, 'difficulty', difficulty, 'skipped', skipped, 'completed', completed))
       from public.season_feedback where slug = p_slug), '[]'::jsonb),
    -- Semanas con al menos una sesión hecha, por persona (sin decir quién).
    'weeks', coalesce((select jsonb_agg(ws) from (
       select jsonb_agg(distinct (regexp_match(w.template, ':(\d{1,2})\.\d$'))[1]::int) as ws
         from public.workouts w where w.template like 'p:' || p_slug || ':%' group by w.user_id) x), '[]'::jsonb),
    'intakes', coalesce((select jsonb_agg(answers) from public.season_intake where slug = p_slug), '[]'::jsonb),
    -- Carreras con GPS (0048) de quienes tienen la temporada, dentro de sus fechas: solo totales.
    'runs', (select jsonb_build_object('count', count(*), 'km', round(coalesce(sum(r.distance_m), 0) / 1000.0, 1))
       from public.runs r join public._season_of(p_slug) s on r.day between s.starts_on and s.ends_on
       where r.user_id in (select user_id from public.challenge_entitlements where challenge_slug = p_slug))
  ) into v;
  return v;
end $$;
revoke execute on function public.admin_season_stats(text) from public, anon;
grant execute on function public.admin_season_stats(text) to authenticated;
