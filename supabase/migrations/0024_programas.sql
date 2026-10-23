-- Banana Burn, 0024: Programas (retos Premium que transforman la app mientras duran)
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0023.
-- Qué hace:
--   1. challenges_catalog.kind: 'reto' (hábitos con check-in diario, como hasta hoy) o 'programa' (plan de entreno
--      completo que reemplaza la rutina del motor mientras está activo). challenges_catalog.program guarda la meta pública
--      del programa: fases, días por semana, minutos, nivel, equipo, para quién, resultado, nutrición opcional.
--   2. program_sessions: una sesión por (programa, fase, día) con sus ejercicios (series, rango, descanso, tempo, nota).
--      La app la lee con RLS: la fase 1 (la semana 1) es pública para quien tiene sesión; el resto solo con la compra
--      (o cortesía), si ya lo empezó, o si es staff. Solo quien edita contenido escribe.
--   3. user_programs: estado de cada persona (activo, pausado, abandonado, completado), inicio y días en pausa.
--      Un solo programa activo por persona (índice único parcial). Nadie escribe directo: solo las RPC de abajo.
--   4. RPC: program_start (empezar, reanudar o reiniciar; pide pausar el activo), program_pause, program_leave y
--      program_finish. Todas validan auth.uid(); empezar exige acceso a la app y la compra del programa.
--   5. Un programa no se une como reto (user_challenges); los retos de pago siguen igual que en 0018.
--   6. Siembra: los retos Premium de entreno pasan a ser programas con sesiones reales, más el programa insignia
--      "Reconstrucción corporal 8 semanas" ($9.99). No pisa lo editado en el panel.
-- La seguridad de compras y accesos de 0018/0023 no cambia: challenge_entitlements solo la escriben el webhook
-- (service_role) y admin_grant_challenge().

-- ───────────── 1. Tipo de reto y meta del programa ─────────────
alter table public.challenges_catalog
  add column if not exists kind text not null default 'reto',
  add column if not exists program jsonb;

do $$ begin
  alter table public.challenges_catalog drop constraint if exists challenges_catalog_kind_check;
  alter table public.challenges_catalog add constraint challenges_catalog_kind_check check (
    kind in ('reto', 'programa')
    and (program is null or (jsonb_typeof(program) = 'object' and pg_column_size(program) <= 16000))
    and (kind = 'reto' or program is not null)
  );
end $$;
create index if not exists challenges_catalog_kind on public.challenges_catalog (kind, status, sort);

-- ───────────── 2. Sesiones de cada programa ─────────────
create table if not exists public.program_sessions (
  slug text not null references public.challenges_catalog(slug) on update cascade on delete cascade,
  phase int not null check (phase between 1 and 8),
  day int not null check (day between 1 and 6),
  title text not null check (char_length(title) between 1 and 60),
  focus text not null default '' check (char_length(focus) <= 160),
  optional boolean not null default false,
  exercises jsonb not null default '[]'::jsonb check (jsonb_typeof(exercises) = 'array' and jsonb_array_length(exercises) <= 12 and pg_column_size(exercises) <= 8000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (slug, phase, day)
);
alter table public.program_sessions enable row level security;

-- ───────────── 3. Estado de cada persona ─────────────
create table if not exists public.user_programs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null references public.challenges_catalog(slug) on update cascade on delete cascade,
  status text not null default 'activo' check (status in ('activo', 'pausado', 'abandonado', 'completado')),
  started_on date not null,
  paused_on date,
  paused_days int not null default 0 check (paused_days between 0 and 3650),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug),
  check (status <> 'pausado' or paused_on is not null)
);
-- Un solo programa activo a la vez (lo repite program_start con un candado por usuario).
create unique index if not exists user_programs_one_active on public.user_programs (user_id) where status = 'activo';
create index if not exists user_programs_slug on public.user_programs (slug, status);
alter table public.user_programs enable row level security;
drop policy if exists "programas: propios o staff" on public.user_programs;
create policy "programas: propios o staff" on public.user_programs for select using (user_id = auth.uid() or public.is_staff());
revoke insert, update, delete on public.user_programs from anon, authenticated; -- solo las RPC program_*

/**
 * ¿Quien mira puede leer esta sesión? Staff; quien tiene el programa (compra o cortesía) o ya lo empezó; y para todos
 * los que tienen sesión, la fase 1 (la semana 1 de vista previa) de un programa publicado, o todo si es gratis.
 */
create or replace function public.program_session_visible(p_slug text, p_phase int)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_staff()
    or public._owns_challenge(auth.uid(), p_slug)
    or exists (select 1 from public.user_programs u where u.user_id = auth.uid() and u.slug = p_slug)
    or exists (select 1 from public.challenges_catalog c where c.slug = p_slug and c.kind = 'programa' and c.status = 'publicado' and (p_phase = 1 or c.price_usd = 0))
  );
$$;
revoke execute on function public.program_session_visible(text, int) from public, anon;
grant execute on function public.program_session_visible(text, int) to authenticated;

drop policy if exists "sesiones: ver con acceso" on public.program_sessions;
drop policy if exists "sesiones: editores" on public.program_sessions;
create policy "sesiones: ver con acceso" on public.program_sessions for select using (public.program_session_visible(slug, phase));
create policy "sesiones: editores" on public.program_sessions for all using (public.is_content_editor()) with check (public.is_content_editor());
revoke all on public.program_sessions from anon;

/** Semanas de un programa (suma de sus fases). */
create or replace function public._program_weeks(p_program jsonb)
returns int language sql immutable as $$
  select least(52, greatest(1, coalesce((select sum(greatest(1, (p->>'weeks')::int)) from jsonb_array_elements(coalesce(p_program->'phases', '[]'::jsonb)) p where (p->>'weeks') ~ '^\d+$'), 1)::int));
$$;

-- ───────────── 4. Cambios de estado (solo por RPC) ─────────────
/**
 * Empieza, reanuda o reinicia un programa. Con otro programa activo falla (P0001) salvo que p_pause_current = true:
 * entonces pausa el otro, que conserva su avance. Exige acceso a la app y, si el programa es de pago, la compra o
 * cortesía. Devuelve 'empezado', 'reanudado', 'reiniciado' o 'activo' (ya lo estaba).
 */
create or replace function public.program_start(p_slug text, p_day date, p_pause_current boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); c record; cur public.user_programs%rowtype; other public.user_programs%rowtype;
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_day is null or not public._is_today_somewhere(p_day) then raise exception 'Fecha inválida' using errcode = '22023'; end if;
  select slug, kind, status, price_usd into c from public.challenges_catalog where slug = p_slug;
  if not found or c.kind <> 'programa' then raise exception 'Programa inválido' using errcode = '22023'; end if;
  -- Serializa los cambios de cada persona: dos "Empezar" simultáneos no dejan dos programas activos.
  perform pg_advisory_xact_lock(hashtextextended('bb:programas:' || v_uid::text, 0));
  select * into cur from public.user_programs where user_id = v_uid and slug = p_slug;
  if c.status <> 'publicado' and cur.id is null then raise exception 'Este programa ya no está disponible' using errcode = '22023'; end if;
  if not public._has_app_access(v_uid) then raise exception 'Sin plan activo' using errcode = '42501'; end if;
  if c.price_usd > 0 and not public._owns_challenge(v_uid, p_slug) then raise exception 'Compra este programa para empezarlo' using errcode = '42501'; end if;
  if not exists (select 1 from public.program_sessions where slug = p_slug) then raise exception 'Este programa todavía no tiene sesiones' using errcode = 'P0001'; end if;
  if cur.id is not null and cur.status = 'activo' then return 'activo'; end if;
  for other in select * from public.user_programs where user_id = v_uid and status = 'activo' and slug <> p_slug loop
    if not coalesce(p_pause_current, false) then raise exception 'Ya tienes un programa activo' using errcode = 'P0001'; end if;
    update public.user_programs set status = 'pausado', paused_on = greatest(p_day, other.started_on), updated_at = now() where id = other.id;
  end loop;
  if cur.id is null then
    insert into public.user_programs (user_id, slug, status, started_on) values (v_uid, p_slug, 'activo', p_day);
    return 'empezado';
  elsif cur.status = 'pausado' then
    update public.user_programs set status = 'activo', paused_days = least(3650, paused_days + greatest(0, p_day - coalesce(paused_on, p_day))), paused_on = null, updated_at = now() where id = cur.id;
    return 'reanudado';
  end if;
  update public.user_programs set status = 'activo', started_on = p_day, paused_on = null, paused_days = 0, completed_at = null, updated_at = now() where id = cur.id;
  return 'reiniciado';
