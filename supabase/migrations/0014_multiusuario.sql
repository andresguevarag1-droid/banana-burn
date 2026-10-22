-- Banana Burn · 0014 aislamiento multiusuario, XP verificable y carreras
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001–0013.
-- Probado con supabase/tests/multiusuario.sql (3+ usuarios: A, B, staff) sobre Postgres 16 con stubs de auth/storage.
-- Qué hace:
--   1. Metas: el enum plan_mode acepta 'fuerza' (la bienvenida y el perfil lo mandan y fallaba "No se pudo guardar tu meta").
--   2. Comunidad: un perfil "Solo yo" (privado) oculta TODAS sus publicaciones, también a quienes ya lo seguían.
--   3. XP verificable: cada evento que inserta el usuario debe corresponder a un registro real de HOY (entreno, registro
--      diario, pesaje, medidas, foto, check-in manual) y se cuenta una sola vez por día (ref_day). 'challenge' solo lo
--      otorga el servidor. Los récords (pr) solo junto con el XP de su entreno. Inserciones serializadas por usuario
--      (pg_advisory_xact_lock): sin doble XP por doble clic ni carreras contra el tope diario.
--   4. Retos: el tope de 3 activos ya no se salta con dos "Unirme" simultáneos (bloqueo por usuario).
--   4b. Entrenos: el mismo entreno (usuario + plantilla + started_at) no se guarda dos veces (doble envío -> 23505).
--      Las series solo se agregan a entrenos propios (antes se podían colgar de un entreno ajeno) y máx. 300 por entreno.
--   5. Publicaciones: por la API solo 'text' (data vacía) o 'workout' con un entreno propio y una sola vez por entreno;
--      'pr' y 'challenge' solo los publica el servidor.
--   6. Reportes: el extracto que ve el moderador lo arma la base con lo que el reportante puede ver (no se puede
--      inventar lo que "dijo" otra persona por la API); no se reporta contenido propio ni invisible.
--   7. Límites de frecuencia nuevos: mensajes del coach, comidas, metas y subidas al bucket de fotos; largos máximos.
--   8. Registro: un nombre muy largo en los metadatos ya no hace fallar la creación de la cuenta.
--   9. Staff ya no lee las llaves de los dispositivos de push (no las necesita; el cron usa service_role).

-- ───────────── 1. Metas: modo 'fuerza' ─────────────
alter type public.plan_mode add value if not exists 'fuerza';

-- ───────────── 2. Privacidad: "Solo yo" oculta todo ─────────────
create or replace function public.can_see_post(p_user uuid, p_visibility text, p_hidden boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when p_user = auth.uid() then true
    when p_hidden then public.is_staff()
    when coalesce(public.profile_visibility(p_user), 'privado') = 'privado' then public.is_staff()
    when p_visibility = 'publico' then true
    when p_visibility = 'seguidores' then exists (select 1 from public.follows where follower = auth.uid() and followee = p_user)
    else public.is_staff()
  end;
$$;
revoke execute on function public.can_see_post(uuid, text, boolean) from public, anon;
grant execute on function public.can_see_post(uuid, text, boolean) to authenticated;

-- ───────────── 3. XP verificable ─────────────
alter table public.xp_events add column if not exists ref_day date;
-- Una vez por día (del registro) para los tipos diarios; los eventos del servidor no llevan ref_day.
create unique index if not exists xp_events_once_per_day on public.xp_events (user_id, kind, ref_day)
  where ref_day is not null and kind in ('checkin', 'weigh', 'measure', 'photo');

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
    when 'photo' then 20 when 'challenge_day' then 10 when 'onboard' then 50 else null end;
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
drop trigger if exists xp_events_guard on public.xp_events;
create trigger xp_events_guard before insert on public.xp_events for each row execute function public.guard_xp_event();
revoke update, delete on public.xp_events from authenticated, anon;

-- ───────────── 4. Entrenos y series ─────────────
create or replace function public.guard_workout_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_api_role() then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('bb:workout:' || new.user_id::text, 0));
  new.created_at := now();
  if new.started_at is not null and exists (
    select 1 from public.workouts w where w.user_id = new.user_id and w.template = new.template and w.started_at = new.started_at
  ) then
    raise exception 'Este entreno ya está guardado' using errcode = '23505';
  end if;
  return new;
end $$;
drop trigger if exists workouts_guard on public.workouts;
create trigger workouts_guard before insert on public.workouts for each row execute function public.guard_workout_insert();

create index if not exists workout_sets_workout on public.workout_sets (workout_id);

create or replace function public.guard_workout_set()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_api_role() then return new; end if;
  if not exists (select 1 from public.workouts w where w.id = new.workout_id and w.user_id = new.user_id) then
    raise exception 'Entreno inválido' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.workout_sets s where s.workout_id = new.workout_id) >= 300 then
    raise exception 'Demasiadas series en este entreno' using errcode = 'P0001', hint = 'rate_limit';
  end if;
  return new;
