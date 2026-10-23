-- Banana Burn · suite multiusuario (aislamiento entre cuentas, comunidad, escalamiento, XP, RPC y carreras)
-- Uso (BD desechable con stub.sql + migraciones 0001→0025, ver README.md). La sección 5b cubre la tienda de retos (0018),
-- la 7, el acceso a nutrición por plan (0022) y la 9, regalos, referidos y escribir datos con plan (0025).
-- (0017 es de nutrición y no es requisito de 0018.)
--   psql -d bb -X -q -f supabase/tests/multiusuario.sql 2>&1 | grep -E '^(NOTICE:  )?(PASS|FAIL|RESUMEN)'
-- Cada verificación imprime PASS/FAIL y al final un RESUMEN; la suite falla si hay algún FAIL.
-- Usuarios: A (ana, seguidores), B (beto, público), D (dani, público), S (admin), P (soporte), E (prueba vencida, sin plan).
\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- ───────────── Utilidades de prueba (esquema propio, solo en la BD de pruebas) ─────────────
drop schema if exists bbtest cascade;
create schema bbtest;
grant usage on schema bbtest to public;
create table bbtest.results (id serial primary key, pass boolean not null, label text not null);
grant all on bbtest.results to public;
grant all on sequence bbtest.results_id_seq to public;

create function bbtest.u(n text) returns uuid language sql immutable as $$
  select (case n when 'A' then 'a1a1a1a1-0000-4000-8000-0000000000a1' when 'B' then 'b2b2b2b2-0000-4000-8000-0000000000b2'
    when 'D' then 'd4d4d4d4-0000-4000-8000-0000000000d4' when 'S' then 'c3c3c3c3-0000-4000-8000-0000000000c3'
    when 'P' then 'e5e5e5e5-0000-4000-8000-0000000000e5' when 'E' then 'f6f6f6f6-0000-4000-8000-0000000000f6' end)::uuid
$$;