end $$;
revoke execute on function public.program_start(text, date, boolean) from public, anon;
grant execute on function public.program_start(text, date, boolean) to authenticated;

/** Pausa el programa activo: la semana deja de avanzar hasta que lo reanudes. */
create or replace function public.program_pause(p_slug text, p_day date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_day is null or not public._is_today_somewhere(p_day) then raise exception 'Fecha inválida' using errcode = '22023'; end if;
  update public.user_programs set status = 'pausado', paused_on = greatest(p_day, started_on), updated_at = now()
   where user_id = auth.uid() and slug = p_slug and status = 'activo';
  if not found then raise exception 'No tienes este programa activo' using errcode = 'P0001'; end if;
end $$;
revoke execute on function public.program_pause(text, date) from public, anon;
grant execute on function public.program_pause(text, date) to authenticated;

/** Deja el programa (activo o en pausa) y vuelve al plan normal. Lo hecho queda guardado en tus entrenos. */
create or replace function public.program_leave(p_slug text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.user_programs set status = 'abandonado', paused_on = null, updated_at = now()
   where user_id = auth.uid() and slug = p_slug and status in ('activo', 'pausado');
  if not found then raise exception 'No tienes este programa en curso' using errcode = 'P0001'; end if;
end $$;
revoke execute on function public.program_leave(text) from public, anon;
grant execute on function public.program_leave(text) to authenticated;

/**
 * Cierra el programa y da el certificado. Solo si terminó su calendario (semanas x 7 días sin contar pausas) o si ya
 * hiciste todas las sesiones obligatorias (entrenos con la plantilla p:<slug>:<semana>.<día> desde el inicio).
 */
create or replace function public.program_finish(p_slug text, p_day date)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); cur public.user_programs%rowtype; v_prog jsonb; v_weeks int; v_req int; v_done int;
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_day is null or not public._is_today_somewhere(p_day) then raise exception 'Fecha inválida' using errcode = '22023'; end if;
  select * into cur from public.user_programs where user_id = v_uid and slug = p_slug and status = 'activo';
  if cur.id is null then raise exception 'No tienes este programa activo' using errcode = 'P0001'; end if;
  select program into v_prog from public.challenges_catalog where slug = p_slug;
  v_weeks := public._program_weeks(v_prog);
  if (p_day - cur.started_on) - cur.paused_days < v_weeks * 7 then
    with ph as (
      select ord::int as idx, sum(greatest(1, (p->>'weeks')::int)) over (order by ord) as last_week
        from jsonb_array_elements(coalesce(v_prog->'phases', '[]'::jsonb)) with ordinality as t(p, ord)
       where (p->>'weeks') ~ '^\d+$'
    ), wk as (
      select g as week, coalesce((select min(idx) from ph where ph.last_week >= g), (select max(idx) from ph)) as phase from generate_series(1, v_weeks) g
    ), req as (
      select wk.week, s.day from wk join public.program_sessions s on s.slug = p_slug and s.phase = wk.phase and not s.optional
    ), done as (
      select distinct (m)[1]::int as week, (m)[2]::int as day
        from (select regexp_match(w.template, ':(\d{1,2})\.(\d)$') as m from public.workouts w
               where w.user_id = v_uid and w.day >= cur.started_on and w.template like 'p:' || p_slug || ':%') x
       where m is not null
    )
    select count(*), count(*) filter (where exists (select 1 from done d where d.week = req.week and d.day = req.day)) into v_req, v_done from req;
    if v_req = 0 or v_done < v_req then raise exception 'Todavía no terminas el programa' using errcode = 'P0001'; end if;
  end if;
  update public.user_programs set status = 'completado', completed_at = now(), paused_on = null, updated_at = now() where id = cur.id;
  return true;
end $$;
revoke execute on function public.program_finish(text, date) from public, anon;
grant execute on function public.program_finish(text, date) to authenticated;

/** Definición de los programas que la persona tiene o tuvo (aunque luego se ocultaran), con su meta. */
create or replace function public.my_program_defs()
returns table (slug text, title text, description text, days int, rules jsonb, status text, price_usd numeric, difficulty text, minutes int, cover text, icon text,
  verify text, grace int, xp int, steps_goal int, badge text, reward_title text, start_mode text, start_date date, featured boolean, coming_soon boolean, safety_note text, sort int, kind text, program jsonb)
language sql stable security definer set search_path = public as $$
  select c.slug, c.title, c.description, c.days, c.rules, c.status, c.price_usd, c.difficulty, c.minutes, c.cover, c.icon,
         c.verify, c.grace, c.xp, c.steps_goal, c.badge, c.reward_title, c.start_mode, c.start_date, c.featured, c.coming_soon, c.safety_note, c.sort, c.kind, c.program
  from public.challenges_catalog c
  where auth.uid() is not null and c.kind = 'programa' and c.slug in (select u.slug from public.user_programs u where u.user_id = auth.uid());
$$;
revoke execute on function public.my_program_defs() from public, anon;
grant execute on function public.my_program_defs() to authenticated;

/** Panel: personas con cada programa activo, en pausa y completado (conteos, sin identidades). Staff. */
create or replace function public.admin_program_stats()
returns table (slug text, active bigint, paused bigint, completed bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query
  select c.slug,
    (select count(*) from public.user_programs u where u.slug = c.slug and u.status = 'activo'),
    (select count(*) from public.user_programs u where u.slug = c.slug and u.status = 'pausado'),
    (select count(*) from public.user_programs u where u.slug = c.slug and u.status = 'completado')
  from public.challenges_catalog c where c.kind = 'programa';
end $$;
revoke execute on function public.admin_program_stats() from public, anon;
grant execute on function public.admin_program_stats() to authenticated;

-- ───────────── 5. Un programa no se une como reto ─────────────
-- Igual que 0018 (compra, ventana de inscripción, cupo de 3 y comodines por nivel), más el rechazo de programas.
-- Las inscripciones viejas a un reto que luego pasó a programa siguen su curso (el UPDATE no cambia).
create or replace function public.guard_user_challenge()
returns trigger language plpgsql set search_path = public as $$
declare n int; v_price numeric;
begin
  if not public.is_api_role() then return new; end if; -- servidor (service_role) cierra retos y otorga XP
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then raise exception 'No autorizado' using errcode = '42501'; end if;
    if not public.challenge_exists(new.challenge_id) then raise exception 'Reto inválido' using errcode = '22023'; end if;
    if exists (select 1 from public.challenges_catalog where slug = new.challenge_id and kind = 'programa') then
      raise exception 'Los programas se empiezan desde su página, no como reto' using errcode = 'P0001';
    end if;
    if new.started_on is null or not public._is_today_somewhere(new.started_on) then raise exception 'Fecha de inicio inválida' using errcode = '22023'; end if;
    if not public.challenge_open(new.challenge_id, new.started_on) then raise exception 'Este reto todavía no abre o ya cerró inscripciones' using errcode = 'P0001'; end if;
    select price_usd into v_price from public.challenges_catalog where slug = new.challenge_id;
    if coalesce(v_price, 0) > 0 then
      if not public.i_own_challenge(new.challenge_id) then raise exception 'Compra este reto para empezarlo' using errcode = '42501'; end if;
    elsif not public.has_app_access() then
      raise exception 'Sin plan activo' using errcode = '42501';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('bb:retos:' || new.user_id::text, 0));
    select count(*) into n from public.user_challenges where user_id = new.user_id and status = 'activo';
    if n >= 3 then raise exception 'Máximo 3 retos a la vez' using errcode = 'P0001'; end if;
    new.status := 'activo'; new.completed_at := null; new.created_at := now();
    new.bonus_grace := public.my_bonus_grace();
    return new;
  end if;
  if old.status = 'activo' and new.status = 'abandonado'
     and new.user_id = old.user_id and new.challenge_id = old.challenge_id and new.started_on = old.started_on
     and new.completed_at is not distinct from old.completed_at and new.created_at = old.created_at
     and new.bonus_grace = old.bonus_grace then
    return new;
  end if;
  raise exception 'Solo puedes abandonar un reto en curso' using errcode = '42501';
end $$;
drop trigger if exists user_challenges_guard on public.user_challenges;
create trigger user_challenges_guard before insert or update on public.user_challenges for each row execute function public.guard_user_challenge();

-- ───────────── 6. Siembra (generada con scripts/gen-programas-seed.ts; no pisa lo editado en el panel) ─────────────
insert into public.challenges_catalog (slug, title, description, days, rules, status, price_usd, difficulty, minutes, cover, icon, verify, grace, xp, badge, reward_title, start_mode, featured, coming_soon, safety_note, sort, kind, program) values
  ('reconstruccion-8-semanas', 'Reconstrucción corporal 8 semanas', 'Para recuperar el músculo y la fuerza que se van cuando bajas de peso rápido. 8 semanas de cuerpo completo, 3 días por semana más uno opcional, con cargas exactas que suben solas.', 56, '{}'::jsonb, 'publicado', 9.99, 'media', 55, 'noche', 'gorilla', 'workout', 0, 400, 'Cuerpo reconstruido', 'Reconstruido', 'libre', true, false, 'Si tomas medicamentos para bajar de peso, tienes una lesión o una condición médica, consulta con tu médico antes de empezar. Las dos primeras semanas usa cargas que puedas mover con técnica limpia: el programa sube el peso cuando estás listo.', 5, 'programa', $j${"phases":[{"name":"Base y técnica","weeks":3,"focus":"Aprende los movimientos con cargas cómodas. Termina cada serie con 2 a 3 repeticiones en reserva."},{"name":"Construcción","weeks":3,"focus":"Más series en los básicos. Cuando llegas al tope del rango, el peso sube solo."},{"name":"Descarga","weeks":1,"deload":true,"focus":"Semana ligera para recuperarte y llegar fuerte al cierre."},{"name":"Cierre","weeks":1,"focus":"Iguala o supera tus marcas y compara fuerza, peso y medidas con el día 1."}],"daysPerWeek":4,"sessionMinutes":55,"level":"principiante","equipment":"Gimnasio (se adapta a casa con mancuernas)","adapt":true,"who":"Para quien bajó de peso rápido (con dieta estricta, ayuno o medicamentos como los GLP-1) y siente que perdió fuerza o firmeza. También si vuelves al gimnasio después de mucho tiempo.","result":"Recuperar músculo y fuerza en todo el cuerpo con 3 sesiones de cuerpo completo por semana, mientras cuidas el peso que ya bajaste.","outcomes":["Cargas exactas en cada serie, que suben cuando estás listo","3 sesiones de cuerpo completo por semana y una cuarta opcional","Una semana de descarga antes del cierre","Fuerza, peso y medidas comparados con tu día 1"],"keyLifts":["bench","rdl","dbrow","ds:1409"],"nutrition":{"mode":"recomp","proteinPerKg":2,"note":"Déficit pequeño y proteína alta: recuperas músculo sin recuperar la grasa."},"previewExercise":"rdl"}$j$::jsonb)
on conflict (slug) do nothing;
-- Retos Premium que pasan a ser programas: solo la primera vez (kind todavía 'reto'); después manda el panel.
update public.challenges_catalog set kind = 'programa', program = $j${"phases":[{"name":"Activación y técnica","weeks":2,"focus":"Aprende a sentir el glúteo en cada ejercicio con cargas moderadas."},{"name":"Carga progresiva","weeks":3,"focus":"Más series y más peso en el puente con barra y la sentadilla."},{"name":"Semana pico","weeks":1,"focus":"Carga más alta en el puente con barra y comparación con la semana 1."}],"daysPerWeek":3,"sessionMinutes":45,"level":"todos","equipment":"Gimnasio o casa con mancuernas","adapt":true,"who":"Para quien quiere más glúteo y piernas más firmes, entrena en el gimnasio o en casa y busca un plan con pesos concretos en lugar de rutinas sueltas.","result":"Construir glúteo con 3 sesiones por semana enfocadas en puente con barra, sentadilla, peso muerto rumano y trabajo a una pierna.","outcomes":["Unas 18 series semanales de trabajo directo de glúteo","Versión para casa de cada ejercicio de máquina","Pesos que suben solos con tu historial","Comparación de fuerza en puente con barra y peso muerto rumano"],"keyLifts":["ds:1409","rdl","ds:0739"],"nutrition":{"mode":"fuerza","proteinPerKg":1.8,"note":"Superávit pequeño (unas 250 kcal) y proteína alta: el músculo necesita energía para crecer."},"previewExercise":"rdl"}$j$::jsonb, title = 'Glúteos de acero', description = 'Programa de 6 semanas para construir glúteo: puente con barra, sentadilla, peso muerto rumano y trabajo a una pierna, 3 días por semana. Funciona en el gimnasio o en casa con mancuernas.', minutes = 45, safety_note = null where slug = 'gluteos-30' and kind = 'reto';
update public.challenges_catalog set kind = 'programa', program = $j${"phases":[{"name":"Colgarte y retraer","weeks":2,"focus":"Dominadas escapulares, remo invertido y agarre."},{"name":"Negativas","weeks":2,"focus":"Bajar despacio desde arriba construye la fuerza para subir."},{"name":"Primera dominada","weeks":2,"focus":"Intentos de dominada estricta con negativas de respaldo."}],"daysPerWeek":3,"sessionMinutes":30,"level":"principiante","equipment":"Barra de dominadas (una banda elástica ayuda)","adapt":false,"who":"Para quien todavía no hace una dominada, o hace una con impulso, y quiere un camino claro con una barra en casa o en el gimnasio.","result":"Intentar tu primera dominada estricta al final de las 6 semanas, con una espalda más fuerte en el camino.","outcomes":["3 sesiones cortas por semana, de unos 30 minutos","Progresión de escapulares a negativas y a intentos","Registro de tus repeticiones en cada fase"],"keyLifts":["invrow","ds:0652","pullup"],"nutrition":null,"previewExercise":"invrow"}$j$::jsonb, title = 'Dominadas desde cero', description = 'De colgarte de la barra a intentar tu primera dominada estricta en 6 semanas: dominadas escapulares, remo invertido, negativas y asistidas. Necesitas una barra.', minutes = 30, safety_note = null where slug = 'dominadas-desde-cero' and kind = 'reto';
update public.challenges_catalog set kind = 'programa', program = $j${"phases":[{"name":"Base","weeks":1,"focus":"Aprende a bloquear el core sin arquear la espalda."},{"name":"Progresión","weeks":1,"focus":"Más series y más tiempo en las planchas."},{"name":"Pico","weeks":1,"focus":"Variantes más difíciles: plancha RKC y elevación de piernas."}],"daysPerWeek":3,"sessionMinutes":15,"level":"todos","equipment":"Sin equipo (una barra para colgarte es opcional)","adapt":true,"who":"Para quien quiere un core más fuerte y estable con sesiones cortas que caben en cualquier día.","result":"Fortalecer el abdomen al frente, los oblicuos y la estabilidad del core en 3 semanas. Que se vea el abdomen depende de tu grasa corporal, y eso lo mueve tu alimentación.","outcomes":["3 sesiones de unos 15 minutos por semana","Abdomen al frente, oblicuos y abdomen inferior","Cada semana sube la exigencia"],"keyLifts":["plank","kneeraise"],"nutrition":null,"previewExercise":"plank"}$j$::jsonb, title = '21 días de abdomen', description = 'Programa de core de 3 semanas: 3 sesiones cortas por semana para el abdomen al frente, los oblicuos y la estabilidad. Cada semana sube la exigencia.', minutes = 15, safety_note = null where slug = 'abdomen-21' and kind = 'reto';
update public.challenges_catalog set kind = 'programa', program = $j${"phases":[{"name":"Arranque","weeks":2,"focus":"Fuerza de cuerpo completo y el hábito de 4 sesiones por semana."},{"name":"Progresión","weeks":3,"focus":"Una serie más en los básicos e intervalos más largos."},{"name":"Cierre","weeks":1,"focus":"Misma estructura; el último día te pesas y tomas medidas."}],"daysPerWeek":4,"sessionMinutes":45,"level":"principiante","equipment":"Gimnasio o casa (se adapta a tu equipo)","adapt":true,"who":"Para quien quiere bajar alrededor de 3 kg con un plan concreto de 6 semanas, sin perder el músculo que tiene.","result":"Bajar unos 0,5 kg por semana con 3 sesiones de fuerza y 1 de intervalos suaves, más el ajuste de calorías del programa. El resultado depende de tu punto de partida y de cómo comes.","outcomes":["3 sesiones de fuerza y 1 de intervalos por semana","Calorías y proteína del programa si tienes Entreno + Nutrición","Peso y medidas comparados con el día 1"],"keyLifts":["goblet","bench","rdl"],"nutrition":{"mode":"acelerada","proteinPerKg":2,"note":"Déficit moderado (unas 500 kcal) con proteína alta para que lo que bajes sea grasa y no músculo."},"previewExercise":"bench"}$j$::jsonb, title = 'Pierde 3 kg en 6 semanas', description = 'Plan de 6 semanas que apunta a bajar unos 0,5 kg por semana: 3 sesiones de fuerza y 1 de intervalos suaves cada semana, con el ajuste de calorías del programa. El resultado depende de tu punto de partida y de cómo comes.', minutes = 45, safety_note = 'Bajar alrededor de 0,5 kg por semana es un ritmo seguro para la mayoría de adultos. No es una garantía: cada cuerpo responde distinto. Si estás embarazada, tienes una condición médica o tomas medicamentos, consulta con tu médico antes de empezar.' where slug = 'pierde-3kg-6-semanas' and kind = 'reto';
insert into public.program_sessions (slug, phase, day, title, focus, optional, exercises) values
  ('reconstruccion-8-semanas', 1, 1, 'Cuerpo completo A', 'Sentadilla, empuje y tirón con cargas cómodas', false, $j$[{"id":"goblet","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"3-1-1","note":"Baja hasta que la cadera pase la rodilla si tu movilidad lo permite."},{"id":"bench","sets":3,"lo":8,"hi":12,"rest":120,"tempo":"3-1-1"},{"id":"lat","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1"},{"id":"rdl","sets":3,"lo":8,"hi":12,"rest":120,"tempo":"3-1-1","note":"Espalda neutra; la barra baja pegada a las piernas."},{"id":"plank","sets":3,"lo":30,"hi":45,"rest":45,"unit":"s"}]$j$::jsonb),
  ('reconstruccion-8-semanas', 1, 2, 'Cuerpo completo B', 'Glúteo, hombro y espalda', false, $j$[{"id":"ds:1409","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","note":"Pausa de 1 s arriba apretando glúteos.","home":"glutebridge"},{"id":"dbpress","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1"},{"id":"dbrow","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","note":"Repeticiones por brazo."},{"id":"bulgarian","sets":3,"lo":8,"hi":10,"rest":90,"tempo":"3-1-1","note":"Repeticiones por pierna."},{"id":"ds:0586","sets":2,"lo":10,"hi":12,"rest":60,"tempo":"2-1-1","home":"slrdl"},{"id":"kneeraise","sets":2,"lo":8,"hi":12,"rest":60}]$j$::jsonb),
  ('reconstruccion-8-semanas', 1, 3, 'Cuerpo completo C', 'Pierna, pecho y espalda con más repeticiones', false, $j$[{"id":"ds:0739","sets":3,"lo":10,"hi":15,"rest":120,"tempo":"3-1-1","home":"goblet"},{"id":"incline","sets":3,"lo":8,"hi":12,"rest":120,"tempo":"3-1-1"},{"id":"ds:0861","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","home":"dbrow"},{"id":"pushup","sets":2,"lo":8,"hi":15,"rest":60},{"id":"facepull","sets":2,"lo":12,"hi":15,"rest":60,"tempo":"2-1-1"},{"id":"carry","sets":3,"lo":30,"hi":40,"rest":60,"unit":"m"}]$j$::jsonb),
  ('reconstruccion-8-semanas', 1, 4, 'Extra: brazos, hombros y core', 'Opcional. Si te sobra energía esta semana, suma esta sesión corta.', true, $j$[{"id":"lateral","sets":3,"lo":12,"hi":15,"rest":45,"tempo":"2-1-1"},{"id":"hammer","sets":2,"lo":10,"hi":12,"rest":60,"tempo":"2-1-1"},{"id":"pushupd","sets":2,"lo":8,"hi":12,"rest":60,"tempo":"2-1-1"},{"id":"bicycle","sets":2,"lo":16,"hi":24,"rest":45}]$j$::jsonb),
  ('reconstruccion-8-semanas', 2, 1, 'Fuerza A', 'Sentadilla y press banca pesados', false, $j$[{"id":"squat","sets":4,"lo":6,"hi":8,"rest":180,"tempo":"3-1-1","note":"Si aún no dominas la sentadilla con barra, cámbiala por la goblet."},{"id":"bench","sets":4,"lo":6,"hi":10,"rest":150,"tempo":"3-1-1"},{"id":"lat","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"2-1-1"},{"id":"rdl","sets":3,"lo":8,"hi":10,"rest":150,"tempo":"3-1-1"},{"id":"lateral","sets":2,"lo":12,"hi":15,"rest":45,"tempo":"2-1-1"},{"id":"plank","sets":3,"lo":30,"hi":45,"rest":45,"unit":"s"}]$j$::jsonb),
  ('reconstruccion-8-semanas', 2, 2, 'Fuerza B', 'Glúteo pesado, hombro y espalda', false, $j$[{"id":"ds:1409","sets":4,"lo":8,"hi":12,"rest":120,"tempo":"2-1-1","note":"Pausa de 1 s arriba apretando glúteos.","home":"glutebridge"},{"id":"dbpress","sets":3,"lo":8,"hi":10,"rest":120,"tempo":"3-1-1"},{"id":"dbrow","sets":4,"lo":8,"hi":12,"rest":90,"tempo":"2-1-1","note":"Repeticiones por brazo."},{"id":"bulgarian","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1","note":"Repeticiones por pierna."},{"id":"ds:0586","sets":3,"lo":10,"hi":12,"rest":60,"tempo":"2-1-1","home":"slrdl"},{"id":"hammer","sets":2,"lo":10,"hi":12,"rest":60,"tempo":"2-1-1"}]$j$::jsonb),
  ('reconstruccion-8-semanas', 2, 3, 'Volumen C', 'Más repeticiones para sumar músculo', false, $j$[{"id":"ds:0739","sets":3,"lo":10,"hi":15,"rest":120,"tempo":"3-1-1","home":"goblet"},{"id":"incline","sets":3,"lo":8,"hi":12,"rest":120,"tempo":"3-1-1"},{"id":"ds:0861","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","home":"dbrow"},{"id":"pushup","sets":3,"lo":10,"hi":20,"rest":60},{"id":"facepull","sets":3,"lo":12,"hi":15,"rest":60,"tempo":"2-1-1"},{"id":"kneeraise","sets":3,"lo":10,"hi":15,"rest":60}]$j$::jsonb),
  ('reconstruccion-8-semanas', 2, 4, 'Extra: brazos, hombros y core', 'Opcional. Si te sobra energía esta semana, suma esta sesión corta.', true, $j$[{"id":"lateral","sets":3,"lo":12,"hi":15,"rest":45,"tempo":"2-1-1"},{"id":"hammer","sets":2,"lo":10,"hi":12,"rest":60,"tempo":"2-1-1"},{"id":"pushupd","sets":2,"lo":8,"hi":12,"rest":60,"tempo":"2-1-1"},{"id":"bicycle","sets":2,"lo":16,"hi":24,"rest":45}]$j$::jsonb),
  ('reconstruccion-8-semanas', 3, 1, 'Fuerza A', 'Semana ligera: el motor baja la carga un 10 % y quita una serie. Llega descansado al cierre.', false, $j$[{"id":"squat","sets":4,"lo":6,"hi":8,"rest":180,"tempo":"3-1-1","note":"Si aún no dominas la sentadilla con barra, cámbiala por la goblet."},{"id":"bench","sets":4,"lo":6,"hi":10,"rest":150,"tempo":"3-1-1"},{"id":"lat","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"2-1-1"},{"id":"rdl","sets":3,"lo":8,"hi":10,"rest":150,"tempo":"3-1-1"},{"id":"lateral","sets":2,"lo":12,"hi":15,"rest":45,"tempo":"2-1-1"},{"id":"plank","sets":3,"lo":30,"hi":45,"rest":45,"unit":"s"}]$j$::jsonb),
  ('reconstruccion-8-semanas', 3, 2, 'Fuerza B', 'Semana ligera: el motor baja la carga un 10 % y quita una serie. Llega descansado al cierre.', false, $j$[{"id":"ds:1409","sets":4,"lo":8,"hi":12,"rest":120,"tempo":"2-1-1","note":"Pausa de 1 s arriba apretando glúteos.","home":"glutebridge"},{"id":"dbpress","sets":3,"lo":8,"hi":10,"rest":120,"tempo":"3-1-1"},{"id":"dbrow","sets":4,"lo":8,"hi":12,"rest":90,"tempo":"2-1-1","note":"Repeticiones por brazo."},{"id":"bulgarian","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1","note":"Repeticiones por pierna."},{"id":"ds:0586","sets":3,"lo":10,"hi":12,"rest":60,"tempo":"2-1-1","home":"slrdl"},{"id":"hammer","sets":2,"lo":10,"hi":12,"rest":60,"tempo":"2-1-1"}]$j$::jsonb),
  ('reconstruccion-8-semanas', 3, 3, 'Volumen C', 'Semana ligera: el motor baja la carga un 10 % y quita una serie. Llega descansado al cierre.', false, $j$[{"id":"ds:0739","sets":3,"lo":10,"hi":15,"rest":120,"tempo":"3-1-1","home":"goblet"},{"id":"incline","sets":3,"lo":8,"hi":12,"rest":120,"tempo":"3-1-1"},{"id":"ds:0861","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","home":"dbrow"},{"id":"pushup","sets":3,"lo":10,"hi":20,"rest":60},{"id":"facepull","sets":3,"lo":12,"hi":15,"rest":60,"tempo":"2-1-1"},{"id":"kneeraise","sets":3,"lo":10,"hi":15,"rest":60}]$j$::jsonb),
  ('reconstruccion-8-semanas', 3, 4, 'Extra: brazos, hombros y core', 'Semana ligera: el motor baja la carga un 10 % y quita una serie. Llega descansado al cierre.', true, $j$[{"id":"lateral","sets":3,"lo":12,"hi":15,"rest":45,"tempo":"2-1-1"},{"id":"hammer","sets":2,"lo":10,"hi":12,"rest":60,"tempo":"2-1-1"},{"id":"pushupd","sets":2,"lo":8,"hi":12,"rest":60,"tempo":"2-1-1"},{"id":"bicycle","sets":2,"lo":16,"hi":24,"rest":45}]$j$::jsonb),
  ('reconstruccion-8-semanas', 4, 1, 'Fuerza A', 'Semana de cierre: iguala o supera tus marcas de la semana 6 y compara con el día 1.', false, $j$[{"id":"squat","sets":3,"lo":5,"hi":8,"rest":180,"tempo":"3-1-1","note":"Si aún no dominas la sentadilla con barra, cámbiala por la goblet."},{"id":"bench","sets":3,"lo":5,"hi":8,"rest":150,"tempo":"3-1-1"},{"id":"lat","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"2-1-1"},{"id":"rdl","sets":3,"lo":8,"hi":10,"rest":150,"tempo":"3-1-1"},{"id":"lateral","sets":2,"lo":12,"hi":15,"rest":45,"tempo":"2-1-1"},{"id":"plank","sets":3,"lo":30,"hi":45,"rest":45,"unit":"s"}]$j$::jsonb),
  ('reconstruccion-8-semanas', 4, 2, 'Fuerza B', 'Semana de cierre: iguala o supera tus marcas de la semana 6 y compara con el día 1.', false, $j$[{"id":"ds:1409","sets":3,"lo":5,"hi":8,"rest":120,"tempo":"2-1-1","note":"Pausa de 1 s arriba apretando glúteos.","home":"glutebridge"},{"id":"dbpress","sets":3,"lo":8,"hi":10,"rest":120,"tempo":"3-1-1"},{"id":"dbrow","sets":4,"lo":8,"hi":12,"rest":90,"tempo":"2-1-1","note":"Repeticiones por brazo."},{"id":"bulgarian","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1","note":"Repeticiones por pierna."},{"id":"ds:0586","sets":3,"lo":10,"hi":12,"rest":60,"tempo":"2-1-1","home":"slrdl"},{"id":"hammer","sets":2,"lo":10,"hi":12,"rest":60,"tempo":"2-1-1"}]$j$::jsonb),
  ('reconstruccion-8-semanas', 4, 3, 'Volumen C', 'Semana de cierre: iguala o supera tus marcas de la semana 6 y compara con el día 1.', false, $j$[{"id":"ds:0739","sets":3,"lo":10,"hi":15,"rest":120,"tempo":"3-1-1","home":"goblet"},{"id":"incline","sets":3,"lo":8,"hi":12,"rest":120,"tempo":"3-1-1"},{"id":"ds:0861","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","home":"dbrow"},{"id":"pushup","sets":3,"lo":10,"hi":20,"rest":60},{"id":"facepull","sets":3,"lo":12,"hi":15,"rest":60,"tempo":"2-1-1"},{"id":"kneeraise","sets":3,"lo":10,"hi":15,"rest":60}]$j$::jsonb),
  ('reconstruccion-8-semanas', 4, 4, 'Extra: brazos, hombros y core', 'Semana de cierre: iguala o supera tus marcas de la semana 6 y compara con el día 1.', true, $j$[{"id":"lateral","sets":3,"lo":12,"hi":15,"rest":45,"tempo":"2-1-1"},{"id":"hammer","sets":2,"lo":10,"hi":12,"rest":60,"tempo":"2-1-1"},{"id":"pushupd","sets":2,"lo":8,"hi":12,"rest":60,"tempo":"2-1-1"},{"id":"bicycle","sets":2,"lo":16,"hi":24,"rest":45}]$j$::jsonb),
  ('gluteos-30', 1, 1, 'Glúteo fuerte', 'Puente con barra, sentadilla y bisagra de cadera', false, $j$[{"id":"ds:1409","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","note":"Pausa de 1 s arriba apretando glúteos; mentón adentro.","home":"glutebridge"},{"id":"goblet","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"3-1-1"},{"id":"rdl","sets":3,"lo":10,"hi":12,"rest":120,"tempo":"3-1-1","note":"Empuja la cadera hacia atrás hasta sentir el estiramiento."},{"id":"ds:0597","sets":2,"lo":15,"hi":20,"rest":45,"tempo":"2-1-1","home":"ds:0710"},{"id":"plank","sets":2,"lo":30,"hi":45,"rest":45,"unit":"s"}]$j$::jsonb),
  ('gluteos-30', 1, 2, 'Una pierna y espalda', 'Trabajo unilateral y tren superior', false, $j$[{"id":"bulgarian","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1","note":"Por pierna. Inclina un poco el torso al frente para cargar más el glúteo."},{"id":"ds:0381","sets":2,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","note":"Por pierna.","home":"lunge"},{"id":"ds:0228","sets":3,"lo":12,"hi":15,"rest":45,"tempo":"2-1-1","note":"Por pierna. Sin arquear la espalda baja.","home":"glutebridge"},{"id":"lat","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1"},{"id":"dbpress","sets":2,"lo":10,"hi":12,"rest":90,"tempo":"3-1-1"}]$j$::jsonb),
  ('gluteos-30', 1, 3, 'Glúteo volumen', 'Más repeticiones y pausas arriba', false, $j$[{"id":"ds:0739","sets":3,"lo":12,"hi":15,"rest":90,"tempo":"3-1-1","note":"Pies altos y separados en la plataforma.","home":"goblet"},{"id":"ds:1409","sets":3,"lo":12,"hi":15,"rest":60,"tempo":"2-2-1","note":"Pausa de 2 s arriba.","home":"glutebridge"},{"id":"ds:1757","sets":2,"lo":10,"hi":12,"rest":60,"tempo":"3-1-1","note":"Por pierna.","home":"slrdl"},{"id":"ds:0597","sets":2,"lo":15,"hi":20,"rest":45,"tempo":"2-1-1","home":"ds:0710"},{"id":"dbrow","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","note":"Por brazo."}]$j$::jsonb),
  ('gluteos-30', 2, 1, 'Glúteo fuerte', 'Más carga en el puente y la sentadilla', false, $j$[{"id":"ds:1409","sets":4,"lo":8,"hi":10,"rest":120,"tempo":"2-1-1","note":"Pausa de 1 s arriba apretando glúteos.","home":"glutebridge"},{"id":"squat","sets":3,"lo":6,"hi":10,"rest":150,"tempo":"3-1-1","note":"En casa se cambia por sentadilla goblet."},{"id":"rdl","sets":3,"lo":8,"hi":10,"rest":120,"tempo":"3-1-1"},{"id":"ds:0597","sets":3,"lo":15,"hi":20,"rest":45,"tempo":"2-1-1","home":"ds:0710"},{"id":"plank","sets":2,"lo":30,"hi":45,"rest":45,"unit":"s"}]$j$::jsonb),
  ('gluteos-30', 2, 2, 'Una pierna y espalda', 'Unilateral más pesado', false, $j$[{"id":"bulgarian","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1","note":"Por pierna."},{"id":"ds:0381","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","note":"Por pierna.","home":"lunge"},{"id":"ds:0228","sets":3,"lo":12,"hi":15,"rest":45,"tempo":"2-1-1","note":"Por pierna.","home":"glutebridge"},{"id":"lat","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"2-1-1"},{"id":"dbpress","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1"}]$j$::jsonb),
  ('gluteos-30', 2, 3, 'Glúteo volumen', 'Prensa, puente con pausa y peso muerto a una pierna', false, $j$[{"id":"ds:0739","sets":4,"lo":10,"hi":15,"rest":120,"tempo":"3-1-1","note":"Pies altos y separados.","home":"goblet"},{"id":"ds:1409","sets":3,"lo":12,"hi":15,"rest":60,"tempo":"2-2-1","note":"Pausa de 2 s arriba.","home":"glutebridge"},{"id":"ds:1757","sets":2,"lo":10,"hi":12,"rest":60,"tempo":"3-1-1","note":"Por pierna.","home":"slrdl"},{"id":"dbrow","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","note":"Por brazo."}]$j$::jsonb),
  ('gluteos-30', 3, 1, 'Glúteo fuerte', 'Semana pico: más carga en el puente con barra. Compara tus números con la semana 1.', false, $j$[{"id":"ds:1409","sets":4,"lo":6,"hi":8,"rest":150,"tempo":"2-1-1","note":"Pausa de 1 s arriba apretando glúteos.","home":"glutebridge"},{"id":"squat","sets":3,"lo":6,"hi":10,"rest":150,"tempo":"3-1-1","note":"En casa se cambia por sentadilla goblet."},{"id":"rdl","sets":3,"lo":8,"hi":10,"rest":120,"tempo":"3-1-1"},{"id":"ds:0597","sets":3,"lo":15,"hi":20,"rest":45,"tempo":"2-1-1","home":"ds:0710"},{"id":"plank","sets":2,"lo":30,"hi":45,"rest":45,"unit":"s"}]$j$::jsonb),
  ('gluteos-30', 3, 2, 'Una pierna y espalda', 'Semana pico: más carga en el puente con barra. Compara tus números con la semana 1.', false, $j$[{"id":"bulgarian","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1","note":"Por pierna."},{"id":"ds:0381","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","note":"Por pierna.","home":"lunge"},{"id":"ds:0228","sets":3,"lo":12,"hi":15,"rest":45,"tempo":"2-1-1","note":"Por pierna.","home":"glutebridge"},{"id":"lat","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"2-1-1"},{"id":"dbpress","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1"}]$j$::jsonb),
  ('gluteos-30', 3, 3, 'Glúteo volumen', 'Semana pico: más carga en el puente con barra. Compara tus números con la semana 1.', false, $j$[{"id":"ds:0739","sets":4,"lo":10,"hi":15,"rest":120,"tempo":"3-1-1","note":"Pies altos y separados.","home":"goblet"},{"id":"ds:1409","sets":3,"lo":12,"hi":15,"rest":60,"tempo":"2-2-1","note":"Pausa de 2 s arriba.","home":"glutebridge"},{"id":"ds:1757","sets":2,"lo":10,"hi":12,"rest":60,"tempo":"3-1-1","note":"Por pierna.","home":"slrdl"},{"id":"dbrow","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","note":"Por brazo."}]$j$::jsonb),
  ('dominadas-desde-cero', 1, 1, 'Tirón A', 'Colgarte, retraer los omóplatos y remar', false, $j$[{"id":"ds:0688","sets":3,"lo":5,"hi":8,"rest":90,"tempo":"2-1-1","note":"Brazos rectos: baja y junta los omóplatos sin doblar los codos. Termina colgado 10 s."},{"id":"invrow","sets":3,"lo":6,"hi":10,"rest":90,"tempo":"2-1-1","note":"Más horizontal = más difícil."},{"id":"kneeraise","sets":2,"lo":6,"hi":10,"rest":60,"note":"Colgado de la barra: también entrena tu agarre."},{"id":"pushup","sets":2,"lo":6,"hi":12,"rest":60}]$j$::jsonb),
  ('dominadas-desde-cero', 1, 2, 'Tirón B', 'Dominadas asistidas y remo lento', false, $j$[{"id":"ds:0970","sets":3,"lo":5,"hi":8,"rest":120,"tempo":"3-1-1","note":"Sin banda: apoya un pie en una silla y ayúdate lo mínimo."},{"id":"invrow","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1"},{"id":"ytw","sets":2,"lo":8,"hi":10,"rest":45},{"id":"plank","sets":2,"lo":30,"hi":40,"rest":45,"unit":"s"}]$j$::jsonb),
  ('dominadas-desde-cero', 1, 3, 'Tirón C', 'Escapulares y remo', false, $j$[{"id":"ds:0688","sets":3,"lo":6,"hi":10,"rest":90,"tempo":"2-1-1"},{"id":"invrow","sets":3,"lo":6,"hi":10,"rest":90,"tempo":"2-1-1"},{"id":"kneeraise","sets":2,"lo":8,"hi":12,"rest":60}]$j$::jsonb),
  ('dominadas-desde-cero', 2, 1, 'Negativas A', 'Bajar despacio construye la fuerza para subir', false, $j$[{"id":"ds:0652","sets":4,"lo":3,"hi":5,"rest":120,"note":"Negativa: sube con un salto o una silla y baja en 5 s, controlado."},{"id":"invrow","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1"},{"id":"ds:0688","sets":2,"lo":8,"hi":10,"rest":60,"tempo":"2-1-1"},{"id":"kneeraise","sets":2,"lo":8,"hi":12,"rest":60}]$j$::jsonb),
  ('dominadas-desde-cero', 2, 2, 'Asistidas B', 'Volumen de tirón con ayuda', false, $j$[{"id":"ds:0970","sets":3,"lo":5,"hi":8,"rest":120,"tempo":"3-1-1","note":"Usa la banda más delgada con la que llegues al rango."},{"id":"invrow","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1"},{"id":"pushup","sets":3,"lo":8,"hi":12,"rest":60},{"id":"plank","sets":2,"lo":30,"hi":45,"rest":45,"unit":"s"}]$j$::jsonb),
  ('dominadas-desde-cero', 2, 3, 'Negativas C', 'Negativas y espalda alta', false, $j$[{"id":"ds:0652","sets":4,"lo":3,"hi":5,"rest":120,"note":"Negativa de 5 s. Si bajas en menos de 3 s, termina la serie."},{"id":"ds:0688","sets":3,"lo":8,"hi":10,"rest":60,"tempo":"2-1-1"},{"id":"ytw","sets":2,"lo":10,"hi":12,"rest":45}]$j$::jsonb),
  ('dominadas-desde-cero', 3, 1, 'Intentos A', 'Tu primera dominada estricta', false, $j$[{"id":"pullup","sets":5,"lo":1,"hi":3,"rest":150,"note":"Intenta una dominada estricta. Si no sale, haz una negativa de 5 s en su lugar."},{"id":"ds:0652","sets":3,"lo":3,"hi":5,"rest":120,"note":"Negativa de 5 s."},{"id":"invrow","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1"}]$j$::jsonb),
  ('dominadas-desde-cero', 3, 2, 'Asistidas B', 'Volumen con menos ayuda', false, $j$[{"id":"ds:0970","sets":3,"lo":6,"hi":8,"rest":120,"tempo":"3-1-1","note":"Banda más delgada que en la fase 2."},{"id":"invrow","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"3-1-1"},{"id":"pushup","sets":3,"lo":8,"hi":15,"rest":60},{"id":"kneeraise","sets":2,"lo":10,"hi":12,"rest":60}]$j$::jsonb),
  ('dominadas-desde-cero', 3, 3, 'Intentos C', 'Prueba final de la semana', false, $j$[{"id":"pullup","sets":5,"lo":1,"hi":3,"rest":150,"note":"Anota cuántas estrictas haces. La última semana es tu prueba."},{"id":"ds:0688","sets":3,"lo":8,"hi":10,"rest":60,"tempo":"2-1-1"},{"id":"ytw","sets":2,"lo":10,"hi":12,"rest":45}]$j$::jsonb),
  ('abdomen-21', 1, 1, 'Core firme', 'Anti-extensión: que la espalda baja no se arquee', false, $j$[{"id":"plank","sets":2,"lo":25,"hi":35,"rest":45,"unit":"s"},{"id":"ds:0276","sets":2,"lo":8,"hi":10,"rest":45,"tempo":"2-1-1","note":"Por lado. Espalda baja pegada al piso."},{"id":"ds:0872","sets":2,"lo":10,"hi":12,"rest":45,"tempo":"2-1-1"}]$j$::jsonb),
  ('abdomen-21', 1, 2, 'Oblicuos', 'Rotación y anti-rotación', false, $j$[{"id":"ds:0705","sets":2,"lo":20,"hi":30,"rest":30,"unit":"s","note":"Por lado."},{"id":"ds:0687","sets":2,"lo":12,"hi":16,"rest":45,"note":"Cuenta cada lado."},{"id":"bicycle","sets":2,"lo":16,"hi":20,"rest":45}]$j$::jsonb),
  ('abdomen-21', 1, 3, 'Abdomen inferior', 'Elevaciones de piernas y estabilidad', false, $j$[{"id":"kneeraise","sets":2,"lo":6,"hi":10,"rest":60,"note":"Sin balanceo: sube con el abdomen, no con impulso."},{"id":"planktap","sets":2,"lo":16,"hi":20,"rest":45,"note":"Cadera quieta."},{"id":"mountain","sets":2,"lo":20,"hi":30,"rest":30,"unit":"s"}]$j$::jsonb),
  ('abdomen-21', 2, 1, 'Core firme', 'Anti-extensión: que la espalda baja no se arquee', false, $j$[{"id":"plank","sets":3,"lo":30,"hi":40,"rest":45,"unit":"s"},{"id":"ds:0276","sets":2,"lo":8,"hi":10,"rest":45,"tempo":"2-1-1","note":"Por lado. Espalda baja pegada al piso."},{"id":"ds:0872","sets":2,"lo":10,"hi":12,"rest":45,"tempo":"2-1-1"}]$j$::jsonb),
  ('abdomen-21', 2, 2, 'Oblicuos', 'Rotación y anti-rotación', false, $j$[{"id":"ds:0705","sets":3,"lo":25,"hi":35,"rest":30,"unit":"s","note":"Por lado."},{"id":"ds:0687","sets":2,"lo":12,"hi":16,"rest":45,"note":"Cuenta cada lado."},{"id":"bicycle","sets":2,"lo":16,"hi":20,"rest":45}]$j$::jsonb),
  ('abdomen-21', 2, 3, 'Abdomen inferior', 'Elevaciones de piernas y estabilidad', false, $j$[{"id":"kneeraise","sets":3,"lo":6,"hi":10,"rest":60,"note":"Sin balanceo: sube con el abdomen, no con impulso."},{"id":"planktap","sets":2,"lo":16,"hi":20,"rest":45,"note":"Cadera quieta."},{"id":"mountain","sets":2,"lo":20,"hi":30,"rest":30,"unit":"s"}]$j$::jsonb),
  ('abdomen-21', 3, 1, 'Core firme', 'Anti-extensión: que la espalda baja no se arquee', false, $j$[{"id":"plankrkc","sets":3,"lo":15,"hi":25,"rest":45,"unit":"s"},{"id":"ds:0276","sets":2,"lo":8,"hi":10,"rest":45,"tempo":"2-1-1","note":"Por lado. Espalda baja pegada al piso."},{"id":"ds:0872","sets":2,"lo":10,"hi":12,"rest":45,"tempo":"2-1-1"}]$j$::jsonb),
  ('abdomen-21', 3, 2, 'Oblicuos', 'Rotación y anti-rotación', false, $j$[{"id":"ds:0705","sets":3,"lo":30,"hi":40,"rest":30,"unit":"s","note":"Por lado."},{"id":"ds:0687","sets":2,"lo":12,"hi":16,"rest":45,"note":"Cuenta cada lado."},{"id":"bicycle","sets":2,"lo":16,"hi":20,"rest":45}]$j$::jsonb),
  ('abdomen-21', 3, 3, 'Abdomen inferior', 'Elevaciones de piernas y estabilidad', false, $j$[{"id":"legraise","sets":3,"lo":6,"hi":10,"rest":60,"note":"Sin balanceo: sube con el abdomen, no con impulso."},{"id":"planktap","sets":2,"lo":16,"hi":20,"rest":45,"note":"Cadera quieta."},{"id":"mountain","sets":2,"lo":20,"hi":30,"rest":30,"unit":"s"}]$j$::jsonb),
  ('pierde-3kg-6-semanas', 1, 1, 'Fuerza A', 'Cuerpo completo: sentadilla, empuje y tirón', false, $j$[{"id":"goblet","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"3-1-1"},{"id":"bench","sets":3,"lo":8,"hi":12,"rest":120,"tempo":"3-1-1"},{"id":"lat","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1"},{"id":"rdl","sets":3,"lo":8,"hi":12,"rest":120,"tempo":"3-1-1"},{"id":"plank","sets":2,"lo":30,"hi":45,"rest":45,"unit":"s"}]$j$::jsonb),
  ('pierde-3kg-6-semanas', 1, 2, 'Fuerza B', 'Cuerpo completo: pierna, hombro y espalda', false, $j$[{"id":"ds:0739","sets":3,"lo":10,"hi":15,"rest":120,"tempo":"3-1-1","home":"goblet"},{"id":"dbpress","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1"},{"id":"dbrow","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","note":"Por brazo."},{"id":"ds:1409","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","home":"glutebridge"},{"id":"kneeraise","sets":2,"lo":8,"hi":12,"rest":60}]$j$::jsonb),
  ('pierde-3kg-6-semanas', 1, 3, 'Intervalos suaves', 'Cardio en intervalos: 40 s de trabajo y 20 s de descanso. Suma 8.000 a 10.000 pasos al día.', false, $j$[{"id":"jacks","sets":3,"lo":30,"hi":40,"rest":20,"unit":"s"},{"id":"bwsquat","sets":3,"lo":30,"hi":40,"rest":20,"unit":"s"},{"id":"mountain","sets":3,"lo":20,"hi":30,"rest":20,"unit":"s"},{"id":"glutebridge","sets":3,"lo":30,"hi":40,"rest":20,"unit":"s"}]$j$::jsonb),
  ('pierde-3kg-6-semanas', 1, 4, 'Fuerza C', 'Una pierna, pecho y paseo del granjero', false, $j$[{"id":"bulgarian","sets":3,"lo":8,"hi":10,"rest":90,"tempo":"3-1-1","note":"Por pierna."},{"id":"incline","sets":3,"lo":8,"hi":12,"rest":120,"tempo":"3-1-1"},{"id":"ds:0861","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","home":"dbrow"},{"id":"ds:0586","sets":2,"lo":10,"hi":12,"rest":60,"tempo":"2-1-1","home":"slrdl"},{"id":"carry","sets":3,"lo":30,"hi":40,"rest":60,"unit":"m"}]$j$::jsonb),
  ('pierde-3kg-6-semanas', 2, 1, 'Fuerza A', 'Una serie más en los básicos', false, $j$[{"id":"goblet","sets":4,"lo":8,"hi":12,"rest":120,"tempo":"3-1-1"},{"id":"bench","sets":4,"lo":6,"hi":10,"rest":150,"tempo":"3-1-1"},{"id":"lat","sets":4,"lo":8,"hi":12,"rest":90,"tempo":"2-1-1"},{"id":"rdl","sets":3,"lo":8,"hi":10,"rest":120,"tempo":"3-1-1"},{"id":"plank","sets":2,"lo":30,"hi":45,"rest":45,"unit":"s"}]$j$::jsonb),
  ('pierde-3kg-6-semanas', 2, 2, 'Fuerza B', 'Pierna, hombro y espalda', false, $j$[{"id":"ds:0739","sets":3,"lo":10,"hi":15,"rest":120,"tempo":"3-1-1","home":"goblet"},{"id":"dbpress","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1"},{"id":"dbrow","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"2-1-1","note":"Por brazo."},{"id":"ds:1409","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"2-1-1","home":"glutebridge"},{"id":"kneeraise","sets":3,"lo":8,"hi":12,"rest":60}]$j$::jsonb),
  ('pierde-3kg-6-semanas', 2, 3, 'Intervalos suaves', 'Cardio en intervalos: 40 s de trabajo y 20 s de descanso. Suma 8.000 a 10.000 pasos al día.', false, $j$[{"id":"jacks","sets":4,"lo":30,"hi":40,"rest":20,"unit":"s"},{"id":"bwsquat","sets":4,"lo":30,"hi":40,"rest":20,"unit":"s"},{"id":"mountain","sets":4,"lo":20,"hi":30,"rest":20,"unit":"s"},{"id":"glutebridge","sets":4,"lo":30,"hi":40,"rest":20,"unit":"s"}]$j$::jsonb),
  ('pierde-3kg-6-semanas', 2, 4, 'Fuerza C', 'Una pierna, pecho y espalda', false, $j$[{"id":"bulgarian","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1","note":"Por pierna."},{"id":"incline","sets":3,"lo":8,"hi":12,"rest":120,"tempo":"3-1-1"},{"id":"ds:0861","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","home":"dbrow"},{"id":"pushup","sets":2,"lo":8,"hi":15,"rest":60},{"id":"ds:0586","sets":2,"lo":10,"hi":12,"rest":60,"tempo":"2-1-1","home":"slrdl"},{"id":"carry","sets":3,"lo":30,"hi":40,"rest":60,"unit":"m"}]$j$::jsonb),
  ('pierde-3kg-6-semanas', 3, 1, 'Fuerza A', 'Última semana: pésate y toma tus medidas el último día para comparar con el día 1.', false, $j$[{"id":"goblet","sets":4,"lo":8,"hi":12,"rest":120,"tempo":"3-1-1"},{"id":"bench","sets":4,"lo":6,"hi":10,"rest":150,"tempo":"3-1-1"},{"id":"lat","sets":4,"lo":8,"hi":12,"rest":90,"tempo":"2-1-1"},{"id":"rdl","sets":3,"lo":8,"hi":10,"rest":120,"tempo":"3-1-1"},{"id":"plank","sets":2,"lo":30,"hi":45,"rest":45,"unit":"s"}]$j$::jsonb),
  ('pierde-3kg-6-semanas', 3, 2, 'Fuerza B', 'Última semana: pésate y toma tus medidas el último día para comparar con el día 1.', false, $j$[{"id":"ds:0739","sets":3,"lo":10,"hi":15,"rest":120,"tempo":"3-1-1","home":"goblet"},{"id":"dbpress","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1"},{"id":"dbrow","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"2-1-1","note":"Por brazo."},{"id":"ds:1409","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"2-1-1","home":"glutebridge"},{"id":"kneeraise","sets":3,"lo":8,"hi":12,"rest":60}]$j$::jsonb),
  ('pierde-3kg-6-semanas', 3, 3, 'Intervalos suaves', 'Última semana: pésate y toma tus medidas el último día para comparar con el día 1.', false, $j$[{"id":"jacks","sets":4,"lo":30,"hi":40,"rest":20,"unit":"s"},{"id":"bwsquat","sets":4,"lo":30,"hi":40,"rest":20,"unit":"s"},{"id":"mountain","sets":4,"lo":20,"hi":30,"rest":20,"unit":"s"},{"id":"glutebridge","sets":4,"lo":30,"hi":40,"rest":20,"unit":"s"}]$j$::jsonb),
  ('pierde-3kg-6-semanas', 3, 4, 'Fuerza C', 'Última semana: pésate y toma tus medidas el último día para comparar con el día 1.', false, $j$[{"id":"bulgarian","sets":3,"lo":8,"hi":12,"rest":90,"tempo":"3-1-1","note":"Por pierna."},{"id":"incline","sets":3,"lo":8,"hi":12,"rest":120,"tempo":"3-1-1"},{"id":"ds:0861","sets":3,"lo":10,"hi":12,"rest":90,"tempo":"2-1-1","home":"dbrow"},{"id":"pushup","sets":2,"lo":8,"hi":15,"rest":60},{"id":"ds:0586","sets":2,"lo":10,"hi":12,"rest":60,"tempo":"2-1-1","home":"slrdl"},{"id":"carry","sets":3,"lo":30,"hi":40,"rest":60,"unit":"m"}]$j$::jsonb)
on conflict (slug, phase, day) do nothing;