end $$;
drop trigger if exists workout_sets_guard on public.workout_sets;
create trigger workout_sets_guard before insert or update of workout_id, user_id on public.workout_sets
  for each row execute function public.guard_workout_set();

-- Retos: mismo guard de 0013 + bloqueo por usuario antes de contar los activos (dos "Unirme" a la vez = 4 activos).
create or replace function public.guard_user_challenge()
returns trigger language plpgsql set search_path = public as $$
declare n int;
begin
  if not public.is_api_role() then return new; end if; -- servidor (service_role) cierra retos y otorga XP
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then raise exception 'No autorizado' using errcode = '42501'; end if;
    if not public.has_app_access() then raise exception 'Sin plan activo' using errcode = '42501'; end if;
    if not public.challenge_exists(new.challenge_id) then raise exception 'Reto inválido' using errcode = '22023'; end if;
    if new.started_on is null or not public._is_today_somewhere(new.started_on) then raise exception 'Fecha de inicio inválida' using errcode = '22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended('bb:retos:' || new.user_id::text, 0));
    select count(*) into n from public.user_challenges where user_id = new.user_id and status = 'activo';
    if n >= 3 then raise exception 'Máximo 3 retos a la vez' using errcode = 'P0001'; end if;
    new.status := 'activo'; new.completed_at := null; new.created_at := now();
    return new;
  end if;
  if old.status = 'activo' and new.status = 'abandonado'
     and new.user_id = old.user_id and new.challenge_id = old.challenge_id and new.started_on = old.started_on
     and new.completed_at is not distinct from old.completed_at and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'Solo puedes abandonar un reto en curso' using errcode = '42501';
end $$;
drop trigger if exists user_challenges_guard on public.user_challenges;
create trigger user_challenges_guard before insert or update on public.user_challenges for each row execute function public.guard_user_challenge();

-- ───────────── 5. Publicaciones ─────────────
create or replace function public.guard_post_write()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_api_role() then return new; end if;
  if tg_op = 'INSERT' then
    new.hidden := false;
    new.created_at := now();
    if new.kind = 'text' then
      new.workout_id := null;
      new.data := '{}'::jsonb;
    elsif new.kind = 'workout' then
      if new.workout_id is null or not exists (select 1 from public.workouts w where w.id = new.workout_id and w.user_id = auth.uid()) then
        raise exception 'Entreno inválido' using errcode = '42501';
      end if;
      if exists (select 1 from public.posts p where p.workout_id = new.workout_id) then
        raise exception 'Este entreno ya está publicado' using errcode = '23505';
      end if;
    else
      raise exception 'Tipo de publicación no permitido' using errcode = '42501';
    end if;
    return new;
  end if;
  -- UPDATE (igual que 0012)
  if old.user_id = auth.uid() and not public.is_staff() then
    if new.hidden is distinct from old.hidden or new.user_id is distinct from old.user_id or new.kind is distinct from old.kind
       or new.workout_id is distinct from old.workout_id or new.data is distinct from old.data or new.created_at is distinct from old.created_at then
      raise exception 'Solo puedes editar el texto y la visibilidad' using errcode = '42501';
    end if;
  elsif public.is_staff() then
    if new.user_id is distinct from old.user_id or new.kind is distinct from old.kind or new.workout_id is distinct from old.workout_id
       or new.data is distinct from old.data or new.created_at is distinct from old.created_at
       or (old.user_id <> auth.uid() and (new.body is distinct from old.body or new.visibility is distinct from old.visibility)) then
      raise exception 'El staff solo puede ocultar o mostrar contenido ajeno' using errcode = '42501';
    end if;
    if old.user_id = auth.uid() and new.hidden is distinct from old.hidden and not public.is_admin() then
      raise exception 'No puedes moderar tu propio contenido' using errcode = '42501';
    end if;
  else
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists posts_guard on public.posts;
create trigger posts_guard before insert or update on public.posts for each row execute function public.guard_post_write();

-- ───────────── 6. Reportes: extracto real ─────────────
create or replace function public.guard_report_insert()
returns trigger language plpgsql set search_path = public as $$
declare v_owner uuid; v_text text;
begin
  if not public.is_api_role() then return new; end if;
  if new.reporter is distinct from auth.uid() then raise exception 'No autorizado' using errcode = '42501'; end if;
  new.status := 'abierto'; new.resolved_by := null; new.resolved_at := null; new.resolution_note := null; new.created_at := now();
  if new.target_type not in ('post', 'comment', 'user') then raise exception 'Tipo de reporte inválido' using errcode = '22023'; end if;
  -- Las lecturas de abajo pasan por la RLS de quien reporta: solo se reporta lo que puede ver.
  if new.target_type = 'post' then
    if new.target_id !~ '^[0-9]{1,18}$' then raise exception 'Contenido inválido' using errcode = '22023'; end if;
    select p.user_id, p.body into v_owner, v_text from public.posts p where p.id = new.target_id::bigint;
  elsif new.target_type = 'comment' then
    if new.target_id !~ '^[0-9]{1,18}$' then raise exception 'Contenido inválido' using errcode = '22023'; end if;
    select c.user_id, c.body into v_owner, v_text from public.comments c where c.id = new.target_id::bigint;
  else
    if new.target_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Contenido inválido' using errcode = '22023'; end if;
    select pp.id, '@' || coalesce(pp.username, '') || ' ' || coalesce(pp.bio, '') into v_owner, v_text
      from public.public_profiles pp where pp.id = new.target_id::uuid;
  end if;
  if v_owner is null then raise exception 'Ese contenido ya no está disponible' using errcode = '22023'; end if;
  if v_owner = auth.uid() then raise exception 'No puedes reportar tu propio contenido' using errcode = '22023'; end if;
  new.target_id := lower(new.target_id);
  new.excerpt := nullif(left(btrim(regexp_replace(coalesce(v_text, ''), '\s+', ' ', 'g')), 280), '');
  return new;