/** Sesión como lo hace PostgREST 10+: request.jwt.claims con sub y role. NULL = anónimo. */
create function bbtest.login(n text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', case when n is null then '' else json_build_object('sub', bbtest.u(n), 'role', 'authenticated')::text end, false);
end $$;

create function bbtest.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  insert into bbtest.results (pass, label) values (coalesce(cond, false), label);
  raise notice '% %', case when coalesce(cond, false) then 'PASS' else 'FAIL' end, label;
end $$;

/** Debe fallar (opcional: con ese SQLSTATE). */
create function bbtest.fails(label text, q text, state text default null) returns void language plpgsql as $$
begin
  execute q;
  perform bbtest.ok(label || ' [no falló]', false);
exception when others then
  perform bbtest.ok(label || ' [' || sqlstate || ': ' || left(sqlerrm, 70) || ']', state is null or sqlstate = state);
end $$;

/** No debe afectar filas (0 filas o permiso denegado). */
create function bbtest.zero(label text, q text) returns void language plpgsql as $$
declare n bigint;
begin
  execute q;
  get diagnostics n = row_count;
  perform bbtest.ok(label || ' [' || n || ' filas]', n = 0);
exception when insufficient_privilege then
  perform bbtest.ok(label || ' [permiso denegado]', true);
end $$;

/** Filas afectadas por una sentencia (para INSERT con guardas que ignoran en silencio). -1 si falló. */
create function bbtest.affected(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
exception when others then
  raise notice '  (aviso: % %)', sqlstate, left(sqlerrm, 80);
  return -1;
end $$;

create function bbtest.num(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || q || ') x' into n;
  return n;
end $$;

/** Cuántas de N sentencias iguales pasan (límites de frecuencia). */
create function bbtest.passes(q text, times int) returns int language plpgsql as $$
declare ok int := 0;
begin
  for i in 1..times loop
    begin execute q; ok := ok + 1; exception when others then null; end;
  end loop;
  return ok;
end $$;

/**
 * Aislamiento genérico: `me` no puede leer, editar, borrar ni insertar a nombre de `other` en ninguna tabla con datos
 * personales. Para insertar usa una fila propia como plantilla y solo cambia el dueño.
 */
create function bbtest.isolation(me text, other text) returns void language plpgsql as $$
declare r record; n bigint; j jsonb; cols text; me_id uuid := bbtest.u(me); ot uuid := bbtest.u(other);
begin
  for r in select * from (values
    ('public.goals','user_id'), ('public.weights','user_id'), ('public.measurements','user_id'), ('public.daily_logs','user_id'),
    ('public.meals','user_id'), ('public.workouts','user_id'), ('public.workout_sets','user_id'), ('public.coach_messages','user_id'),
    ('public.xp_events','user_id'), ('public.coach_usage','user_id'), ('public.subscriptions','user_id'), ('public.billing_customers','user_id'),
    ('public.payment_events','user_id'), ('public.comp_grants','user_id'), ('public.notification_prefs','user_id'),
    ('public.push_subscriptions','user_id'), ('public.notification_log','user_id'), ('public.notifications','user_id'),
    ('public.progress_photos','user_id'), ('public.user_challenges','user_id'), ('public.challenge_checkins','user_id'),
    ('public.device_interest','user_id'), ('public.posts','user_id'), ('public.comments','user_id'), ('public.kudos','user_id'),
    ('public.follows','follower'), ('public.reports','reporter'), ('public.saved_foods','user_id'), ('public.user_recipes','user_id')
  ) v(t, c) loop
    execute format('select count(*) from %s where %I = $1', r.t, r.c) into n using ot;
    perform bbtest.ok(format('%s no lee %s de %s [%s filas]', me, r.t, other, n), n = 0);
    perform bbtest.zero(format('%s no edita %s de %s', me, r.t, other), format('update %s set %I = %I where %I = %L', r.t, r.c, r.c, r.c, ot));
    perform bbtest.zero(format('%s no borra %s de %s', me, r.t, other), format('delete from %s where %I = %L', r.t, r.c, ot));
    execute format('select to_jsonb(x) from %s x where %I = $1 limit 1', r.t, r.c) into j using me_id;
    if j is null then perform bbtest.ok(format('plantilla propia de %s en %s', me, r.t), false); continue; end if;
    j := (j - 'id') || jsonb_build_object(r.c, ot);
    select string_agg(quote_ident(k), ',') into cols from jsonb_object_keys(j) k;
    perform bbtest.fails(format('%s no inserta en %s a nombre de %s', me, r.t, other),
      format('insert into %s (%s) select %s from jsonb_populate_record(null::%s, %L::jsonb)', r.t, cols, cols, r.t, j), '42501');
  end loop;
  -- Storage: fotos privadas por carpeta
  perform bbtest.ok(format('%s no lista fotos de %s en Storage', me, other),
    bbtest.num(format('select 1 from storage.objects where bucket_id = ''progreso'' and name like %L', ot || '/%')) = 0);
  perform bbtest.zero(format('%s no borra fotos de %s en Storage', me, other), format('delete from storage.objects where name like %L', ot || '/%'));
  perform bbtest.zero(format('%s no renombra fotos de %s en Storage', me, other), format('update storage.objects set name = name where name like %L', ot || '/%'));
  perform bbtest.fails(format('%s no sube a la carpeta de %s', me, other), format('insert into storage.objects (bucket_id, name) values (''progreso'', %L)', ot || '/intruso.jpg'), '42501');
  -- Perfil privado completo
  perform bbtest.ok(format('%s no lee el perfil (salud) de %s', me, other), bbtest.num(format('select 1 from public.profiles where id = %L', ot)) = 0);
  perform bbtest.zero(format('%s no edita el perfil de %s', me, other), format('update public.profiles set full_name = ''x'' where id = %L', ot));
end $$;

-- ───────────── Datos: usuarios y una fila por tabla (como servidor, sin guardas de la API) ─────────────
reset role;
select bbtest.login(null);
insert into auth.users (id, email) select bbtest.u(n), lower(n) || '@prueba.test' from unnest(array['A','B','D','S','P','E']) n;
update public.profiles set username = 'ana',  visibility = 'seguidores' where id = bbtest.u('A');
update public.profiles set username = 'beto', visibility = 'publico'    where id = bbtest.u('B');
update public.profiles set username = 'dani', visibility = 'publico'    where id = bbtest.u('D');
update public.profiles set role = 'admin'   where id = bbtest.u('S');
update public.profiles set role = 'support' where id = bbtest.u('P');
update public.profiles set created_at = now() - interval '30 days', username = 'eli', visibility = 'publico' where id = bbtest.u('E');

create function bbtest.seed(n text) returns void language plpgsql as $$
declare u uuid := bbtest.u(n); w uuid := gen_random_uuid(); p bigint; uc bigint; old date := current_date - 3;
begin
  insert into public.goals (user_id, start_weight, goal_weight, goal_date) values (u, 90, 80, current_date + 90);
  insert into public.weights (user_id, day, kg) values (u, old, 90);
  insert into public.measurements (user_id, day, waist) values (u, old, 90);
  insert into public.daily_logs (user_id, day, steps) values (u, old, 5000);
  insert into public.meals (user_id, day, name, kcal) values (u, old, 'Avena', 300);
  insert into public.workouts (id, user_id, day, template, started_at) values (w, u, old, 'semilla', now() - interval '3 days');
  insert into public.workout_sets (workout_id, user_id, exercise, set_no, kg, reps) values (w, u, 'sentadilla', 1, 60, 8);
  insert into public.coach_messages (user_id, role, content) values (u, 'user', 'hola');
  insert into public.xp_events (user_id, kind, xp) values (u, 'challenge', 400);
  insert into public.coach_usage (user_id, day, kind, n) values (u, old, 'chat', 3);
  insert into public.subscriptions (user_id, status, plan, provider_subscription_id) values (u, 'expired', 'entreno', 'sub_' || n);
  insert into public.billing_customers (user_id, provider_customer_id) values (u, 'cus_' || n);
  insert into public.payment_events (event_key, type, user_id) values ('evt_' || n, 'prueba', u);
  insert into public.comp_grants (user_id, plan, expires_at, revoked_at) values (u, 'entreno', now() + interval '1 day', now());
  insert into public.notification_prefs (user_id) values (u);
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (u, 'https://fcm.googleapis.com/fcm/send/' || n, 'llave', 'secreto');
  insert into public.notification_log (user_id, kind, local_day) values (u, 'recordatorio', old);
  insert into public.notifications (user_id, kind, title) values (u, 'semanal', 'Tu semana');
  insert into public.progress_photos (user_id, day, path) values (u, old, u || '/semilla.jpg');
  insert into storage.objects (bucket_id, name) values ('progreso', u || '/semilla.jpg');
  insert into public.user_challenges (user_id, challenge_id, started_on) values (u, 'flexiones-30', old) returning id into uc;
  insert into public.challenge_checkins (user_challenge_id, user_id, day) values (uc, u, old);
  insert into public.device_interest (user_id, device) values (u, 'garmin');
  insert into public.saved_foods (user_id, name, kcal) values (u, 'Sopa de ' || n, 300);
  insert into public.user_recipes (user_id, name, servings, ingredients, kcal, protein) values (u, 'Plato de ' || n, 1, '[{"name":"Bagel","qty":1,"kcal":260}]', 260, 10);
  -- Comunidad: todo PRIVADO para el aislamiento genérico (lo visible se prueba aparte)
  insert into public.posts (user_id, kind, body, visibility) values (u, 'text', 'privado de ' || n, 'privado') returning id into p;
  insert into public.comments (post_id, user_id, body) values (p, u, 'comentario de ' || n);
  insert into public.kudos (post_id, user_id) values (p, u);
  insert into public.reports (target_type, target_id, reporter, reason) values ('user', bbtest.u('S')::text, u, 'otro');
end $$;
select bbtest.seed(n) from unnest(array['A','B','D']) n;
-- A y B siguen a E (ajena a los pares que se prueban); D sigue a B (para la prueba de comunidad).
insert into public.follows (follower, followee) values (bbtest.u('A'), bbtest.u('E')), (bbtest.u('B'), bbtest.u('E')), (bbtest.u('D'), bbtest.u('B'));

-- ───────────── 1. Aislamiento entre usuarios (todas las tablas) ─────────────
set role authenticated;
select bbtest.login('A'); select bbtest.isolation('A', 'B');
select bbtest.login('B'); select bbtest.isolation('B', 'A');
select bbtest.login('D'); select bbtest.isolation('D', 'A');
reset role;

-- ───────────── 2. Escalamiento de privilegios ─────────────
set role authenticated; select bbtest.login('A');
select bbtest.fails('A no se cambia el rol', $q$ update public.profiles set role = 'admin' where id = auth.uid() $q$, '42501');
select bbtest.fails('A no se cambia el plan', $q$ update public.profiles set plan = 'completo' where id = auth.uid() $q$, '42501');
select bbtest.fails('A no se quita/pone suspensión', $q$ update public.profiles set suspended_at = now() where id = auth.uid() $q$, '42501');
select bbtest.affected($q$ update public.profiles set created_at = now() + interval '1 year', full_name = 'Ana' where id = auth.uid() $q$);
select bbtest.ok('A no reinicia su prueba (created_at intacto)', (select created_at < now() + interval '1 minute' from public.profiles where id = auth.uid()));
select bbtest.fails('A no crea perfiles', $q$ insert into public.profiles (id) values (gen_random_uuid()) $q$);
select bbtest.zero('A no borra su perfil por la API', $q$ delete from public.profiles where id = auth.uid() $q$);
select bbtest.fails('A no se crea suscripción propia', $q$ insert into public.subscriptions (user_id, status, plan) values (auth.uid(), 'active', 'completo') $q$, '42501');
select bbtest.zero('A no activa su suscripción vieja', $q$ update public.subscriptions set status = 'active' where user_id = auth.uid() $q$);
select bbtest.fails('A no se regala cortesía', $q$ insert into public.comp_grants (user_id, plan, expires_at) values (auth.uid(), 'completo', now() + interval '1 year') $q$, '42501');
select bbtest.zero('A no revive una cortesía revocada', $q$ update public.comp_grants set revoked_at = null where user_id = auth.uid() $q$);
select bbtest.fails('A no inventa pagos', $q$ insert into public.payment_events (event_key, type, user_id) values ('x', 'y', auth.uid()) $q$, '42501');
select bbtest.fails('A no se crea cliente de pago', $q$ insert into public.billing_customers (user_id, provider_customer_id) values (auth.uid(), 'cus_x') $q$);
select bbtest.fails('A no resetea su cupo del coach', $q$ update public.coach_usage set n = 0 where user_id = auth.uid() $q$, '42501');
select bbtest.fails('A no inserta cupo del coach', $q$ insert into public.coach_usage (user_id, day, kind) values (auth.uid(), current_date, 'chat') $q$, '42501');
select bbtest.fails('A no escribe en la bitácora de envíos', $q$ insert into public.notification_log (user_id, kind, local_day) values (auth.uid(), 'x', current_date) $q$, '42501');
select bbtest.fails('A no escribe auditoría', $q$ insert into public.audit_log (actor, action) values (auth.uid(), 'x') $q$, '42501');
select bbtest.ok('A no lee auditoría', bbtest.num('select 1 from public.audit_log') = 0);
select bbtest.fails('A no edita el catálogo de retos', $q$ insert into public.challenges_catalog (slug, title, days) values ('trampa', 'Trampa', 1) $q$, '42501');
select bbtest.fails('A no crea anuncios', $q$ insert into public.announcements (title) values ('Hola a todos') $q$, '42501');
select bbtest.fails('A no edita ejercicios', $q$ insert into public.exercise_overrides (exercise_id, name) values ('sentadilla', 'x') $q$, '42501');
select bbtest.zero('A no modera reportes (0 filas)', $q$ update public.reports set status = 'resuelto' $q$);
-- RPC de staff: todas validan auth.uid()
select bbtest.fails('RPC admin_set_role', $q$ select public.admin_set_role(auth.uid(), 'superadmin') $q$, '42501');
select bbtest.fails('RPC admin_grant_comp', $q$ select public.admin_grant_comp(auth.uid(), 'completo', now() + interval '30 days') $q$, '42501');
select bbtest.fails('RPC admin_revoke_comp', $q$ select public.admin_revoke_comp(1) $q$, '42501');
select bbtest.fails('RPC admin_reset_onboarding', $q$ select public.admin_reset_onboarding('b2b2b2b2-0000-4000-8000-0000000000b2') $q$, '42501');
select bbtest.fails('RPC admin_set_suspended', $q$ select public.admin_set_suspended('b2b2b2b2-0000-4000-8000-0000000000b2', true, 'porque sí') $q$, '42501');
select bbtest.fails('RPC admin_kpis', $q$ select public.admin_kpis() $q$, '42501');
select bbtest.fails('RPC admin_series', $q$ select * from public.admin_series(30) $q$, '42501');
select bbtest.fails('RPC admin_retention', $q$ select * from public.admin_retention(8) $q$, '42501');
select bbtest.fails('RPC admin_list_users', $q$ select * from public.admin_list_users() $q$, '42501');
select bbtest.fails('RPC admin_user_account (correo de B)', $q$ select * from public.admin_user_account('b2b2b2b2-0000-4000-8000-0000000000b2') $q$, '42501');
select bbtest.fails('RPC expire_comp_grants', $q$ select public.expire_comp_grants() $q$, '42501');
select bbtest.fails('RPC interna _has_app_access(B)', $q$ select public._has_app_access('b2b2b2b2-0000-4000-8000-0000000000b2') $q$, '42501');
select bbtest.fails('RPC interna _restore_plan_after_comp', $q$ select public._restore_plan_after_comp(auth.uid(), 'completo') $q$, '42501');
select bbtest.fails('RPC interna _activity_days', $q$ select * from public._activity_days('2000-01-01') $q$, '42501');
select bbtest.ok('coach_consume solo descuenta mi cupo', (select public.coach_consume('chat')) >= 0
  and bbtest.num($q$ select 1 from public.coach_usage where day = public.cr_today() $q$) = 1);
select bbtest.ok('has_app_access: A en prueba de 7 días', (select public.has_app_access()));
reset role;

-- Prueba vencida, sin plan: no publica, no comenta, no usa el coach ni se une a retos
set role authenticated; select bbtest.login('E');
-- Período de prueba del servicio (0021): hasta el 1 de noviembre de 2026 todos tienen acceso; después, la regla normal.
select bbtest.ok('beta: E con prueba vencida tiene acceso hasta noviembre', (select public.has_app_access())) where not (now() >= timestamptz '2026-11-01 06:00:00+00');
select bbtest.ok('has_app_access: E con prueba vencida = false', not (select public.has_app_access())) where now() >= timestamptz '2026-11-01 06:00:00+00';
select bbtest.fails('E sin plan no publica', $q$ insert into public.posts (user_id, kind, body) values (auth.uid(), 'text', 'hola') $q$, '42501') where now() >= timestamptz '2026-11-01 06:00:00+00';
select bbtest.fails('E sin plan no usa el coach', $q$ select public.coach_consume('chat') $q$, '42501') where now() >= timestamptz '2026-11-01 06:00:00+00';
select bbtest.fails('E sin plan no se une a retos', $q$ insert into public.user_challenges (user_id, challenge_id) values (auth.uid(), 'banana-30') $q$, '42501') where now() >= timestamptz '2026-11-01 06:00:00+00';
reset role;

-- Anónimo (sin sesión): no lee nada personal ni llama RPC
set role anon; select bbtest.login(null);
select bbtest.ok('anon no lee pesos', bbtest.num('select 1 from public.weights') = 0);
select bbtest.ok('anon no lee perfiles', bbtest.num('select 1 from public.profiles') = 0);
select bbtest.fails('anon no lee publicaciones (ni públicas)', 'select 1 from public.posts', '42501');
select bbtest.fails('anon no escribe pesos', $q$ insert into public.weights (user_id, day, kg) values ('a1a1a1a1-0000-4000-8000-0000000000a1', current_date, 70) $q$, '42501');
select bbtest.fails('anon no lee public_profiles', 'select * from public.public_profiles', '42501');
select bbtest.fails('anon no llama coach_consume', $q$ select public.coach_consume('chat') $q$, '42501');
select bbtest.fails('anon no llama has_app_access', 'select public.has_app_access()', '42501');
select bbtest.fails('anon no llama weekly_leaderboard', 'select * from public.weekly_leaderboard()', '42501');
select bbtest.fails('anon no llama community_profile', $q$ select * from public.community_profile('beto') $q$, '42501');
select bbtest.fails('anon no llama admin_kpis', 'select public.admin_kpis()', '42501');
reset role;

-- ───────────── 3. Staff: mínimo privilegio ─────────────
set role authenticated; select bbtest.login('P');
select bbtest.ok('soporte no lee pesos ajenos', bbtest.num('select 1 from public.weights') = 0);
select bbtest.ok('soporte no lee chats del coach', bbtest.num('select 1 from public.coach_messages') = 0);
select bbtest.ok('soporte no lee llaves de push', bbtest.num('select 1 from public.push_subscriptions') = 0);
select bbtest.zero('soporte no edita perfiles ajenos por la API', $q$ update public.profiles set plan = 'completo' where id = 'a1a1a1a1-0000-4000-8000-0000000000a1' $q$);
reset role;
set role authenticated; select bbtest.login('S');
select bbtest.ok('admin lee pesos (datos de salud para coaching)', bbtest.num($q$ select 1 from public.weights where user_id = 'a1a1a1a1-0000-4000-8000-0000000000a1' $q$) = 1);
select bbtest.ok('admin NO lee chats del coach', bbtest.num('select 1 from public.coach_messages') = 0);
select bbtest.ok('admin NO lee llaves de push', bbtest.num('select 1 from public.push_subscriptions') = 0);
select bbtest.fails('admin no cambia planes por la API', $q$ update public.profiles set plan = 'completo' where id = 'a1a1a1a1-0000-4000-8000-0000000000a1' $q$, '42501');
select bbtest.fails('admin no cambia roles por la API', $q$ update public.profiles set role = 'superadmin' where id = auth.uid() $q$, '42501');
select bbtest.ok('admin sí regala cortesía por RPC', (select public.admin_grant_comp('d4d4d4d4-0000-4000-8000-0000000000d4', 'completo', now() + interval '30 days', 'prueba')) > 0);
select bbtest.fails('admin no se otorga superadmin', $q$ select public.admin_set_role('c3c3c3c3-0000-4000-8000-0000000000c3', 'superadmin') $q$);
reset role;
select bbtest.ok('cortesía auditada con actor', exists (select 1 from public.audit_log where action = 'user.comp_grant' and actor = bbtest.u('S')));

-- ───────────── 4. Comunidad: visibilidad ─────────────
set role authenticated; select bbtest.login('B');
insert into public.posts (user_id, kind, body, visibility) values (auth.uid(), 'text', 'post publico de beto', 'publico'), (auth.uid(), 'text', 'post para seguidores de beto', 'seguidores');
reset role;
set role authenticated; select bbtest.login('A');
select bbtest.ok('A (no sigue a B) ve solo lo público de B', bbtest.num($q$ select 1 from public.posts where user_id = 'b2b2b2b2-0000-4000-8000-0000000000b2' $q$) = 1);
reset role;
-- Los ids de los posts de B (como servidor: así se prueba con ids conocidos aunque la RLS no los muestre)
create temp table bpost as select id, visibility from public.posts where user_id = bbtest.u('B') and visibility in ('publico', 'seguidores');
grant select on bpost to public;
set role authenticated; select bbtest.login('A');
select bbtest.fails('A no da banana a un post de seguidores sin seguir', $q$ insert into public.kudos (post_id, user_id) select id, auth.uid() from bpost where visibility = 'seguidores' $q$, '42501');
select bbtest.fails('A no comenta un post de seguidores sin seguir', $q$ insert into public.comments (post_id, user_id, body) select id, auth.uid(), 'hola' from bpost where visibility = 'seguidores' $q$, '42501');
insert into public.follows (follower, followee) values (auth.uid(), 'b2b2b2b2-0000-4000-8000-0000000000b2');
select bbtest.ok('A (seguidor) ve lo público y lo de seguidores de B', bbtest.num($q$ select 1 from public.posts where user_id = 'b2b2b2b2-0000-4000-8000-0000000000b2' $q$) = 2);
select bbtest.ok('A comenta y da banana al post de seguidores', bbtest.affected($q$ insert into public.comments (post_id, user_id, body) select id, auth.uid(), 'buen trabajo' from bpost where visibility = 'seguidores' $q$) = 1
  and bbtest.affected($q$ insert into public.kudos (post_id, user_id) select id, auth.uid() from bpost where visibility = 'seguidores' $q$) = 1);
reset role;
set role authenticated; select bbtest.login('D');
select bbtest.ok('D sigue a B y ve sus 2 posts', bbtest.num($q$ select 1 from public.posts where user_id = 'b2b2b2b2-0000-4000-8000-0000000000b2' $q$) = 2);
reset role;
set role authenticated; select bbtest.login('E');
select bbtest.ok('E (no sigue) ve solo el público de B', bbtest.num($q$ select 1 from public.posts where user_id = 'b2b2b2b2-0000-4000-8000-0000000000b2' $q$) = 1);
select bbtest.fails('E no da banana al post de seguidores', $q$ insert into public.kudos (post_id, user_id) select id, auth.uid() from bpost where visibility = 'seguidores' $q$, '42501');
select bbtest.ok('E no ve comentarios del post de seguidores', bbtest.num($q$ select 1 from public.comments c join bpost b on b.id = c.post_id where b.visibility = 'seguidores' $q$) = 0);
select bbtest.ok('E no ve bananas del post de seguidores', bbtest.num($q$ select 1 from public.kudos k join bpost b on b.id = k.post_id where b.visibility = 'seguidores' $q$) = 0);
reset role;
-- B pasa a "Solo yo"
set role authenticated; select bbtest.login('B');
update public.profiles set visibility = 'privado' where id = auth.uid();
reset role;
set role authenticated; select bbtest.login('A');
select bbtest.ok('perfil privado: su seguidor A ya no ve NINGÚN post de B', bbtest.num($q$ select 1 from public.posts where user_id = 'b2b2b2b2-0000-4000-8000-0000000000b2' $q$) = 0);
select bbtest.ok('perfil privado: A no ve comentarios ni bananas en posts de B', bbtest.num('select 1 from public.comments c join bpost b on b.id = c.post_id') = 0
  and bbtest.num('select 1 from public.kudos k join bpost b on b.id = k.post_id') = 0);
select bbtest.fails('perfil privado: A no comenta posts de B', $q$ insert into public.comments (post_id, user_id, body) select id, auth.uid(), 'hola' from bpost limit 1 $q$, '42501');
select bbtest.ok('perfil privado: fuera de public_profiles', bbtest.num($q$ select 1 from public.public_profiles where username = 'beto' $q$) = 0);
select bbtest.ok('perfil privado: community_profile vacío', bbtest.num($q$ select * from public.community_profile('beto') $q$) = 0);
select bbtest.ok('perfil privado: fuera del ranking de A', bbtest.num($q$ select 1 from public.weekly_leaderboard() where username = 'beto' $q$) = 0);
reset role;
set role authenticated; select bbtest.login('E');
select bbtest.fails('perfil privado: nadie nuevo puede seguir a B', $q$ insert into public.follows (follower, followee) values (auth.uid(), 'b2b2b2b2-0000-4000-8000-0000000000b2') $q$, '42501');
select bbtest.ok('perfil privado: E no ve el post público de B', bbtest.num($q$ select 1 from public.posts where user_id = 'b2b2b2b2-0000-4000-8000-0000000000b2' $q$) = 0);
reset role;
set role authenticated; select bbtest.login('B');
select bbtest.ok('perfil privado: B sigue viendo sus posts', bbtest.num($q$ select 1 from public.posts where user_id = auth.uid() $q$) = 3);
select bbtest.ok('perfil privado: B se ve en community_profile', bbtest.num($q$ select * from public.community_profile('beto') $q$) = 1);
reset role;
set role authenticated; select bbtest.login('S');
select bbtest.ok('staff ve los posts de un perfil privado (moderación)', bbtest.num($q$ select 1 from public.posts where user_id = 'b2b2b2b2-0000-4000-8000-0000000000b2' $q$) = 3);
reset role;
set role authenticated; select bbtest.login('B');
update public.profiles set visibility = 'publico' where id = auth.uid();
reset role;
set role authenticated; select bbtest.login('A');
select bbtest.ok('vuelve a público: A otra vez ve 2 posts de B', bbtest.num($q$ select 1 from public.posts where user_id = 'b2b2b2b2-0000-4000-8000-0000000000b2' $q$) = 2);
select bbtest.ok('A nunca ve el post privado de B', bbtest.num($q$ select 1 from public.posts where user_id = 'b2b2b2b2-0000-4000-8000-0000000000b2' and visibility = 'privado' $q$) = 0);
-- Publicaciones: tipos y datos
select bbtest.fails('A no publica "Completó el reto" falso', $q$ insert into public.posts (user_id, kind, data) values (auth.uid(), 'challenge', '{"title":"Completó el reto"}') $q$, '42501');
select bbtest.fails('A no publica un récord falso', $q$ insert into public.posts (user_id, kind, data) values (auth.uid(), 'pr', '{"prs":["Sentadilla 300 kg"]}') $q$, '42501');
select bbtest.fails('A no publica un entreno sin entreno', $q$ insert into public.posts (user_id, kind, data) values (auth.uid(), 'workout', '{"volume":99999}') $q$, '42501');
select bbtest.fails('A no publica el entreno de B como suyo', $q$ insert into public.posts (user_id, kind, workout_id) select auth.uid(), 'workout', (select id from public.workouts where user_id = 'b2b2b2b2-0000-4000-8000-0000000000b2' limit 1) $q$, '42501');
insert into public.posts (user_id, kind, body, data) values (auth.uid(), 'text', 'texto con datos', '{"prs":["falso"]}');
select bbtest.ok('post de texto: data siempre vacía', (select data = '{}'::jsonb from public.posts where body = 'texto con datos'));
select bbtest.ok('A publica su propio entreno una vez', bbtest.affected($q$ insert into public.posts (user_id, kind, workout_id, data) select auth.uid(), 'workout', id, '{"mins":40}' from public.workouts where user_id = auth.uid() order by id limit 1 $q$) = 1);
select bbtest.fails('el mismo entreno no se publica dos veces', $q$ insert into public.posts (user_id, kind, workout_id) select auth.uid(), 'workout', id from public.workouts where user_id = auth.uid() order by id limit 1 $q$, '23505');
select bbtest.fails('A no se des-oculta ni cambia el dueño', $q$ update public.posts set user_id = 'b2b2b2b2-0000-4000-8000-0000000000b2' where user_id = auth.uid() $q$, '42501');
-- Reportes: el extracto lo arma la base
insert into public.reports (target_type, target_id, reporter, reason, excerpt)
  select 'post', id::text, auth.uid(), 'acoso', 'B me insultó: texto inventado' from bpost where visibility = 'publico';
select bbtest.ok('reporte: el extracto es el texto real, no el inventado', (select excerpt from public.reports where reporter = auth.uid() and reason = 'acoso') = 'post publico de beto');
select bbtest.fails('reporte: contenido inexistente', $q$ insert into public.reports (target_type, target_id, reporter, reason) values ('post', '999999', auth.uid(), 'spam') $q$, '22023');
select bbtest.fails('reporte: no se reporta lo propio', $q$ insert into public.reports (target_type, target_id, reporter, reason) select 'post', id::text, auth.uid(), 'spam' from public.posts where user_id = auth.uid() limit 1 $q$, '22023');
select bbtest.fails('reporte: perfil inexistente', $q$ insert into public.reports (target_type, target_id, reporter, reason) values ('user', 'x', auth.uid(), 'spam') $q$, '22023');
reset role;
create temp table bpriv as select id from public.posts where user_id = bbtest.u('B') and visibility = 'privado';
grant select on bpriv to public;
set role authenticated; select bbtest.login('A');
select bbtest.ok('A no ve el post privado de B (por id)', bbtest.num('select 1 from public.posts p join bpriv b on b.id = p.id') = 0);
select bbtest.fails('reporte: post privado de B rechazado', $q$ insert into public.reports (target_type, target_id, reporter, reason) select 'post', id::text, auth.uid(), 'spam' from bpriv $q$, '22023');
reset role;

-- ───────────── 5. XP: solo con registros reales y una vez ─────────────
set role authenticated; select bbtest.login('A');
select bbtest.fails('XP: A no se da XP de reto (solo servidor)', $q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'challenge', 400) $q$, '42501');
select bbtest.fails('XP: A no da XP a B', $q$ insert into public.xp_events (user_id, kind, xp) values ('b2b2b2b2-0000-4000-8000-0000000000b2', 'checkin', 15) $q$, '42501');
select bbtest.ok('XP: entreno sin entreno de hoy = ignorado', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'workout', 100) $q$) = 0);
insert into public.workouts (user_id, day, template, started_at) values (auth.uid(), current_date, 'pierna', '2026-01-01 10:00+00');
select bbtest.ok('XP: entreno de hoy = 1 evento', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'workout', 100) $q$) = 1);
select bbtest.ok('XP: el mismo entreno no suma dos veces', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'workout', 100) $q$) = 0);
select bbtest.fails('entreno: doble guardado (mismo started_at) rechazado', $q$ insert into public.workouts (user_id, day, template, started_at) values (auth.uid(), current_date, 'pierna', '2026-01-01 10:00+00') $q$, '23505');
insert into public.workouts (user_id, day, template, started_at) values (auth.uid(), current_date, 'pierna', '2026-01-01 18:00+00');
select bbtest.ok('XP: repetir la plantilla el mismo día no suma', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'workout', 100) $q$) = 0);
insert into public.workouts (user_id, day, template, started_at) values (auth.uid(), current_date, 'torso', '2026-01-01 19:00+00');
select bbtest.ok('XP: récord suelto (sin entreno en la misma operación) = ignorado', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'pr', 50) $q$) = 0);
select bbtest.ok('XP: entreno nuevo + 12 récords en una operación = 1 + 10', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) select auth.uid(), 'workout', 50 union all select auth.uid(), 'pr', 5 from generate_series(1, 12) $q$) = 11);
select bbtest.ok('XP: registro diario sin registro = ignorado', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'checkin', 15) $q$) = 0);
insert into public.daily_logs (user_id, day, steps) values (auth.uid(), current_date, 4000);
select bbtest.ok('XP: registro diario de hoy = 1, el segundo = 0', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'checkin', 15) $q$) = 1
  and bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'checkin', 15) $q$) = 0);
