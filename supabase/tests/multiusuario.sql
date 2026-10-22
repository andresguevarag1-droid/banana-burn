-- Banana Burn · suite multiusuario (aislamiento entre cuentas, comunidad, escalamiento, XP, RPC y carreras)
-- Uso (BD desechable con stub.sql + migraciones 0001→0018, ver README.md). La sección 5b cubre la tienda de retos (0018).
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
    ('public.follows','follower'), ('public.reports','reporter')
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
select bbtest.ok('has_app_access: E con prueba vencida = false', not (select public.has_app_access()));
select bbtest.fails('E sin plan no publica', $q$ insert into public.posts (user_id, kind, body) values (auth.uid(), 'text', 'hola') $q$, '42501');
select bbtest.fails('E sin plan no usa el coach', $q$ select public.coach_consume('chat') $q$, '42501');
select bbtest.fails('E sin plan no se une a retos', $q$ insert into public.user_challenges (user_id, challenge_id) values (auth.uid(), 'banana-30') $q$, '42501');
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

-- ───────────── Resumen ─────────────
select bbtest.ok('aislamiento: ninguna fila de B quedó modificada por A', (select count(*) = 1 from public.weights where user_id = bbtest.u('B')));
do $$
declare total int; bad int;
begin
  select count(*), count(*) filter (where not pass) into total, bad from bbtest.results;
  raise notice 'RESUMEN % verificaciones, % fallas', total, bad;
  if bad > 0 then raise exception 'Fallaron % verificaciones', bad; end if;
end $$;