end $$;
drop trigger if exists reports_guard on public.reports;
create trigger reports_guard before insert on public.reports for each row execute function public.guard_report_insert();

-- ───────────── 7. Límites de frecuencia y largos ─────────────
create or replace function public._my_recent_count(p_table text, p_col text, p_window text)
returns int language plpgsql stable security definer set search_path = public as $$
declare n int;
begin
  if p_table not in ('posts','comments','kudos','reports','follows','workouts','progress_photos','push_subscriptions','notifications',
                     'coach_messages','meals','goals')
     or p_col not in ('user_id','reporter','follower') then
    raise exception 'tabla no permitida';
  end if;
  if p_window = 'total' then
    execute format('select count(*) from public.%I where %I = $1', p_table, p_col) into n using auth.uid();
  else
    execute format('select count(*) from public.%I where %I = $1 and created_at > now() - $2::interval', p_table, p_col) into n using auth.uid(), p_window;
  end if;
  return n;
end $$;
revoke execute on function public._my_recent_count(text, text, text) from public, anon;
grant execute on function public._my_recent_count(text, text, text) to authenticated;

create index if not exists coach_messages_user_created on public.coach_messages (user_id, created_at desc);
create index if not exists goals_user_created on public.goals (user_id, created_at desc);
create index if not exists meals_user_created on public.meals (user_id, created_at desc);

-- Coach: 2 filas por mensaje (pregunta + respuesta) y cupo de 40 por día calendario -> hasta 160 en 24 h móviles.
drop trigger if exists rl_coach_messages on public.coach_messages;
create trigger rl_coach_messages before insert on public.coach_messages for each row execute function public.enforce_rate_limit('user_id', '24 hours', '200');
drop trigger if exists rl_meals on public.meals;
create trigger rl_meals before insert on public.meals for each row execute function public.enforce_rate_limit('user_id', '24 hours', '300');
drop trigger if exists rl_goals on public.goals;
create trigger rl_goals before insert on public.goals for each row execute function public.enforce_rate_limit('user_id', '24 hours', '30');

alter table public.coach_messages drop constraint if exists coach_messages_content_len;
alter table public.coach_messages add constraint coach_messages_content_len check (char_length(content) <= 8000) not valid;
alter table public.meals drop constraint if exists meals_name_len;
alter table public.meals add constraint meals_name_len check (char_length(name) <= 120) not valid;
alter table public.daily_logs drop constraint if exists daily_logs_note_len;
alter table public.daily_logs add constraint daily_logs_note_len check (note is null or char_length(note) <= 1000) not valid;
alter table public.workouts drop constraint if exists workouts_template_len;
alter table public.workouts add constraint workouts_template_len check (char_length(template) <= 80) not valid;
alter table public.workout_sets drop constraint if exists workout_sets_exercise_len;
alter table public.workout_sets add constraint workout_sets_exercise_len check (char_length(exercise) <= 80 and set_no between 1 and 100) not valid;

-- Fotos: máximo 40 subidas por día y 1000 en total en la carpeta propia (8 MB c/u). Antes no había tope en Storage.
create or replace function public._my_photo_uploads()
returns table (last_24h bigint, total bigint) language sql stable security definer set search_path = public, storage as $$
  select count(*) filter (where o.created_at > now() - interval '24 hours'), count(*)
    from storage.objects o
   where o.bucket_id = 'progreso' and auth.uid() is not null and (storage.foldername(o.name))[1] = auth.uid()::text;
$$;
revoke execute on function public._my_photo_uploads() from public, anon;
grant execute on function public._my_photo_uploads() to authenticated;

drop policy if exists "progreso: subir propio" on storage.objects;
create policy "progreso: subir propio" on storage.objects for insert with check (
  bucket_id = 'progreso' and (storage.foldername(name))[1] = auth.uid()::text
  and (select u.last_24h < 40 and u.total < 1000 from public._my_photo_uploads() u)
);

-- ───────────── 8. Registro robusto ─────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(left(btrim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), 80), ''))
  on conflict (id) do nothing;
  return new;
end $$;

-- ───────────── 9. Push: el staff no necesita las llaves del navegador ─────────────
drop policy if exists "push: staff lee" on public.push_subscriptions;