select bbtest.ok('XP: pesaje sin peso de hoy = ignorado', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'weigh', 10) $q$) = 0);
insert into public.weights (user_id, day, kg) values (auth.uid(), current_date, 89);
select bbtest.ok('XP: pesaje de hoy = 1, el segundo = 0', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'weigh', 10) $q$) = 1
  and bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'weigh', 10) $q$) = 0);
select bbtest.ok('XP: medidas sin medidas de hoy = ignorado', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'measure', 15) $q$) = 0);
insert into public.measurements (user_id, day, waist) values (auth.uid(), current_date, 88);
select bbtest.ok('XP: medidas de hoy = 1', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'measure', 15) $q$) = 1);
insert into public.progress_photos (user_id, day, path) values (auth.uid(), current_date, auth.uid() || '/hoy.jpg'), (auth.uid(), current_date, auth.uid() || '/hoy2.jpg');
select bbtest.ok('XP: fotos de hoy = 1 sola vez', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'photo', 20) $q$) = 1
  and bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'photo', 20) $q$) = 0);
-- Retos manuales: un XP por check-in de hoy
select bbtest.ok('XP: día de reto sin check-in = ignorado', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'challenge_day', 10) $q$) = 0);
insert into public.user_challenges (user_id, challenge_id) values (auth.uid(), 'plancha-30');
insert into public.challenge_checkins (user_challenge_id, user_id, day) select id, auth.uid(), current_date from public.user_challenges where user_id = auth.uid() and status = 'activo';
select bbtest.ok('XP: 2 retos manuales marcados hoy = 2 XP, el tercero = 0', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'challenge_day', 10) $q$) = 1
  and bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'challenge_day', 10) $q$) = 1
  and bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'challenge_day', 10) $q$) = 0);
select bbtest.ok('XP: bienvenida sin completar = ignorado', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'onboard', 50) $q$) = 0);
update public.profiles set onboarded = true where id = auth.uid();
select bbtest.ok('XP: bienvenida completa = 1 vez en la vida', bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'onboard', 50) $q$) = 1
  and bbtest.affected($q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'onboard', 50) $q$) = 0);
