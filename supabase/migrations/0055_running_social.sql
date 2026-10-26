-- 0055_running_social.sql: Banana Run, motivación y comunidad.
--   1. XP por correr: cada carrera con GPS guardada suma XP (kind 'run', hasta 100), respaldada por la fila en runs
--      del mismo día (igual que los entrenos). Es la misma función de 0014 con 'run' agregado.
--   2. run_shoes: tus tenis y sus km (se suman las carreras desde que los estrenaste). Un par activo a la vez.
--   3. run_board: tabla semanal de km entre quienes se suman (apagada por defecto). Solo nombre visible y km de la
--      semana, nunca recorridos ni ritmos. run_weekly_board() la lee.

-- ───────────── 1. XP por correr ─────────────
create or replace function public.guard_xp_event()
returns trigger language plpgsql set search_path = public as $$
declare max_xp int; today_sum int; d date; lo date; hi date;
begin
  if not public.is_api_role() then return new; end if; -- servidor (service_role): retos completados, etc.
  if new.user_id is distinct from auth.uid() then raise exception 'No autorizado' using errcode = '42501'; end if;
  -- Serializa el XP de cada usuario: dos pestañas o un doble clic no cuentan dos veces el mismo registro.
  perform pg_advisory_xact_lock(hashtextextended('bb:xp:' || new.user_id::text, 0));
  new.created_at := now();
  new.ref_day := null;
  max_xp := case new.kind
    when 'workout' then 430 when 'pr' then 50 when 'checkin' then 15 when 'weigh' then 10 when 'measure' then 15
    when 'photo' then 20 when 'challenge_day' then 10 when 'onboard' then 50 when 'run' then 100 else null end;
  if new.kind = 'challenge' then raise exception 'El XP de retos lo otorga el servidor' using errcode = '42501'; end if;
  if max_xp is null then raise exception 'Tipo de XP inválido' using errcode = '22023'; end if;
  if new.xp is null or new.xp < 0 or new.xp > max_xp then raise exception 'XP fuera de rango' using errcode = '22023'; end if;

  if new.kind = 'onboard' then
    -- Una vez en la vida y solo con la bienvenida completa.
    if exists (select 1 from public.xp_events where user_id = new.user_id and kind = 'onboard')
       or not exists (select 1 from public.profiles where id = new.user_id and onboarded) then
      return null;
    end if;
  elsif new.kind = 'pr' then
    -- Récords: solo en la misma transacción que el XP de su entreno (máx. 10 por entreno).
    if not exists (select 1 from public.xp_events where user_id = new.user_id and kind = 'workout' and created_at = now())
       or (select count(*) from public.xp_events where user_id = new.user_id and kind = 'pr' and created_at = now()) >= 10 then
      return null;
    end if;
  else
    -- "Hoy" en alguna zona horaria (la del usuario viaja en una cookie): el registro debe ser de hoy.
    lo := (now() at time zone 'Etc/GMT+12')::date;
    hi := (now() at time zone 'Etc/GMT-14')::date;
    select f.day into d from (
      select x.day, x.n from (
        select l.day, 1::bigint as n from public.daily_logs l where new.kind = 'checkin' and l.user_id = new.user_id and l.day between lo and hi
        union all
        select w.day, 1 from public.weights w where new.kind = 'weigh' and w.user_id = new.user_id and w.day between lo and hi
        union all
        select m.day, 1 from public.measurements m where new.kind = 'measure' and m.user_id = new.user_id and m.day between lo and hi
        union all
        select p.day, 1 from public.progress_photos p where new.kind = 'photo' and p.user_id = new.user_id and p.day between lo and hi group by p.day
        union all
        -- Repetir la misma plantilla el mismo día no vuelve a sumar (igual que saveWorkout).
        select w.day, count(distinct w.template) from public.workouts w where new.kind = 'workout' and w.user_id = new.user_id and w.day between lo and hi group by w.day
        union all
        -- Carreras con GPS (0049): una vez por carrera guardada ese día (0055).
        select r.day, count(*) from public.runs r where new.kind = 'run' and r.user_id = new.user_id and r.day between lo and hi group by r.day
        union all
        select c.day, count(*) from public.challenge_checkins c join public.user_challenges uc on uc.id = c.user_challenge_id
         where new.kind = 'challenge_day' and c.user_id = new.user_id and uc.user_id = new.user_id and c.day between lo and hi
           and public.challenge_is_manual(uc.challenge_id)
         group by c.day
      ) x
    ) f
    where f.n > (select count(*) from public.xp_events e where e.user_id = new.user_id and e.kind = new.kind and e.ref_day = f.day)
    order by f.day desc
    limit 1;
    if d is null then return null; end if; -- sin registro que lo respalde (o ya contado): se ignora en silencio
    new.ref_day := d;
  end if;

  select coalesce(sum(xp), 0) into today_sum from public.xp_events where user_id = new.user_id and created_at > now() - interval '24 hours';
  if today_sum + new.xp > 1500 then raise exception 'Tope diario de XP alcanzado' using errcode = 'P0001'; end if;
  return new;