select bbtest.fails('XP: no se edita', $q$ update public.xp_events set xp = 999 where user_id = auth.uid() $q$, '42501');
select bbtest.fails('XP: no se borra', $q$ delete from public.xp_events where user_id = auth.uid() $q$, '42501');
-- Retos: no se hace trampa
select bbtest.fails('reto: A no se marca un día futuro', $q$ insert into public.challenge_checkins (user_challenge_id, user_id, day) select id, auth.uid(), current_date + 5 from public.user_challenges where user_id = auth.uid() and status = 'activo' limit 1 $q$, '42501');
select bbtest.fails('reto: A no se da por completado', $q$ update public.user_challenges set status = 'completado' where user_id = auth.uid() and status = 'activo' $q$);
select bbtest.fails('reto: A no borra un reto', $q$ delete from public.user_challenges where user_id = auth.uid() $q$, '42501');
insert into public.user_challenges (user_id, challenge_id) values (auth.uid(), 'pasos-30');
select bbtest.fails('reto: A no marca a mano un reto automático', $q$ insert into public.challenge_checkins (user_challenge_id, user_id, day) select id, auth.uid(), current_date from public.user_challenges where user_id = auth.uid() and challenge_id = 'pasos-30' $q$, '42501');
select bbtest.fails('reto: máximo 3 activos', $q$ insert into public.user_challenges (user_id, challenge_id) values (auth.uid(), 'agua-21') $q$, 'P0001');
-- Series: solo en entrenos propios
reset role;
create temp table bwork as select id from public.workouts where user_id = bbtest.u('B');
grant select on bwork to public;
set role authenticated; select bbtest.login('A');
select bbtest.fails('series: A no cuelga series del entreno de B (id conocido)', $q$ insert into public.workout_sets (workout_id, user_id, exercise, set_no, reps) select id, auth.uid(), 'press', 1, 10 from bwork $q$, '42501');
select bbtest.fails('series: A no mueve sus series al entreno de B', $q$ update public.workout_sets set workout_id = (select id from bwork limit 1) where user_id = auth.uid() $q$, '42501');
select bbtest.fails('posts: A no comenta como B', $q$ insert into public.comments (post_id, user_id, body) select id, 'b2b2b2b2-0000-4000-8000-0000000000b2', 'soy B' from bpost limit 1 $q$, '42501');
select bbtest.fails('kudos: A no da banana como B', $q$ insert into public.kudos (post_id, user_id) select id, 'b2b2b2b2-0000-4000-8000-0000000000b2' from bpost where visibility = 'publico' $q$, '42501');
select bbtest.fails('follows: A no hace que B siga a nadie', $q$ insert into public.follows (follower, followee) values ('b2b2b2b2-0000-4000-8000-0000000000b2', 'd4d4d4d4-0000-4000-8000-0000000000d4') $q$, '42501');
select bbtest.zero('follows: A no deshace los follows de B', $q$ delete from public.follows where follower = 'd4d4d4d4-0000-4000-8000-0000000000d4' $q$);
-- Avisos
select bbtest.fails('avisos: A no reescribe el título', $q$ update public.notifications set title = 'x' where user_id = auth.uid() $q$, '42501');
select bbtest.zero('avisos: A no marca leídos los de B', $q$ update public.notifications set read_at = now() where user_id = 'b2b2b2b2-0000-4000-8000-0000000000b2' $q$);
select bbtest.ok('avisos: A marca los suyos', bbtest.affected($q$ update public.notifications set read_at = now() where user_id = auth.uid() $q$) = 1);
select bbtest.fails('avisos: A no se crea avisos de sistema', $q$ insert into public.notifications (user_id, kind, title) values (auth.uid(), 'pago', 'Pago aprobado') $q$, '42501');
-- Metas con modo fuerza (bienvenida y perfil)
select bbtest.ok('metas: modo fuerza se guarda', bbtest.affected($q$ insert into public.goals (user_id, start_weight, goal_weight, goal_date, mode) values (auth.uid(), 80, 85, current_date + 120, 'fuerza') $q$) = 1);
-- Mis recetas: no cambia de dueño, valida ingredientes y tope de 100
select bbtest.ok('recetas: A edita la suya', bbtest.affected($q$ update public.user_recipes set name = 'Bagel del domingo' where user_id = auth.uid() $q$) = 1);
select bbtest.passes($q$ update public.user_recipes set user_id = 'b2b2b2b2-0000-4000-8000-0000000000b2' where user_id = auth.uid() $q$, 1);
select bbtest.ok('recetas: A no le pasa su receta a B', (select count(*) = 1 from public.user_recipes where user_id = auth.uid()));
select bbtest.fails('recetas: sin ingredientes no se guarda', $q$ insert into public.user_recipes (name, ingredients, kcal) values ('Vacía', '[]', 0) $q$, '23514');
select bbtest.fails('recetas: ingredientes deben ser lista', $q$ insert into public.user_recipes (name, ingredients, kcal) values ('Mala', '{"a":1}', 0) $q$, '23514');
select bbtest.fails('recetas: kcal fuera de rango', $q$ insert into public.user_recipes (name, ingredients, kcal) values ('Mucha', '[{"name":"x"}]', 9000) $q$, '23514');
select bbtest.ok('recetas: tope de 100 por persona', bbtest.passes($q$ insert into public.user_recipes (name, ingredients, kcal) values ('Receta', '[{"name":"x"}]', 100) $q$, 105) = 99);
-- Límites de frecuencia
select bbtest.fails('largo: mensaje del coach > 8000', $q$ insert into public.coach_messages (user_id, role, content) values (auth.uid(), 'user', repeat('x', 8001)) $q$, '23514');
select bbtest.ok('límite: coach_messages 200/24 h', bbtest.passes($q$ insert into public.coach_messages (user_id, role, content) values (auth.uid(), 'user', 'hola') $q$, 210) = 199);
select bbtest.ok('límite: comidas 300/24 h', bbtest.passes($q$ insert into public.meals (user_id, day, name, kcal) values (auth.uid(), current_date, 'Banana', 100) $q$, 310) = 299);
select bbtest.ok('límite: metas 30/24 h', bbtest.passes($q$ insert into public.goals (user_id, start_weight, goal_weight, goal_date) values (auth.uid(), 80, 75, current_date + 60) $q$, 40) = 28);
select bbtest.ok('límite: subidas de fotos 40/24 h', bbtest.passes($q$ insert into storage.objects (bucket_id, name) values ('progreso', auth.uid() || '/' || gen_random_uuid() || '.jpg') $q$, 45) = 39);
select bbtest.ok('límite: entrenos 12/24 h (ya hay 4 hoy: semilla, pierna x2, torso)', bbtest.passes($q$ insert into public.workouts (user_id, day, template, started_at) values (auth.uid(), current_date, 'x', clock_timestamp()) $q$, 15) = 8);
reset role;

-- ───────────── 5b. Tienda de retos (0018) ─────────────
-- F: cuenta nueva (prueba vigente) para unirse sin chocar con el cupo de A. G: otra cuenta para aislamiento.
reset role;
select bbtest.login(null);
insert into auth.users (id, email) values ('0f0f0f0f-0000-4000-8000-00000000000f', 'f@prueba.test'), ('0a0a0a0a-0000-4000-8000-00000000000a', 'g@prueba.test');
create function bbtest.as_user(id uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, false); end $$;
-- Estados de catálogo para probar la visibilidad (como servidor).
update public.challenges_catalog set status = 'oculto' where slug = 'movilidad-14';
update public.challenges_catalog set status = 'borrador' where slug = 'sin-azucar-7';
update public.challenges_catalog set status = 'archivado' where slug = 'pasos-14';
-- Una compra y un acceso de G (escritos por el servidor, como el webhook).
insert into public.challenge_purchases (user_id, challenge_slug, status, amount_minor, list_price_minor, provider_payment_intent_id) values ('0a0a0a0a-0000-4000-8000-00000000000a', 'gluteos-30', 'pagado', 699, 699, 'pi_test_g');
insert into public.challenge_entitlements (user_id, challenge_slug, source) values ('0a0a0a0a-0000-4000-8000-00000000000a', 'gluteos-30', 'compra');

set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
select bbtest.ok('tienda: el usuario ve los retos publicados', bbtest.num($q$ select 1 from public.challenges_catalog where status = 'publicado' $q$) = 11);
select bbtest.ok('tienda: no ve ocultos, borradores ni archivados', bbtest.num($q$ select 1 from public.challenges_catalog where slug in ('movilidad-14','sin-azucar-7','pasos-14') $q$) = 0);
select bbtest.fails('tienda: el usuario no crea retos', $q$ insert into public.challenges_catalog (slug, title, days) values ('trampa-2', 'Trampa', 7) $q$, '42501');
select bbtest.zero('tienda: el usuario no cambia precios', $q$ update public.challenges_catalog set price_usd = 0 where slug = 'abdomen-21' $q$);
select bbtest.zero('tienda: el usuario no oculta retos', $q$ update public.challenges_catalog set status = 'oculto' where slug = 'banana-30' $q$);
select bbtest.zero('tienda: el usuario no borra retos', $q$ delete from public.challenges_catalog where slug = 'banana-30' $q$);
select bbtest.ok('plan: el usuario no lee la tabla de planes directo', bbtest.num($q$ select 1 from public.challenge_plans $q$) = 0);
select bbtest.ok('plan: reto gratis completo', (select (public.challenge_plan('flexiones-30')->>'locked')::boolean = false and jsonb_array_length(public.challenge_plan('flexiones-30')->'days') = 30));
select bbtest.ok('plan: reto de pago sin comprar = 3 días y bloqueado', (select (public.challenge_plan('abdomen-21')->>'locked')::boolean and jsonb_array_length(public.challenge_plan('abdomen-21')->'days') = 3));
select bbtest.ok('plan: nada de un reto oculto en el que no está', public.challenge_plan('movilidad-14') is null);
select bbtest.fails('compras: el usuario no se crea una compra', $q$ insert into public.challenge_purchases (user_id, challenge_slug, status, amount_minor, list_price_minor) values (auth.uid(), 'abdomen-21', 'pagado', 499, 499) $q$, '42501');
select bbtest.fails('compras: el usuario no se da acceso a un reto de pago', $q$ insert into public.challenge_entitlements (user_id, challenge_slug, source) values (auth.uid(), 'abdomen-21', 'compra') $q$, '42501');
select bbtest.ok('compras: no ve compras ni accesos de otros', bbtest.num($q$ select 1 from public.challenge_purchases $q$) = 0 and bbtest.num($q$ select 1 from public.challenge_entitlements $q$) = 0);
select bbtest.zero('compras: no marca pagada una compra ajena', $q$ update public.challenge_purchases set status = 'reembolsado' $q$);
select bbtest.fails('unirse: reto de pago sin comprarlo', $q$ insert into public.user_challenges (user_id, challenge_id) values (auth.uid(), 'abdomen-21') $q$, '42501');
select bbtest.fails('unirse: reto oculto', $q$ insert into public.user_challenges (user_id, challenge_id) values (auth.uid(), 'movilidad-14') $q$, '22023');
select bbtest.fails('unirse: reto en borrador', $q$ insert into public.user_challenges (user_id, challenge_id) values (auth.uid(), 'sin-azucar-7') $q$, '22023');
select bbtest.fails('unirse: reto con fecha que aún no abre', $q$ insert into public.user_challenges (user_id, challenge_id) values (auth.uid(), 'sprint-verano-28') $q$, 'P0001');
select bbtest.ok('unirse: reto gratis abierto', bbtest.affected($q$ insert into public.user_challenges (user_id, challenge_id, bonus_grace) values (auth.uid(), 'flexiones-30', 5) $q$) = 1);
select bbtest.ok('unirse: no se regala comodines extra (pidió 5, su nivel da 0)', (select bonus_grace = 0 from public.user_challenges where user_id = auth.uid() and challenge_id = 'flexiones-30'));
select bbtest.fails('unirse: no cambia sus comodines después', $q$ update public.user_challenges set bonus_grace = 3 where user_id = auth.uid() $q$, '42501');
select bbtest.fails('XP: el usuario no se da bono de racha', $q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'streak_bonus', 50) $q$, '22023');
select bbtest.fails('XP: el usuario no se da hitos de reto', $q$ insert into public.xp_events (user_id, kind, xp) values (auth.uid(), 'challenge_milestone', 25) $q$, '22023');
select bbtest.fails('XP: el usuario no llama a grant_streak_bonus', $q$ select public.grant_streak_bonus(auth.uid(), current_date, 100) $q$, '42501');
select bbtest.fails('hitos: el usuario no se marca hitos', $q$ insert into public.challenge_milestones (user_challenge_id, user_id, milestone) select id, auth.uid(), 7 from public.user_challenges where user_id = auth.uid() limit 1 $q$, '42501');
select bbtest.fails('panel: el usuario no regala retos', $q$ select public.admin_grant_challenge(auth.uid(), 'abdomen-21', 'me lo regalo') $q$, '42501');
select bbtest.fails('panel: el usuario no ve ventas', $q$ select * from public.admin_challenge_stats() $q$, '42501');
select bbtest.ok('personas en el reto: solo conteos de retos publicados', (select n >= 1 from public.challenge_participants() where slug = 'flexiones-30') and bbtest.num($q$ select 1 from public.challenge_participants() where slug = 'movilidad-14' $q$) = 0);
select bbtest.ok('nivel público: el propio sí', public.community_xp(auth.uid()) = 0);
reset role;

-- Bono de racha y comodines por nivel (servidor)
select bbtest.login(null);
select bbtest.ok('bono: el servidor lo otorga', public.grant_streak_bonus('0f0f0f0f-0000-4000-8000-00000000000f', current_date, 40) = 40);
select bbtest.ok('bono: idempotente (30 < 40 no agrega)', public.grant_streak_bonus('0f0f0f0f-0000-4000-8000-00000000000f', current_date, 30) = 0);
select bbtest.ok('bono: solo sube (55 agrega 15)', public.grant_streak_bonus('0f0f0f0f-0000-4000-8000-00000000000f', current_date, 55) = 15);
select bbtest.ok('bono: total del día = 55', (select sum(xp) = 55 from public.xp_events where user_id = '0f0f0f0f-0000-4000-8000-00000000000f' and kind = 'streak_bonus'));
select bbtest.fails('bono: tope de 150 por día', $q$ select public.grant_streak_bonus('0f0f0f0f-0000-4000-8000-00000000000f', current_date, 151) $q$, '22023');
insert into public.xp_events (user_id, kind, xp) values ('0f0f0f0f-0000-4000-8000-00000000000f', 'workout', 900);
set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
insert into public.user_challenges (user_id, challenge_id) values (auth.uid(), 'plancha-30');
select bbtest.ok('nivel: con 955 XP (Banana madura) el reto nuevo trae +1 comodín', (select bonus_grace = 1 from public.user_challenges where user_id = auth.uid() and challenge_id = 'plancha-30'));
reset role;

-- Compra confirmada por el webhook (servidor): ahora sí se une al reto de pago
insert into public.challenge_entitlements (user_id, challenge_slug, source) values ('0f0f0f0f-0000-4000-8000-00000000000f', 'abdomen-21', 'compra');
set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
select bbtest.ok('unirse: reto de pago comprado', bbtest.affected($q$ insert into public.user_challenges (user_id, challenge_id) values (auth.uid(), 'abdomen-21') $q$) = 1);
select bbtest.ok('plan: reto comprado se ve completo', (select (public.challenge_plan('abdomen-21')->>'locked')::boolean = false and jsonb_array_length(public.challenge_plan('abdomen-21')->'days') = 21));
select bbtest.ok('acceso: ve su propio acceso', bbtest.num($q$ select 1 from public.challenge_entitlements where user_id = auth.uid() $q$) = 1);
reset role;
-- Un reto ya en curso que el admin oculta: quien está inscrito sigue viendo su definición y su plan
update public.challenges_catalog set status = 'oculto' where slug = 'abdomen-21';
set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
select bbtest.ok('oculto: el inscrito conserva su reto (my_challenge_defs)', bbtest.num($q$ select 1 from public.my_challenge_defs() where slug = 'abdomen-21' and jsonb_array_length(plan) = 21 $q$) = 1);
select bbtest.ok('oculto: ya no está en la tienda', bbtest.num($q$ select 1 from public.challenges_catalog where slug = 'abdomen-21' $q$) = 0);
reset role;
update public.challenges_catalog set status = 'publicado' where slug = 'abdomen-21';

-- Staff: admin (S) edita y regala; soporte (P) regala pero no edita el catálogo
set role authenticated; select bbtest.login('S');
select bbtest.ok('panel: admin ve también ocultos y borradores', bbtest.num($q$ select 1 from public.challenges_catalog $q$) = 14);
select bbtest.ok('panel: admin cambia el estado', bbtest.affected($q$ update public.challenges_catalog set status = 'publicado' where slug = 'movilidad-14' $q$) = 1);
select bbtest.ok('panel: active queda sincronizado con publicado', (select active from public.challenges_catalog where slug = 'movilidad-14') and not (select active from public.challenges_catalog where slug = 'sin-azucar-7'));
select bbtest.ok('panel: admin edita el plan', bbtest.affected($q$ update public.challenge_plans set days = days where slug = 'movilidad-14' $q$) = 1);
select bbtest.fails('panel: precio de pago bajo el mínimo de ONVO', $q$ update public.challenges_catalog set price_usd = 0.3 where slug = 'abdomen-21' $q$, '23514');
select bbtest.ok('panel: admin regala un reto (cortesía)', bbtest.affected($q$ select public.admin_grant_challenge('d4d4d4d4-0000-4000-8000-0000000000d4', 'gluteos-30', 'Ganadora del sorteo de octubre') $q$) = 1);
select bbtest.ok('panel: la cortesía queda en auditoría', (select count(*) = 1 from public.audit_log where action = 'challenge.grant' and target = 'd4d4d4d4-0000-4000-8000-0000000000d4'));
select bbtest.fails('panel: no regala dos veces el mismo reto', $q$ select public.admin_grant_challenge('d4d4d4d4-0000-4000-8000-0000000000d4', 'gluteos-30', 'Otra vez') $q$, 'P0001');
select bbtest.fails('panel: la cortesía exige motivo', $q$ select public.admin_grant_challenge('d4d4d4d4-0000-4000-8000-0000000000d4', 'abdomen-21', '') $q$, 'P0001');
select bbtest.ok('panel: admin ve compradores e ingresos', (select purchases = 1 and revenue_minor = 699 and comps = 1 from public.admin_challenge_stats() where slug = 'gluteos-30'));
select bbtest.fails('panel: admin tampoco escribe compras a mano', $q$ insert into public.challenge_purchases (user_id, challenge_slug, status, amount_minor, list_price_minor) values (auth.uid(), 'abdomen-21', 'pagado', 499, 499) $q$, '42501');
reset role;
set role authenticated; select bbtest.login('P');
select bbtest.zero('soporte no edita el catálogo de retos', $q$ update public.challenges_catalog set price_usd = 1 where slug = 'abdomen-21' $q$);
select bbtest.ok('soporte regala retos (staff de cuentas)', bbtest.affected($q$ select public.admin_grant_challenge('d4d4d4d4-0000-4000-8000-0000000000d4', 'abdomen-21', 'Compensación por error de cobro') $q$) = 1);
reset role;
-- Borrar una cuenta con compras no falla y conserva la venta (sin dueño)
delete from auth.users where id = '0a0a0a0a-0000-4000-8000-00000000000a';
select bbtest.ok('cuenta borrada: la venta queda registrada sin dueño y el acceso se va', (select user_id is null from public.challenge_purchases where provider_payment_intent_id = 'pi_test_g')
  and not exists (select 1 from public.challenge_entitlements where user_id = '0a0a0a0a-0000-4000-8000-00000000000a'));

-- ───────────── 6. Registro ─────────────
insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'largo@prueba.test', jsonb_build_object('full_name', repeat('Nombre ', 40)));
select bbtest.ok('registro con nombre largo no falla (80 máx.)', (select char_length(full_name) <= 80 from public.profiles p join auth.users u on u.id = p.id where u.email = 'largo@prueba.test'));

-- ───────────── 7. Nutrición por plan (0022) ─────────────
-- N: plan Entreno, registrado hace 30 días. C: Entreno + Nutrición. K: plan Entreno con cortesía vigente (vale como completo).
-- A y T: prueba de 7 días. S: admin. E: prueba vencida, sin plan. Hasta el 1 de noviembre de 2026 (beta) todos tienen nutrición.
reset role;
select bbtest.login(null);
insert into auth.users (id, email) values
  ('1a1a1a1a-0000-4000-8000-0000000000a1', 'nico@prueba.test'),
  ('2b2b2b2b-0000-4000-8000-0000000000b2', 'caro@prueba.test'),
  ('3c3c3c3c-0000-4000-8000-0000000000c3', 'kike@prueba.test'),
  ('4d4d4d4d-0000-4000-8000-0000000000d4', 'tere@prueba.test');
update public.profiles set plan = 'entreno', created_at = now() - interval '30 days' where id in ('1a1a1a1a-0000-4000-8000-0000000000a1', '3c3c3c3c-0000-4000-8000-0000000000c3');
update public.profiles set plan = 'completo', created_at = now() - interval '30 days' where id = '2b2b2b2b-0000-4000-8000-0000000000b2';
insert into public.comp_grants (user_id, plan, expires_at) values ('3c3c3c3c-0000-4000-8000-0000000000c3', 'entreno', now() + interval '10 days');
insert into public.meals (user_id, day, name, kcal) values ('1a1a1a1a-0000-4000-8000-0000000000a1', current_date - 3, 'Arroz con frijoles', 400);

set role anon; select bbtest.login(null);
select bbtest.fails('anon no llama has_nutrition_access', 'select public.has_nutrition_access()', '42501');
reset role;

set role authenticated; select bbtest.as_user('2b2b2b2b-0000-4000-8000-0000000000b2');
select bbtest.fails('RPC interna _has_nutrition_access(N)', $q$ select public._has_nutrition_access('1a1a1a1a-0000-4000-8000-0000000000a1') $q$, '42501');
select bbtest.ok('nutrición: C (Entreno + Nutrición) tiene acceso', (select public.has_nutrition_access()));
select bbtest.ok('nutrición: C registra una comida', bbtest.affected($q$ insert into public.meals (user_id, day, name, kcal, protein) values (auth.uid(), current_date, 'Arroz con pollo', 650, 40) $q$) = 1);
select bbtest.ok('nutrición: C edita su comida', bbtest.affected($q$ update public.meals set kcal = 600 where user_id = auth.uid() $q$) = 1);
select bbtest.ok('nutrición: C guarda un alimento', bbtest.affected($q$ insert into public.saved_foods (user_id, name, kcal) values (auth.uid(), 'Plato del día', 700) $q$) = 1);
select bbtest.ok('nutrición: C crea una receta', bbtest.affected($q$ insert into public.user_recipes (user_id, name, servings, ingredients, kcal, protein) values (auth.uid(), 'Bowl', 1, '[{"name":"Arroz","qty":1,"kcal":200}]', 200, 4) $q$) = 1);
select bbtest.fails('nutrición: C no registra comida a nombre de N', $q$ insert into public.meals (user_id, day, name, kcal) values ('1a1a1a1a-0000-4000-8000-0000000000a1', current_date, 'Intruso', 1) $q$, '42501');
reset role;

set role authenticated; select bbtest.as_user('3c3c3c3c-0000-4000-8000-0000000000c3');
select bbtest.ok('nutrición: K con cortesía (aunque diga Entreno) tiene acceso, igual que la app', (select public.has_nutrition_access()));
select bbtest.ok('nutrición: K registra una comida', bbtest.affected($q$ insert into public.meals (user_id, day, name, kcal) values (auth.uid(), current_date, 'Avena', 300) $q$) = 1);
reset role;
set role authenticated; select bbtest.login('S');
select bbtest.ok('nutrición: staff tiene acceso', (select public.has_nutrition_access()));
reset role;
set role authenticated; select bbtest.login('A');
select bbtest.ok('nutrición: A en prueba de 7 días tiene acceso', (select public.has_nutrition_access()));
reset role;
-- T: cuenta nueva sin plan (A ya llegó al tope de comidas por día en la sección 4)
set role authenticated; select bbtest.as_user('4d4d4d4d-0000-4000-8000-0000000000d4');
select bbtest.ok('nutrición: T en prueba de 7 días registra una comida', bbtest.affected($q$ insert into public.meals (user_id, day, name, kcal) values (auth.uid(), current_date, 'Huevos', 200) $q$) = 1);
reset role;

set role authenticated; select bbtest.as_user('1a1a1a1a-0000-4000-8000-0000000000a1');
select bbtest.ok('nutrición: N (Entreno) sí tiene la app', (select public.has_app_access()));
select bbtest.ok('beta: N (Entreno) tiene nutrición hasta noviembre', (select public.has_nutrition_access())) where not (now() >= timestamptz '2026-11-01 06:00:00+00');
select bbtest.ok('beta: N registra una comida durante la beta', bbtest.affected($q$ insert into public.meals (user_id, day, name, kcal) values (auth.uid(), current_date, 'Pinto', 350) $q$) = 1) where not (now() >= timestamptz '2026-11-01 06:00:00+00');
select bbtest.ok('nutrición: N (Entreno) no tiene nutrición', not (select public.has_nutrition_access())) where now() >= timestamptz '2026-11-01 06:00:00+00';
select bbtest.fails('nutrición: N no registra comidas', $q$ insert into public.meals (user_id, day, name, kcal) values (auth.uid(), current_date, 'Pinto', 350) $q$, '42501') where now() >= timestamptz '2026-11-01 06:00:00+00';
select bbtest.fails('nutrición: N no edita sus comidas viejas', $q$ update public.meals set kcal = 1 where user_id = auth.uid() $q$, '42501') where now() >= timestamptz '2026-11-01 06:00:00+00';
select bbtest.fails('nutrición: N no guarda alimentos', $q$ insert into public.saved_foods (user_id, name, kcal) values (auth.uid(), 'Plato del día', 700) $q$, '42501') where now() >= timestamptz '2026-11-01 06:00:00+00';
select bbtest.fails('nutrición: N no crea recetas', $q$ insert into public.user_recipes (user_id, name, servings, ingredients, kcal, protein) values (auth.uid(), 'Bowl', 1, '[{"name":"Arroz","qty":1,"kcal":200}]', 200, 4) $q$, '42501') where now() >= timestamptz '2026-11-01 06:00:00+00';
select bbtest.ok('nutrición: N sigue viendo sus comidas guardadas', bbtest.num($q$ select 1 from public.meals where user_id = auth.uid() $q$) >= 1);
select bbtest.ok('nutrición: N sí registra agua, pasos y sueño', bbtest.affected($q$ insert into public.daily_logs (user_id, day, water_glasses, steps, sleep_h) values (auth.uid(), current_date, 6, 8000, 7.5) $q$) = 1);
select bbtest.ok('nutrición: N puede borrar sus comidas (no da nada de más)', bbtest.affected($q$ delete from public.meals where user_id = auth.uid() and name = 'Arroz con frijoles' $q$) = 1);
reset role;

set role authenticated; select bbtest.login('E');
select bbtest.ok('nutrición: E sin plan y prueba vencida no tiene nutrición', not (select public.has_nutrition_access())) where now() >= timestamptz '2026-11-01 06:00:00+00';
select bbtest.fails('nutrición: E no registra comidas', $q$ insert into public.meals (user_id, day, name, kcal) values (auth.uid(), current_date, 'x', 1) $q$, '42501') where now() >= timestamptz '2026-11-01 06:00:00+00';
reset role;