end $$;

-- ───────────── 2. Tenis ─────────────
create table if not exists public.run_shoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  start_km numeric(6,1) not null default 0 check (start_km between 0 and 3000),
  since date not null default current_date,
  retired_on date,
  created_at timestamptz not null default now(),
  check (retired_on is null or retired_on >= since)
);
create unique index if not exists run_shoes_one_active on public.run_shoes (user_id) where retired_on is null;
alter table public.run_shoes enable row level security;
drop policy if exists "tenis: los propios" on public.run_shoes;
create policy "tenis: los propios" on public.run_shoes for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "tenis: crear con plan" on public.run_shoes;
create policy "tenis: crear con plan" on public.run_shoes for insert to authenticated with check (user_id = (select auth.uid()) and (select public.has_app_access()));
drop policy if exists "tenis: editar los propios" on public.run_shoes;
create policy "tenis: editar los propios" on public.run_shoes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "tenis: borrar los propios" on public.run_shoes;
create policy "tenis: borrar los propios" on public.run_shoes for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.run_shoes from anon;
grant select, insert, update, delete on public.run_shoes to authenticated;

-- ───────────── 3. Tabla semanal (opcional) ─────────────
create table if not exists public.run_board (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.run_board enable row level security;
drop policy if exists "tabla de km: la propia" on public.run_board;
create policy "tabla de km: la propia" on public.run_board for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "tabla de km: sumarse" on public.run_board;
create policy "tabla de km: sumarse" on public.run_board for insert to authenticated with check (user_id = (select auth.uid()) and (select public.has_app_access()));
drop policy if exists "tabla de km: salirse" on public.run_board;
create policy "tabla de km: salirse" on public.run_board for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.run_board from anon;
grant select, insert, delete on public.run_board to authenticated;

-- Top 50 de la semana (lunes a domingo, hora de Costa Rica) entre quienes se sumaron. Solo quien también se sumó la ve.
create or replace function public.run_weekly_board()
returns table (pos int, name text, km numeric, me boolean)
language plpgsql stable security definer set search_path = public as $$
declare mon date := date_trunc('week', (now() at time zone 'America/Costa_Rica'))::date;
begin
  if auth.uid() is null or not exists (select 1 from public.run_board b where b.user_id = auth.uid()) then return; end if;
  return query
    select (row_number() over (order by sum(r.distance_m) desc, b.created_at))::int,
           coalesce(nullif(p.username, ''), nullif(split_part(coalesce(p.full_name, ''), ' ', 1), ''), 'Corredor')::text,
           round(sum(r.distance_m) / 1000.0, 1), b.user_id = auth.uid()
      from public.run_board b
      join public.runs r on r.user_id = b.user_id and r.day between mon and mon + 6
      left join public.profiles p on p.id = b.user_id
     group by b.user_id, b.created_at, p.username, p.full_name
     order by 1
     limit 50;
end $$;
revoke execute on function public.run_weekly_board() from public, anon;
grant execute on function public.run_weekly_board() to authenticated;