-- ───────────── 8. Segunda auditoría (0023) ─────────────
-- 8a. Registro: el correo del dueño ya no da superadmin (el registro de la app no verifica el correo).
reset role;
select bbtest.login(null);
delete from auth.users where lower(email) = 'andresguevarag@hotmail.com';
insert into auth.users (id, email) values ('7e7e7e7e-0000-4000-8000-00000000007e', 'AndresGuevaraG@hotmail.com');
select bbtest.ok('registro: el correo del dueño nace como free, no superadmin', (select role::text = 'free' from public.profiles where id = '7e7e7e7e-0000-4000-8000-00000000007e'));
insert into auth.users (id, email, raw_user_meta_data) values ('7f7f7f7f-0000-4000-8000-00000000007f', 'nuevo@prueba.test', '{"role":"superadmin","full_name":"Nuevo"}');
select bbtest.ok('registro: los metadatos del cliente no ponen rol', (select role::text = 'free' and full_name = 'Nuevo' from public.profiles where id = '7f7f7f7f-0000-4000-8000-00000000007f'));
select bbtest.ok('registro: handle_new_user no menciona correos', not exists (select 1 from pg_proc where proname = 'handle_new_user' and prosrc ilike '%@%'));

-- 8b. Límites de frecuencia en la base: solo service_role.
set role authenticated; select bbtest.login('A');
select bbtest.fails('rate_hit: un usuario no la llama', $q$ select public.rate_hit('signup:ip:1.2.3.4', 60, 5) $q$, '42501');
select bbtest.zero('rate_limits: un usuario no lee', $q$ select * from public.rate_limits $q$);
select bbtest.fails('rate_limits: un usuario no escribe', $q$ insert into public.rate_limits (key, window_start, n) values ('x', now(), 0) $q$, '42501');
reset role;
set role anon; select bbtest.login(null);
select bbtest.fails('rate_hit: anon no la llama', $q$ select public.rate_hit('signup:ip:1.2.3.4', 60, 5) $q$, '42501');
reset role;
set role service_role; select bbtest.login(null);
select bbtest.ok('rate_hit: dentro del máximo', public.rate_hit('test:a', 3600, 2) and public.rate_hit('test:a', 3600, 2));
select bbtest.ok('rate_hit: corta al pasar el máximo', not public.rate_hit('test:a', 3600, 2));
select bbtest.ok('rate_hit: otra clave no se afecta', public.rate_hit('test:b', 3600, 2));
select bbtest.fails('rate_hit: valida la ventana', $q$ select public.rate_hit('test:c', 0, 2) $q$, '22023');
select bbtest.fails('rate_hit: valida la clave', $q$ select public.rate_hit('', 60, 2) $q$, '22023');
reset role;
-- Un JWT de usuario no puede usarla aunque el rol de base fuera service_role.
set role service_role; select bbtest.login('A');
select bbtest.fails('rate_hit: con sesión de usuario no', $q$ select public.rate_hit('test:d', 60, 2) $q$, '42501');
reset role;

-- 8c. Borrado de cuenta: scrub_deleted_user quita datos personales que sobreviven a la cascada.
select bbtest.login(null);
insert into auth.users (id, email) values ('8a8a8a8a-0000-4000-8000-00000000008a', 'borrar@prueba.test');
update public.profiles set username = 'borrable', visibility = 'publico' where id = '8a8a8a8a-0000-4000-8000-00000000008a';
insert into public.payment_events (event_key, type, user_id, amount_minor, currency, payload)
  values ('evt_borrar', 'payment-intent.succeeded', '8a8a8a8a-0000-4000-8000-00000000008a', 999, 'USD', '{"data":{"customer":{"email":"borrar@prueba.test","name":"Persona Borrable"}}}');
insert into public.posts (user_id, kind, body, visibility) values ('8a8a8a8a-0000-4000-8000-00000000008a', 'text', 'texto que se va a borrar', 'publico');
insert into public.reports (target_type, target_id, reporter, reason, excerpt)
  select 'post', id::text, bbtest.u('B'), 'spam', 'texto que se va a borrar' from public.posts where user_id = '8a8a8a8a-0000-4000-8000-00000000008a';
insert into public.reports (target_type, target_id, reporter, reason, excerpt) values ('user', '8a8a8a8a-0000-4000-8000-00000000008a', bbtest.u('D'), 'otro', '@borrable bio');
insert into public.reports (target_type, target_id, reporter, reason, details, excerpt) values ('user', bbtest.u('B')::text, '8a8a8a8a-0000-4000-8000-00000000008a', 'acoso', 'detalle escrito por la persona', '@beto');
set role authenticated; select bbtest.login('A');
select bbtest.fails('scrub_deleted_user: un usuario no la llama', $q$ select public.scrub_deleted_user('8a8a8a8a-0000-4000-8000-00000000008a') $q$, '42501');
reset role;
set role service_role; select bbtest.login(null);
select public.scrub_deleted_user('8a8a8a8a-0000-4000-8000-00000000008a');
reset role;
select bbtest.ok('borrado: el webhook guardado ya no trae correo ni nombre', (select payload::text not like '%borrar@prueba.test%' and payload::text not like '%Borrable%' and amount_minor = 999 and currency = 'USD' from public.payment_events where event_key = 'evt_borrar'));
select bbtest.ok('borrado: sin extractos de su contenido ni de su perfil', not exists (select 1 from public.reports where excerpt in ('texto que se va a borrar', '@borrable bio')));
select bbtest.ok('borrado: sin el texto de sus reportes', not exists (select 1 from public.reports where details = 'detalle escrito por la persona'));
select bbtest.ok('borrado: los reportes de otras personas siguen intactos', (select count(*) >= 1 from public.reports where excerpt = '@beto'));
delete from auth.users where id in ('8a8a8a8a-0000-4000-8000-00000000008a', '7e7e7e7e-0000-4000-8000-00000000007e', '7f7f7f7f-0000-4000-8000-00000000007f');
select bbtest.ok('borrado: el registro contable del pago queda sin dueño', (select user_id is null from public.payment_events where event_key = 'evt_borrar'));

-- ───────────── 9. Regalos, referidos y acceso con plan (0025) ─────────────
-- Para probar las reglas normales HOY, esta sección da por terminada la beta (solo en esta BD de pruebas) y la
-- restaura al final. _beta_ends_at() es el único lugar donde vive la fecha.
reset role; select bbtest.login(null);
create or replace function public._beta_ends_at() returns timestamptz language sql stable set search_path = public as $$ select now() - interval '1 day' $$;
-- Personas: R invita (Gmail), Q1-Q7 referidas nuevas, X misma bandeja que R (alias), V paga Completo, H sin plan.
insert into auth.users (id, email) values
  ('9a000000-0000-4000-8000-0000000000a0', 'rita.gomez@gmail.com'),
  ('9a000000-0000-4000-8000-0000000000a1', 'quique@gmail.com'), ('9a000000-0000-4000-8000-0000000000a2', 'quela@hotmail.com'),
  ('9a000000-0000-4000-8000-0000000000a3', 'quino@yahoo.com'), ('9a000000-0000-4000-8000-0000000000a4', 'queta@outlook.com'),
  ('9a000000-0000-4000-8000-0000000000a5', 'quima@icloud.com'), ('9a000000-0000-4000-8000-0000000000a6', 'quito@proton.me'),
  ('9a000000-0000-4000-8000-0000000000a7', 'quila@gmail.com'), ('9a000000-0000-4000-8000-0000000000a8', 'Rita.Gomez+banana@googlemail.com'),
  ('9a000000-0000-4000-8000-0000000000a9', 'quiro@gmail.com'),
  ('9a000000-0000-4000-8000-0000000000b0', 'vale@prueba.test'), ('9a000000-0000-4000-8000-0000000000b1', 'hugo@prueba.test');
update public.profiles set created_at = now() - interval '60 days', onboarded = true, full_name = 'Rita Gómez' where id = '9a000000-0000-4000-8000-0000000000a0';
update public.profiles set full_name = n from (values ('a1','Quique'),('a2','Quela'),('a3','Quino'),('a4','Queta'),('a5','Quima'),('a6','Quito'),('a7','Lucía'),('a9','Quiro')) v(k, n)
  where id = ('9a000000-0000-4000-8000-0000000000' || k)::uuid;
update public.profiles set created_at = now() - interval '90 days', onboarded = true where id in ('9a000000-0000-4000-8000-0000000000b0', '9a000000-0000-4000-8000-0000000000b1');
insert into public.subscriptions (user_id, status, plan, billing, provider_subscription_id, current_period_start, current_period_end)
  values ('9a000000-0000-4000-8000-0000000000b0', 'active', 'completo', 'mes', 'sub_vale', now() - interval '10 days', now() + interval '20 days');
update public.profiles set plan = 'completo' where id = '9a000000-0000-4000-8000-0000000000b0';

-- 9a. Sin plan después de la beta: no escribe entrenos, pesos ni registro diario (lee y borra lo suyo).
set role authenticated; select bbtest.login('E');
select bbtest.ok('acceso: E sin plan después de la beta no tiene la app', not (select public.has_app_access()));
select bbtest.fails('acceso: E no registra un entreno', $q$ insert into public.workouts (user_id, day, template, started_at) values (auth.uid(), current_date, 'pierna', now()) $q$, '42501');
select bbtest.fails('acceso: E no anota su peso', $q$ insert into public.weights (user_id, day, kg) values (auth.uid(), current_date, 80) $q$, '42501');
select bbtest.fails('acceso: E no anota agua', $q$ insert into public.daily_logs (user_id, day, water_glasses) values (auth.uid(), current_date, 3) $q$, '42501');
select bbtest.fails('acceso: E no anota medidas', $q$ insert into public.measurements (user_id, day, waist) values (auth.uid(), current_date, 80) $q$, '42501');
select bbtest.fails('acceso: E no sube fotos', $q$ insert into storage.objects (bucket_id, name) values ('progreso', auth.uid() || '/muro.jpg') $q$, '42501');
reset role;
set role authenticated; select bbtest.as_user('9a000000-0000-4000-8000-0000000000b1');
select bbtest.ok('acceso: H (prueba vencida) ve sus datos aunque no tenga plan', bbtest.num($q$ select 1 from public.profiles where id = auth.uid() $q$) = 1);
reset role;
set role authenticated; select bbtest.as_user('9a000000-0000-4000-8000-0000000000a1');
select bbtest.ok('acceso: Q1 en sus 7 días de prueba sí registra', bbtest.affected($q$ insert into public.weights (user_id, day, kg) values (auth.uid(), current_date - 1, 70) $q$) = 1);
reset role;

-- 9b. Regalos: solo admin, se apilan, respetan el plan, avisan y quedan en auditoría.
set role authenticated; select bbtest.login('A');
select bbtest.fails('regalo: un usuario no regala meses', $q$ select public.admin_gift_months(auth.uid(), 'completo', 12, null, 'yo mismo') $q$, '42501');
select bbtest.fails('regalo: un usuario no regala en lote', $q$ select public.admin_gift_months_bulk(array[auth.uid()], 'completo', 12, null, 'yo mismo') $q$, '42501');
select bbtest.fails('regalo: un usuario no usa la función interna', $q$ select public._gift_grant(auth.uid(), 'completo', 12, 'regalo', null, null) $q$, '42501');
reset role;
set role authenticated; select bbtest.login('P');
select bbtest.fails('regalo: soporte no regala meses (solo admin)', $q$ select public.admin_gift_months('f6f6f6f6-0000-4000-8000-0000000000f6', 'completo', 3, null, 'compensación') $q$, '42501');
reset role;
set role authenticated; select bbtest.login('S');
select bbtest.fails('regalo: pide motivo', $q$ select public.admin_gift_months('f6f6f6f6-0000-4000-8000-0000000000f6', 'completo', 3, null, '') $q$, 'P0001');
select bbtest.fails('regalo: máximo 24 meses', $q$ select public.admin_gift_months('f6f6f6f6-0000-4000-8000-0000000000f6', 'completo', 25, null, 'demasiado') $q$, '22023');
select bbtest.fails('regalo: plan válido', $q$ select public.admin_gift_months('f6f6f6f6-0000-4000-8000-0000000000f6', 'oro', 3, null, 'plan raro') $q$, '22023');
select bbtest.ok('regalo: admin regala 3 meses de Completo a E', (select public.admin_gift_months('f6f6f6f6-0000-4000-8000-0000000000f6', 'completo', 3, 'Gracias por entrenar con nosotros', 'cliente fiel')) > 0);
select bbtest.ok('regalo: admin regala 1 mes de Entreno a E (se apila)', (select public.admin_gift_months('f6f6f6f6-0000-4000-8000-0000000000f6', 'entreno', 1, null, 'segundo regalo')) > 0);
select bbtest.ok('regalo: admin regala 2 meses a V, que ya paga', (select public.admin_gift_months('9a000000-0000-4000-8000-0000000000b0', 'completo', 2, null, 'promo')) > 0);
select bbtest.ok('regalo: en lote (repetidos cuentan una vez, cuentas borradas se saltan)', (select public.admin_gift_months_bulk(array['9a000000-0000-4000-8000-0000000000b1', '0a0a0a0a-0000-4000-8000-00000000000a', '9a000000-0000-4000-8000-0000000000b1']::uuid[], 'entreno', 1, null, 'campaña')) = 1);
select bbtest.fails('regalo: lote de más de 200', $q$ select public.admin_gift_months_bulk((select array_agg(gen_random_uuid()) from generate_series(1, 201)), 'entreno', 1, null, 'demasiados') $q$, 'P0001');
reset role;
select bbtest.ok('regalo: el primero empieza hoy y dura 3 meses', (select abs(extract(epoch from starts_at - now())) < 60 and expires_at = starts_at + interval '3 months' and months = 3 and source = 'regalo'
  from public.comp_grants where user_id = 'f6f6f6f6-0000-4000-8000-0000000000f6' and source = 'regalo' and plan = 'completo'));
select bbtest.ok('regalo: el segundo empieza cuando termina el primero', (select g2.starts_at = g1.expires_at and g2.expires_at = g1.expires_at + interval '1 month'
  from public.comp_grants g1, public.comp_grants g2 where g1.user_id = 'f6f6f6f6-0000-4000-8000-0000000000f6' and g1.source = 'regalo' and g1.plan = 'completo'
   and g2.user_id = g1.user_id and g2.source = 'regalo' and g2.plan = 'entreno'));
select bbtest.ok('regalo: con suscripción pagada empieza al terminar el periodo pagado', (select g.starts_at = s.current_period_end and g.expires_at = s.current_period_end + interval '2 months'
  from public.comp_grants g join public.subscriptions s on s.user_id = g.user_id where g.user_id = '9a000000-0000-4000-8000-0000000000b0' and g.source = 'regalo'));
select bbtest.ok('regalo: no toca el plan del perfil', (select plan = 'free' from public.profiles where id = 'f6f6f6f6-0000-4000-8000-0000000000f6'));
select bbtest.ok('regalo: el motivo interno no queda en la fila que ve la persona', not exists (select 1 from public.comp_grants where source = 'regalo' and reason in ('cliente fiel', 'segundo regalo', 'promo', 'campaña')));
select bbtest.ok('regalo: cada regalo queda en auditoría con el admin', (select count(*) = 4 from public.audit_log where action = 'user.gift' and actor = bbtest.u('S')));
select bbtest.ok('regalo: aviso en la campanita', (select count(*) = 2 from public.notifications where user_id = 'f6f6f6f6-0000-4000-8000-0000000000f6' and kind = 'regalo' and title like 'Te regalaron%'));
set role authenticated; select bbtest.login('E');
select bbtest.ok('regalo: E ya tiene la app', (select public.has_app_access()));
select bbtest.ok('regalo: E tiene nutrición (regalo de Completo)', (select public.has_nutrition_access()));
select bbtest.ok('regalo: E registra su entreno', bbtest.affected($q$ insert into public.weights (user_id, day, kg) values (auth.uid(), current_date, 79) $q$) = 1);
select bbtest.ok('regalo: E ve sus 2 regalos y su mensaje', (select count(*) = 2 and bool_or(message = 'Gracias por entrenar con nosotros') from public.comp_grants where user_id = auth.uid() and source = 'regalo'));
select bbtest.zero('regalo: E no se marca un regalo más largo', $q$ update public.comp_grants set expires_at = now() + interval '10 years' where user_id = auth.uid() $q$);
select bbtest.fails('regalo: E no se crea un regalo', $q$ insert into public.comp_grants (user_id, plan, expires_at, source) values (auth.uid(), 'completo', now() + interval '1 year', 'regalo') $q$, '42501');
select bbtest.ok('regalo: E marca vistos sus regalos', (select public.gifts_mark_seen()) = 2);
select bbtest.ok('regalo: marcar de nuevo no cambia nada', (select public.gifts_mark_seen()) = 0);
reset role;
set role authenticated; select bbtest.as_user('9a000000-0000-4000-8000-0000000000b1');
select bbtest.ok('regalo: H con regalo de Entreno tiene la app', (select public.has_app_access()));
select bbtest.ok('regalo: H con regalo de Entreno no tiene nutrición', not (select public.has_nutrition_access()));
select bbtest.fails('regalo: H no registra comidas', $q$ insert into public.meals (user_id, day, name, kcal) values (auth.uid(), current_date, 'x', 1) $q$, '42501');
select bbtest.ok('regalo: H no ve los regalos de E', bbtest.num($q$ select 1 from public.comp_grants where user_id = 'f6f6f6f6-0000-4000-8000-0000000000f6' $q$) = 0);
select bbtest.ok('regalo: marcar vistos solo toca los propios', (select public.gifts_mark_seen()) = 1);
reset role;
-- Una cortesía de las de siempre ya no revoca los regalos.
set role authenticated; select bbtest.login('P');
select public.admin_grant_comp('f6f6f6f6-0000-4000-8000-0000000000f6', 'entreno', now() + interval '10 days', 'cortesía de soporte');
reset role;
select bbtest.ok('regalo: una cortesía nueva no revoca regalos', (select count(*) = 2 from public.comp_grants where user_id = 'f6f6f6f6-0000-4000-8000-0000000000f6' and source = 'regalo' and revoked_at is null));
-- Al vencer, el plan del perfil no queda pegado en un plan pagado vencido.
update public.subscriptions set status = 'canceled', current_period_end = now() - interval '5 days' where user_id = '9a000000-0000-4000-8000-0000000000b0';
select bbtest.ok('cortesías: restaurar no deja un plan pagado vencido', public._restore_plan_after_comp('9a000000-0000-4000-8000-0000000000b0', 'completo') = 'free');

-- 9c. Referidos: código propio, nadie escribe atribuciones ni recompensas por la API.
set role authenticated; select bbtest.as_user('9a000000-0000-4000-8000-0000000000a0');
select bbtest.ok('referidos: R obtiene su código (8 caracteres)', (select public.my_referral_code()) ~ '^[a-hjkmnp-z2-9]{8}$');
select bbtest.ok('referidos: el código es siempre el mismo', (select public.my_referral_code()) = (select public.my_referral_code()));
select bbtest.ok('referidos: R lee su fila de código', bbtest.num($q$ select 1 from public.referral_codes where user_id = auth.uid() $q$) = 1);
select bbtest.fails('referidos: R no se atribuye referidos', $q$ insert into public.referrals (referrer, referred, code) values (auth.uid(), 'a1a1a1a1-0000-4000-8000-0000000000a1', 'abcdefgh') $q$, '42501');
select bbtest.fails('referidos: R no llama la atribución del servidor', $q$ select public.referral_attribute('a1a1a1a1-0000-4000-8000-0000000000a1', 'abcdefgh') $q$, '42501');
select bbtest.fails('referidos: R no se marca compra anual', $q$ select public.referral_annual_paid('9a000000-0000-4000-8000-0000000000a1') $q$, '42501');
select bbtest.fails('referidos: R no escribe recompensas', $q$ insert into public.referral_rewards (referrer, group_no, months, plan) values (auth.uid(), 99, 3, 'completo') $q$, '42501');
select bbtest.fails('referidos: R no cambia su código', $q$ update public.referral_codes set code = 'zzzzzzzz' where user_id = auth.uid() $q$, '42501');
select bbtest.fails('referidos: R no lee las señales de red', $q$ select * from public.referral_signals $q$, '42501');
select bbtest.fails('referidos: R no lee la tabla de referidos directo', $q$ select * from public.referrals $q$, '42501');
select bbtest.fails('referidos: R no guarda su red', $q$ select public.referral_touch(auth.uid(), repeat('a', 22)) $q$, '42501');
reset role;
set role authenticated; select bbtest.login('A');
select bbtest.ok('referidos: A no ve el código de R', bbtest.num($q$ select 1 from public.referral_codes where user_id = '9a000000-0000-4000-8000-0000000000a0' $q$) = 0);
select bbtest.fails('referidos: A no lee la ficha de referidos', $q$ select public.admin_referral_overview('9a000000-0000-4000-8000-0000000000a0') $q$, '42501');
select bbtest.fails('referidos: A no lee conteos del panel', $q$ select * from public.admin_referral_counts(array['9a000000-0000-4000-8000-0000000000a0']::uuid[]) $q$, '42501');
reset role;
set role anon; select bbtest.login(null);
select bbtest.fails('referidos: anon no atribuye', $q$ select public.referral_attribute('9a000000-0000-4000-8000-0000000000a1', 'abcdefgh') $q$, '42501');
reset role;

-- 9d. Atribución (como el servidor con service_role): una vez, nunca a sí misma, solo cuentas nuevas.
create table bbtest.kv (k text primary key, v text);
grant all on bbtest.kv to public;
insert into bbtest.kv select 'code', code from public.referral_codes where user_id = '9a000000-0000-4000-8000-0000000000a0';
create function bbtest.code() returns text language sql stable as $$ select v from bbtest.kv where k = 'code' $$;
create function bbtest.h(s text) returns text language sql immutable as $$ select rpad(s, 22, 'x') $$;
set role service_role; select bbtest.login(null);
select public.referral_touch('9a000000-0000-4000-8000-0000000000a0', bbtest.h('red-de-rita'));
select bbtest.ok('atribución: Q1 queda registrada', public.referral_attribute('9a000000-0000-4000-8000-0000000000a1', bbtest.code(), bbtest.h('mail-q1'), bbtest.h('red-1')) = 'registrado');
select bbtest.ok('atribución: no se vuelve a atribuir', public.referral_attribute('9a000000-0000-4000-8000-0000000000a1', bbtest.code(), bbtest.h('mail-q1b'), bbtest.h('red-1')) = 'ya_atribuido');
select bbtest.ok('atribución: nadie se refiere a sí mismo', public.referral_attribute('9a000000-0000-4000-8000-0000000000a0', bbtest.code(), null, null) = 'auto_referido');
select bbtest.ok('atribución: una cuenta vieja no se atribuye', public.referral_attribute('f6f6f6f6-0000-4000-8000-0000000000f6', bbtest.code(), null, null) = 'cuenta_vieja');
select bbtest.ok('atribución: código con formato inválido', public.referral_attribute('9a000000-0000-4000-8000-0000000000a2', 'x''; drop table referrals; --', null, null) = 'codigo_invalido');
select bbtest.ok('atribución: código que no existe', public.referral_attribute('9a000000-0000-4000-8000-0000000000a2', 'zzzzzzzz', null, null) = 'codigo_desconocido');
select bbtest.ok('atribución: el mismo correo con alias se descarta', public.referral_attribute('9a000000-0000-4000-8000-0000000000a8', bbtest.code(), bbtest.h('mail-x'), bbtest.h('red-x')) = 'descartado');
select bbtest.ok('atribución: misma red y mismo dominio que quien invita queda en revisión', public.referral_attribute('9a000000-0000-4000-8000-0000000000a7', upper(bbtest.code()), bbtest.h('mail-q7'), bbtest.h('red-de-rita')) = 'sospechoso');
select bbtest.ok('atribución: Q2 a Q6 registrados', (select bool_and(public.referral_attribute(('9a000000-0000-4000-8000-0000000000' || k)::uuid, bbtest.code(), bbtest.h('mail-' || k), bbtest.h('red-' || k)) = 'registrado') from unnest(array['a2','a3','a4','a5','a6']) k));
select bbtest.ok('atribución: el mismo correo (aunque se borre la cuenta) no se atribuye dos veces', public.referral_attribute('9a000000-0000-4000-8000-0000000000a9', bbtest.code(), bbtest.h('mail-a2'), bbtest.h('red-9')) = 'correo_repetido');
reset role;
set role service_role; select bbtest.as_user('9a000000-0000-4000-8000-0000000000a0');
select bbtest.fails('atribución: un JWT de usuario no la usa aunque el rol fuera service_role', $q$ select public.referral_attribute('9a000000-0000-4000-8000-0000000000a9', 'abcdefgh') $q$, '42501');
reset role;
select bbtest.ok('atribución: 8 filas para R (incluye descartado y en revisión)', (select count(*) = 8 from public.referrals where referrer = '9a000000-0000-4000-8000-0000000000a0'));

-- 9e. Calificación y recompensas: grupos de 3, 1 mes o 3 si alguien del grupo compró anual. Sin doble conteo.
select bbtest.login(null);
update public.profiles set onboarded = true where id in ('9a000000-0000-4000-8000-0000000000a1', '9a000000-0000-4000-8000-0000000000a2', '9a000000-0000-4000-8000-0000000000a3',
  '9a000000-0000-4000-8000-0000000000a4', '9a000000-0000-4000-8000-0000000000a5', '9a000000-0000-4000-8000-0000000000a6', '9a000000-0000-4000-8000-0000000000a7');
select bbtest.ok('calificación: terminar la bienvenida sola no califica', (select count(*) = 0 from public.referrals where status = 'calificado'));
-- El peso de la bienvenida tampoco cuenta como día activo (Q1 ya anotó peso en 9a).
select bbtest.ok('calificación: anotar peso no califica', (select status = 'registrado' from public.referrals where referred = '9a000000-0000-4000-8000-0000000000a1'));
set role authenticated; select bbtest.as_user('9a000000-0000-4000-8000-0000000000a1');
select bbtest.ok('calificación: Q1 anota agua', bbtest.affected($q$ insert into public.daily_logs (user_id, day, water_glasses) values (auth.uid(), current_date, 4) $q$) = 1);
reset role;
set role authenticated; select bbtest.as_user('9a000000-0000-4000-8000-0000000000a2');
select bbtest.ok('calificación: Q2 empieza un entreno', bbtest.affected($q$ insert into public.workouts (user_id, day, template, started_at) values (auth.uid(), current_date, 'pierna', now()) $q$) = 1);
reset role;
select bbtest.ok('calificación: un entreno sin terminar no califica', (select status = 'registrado' from public.referrals where referred = '9a000000-0000-4000-8000-0000000000a2'));
set role authenticated; select bbtest.as_user('9a000000-0000-4000-8000-0000000000a2');
select bbtest.ok('calificación: Q2 termina el entreno', bbtest.affected($q$ update public.workouts set finished_at = now() where user_id = auth.uid() $q$) = 1);
reset role;
select bbtest.ok('calificación: Q1 y Q2 calificados, sin recompensa todavía', (select count(*) = 2 from public.referrals where status = 'calificado') and not exists (select 1 from public.referral_rewards));
-- Q3 pasó sus 7 días sin actividad: ya no califica.
update public.profiles set created_at = now() - interval '9 days' where id = '9a000000-0000-4000-8000-0000000000a3';
set role authenticated; select bbtest.as_user('9a000000-0000-4000-8000-0000000000a3');
select bbtest.ok('calificación: Q3 fuera de plazo no puede escribir', bbtest.affected($q$ insert into public.daily_logs (user_id, day, steps) values (auth.uid(), current_date, 9000) $q$) = -1);
reset role;
select bbtest.login(null);
insert into public.daily_logs (user_id, day, steps) values ('9a000000-0000-4000-8000-0000000000a3', current_date, 9000);
select bbtest.ok('calificación: actividad después de los 7 días no califica', (select status = 'registrado' from public.referrals where referred = '9a000000-0000-4000-8000-0000000000a3'));
-- Q4 califica: grupo 1 completo (Q1, Q2, Q4) = 1 mes.
insert into public.daily_logs (user_id, day, sleep_h) values ('9a000000-0000-4000-8000-0000000000a4', current_date, 7.5);
select bbtest.ok('recompensa: el grupo 1 completo da 1 mes', (select count(*) = 1 and min(months) = 1 and min(group_no) = 1 from public.referral_rewards where referrer = '9a000000-0000-4000-8000-0000000000a0'));
select bbtest.ok('recompensa: 1 regalo de referidos para R, de 1 mes', (select count(*) = 1 and min(months) = 1 from public.comp_grants where user_id = '9a000000-0000-4000-8000-0000000000a0' and source = 'referido'));
select bbtest.ok('recompensa: los 3 del grupo quedan marcados', (select count(*) = 3 from public.referrals where referrer = '9a000000-0000-4000-8000-0000000000a0' and group_no = 1));
select bbtest.ok('recompensa: volver a liquidar no paga de nuevo', public._referral_settle('9a000000-0000-4000-8000-0000000000a0') = 0 and (select count(*) = 1 from public.referral_rewards));
-- Q2 compra anual (webhook): el grupo 1 sube a trimestre, una sola vez.
set role service_role; select bbtest.login(null);
select bbtest.ok('anual: el grupo 1 sube a trimestre', public.referral_annual_paid('9a000000-0000-4000-8000-0000000000a2') = 'trimestre');
select bbtest.ok('anual: la renovación del año no suma de nuevo', public.referral_annual_paid('9a000000-0000-4000-8000-0000000000a2') = 'sin_cambio');
select bbtest.ok('anual: otra compra anual del mismo grupo no suma', public.referral_annual_paid('9a000000-0000-4000-8000-0000000000a1') = 'sin_cambio');
reset role;
select bbtest.ok('anual: el grupo 1 vale 3 meses en total (1 + 2)', (select months = 3 and upgraded_at is not null and cardinality(grant_ids) = 2 from public.referral_rewards where group_no = 1)
  and (select sum(months) = 3 from public.comp_grants where user_id = '9a000000-0000-4000-8000-0000000000a0' and source = 'referido'));
-- Grupo 2 con compra anual ANTES de completarse: da 3 meses de una vez.
set role service_role; select bbtest.login(null);
select bbtest.ok('anual: Q5 compra anual antes de calificar (queda anotado)', public.referral_annual_paid('9a000000-0000-4000-8000-0000000000a5') = 'anotado');
reset role;
insert into public.daily_logs (user_id, day, water_glasses) values ('9a000000-0000-4000-8000-0000000000a5', current_date, 2), ('9a000000-0000-4000-8000-0000000000a6', current_date, 2);
select bbtest.ok('recompensa: con 2 de 3 el grupo 2 todavía no paga', (select count(*) = 1 from public.referral_rewards));
-- Q7 estaba en revisión: el admin lo aprueba y completa el grupo 2.
set role authenticated; select bbtest.login('P');
select bbtest.fails('revisión: soporte no aprueba referidos', $q$ select public.admin_review_referral((select 1::bigint), true, 'ok') $q$, '42501');
reset role;
insert into public.daily_logs (user_id, day, water_glasses) values ('9a000000-0000-4000-8000-0000000000a7', current_date, 2);
select bbtest.ok('revisión: en revisión no califica aunque entrene', (select status = 'sospechoso' from public.referrals where referred = '9a000000-0000-4000-8000-0000000000a7'));
insert into bbtest.kv select 'q7', id::text from public.referrals where referred = '9a000000-0000-4000-8000-0000000000a7';
set role authenticated; select bbtest.login('S');
select bbtest.ok('revisión: el admin aprueba a Q7', public.admin_review_referral((select v::bigint from bbtest.kv where k = 'q7'), true, 'es su hermana, lo confirmó por correo') = 'registrado');
select bbtest.fails('revisión: no se revisa dos veces', $q$ select public.admin_review_referral((select v::bigint from bbtest.kv where k = 'q7'), true, 'otra vez') $q$, 'P0001');
reset role;
select bbtest.ok('recompensa: el grupo 2 (con anual) da 3 meses de una vez', (select months = 3 and upgraded_at is null and cardinality(grant_ids) = 1 from public.referral_rewards where group_no = 2));
select bbtest.ok('recompensa: los regalos de R se apilan uno tras otro', (select bool_and(ok) from (
  select starts_at >= lag(expires_at) over (order by starts_at) or lag(expires_at) over (order by starts_at) is null as ok
  from public.comp_grants where user_id = '9a000000-0000-4000-8000-0000000000a0' and source = 'referido') t));
select bbtest.ok('recompensa: aviso en la campanita de R', (select count(*) >= 3 from public.notifications where user_id = '9a000000-0000-4000-8000-0000000000a0' and kind = 'referido'));
select bbtest.ok('auditoría: la aprobación queda registrada', (select count(*) = 1 from public.audit_log where action = 'referral.approve'));

-- 9f. Lo que ve quien invita: inicial y estado, nada más.
set role authenticated; select bbtest.as_user('9a000000-0000-4000-8000-0000000000a0');
select bbtest.ok('mis referidos: R ve sus 8 referidos', bbtest.num($q$ select * from public.my_referrals() $q$) = 8);
select bbtest.ok('mis referidos: solo iniciales (una letra)', (select bool_and(char_length(initial) = 1) from public.my_referrals()));
select bbtest.ok('mis referidos: sin correo ni ids', not exists (select 1 from public.my_referrals() r where to_jsonb(r)::text ~ '@|[0-9a-f]{8}-[0-9a-f]{4}'));
select bbtest.ok('mis referidos: Q3 aparece como vencido', (select count(*) = 1 from public.my_referrals() where expired));
select bbtest.ok('mis referidos: compras anuales marcadas (Q1, Q2, Q5)', (select count(*) = 3 from public.my_referrals() where annual));
select bbtest.ok('mis referidos: R ve sus 2 recompensas', bbtest.num($q$ select 1 from public.referral_rewards where referrer = auth.uid() $q$) = 2);
reset role;
set role authenticated; select bbtest.as_user('9a000000-0000-4000-8000-0000000000a1');
select bbtest.ok('mis referidos: Q1 no ve las recompensas de R', bbtest.num($q$ select 1 from public.referral_rewards $q$) = 0);
select bbtest.ok('mis referidos: Q1 no tiene referidos propios', bbtest.num($q$ select * from public.my_referrals() $q$) = 0);
reset role;

-- 9g. Panel: soporte lee, solo admin revoca. La revocación quita los meses y no se vuelve a pagar.
set role authenticated; select bbtest.login('P');
select bbtest.ok('panel: soporte lee la ficha de referidos', (select jsonb_array_length(public.admin_referral_overview('9a000000-0000-4000-8000-0000000000a0') -> 'referrals')) = 8);
select bbtest.ok('panel: conteos por usuario', (select total = 8 and qualified = 6 and rewards = 2 from public.admin_referral_counts(array['9a000000-0000-4000-8000-0000000000a0']::uuid[])));
select bbtest.fails('panel: soporte no revoca recompensas', $q$ select public.admin_revoke_referral_reward((select 1::bigint), 'fraude') $q$, '42501');
reset role;
insert into bbtest.kv select 'g1', id::text from public.referral_rewards where group_no = 1;
set role authenticated; select bbtest.login('S');
select bbtest.fails('panel: revocar pide motivo', $q$ select public.admin_revoke_referral_reward((select v::bigint from bbtest.kv where k = 'g1'), '') $q$, 'P0001');
select public.admin_revoke_referral_reward((select v::bigint from bbtest.kv where k = 'g1'), 'cuentas falsas confirmadas');
select bbtest.fails('panel: no se revoca dos veces', $q$ select public.admin_revoke_referral_reward((select v::bigint from bbtest.kv where k = 'g1'), 'otra vez') $q$, 'P0001');
reset role;
select bbtest.login(null);
select bbtest.ok('revocación: los meses del grupo 1 quedan revocados', (select count(*) = 2 from public.comp_grants where id = any((select grant_ids from public.referral_rewards where group_no = 1)::bigint[]) and revoked_at is not null));
select bbtest.ok('revocación: los referidos del grupo 1 ya no cuentan', (select count(*) = 3 from public.referrals where group_no = 1 and status = 'descartado'));
select bbtest.ok('revocación: liquidar de nuevo no paga el grupo revocado', public._referral_settle('9a000000-0000-4000-8000-0000000000a0') = 0 and (select count(*) = 2 from public.referral_rewards));
select bbtest.ok('revocación: la compra anual de un grupo revocado no suma', public.referral_annual_paid('9a000000-0000-4000-8000-0000000000a4') = 'sin_cambio');
select bbtest.ok('auditoría: la revocación queda registrada', (select count(*) = 1 from public.audit_log where action = 'referral.reward_revoke' and actor = bbtest.u('S')));

-- 9h. Borrado de la cuenta referida: la fila queda sin dueño ni red, y su correo no se puede volver a atribuir.
delete from auth.users where id = '9a000000-0000-4000-8000-0000000000a6';
select bbtest.ok('borrado: la fila de referido queda sin dueño y sin red', (select referred is null and ip_hash is null and email_hash is not null from public.referrals where email_hash = bbtest.h('mail-a6')));
set role service_role; select bbtest.login(null);
select bbtest.ok('borrado: recrear la cuenta con el mismo correo no se vuelve a atribuir', public.referral_attribute('9a000000-0000-4000-8000-0000000000a9', bbtest.code(), bbtest.h('mail-a6'), null) = 'correo_repetido');
reset role;
-- Los triggers nunca bloquean el registro del usuario aunque fallen las recompensas.
select bbtest.ok('triggers: actividad de alguien sin referido no hace nada', bbtest.affected($q$ insert into public.daily_logs (user_id, day, water_glasses) values ('9a000000-0000-4000-8000-0000000000b0', current_date, 1) $q$) = 1);

-- Restaurar la beta original (misma fecha que src/lib/plans.ts).
create or replace function public._beta_ends_at() returns timestamptz language sql stable set search_path = public as $$ select timestamptz '2026-11-01 06:00:00+00' $$;
revoke all on function public._beta_ends_at() from public, anon, authenticated;

-- ───────────── Resumen ─────────────
select bbtest.ok('aislamiento: ninguna fila de B quedó modificada por A', (select count(*) = 1 from public.weights where user_id = bbtest.u('B')));
do $$
declare total int; bad int;
begin
  select count(*), count(*) filter (where not pass) into total, bad from bbtest.results;
  raise notice 'RESUMEN % verificaciones, % fallas', total, bad;
  if bad > 0 then raise exception 'Fallaron % verificaciones', bad; end if;
end $$;
