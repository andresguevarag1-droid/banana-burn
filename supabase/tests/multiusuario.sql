-- Banana Burn · suite multiusuario (aislamiento entre cuentas, comunidad, escalamiento, XP, RPC y carreras)
-- Uso (BD desechable con stub.sql + migraciones 0001→0026, ver README.md). La sección 5b cubre la tienda de retos (0018),
-- la 5c los programas (0024), la 7, el acceso a nutrición por plan (0022), la 9, regalos, referidos y escribir datos con plan (0025)
-- la 10, tarjeta guardada y prueba de 7 días con cobro el día 7 (0026), la 11, testers de la beta y "Reportar algo" (0029),
-- la 12, la guía de la app (0031), y el cupo de Coach Banana por plan (0032).
-- la 12, la guía de la app (0031), la 13, las novedades (0036), y la 14, Pilates en casa 30 días (0037).
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
    ('public.payment_events','user_id'), ('public.comp_grants','user_id'), ('public.trial_charges','user_id'), ('public.notification_prefs','user_id'),
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

-- ───────────── 0033: retos gratis (antes de restaurar el catálogo de 0018 para las pruebas de abajo) ─────────────
select bbtest.ok('0033: quedan 4 retos gratis publicados, todos de 15 días o menos', (select count(*) = 4 and bool_and(days <= 15) from public.challenges_catalog where status = 'publicado' and price_usd = 0 and kind = 'reto'));
select bbtest.ok('0033: Hidratado 14 días con su plan de 14 días', (select c.days = 14 and jsonb_array_length(p.days) = 14 from public.challenges_catalog c join public.challenge_plans p using (slug) where slug = 'agua-21' and c.title = 'Hidratado 14 días'));
select bbtest.ok('0033: Caminata de la selva 15 días con 8.000 pasos', (select days = 15 and steps_goal = 8000 from public.challenges_catalog where slug = 'pasos-30'));
select bbtest.ok('0033: los demás gratis quedan ocultos', (select bool_and(status = 'oculto') from public.challenges_catalog where slug in ('banana-30','flexiones-30','plancha-30','proteina-21','pasos-14')));
select bbtest.fails('0033: un reto gratis publicado no dura más de 15 días', $q$ update public.challenges_catalog set days = 30 where slug = 'agua-21' $q$, '23514');
select bbtest.ok('0033: uno oculto sí puede durar más', bbtest.affected($q$ update public.challenges_catalog set days = days where slug = 'banana-30' $q$) = 1);
-- Las pruebas de abajo (escritas sobre el catálogo de 0018) usan los retos gratis originales: se vuelven a publicar.
alter table public.challenges_catalog drop constraint challenges_catalog_free_days_check;
update public.challenges_catalog set status = 'publicado' where slug in ('banana-30','flexiones-30','plancha-30','proteina-21','pasos-14');

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

/**
 * Prueba de 7 días con tarjeta (0026), como la deja el servidor: tarjeta guardada en ONVO y cobro programado al día 7.
 * Solo cuenta para cuentas creadas desde el fin de la beta; en la beta el acceso ya viene de _beta_ends_at().
 */
create function bbtest.card_trial(u uuid, st text default 'scheduled', started timestamptz default now()) returns void language plpgsql as $$
begin
  insert into public.payment_methods (user_id, provider_customer_id, provider_payment_method_id, brand, last4, exp_month, exp_year)
  values (u, 'cus_t_' || u, 'pm_' || u, 'visa', '4242', 12, 2030) on conflict (user_id) do nothing;
  insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_started_at, trial_ends_at, charge_at, next_attempt_at, status)
  values (u, 'trial:' || u, 'prueba', 'entreno', 'mes', 999, started, started + interval '7 days', started + interval '7 days',
          case when st in ('scheduled', 'retry_scheduled') then started + interval '7 days' end, st)
  on conflict (user_id) do nothing;
end $$;

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
  perform bbtest.card_trial(u);
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

-- Según la fecha: una cuenta nueva sin tarjeta tiene la app durante la beta; después del 1 de noviembre tiene sus 7 días
-- desde el registro, también sin tarjeta (0043), y al pasar los 7 días ya no.
insert into auth.users (id, email) values ('acacacac-0000-4000-8000-0000000000ac', 'sintarjeta@prueba.test');
select bbtest.ok('beta: cuenta nueva sin tarjeta tiene la app hasta noviembre', public._has_app_access('acacacac-0000-4000-8000-0000000000ac')) where not (now() >= timestamptz '2026-11-01 06:00:00+00');
select bbtest.ok('0043, fin de la beta: cuenta nueva sin tarjeta tiene sus 7 días', public._has_app_access('acacacac-0000-4000-8000-0000000000ac')) where now() >= timestamptz '2026-11-01 06:00:00+00';
update public.profiles set created_at = now() - interval '7 days 1 minute' where id = 'acacacac-0000-4000-8000-0000000000ac';
select bbtest.ok('0043, fin de la beta: cuenta sin tarjeta después de sus 7 días no tiene la app', not public._has_app_access('acacacac-0000-4000-8000-0000000000ac')) where now() >= timestamptz '2026-11-01 06:00:00+00' and now() - interval '7 days 1 minute' >= timestamptz '2026-11-01 06:00:00+00';
select bbtest.ok('fin de la beta: cuenta nueva con tarjeta y cobro programado tiene la app', public._has_app_access(bbtest.u('A'))) where now() >= timestamptz '2026-11-01 06:00:00+00';
delete from auth.users where id = 'acacacac-0000-4000-8000-0000000000ac';

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
select bbtest.card_trial('0f0f0f0f-0000-4000-8000-00000000000f'); -- 0026: la prueba vigente de una cuenta nueva pide tarjeta
create function bbtest.as_user(id uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, false); end $$;
-- Estados de catálogo para probar la visibilidad (como servidor).
update public.challenges_catalog set status = 'oculto' where slug = 'movilidad-14';
update public.challenges_catalog set status = 'borrador' where slug = 'sin-azucar-7';
update public.challenges_catalog set status = 'archivado' where slug = 'pasos-14';
-- Desde 0024 los retos Premium de entreno son programas: para probar un reto de hábitos de pago se crea uno aquí.
insert into public.challenges_catalog (slug, title, days, rules, status, price_usd, verify, grace, xp, badge) values ('reto-pago-prueba', 'Reto de pago de prueba', 14, '{}'::jsonb, 'publicado', 2.99, 'manual', 1, 150, 'Prueba');
insert into public.challenge_plans (slug, days) select 'reto-pago-prueba', jsonb_agg(jsonb_build_object('t', 'Día ' || g, 'type', 'habito')) from generate_series(1, 14) g;
-- Una compra y un acceso de G (escritos por el servidor, como el webhook).
insert into public.challenge_purchases (user_id, challenge_slug, status, amount_minor, list_price_minor, provider_payment_intent_id) values ('0a0a0a0a-0000-4000-8000-00000000000a', 'gluteos-30', 'pagado', 699, 699, 'pi_test_g');
insert into public.challenge_entitlements (user_id, challenge_slug, source) values ('0a0a0a0a-0000-4000-8000-00000000000a', 'gluteos-30', 'compra');

set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
select bbtest.ok('tienda: el usuario ve los retos publicados', bbtest.num($q$ select 1 from public.challenges_catalog where status = 'publicado' and slug not like 'temporada-%' $q$) = 16);
select bbtest.ok('tienda: no ve ocultos, borradores ni archivados', bbtest.num($q$ select 1 from public.challenges_catalog where slug in ('movilidad-14','sin-azucar-7','pasos-14') $q$) = 0);
select bbtest.fails('tienda: el usuario no crea retos', $q$ insert into public.challenges_catalog (slug, title, days) values ('trampa-2', 'Trampa', 7) $q$, '42501');
select bbtest.zero('tienda: el usuario no cambia precios', $q$ update public.challenges_catalog set price_usd = 0 where slug = 'abdomen-21' $q$);
select bbtest.zero('tienda: el usuario no oculta retos', $q$ update public.challenges_catalog set status = 'oculto' where slug = 'banana-30' $q$);
select bbtest.zero('tienda: el usuario no borra retos', $q$ delete from public.challenges_catalog where slug = 'banana-30' $q$);
select bbtest.ok('plan: el usuario no lee la tabla de planes directo', bbtest.num($q$ select 1 from public.challenge_plans $q$) = 0);
select bbtest.ok('plan: reto gratis completo', (select (public.challenge_plan('flexiones-30')->>'locked')::boolean = false and jsonb_array_length(public.challenge_plan('flexiones-30')->'days') = 30));
select bbtest.ok('plan: reto de pago sin comprar = 3 días y bloqueado', (select (public.challenge_plan('sprint-verano-28')->>'locked')::boolean and jsonb_array_length(public.challenge_plan('sprint-verano-28')->'days') = 3));
select bbtest.ok('plan: nada de un reto oculto en el que no está', public.challenge_plan('movilidad-14') is null);
select bbtest.fails('compras: el usuario no se crea una compra', $q$ insert into public.challenge_purchases (user_id, challenge_slug, status, amount_minor, list_price_minor) values (auth.uid(), 'abdomen-21', 'pagado', 499, 499) $q$, '42501');
select bbtest.fails('compras: el usuario no se da acceso a un reto de pago', $q$ insert into public.challenge_entitlements (user_id, challenge_slug, source) values (auth.uid(), 'abdomen-21', 'compra') $q$, '42501');
select bbtest.ok('compras: no ve compras ni accesos de otros', bbtest.num($q$ select 1 from public.challenge_purchases $q$) = 0 and bbtest.num($q$ select 1 from public.challenge_entitlements $q$) = 0);
select bbtest.zero('compras: no marca pagada una compra ajena', $q$ update public.challenge_purchases set status = 'reembolsado' $q$);
select bbtest.fails('unirse: reto de pago sin comprarlo', $q$ insert into public.user_challenges (user_id, challenge_id) values (auth.uid(), 'reto-pago-prueba') $q$, '42501');
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
insert into public.challenge_entitlements (user_id, challenge_slug, source) values ('0f0f0f0f-0000-4000-8000-00000000000f', 'reto-pago-prueba', 'compra');
set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
select bbtest.ok('unirse: reto de pago comprado', bbtest.affected($q$ insert into public.user_challenges (user_id, challenge_id) values (auth.uid(), 'reto-pago-prueba') $q$) = 1);
select bbtest.ok('plan: reto comprado se ve completo', (select (public.challenge_plan('reto-pago-prueba')->>'locked')::boolean = false and jsonb_array_length(public.challenge_plan('reto-pago-prueba')->'days') = 14));
select bbtest.ok('acceso: ve su propio acceso', bbtest.num($q$ select 1 from public.challenge_entitlements where user_id = auth.uid() $q$) = 1);
reset role;
-- Un reto ya en curso que el admin oculta: quien está inscrito sigue viendo su definición y su plan
update public.challenges_catalog set status = 'oculto' where slug = 'reto-pago-prueba';
set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
select bbtest.ok('oculto: el inscrito conserva su reto (my_challenge_defs)', bbtest.num($q$ select 1 from public.my_challenge_defs() where slug = 'reto-pago-prueba' and jsonb_array_length(plan) = 14 $q$) = 1);
select bbtest.ok('oculto: ya no está en la tienda', bbtest.num($q$ select 1 from public.challenges_catalog where slug = 'reto-pago-prueba' $q$) = 0);
reset role;
update public.challenges_catalog set status = 'publicado' where slug = 'reto-pago-prueba';

-- Staff: admin (S) edita y regala; soporte (P) regala pero no edita el catálogo
set role authenticated; select bbtest.login('S');
select bbtest.ok('panel: admin ve también ocultos y borradores', bbtest.num($q$ select 1 from public.challenges_catalog where slug not like 'temporada-%' $q$) = 20);
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

-- ───────────── 5c. Programas (0024) ─────────────
-- F (prueba vigente) compra programas; A intenta tocar lo de F; S (admin) edita; E (prueba vencida) no empieza.
reset role;
select bbtest.login(null);
select bbtest.ok('programas: la siembra trae 9 programas con sesiones', (select count(*) = 9 from public.challenges_catalog where kind = 'programa' and slug not like 'temporada-%')
  and (select count(distinct slug) = 9 from public.program_sessions where slug not like 'temporada-%'));
select bbtest.ok('programas: los retos de hábitos siguen siendo retos', (select kind = 'reto' from public.challenges_catalog where slug = 'banana-30') and (select kind = 'reto' from public.challenges_catalog where slug = 'sprint-verano-28'));
select bbtest.ok('programas: el insignia cuesta $9.99 y dura 8 semanas', (select price_usd = 9.99 and public._program_weeks(program) = 8 from public.challenges_catalog where slug = 'reconstruccion-8-semanas'));
select bbtest.ok('programas: los convertidos conservan su precio', (select bool_and(price_usd = case slug when 'abdomen-21' then 4.99 when 'gluteos-30' then 6.99 when 'dominadas-desde-cero' then 7.99 else 9.99 end) from public.challenges_catalog where slug in ('abdomen-21','gluteos-30','dominadas-desde-cero','pierde-3kg-6-semanas')));
select bbtest.fails('programas: un programa necesita su meta', $q$ update public.challenges_catalog set program = null where slug = 'abdomen-21' $q$, '23514');

set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
select bbtest.ok('programas: F ve los programas publicados con su meta', bbtest.num($q$ select 1 from public.challenges_catalog where kind = 'programa' and program ? 'phases' and slug not like 'temporada-%' $q$) = 8);
select bbtest.ok('sesiones: sin comprar ve la semana 1 (fase 1)', bbtest.num($q$ select 1 from public.program_sessions where slug = 'reconstruccion-8-semanas' and phase = 1 $q$) = 4);
select bbtest.ok('sesiones: sin comprar no ve las demás fases', bbtest.num($q$ select 1 from public.program_sessions where slug = 'reconstruccion-8-semanas' and phase > 1 $q$) = 0);
select bbtest.zero('sesiones: F no edita sesiones', $q$ update public.program_sessions set title = 'x' where slug = 'reconstruccion-8-semanas' $q$);
select bbtest.zero('sesiones: F no borra sesiones', $q$ delete from public.program_sessions where slug = 'reconstruccion-8-semanas' $q$);
select bbtest.fails('sesiones: F no crea sesiones', $q$ insert into public.program_sessions (slug, phase, day, title) values ('reconstruccion-8-semanas', 8, 6, 'Trampa') $q$, '42501');
select bbtest.fails('estado: F no inserta su estado directo', $q$ insert into public.user_programs (user_id, slug, started_on) values (auth.uid(), 'reconstruccion-8-semanas', current_date) $q$, '42501');
select bbtest.fails('empezar: sin comprar el programa', $q$ select public.program_start('reconstruccion-8-semanas', current_date) $q$, '42501');
select bbtest.fails('empezar: un reto de hábitos no es programa', $q$ select public.program_start('banana-30', current_date) $q$, '22023');
select bbtest.fails('empezar: fecha que no es hoy en ninguna zona', $q$ select public.program_start('reconstruccion-8-semanas', current_date + 5) $q$, '22023');
select bbtest.fails('unirse: un programa no se une como reto', $q$ insert into public.user_challenges (user_id, challenge_id) values (auth.uid(), 'reconstruccion-8-semanas') $q$, 'P0001');
reset role;
-- El webhook (servidor) confirma dos compras de F.
insert into public.challenge_entitlements (user_id, challenge_slug, source) values
  ('0f0f0f0f-0000-4000-8000-00000000000f', 'reconstruccion-8-semanas', 'compra'), ('0f0f0f0f-0000-4000-8000-00000000000f', 'gluteos-30', 'compra'),
  ('0f0f0f0f-0000-4000-8000-00000000000f', 'abdomen-21', 'cortesia');
set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
select bbtest.ok('empezar: con la compra empieza', public.program_start('reconstruccion-8-semanas', current_date) = 'empezado');
select bbtest.ok('empezar: dos veces no duplica', public.program_start('reconstruccion-8-semanas', current_date) = 'activo');
select bbtest.ok('empezar: una sola fila', bbtest.num($q$ select 1 from public.user_programs where user_id = auth.uid() $q$) = 1);
select bbtest.ok('sesiones: con la compra ve todas las fases', bbtest.num($q$ select 1 from public.program_sessions where slug = 'reconstruccion-8-semanas' $q$) = 16);
select bbtest.fails('estado: F no se adelanta el inicio', $q$ update public.user_programs set started_on = current_date - 60 where user_id = auth.uid() $q$, '42501');
select bbtest.fails('un activo: empezar otro sin pausar falla', $q$ select public.program_start('gluteos-30', current_date) $q$, 'P0001');
select bbtest.ok('un activo: pausando el actual empieza el otro', public.program_start('gluteos-30', current_date, true) = 'empezado');
select bbtest.ok('un activo: el anterior quedó en pausa con su avance', (select status = 'pausado' and paused_on is not null from public.user_programs where user_id = auth.uid() and slug = 'reconstruccion-8-semanas'));
select bbtest.ok('un activo: solo uno activo', bbtest.num($q$ select 1 from public.user_programs where user_id = auth.uid() and status = 'activo' $q$) = 1);
select bbtest.ok('pausa: F pausa el activo', bbtest.affected($q$ select public.program_pause('gluteos-30', current_date) $q$) = 1);
select bbtest.ok('pausa: queda en pausa', (select status = 'pausado' from public.user_programs where user_id = auth.uid() and slug = 'gluteos-30'));
select bbtest.fails('pausa: no pausa lo que no está activo', $q$ select public.program_pause('gluteos-30', current_date) $q$, 'P0001');
select bbtest.ok('reanudar: vuelve a activo', public.program_start('reconstruccion-8-semanas', current_date) = 'reanudado');
select bbtest.ok('reanudar: sin perder el inicio', (select status = 'activo' and started_on = current_date and paused_on is null from public.user_programs where user_id = auth.uid() and slug = 'reconstruccion-8-semanas'));
select bbtest.fails('terminar: antes del final no hay certificado', $q$ select public.program_finish('reconstruccion-8-semanas', current_date) $q$, 'P0001');
select bbtest.ok('dejar: deja el programa en pausa', bbtest.affected($q$ select public.program_leave('gluteos-30') $q$) = 1);
select bbtest.ok('dejar: queda abandonado', (select status = 'abandonado' from public.user_programs where user_id = auth.uid() and slug = 'gluteos-30'));
select bbtest.ok('dejar: lo vuelve a empezar desde cero', public.program_start('gluteos-30', current_date, true) = 'reiniciado');
-- 0027: experiencias. Cada programa trae su modo; los nuevos se compran aparte; los hábitos manuales viven en daily_logs.
select bbtest.ok('0027: los 8 programas publicados traen su experiencia (abdomen-21 quedó oculto en 0028; Pilates llega en 0037)', bbtest.num($q$ select 1 from public.challenges_catalog where kind = 'programa' and program->'experience'->>'mode' is not null and slug not like 'temporada-%' $q$) = 8);
select bbtest.ok('0028: 21 días de abdomen no se ve en la tienda', bbtest.num($q$ select 1 from public.challenges_catalog where slug = 'abdomen-21' $q$) = 0);
select bbtest.ok('0028: Brazos de Gorila con su modo nuevo', bbtest.num($q$ select 1 from public.challenges_catalog where slug = 'brazos-definidos' and title = 'Brazos de Gorila' and cover = 'peel' and program->'experience'->>'mode' = 'Modo gorila' $q$) = 1);
select bbtest.ok('0027: Glúteos de acero rehecho con 4 sesiones por semana', bbtest.num($q$ select 1 from public.program_sessions where slug = 'gluteos-30' and phase = 2 $q$) = 4);
select bbtest.fails('0027: Banana Girl sin comprar no empieza', $q$ select public.program_start('banana-girl', current_date, true) $q$, '42501');
select bbtest.fails('0027: Abdomen marcado sin comprar no empieza', $q$ select public.program_start('abdomen-marcado', current_date, true) $q$, '42501');
select bbtest.fails('0027: Brazos definidos sin comprar no empieza', $q$ select public.program_start('brazos-definidos', current_date, true) $q$, '42501');
select bbtest.ok('0027: sin comprar ve solo la semana 1 de Banana Girl', bbtest.num($q$ select 1 from public.program_sessions where slug = 'banana-girl' and phase > 1 $q$) = 0 and bbtest.num($q$ select 1 from public.program_sessions where slug = 'banana-girl' and phase = 1 $q$) = 4);
select bbtest.ok('0027: F marca un hábito del programa', bbtest.affected($q$ insert into public.daily_logs (user_id, day, program_checks) values (auth.uid(), current_date, '{activacion}') on conflict (user_id, day) do update set program_checks = excluded.program_checks $q$) = 1);
select bbtest.fails('0027: hábitos con claves raras no entran', $q$ update public.daily_logs set program_checks = '{"<script>"}' where user_id = auth.uid() and day = current_date $q$, '23514');
select bbtest.fails('0027: máximo 8 hábitos marcados', $q$ update public.daily_logs set program_checks = '{a,b,c,d,e,f,g,h,i}' where user_id = auth.uid() and day = current_date $q$, '23514');
select bbtest.zero('0027: F no marca hábitos de otra cuenta', $q$ update public.daily_logs set program_checks = '{x}' where user_id <> auth.uid() $q$);
reset role;
insert into public.challenge_entitlements (user_id, challenge_slug, source) values ('0f0f0f0f-0000-4000-8000-00000000000f', 'banana-girl', 'compra');
set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
select bbtest.ok('0027: con la compra empieza Banana Girl', public.program_start('banana-girl', current_date, true) = 'empezado');
select bbtest.ok('0027: con la compra ve sus 3 fases', bbtest.num($q$ select 1 from public.program_sessions where slug = 'banana-girl' $q$) = 12);
select bbtest.ok('0027: Banana Girl queda como el único activo', (select slug = 'banana-girl' from public.user_programs where user_id = auth.uid() and status = 'activo'));
select bbtest.ok('0027: vuelve a Glúteos de acero pausando Banana Girl', public.program_start('gluteos-30', current_date, true) in ('reanudado', 'reiniciado', 'activo'));
select bbtest.ok('programas: my_program_defs trae los suyos', bbtest.num($q$ select 1 from public.my_program_defs() $q$) = 3);
reset role;
-- A no ve ni toca lo de F.
set role authenticated; select bbtest.login('A');
select bbtest.ok('aislamiento: A no ve el estado de F', bbtest.num($q$ select 1 from public.user_programs where user_id = '0f0f0f0f-0000-4000-8000-00000000000f' $q$) = 0);
select bbtest.fails('aislamiento: A no pausa el programa de F', $q$ select public.program_pause('gluteos-30', current_date) $q$, 'P0001');
select bbtest.zero('aislamiento: A no edita el estado de F', $q$ update public.user_programs set status = 'completado' where user_id = '0f0f0f0f-0000-4000-8000-00000000000f' $q$);
select bbtest.zero('aislamiento: A no borra el estado de F', $q$ delete from public.user_programs where user_id = '0f0f0f0f-0000-4000-8000-00000000000f' $q$);
select bbtest.fails('panel: A no ve las estadísticas de programas', $q$ select * from public.admin_program_stats() $q$, '42501');
reset role;
select bbtest.ok('aislamiento: el estado de F sigue intacto', (select count(*) = 1 from public.user_programs where user_id = '0f0f0f0f-0000-4000-8000-00000000000f' and slug = 'gluteos-30' and status = 'activo'));
-- Terminar por calendario: el servidor mueve el inicio 60 días atrás (más de 8 semanas).
update public.user_programs set status = 'pausado', paused_on = current_date where user_id = '0f0f0f0f-0000-4000-8000-00000000000f' and slug = 'gluteos-30';
update public.user_programs set status = 'activo', started_on = current_date - 60, paused_on = null, paused_days = 0 where user_id = '0f0f0f0f-0000-4000-8000-00000000000f' and slug = 'reconstruccion-8-semanas';
set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
select bbtest.ok('terminar: al final del calendario da el certificado', public.program_finish('reconstruccion-8-semanas', current_date));
select bbtest.ok('terminar: queda completado', (select status = 'completado' and completed_at is not null from public.user_programs where user_id = auth.uid() and slug = 'reconstruccion-8-semanas'));
select bbtest.ok('empezar: 21 días de abdomen (cortesía)', public.program_start('abdomen-21', current_date) = 'empezado');
reset role;
-- Terminar por sesiones: las 9 sesiones obligatorias del programa de abdomen (3 semanas x 3 días), guardadas hoy.
insert into public.workouts (user_id, day, template, started_at) select '0f0f0f0f-0000-4000-8000-00000000000f', current_date, 'p:abdomen-21:' || w || '.' || d, clock_timestamp() + (w * 10 + d) * interval '1 second' from generate_series(1, 3) w, generate_series(1, 2) d;
set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
select bbtest.fails('terminar: faltan sesiones (6 de 9)', $q$ select public.program_finish('abdomen-21', current_date) $q$, 'P0001');
reset role;
insert into public.workouts (user_id, day, template, started_at) select '0f0f0f0f-0000-4000-8000-00000000000f', current_date, 'p:abdomen-21:' || w || '.3', clock_timestamp() + w * interval '1 minute' from generate_series(1, 3) w;
set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
select bbtest.ok('terminar: con todas las sesiones da el certificado', public.program_finish('abdomen-21', current_date));
reset role;
-- Programa oculto después de empezarlo: quien lo tiene sigue viendo su definición y sus sesiones.
update public.challenges_catalog set status = 'oculto' where slug = 'gluteos-30';
set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
select bbtest.ok('oculto: el programa sigue en my_program_defs', bbtest.num($q$ select 1 from public.my_program_defs() where slug = 'gluteos-30' $q$) = 1);
select bbtest.ok('oculto: sus sesiones siguen visibles', bbtest.num($q$ select 1 from public.program_sessions where slug = 'gluteos-30' $q$) > 3);
reset role;
update public.challenges_catalog set status = 'publicado' where slug = 'gluteos-30';
-- Staff: admin edita sesiones y ve conteos; soporte no edita.
set role authenticated; select bbtest.login('S');
select bbtest.ok('panel: admin edita una sesión', bbtest.affected($q$ update public.program_sessions set focus = focus where slug = 'abdomen-21' and phase = 1 and day = 1 $q$) = 1);
select bbtest.ok('panel: admin ve conteos de programas', (select completed = 1 from public.admin_program_stats() where slug = 'reconstruccion-8-semanas'));
select bbtest.ok('panel: admin ve el estado (staff)', bbtest.num($q$ select 1 from public.user_programs $q$) >= 3);
reset role;
set role authenticated; select bbtest.login('P');
select bbtest.zero('panel: soporte no edita sesiones', $q$ update public.program_sessions set title = 'x' where slug = 'abdomen-21' $q$);
reset role;
-- Anónimo no llama nada; E (prueba vencida, sin plan) no empieza aunque tenga el programa.
set role anon; select bbtest.login(null);
select bbtest.fails('anon: no empieza programas', $q$ select public.program_start('abdomen-21', current_date) $q$, '42501');
select bbtest.zero('anon: no lee sesiones', $q$ select 1 from public.program_sessions $q$);
reset role;
insert into public.challenge_entitlements (user_id, challenge_slug, source) values (bbtest.u('E'), 'abdomen-21', 'cortesia');
set role authenticated; select bbtest.login('E');
select bbtest.fails('empezar: sin plan ni prueba no empieza', $q$ select public.program_start('abdomen-21', current_date) $q$, '42501') where now() >= timestamptz '2026-11-01 06:00:00+00';
select bbtest.ok('beta: E empieza durante la beta', public.program_start('abdomen-21', current_date) = 'empezado') where not (now() >= timestamptz '2026-11-01 06:00:00+00');
reset role;

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
select bbtest.card_trial('4d4d4d4d-0000-4000-8000-0000000000d4'); -- T: prueba de 7 días con tarjeta (0026)

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
-- Para probar las reglas normales HOY, esta sección da por terminada la beta y los 7 días más de las cuentas de la beta
-- (0045: el lanzamiento fue hace 8 días; solo en esta BD de pruebas) y la restaura al final. _beta_ends_at() es el único lugar donde vive la fecha.
reset role; select bbtest.login(null);
create or replace function public._beta_ends_at() returns timestamptz language sql stable set search_path = public as $$ select now() - interval '8 days' $$;
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
-- 0026: las cuentas nuevas (Q*, creadas después de la beta) tienen sus 7 días solo con tarjeta guardada y cobro programado.
select bbtest.card_trial(('9a000000-0000-4000-8000-0000000000' || k)::uuid) from unnest(array['a1','a2','a3','a4','a5','a6','a7','a8','a9']) k;

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

-- ───────────── 10. Tarjeta guardada y prueba de 7 días con cobro el día 7 (0026) ─────────────
-- Sigue con la beta terminada (sección 9). N* = cuentas nuevas después de la beta; O* = cuentas de la beta.
reset role; select bbtest.login(null);
insert into auth.users (id, email) values
  ('ab000000-0000-4000-8000-0000000000a1', 'n1@prueba.test'), ('ab000000-0000-4000-8000-0000000000a2', 'n2@prueba.test'),
  ('ab000000-0000-4000-8000-0000000000a3', 'n3@prueba.test'), ('ab000000-0000-4000-8000-0000000000a4', 'n4@prueba.test'),
  ('ab000000-0000-4000-8000-0000000000a5', 'n5@prueba.test'), ('ab000000-0000-4000-8000-0000000000a6', 'n6@prueba.test'),
  ('ab000000-0000-4000-8000-0000000000a7', 'n7@prueba.test'), ('ab000000-0000-4000-8000-0000000000b1', 'o1@prueba.test'),
  ('ab000000-0000-4000-8000-0000000000b2', 'o2@prueba.test');
-- O1 y O2 se registraron durante la beta (O2 tres días antes de que terminara: antes tenía 7 días propios).
update public.profiles set created_at = public._beta_ends_at() - interval '20 days' where id = 'ab000000-0000-4000-8000-0000000000b1';
update public.profiles set created_at = public._beta_ends_at() - interval '3 days' where id = 'ab000000-0000-4000-8000-0000000000b2';
-- N2: prueba con tarjeta. N3: cobro programado pero sin tarjeta (no debería pasar). N4: canceló antes del día 7.
-- N5: su día 7 ya pasó y el cobro sigue programado (cron atrasado). N6: falló el cobro del día 7. N7: reintento del día 8.
select bbtest.card_trial('ab000000-0000-4000-8000-0000000000a2');
insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_started_at, trial_ends_at, charge_at, next_attempt_at, status)
  values ('ab000000-0000-4000-8000-0000000000a3', 'trial:ab000000-0000-4000-8000-0000000000a3', 'prueba', 'completo', 'mes', 1499, now(), now() + interval '7 days', now() + interval '7 days', now() + interval '7 days', 'scheduled');
select bbtest.card_trial('ab000000-0000-4000-8000-0000000000a4', 'canceled');
update public.payment_methods set status = 'disconnected', disconnected_at = now() where user_id = 'ab000000-0000-4000-8000-0000000000a4';
select bbtest.card_trial('ab000000-0000-4000-8000-0000000000a5', 'scheduled', now() - interval '7 days 1 minute');
select bbtest.card_trial('ab000000-0000-4000-8000-0000000000a6', 'failed', now() - interval '8 days');
select bbtest.card_trial('ab000000-0000-4000-8000-0000000000a7', 'retry_scheduled', now() - interval '7 days 2 hours');
-- 0043: la prueba se cuenta desde el registro. N5, N6 y N7 se registraron cuando empezó su prueba.
update public.profiles set created_at = now() - interval '7 days 1 minute' where id = 'ab000000-0000-4000-8000-0000000000a5';
update public.profiles set created_at = now() - interval '8 days' where id = 'ab000000-0000-4000-8000-0000000000a6';
update public.profiles set created_at = now() - interval '7 days 2 hours' where id = 'ab000000-0000-4000-8000-0000000000a7';
-- N8: cuenta nueva sin tarjeta que ya pasó sus 7 días.
insert into auth.users (id, email) values ('ab000000-0000-4000-8000-0000000000a8', 'n8@prueba.test');
update public.profiles set created_at = now() - interval '7 days 1 minute' where id = 'ab000000-0000-4000-8000-0000000000a8';
-- O1: una fila "prueba" con tarjeta por un error del servidor: la base no le da días a una cuenta de la beta.
select bbtest.card_trial('ab000000-0000-4000-8000-0000000000b1');

-- 10a. Acceso (0043): la prueba de 7 días NO pide tarjeta, cuenta desde el registro y solo es para cuentas nuevas.
set role authenticated; select bbtest.as_user('ab000000-0000-4000-8000-0000000000a1');
select bbtest.ok('0043: N1 (nueva, sin tarjeta) tiene la app en su prueba', (select public.has_app_access()));
select bbtest.ok('0043: N1 tiene nutrición en su prueba', (select public.has_nutrition_access()));
select bbtest.ok('0043: N1 registra su peso sin tarjeta', bbtest.affected($q$ insert into public.weights (user_id, day, kg) values (auth.uid(), current_date, 80) $q$) = 1);
reset role;
set role authenticated; select bbtest.as_user('ab000000-0000-4000-8000-0000000000a8');
select bbtest.ok('0043: N8 (sin tarjeta, pasó sus 7 días) no tiene la app', not (select public.has_app_access()));
select bbtest.fails('0043: N8 no registra su peso', $q$ insert into public.weights (user_id, day, kg) values (auth.uid(), current_date, 80) $q$, '42501');
reset role;
select bbtest.ok('0043: un regalo para N1 empieza al terminar su prueba sin tarjeta', (select abs(extract(epoch from public._access_covered_until('ab000000-0000-4000-8000-0000000000a1', 'completo') - (p.created_at + interval '7 days'))) < 1 from public.profiles p where p.id = 'ab000000-0000-4000-8000-0000000000a1'));
set role authenticated; select bbtest.as_user('ab000000-0000-4000-8000-0000000000a2');
select bbtest.ok('tarjeta: N2 (tarjeta y cobro programado) tiene la app', (select public.has_app_access()));
select bbtest.ok('tarjeta: N2 tiene nutrición en la prueba aunque eligió Entreno', (select public.has_nutrition_access()));
select bbtest.ok('tarjeta: N2 registra su peso', bbtest.affected($q$ insert into public.weights (user_id, day, kg) values (auth.uid(), current_date, 80) $q$) = 1);
select bbtest.ok('tarjeta: N2 registra una comida', bbtest.affected($q$ insert into public.meals (user_id, day, name, kcal) values (auth.uid(), current_date, 'Gallo pinto', 350) $q$) = 1);
reset role;
set role authenticated; select bbtest.as_user('ab000000-0000-4000-8000-0000000000a3');
select bbtest.ok('0043: N3 (cobro programado sin tarjeta) igual tiene sus 7 días desde el registro', (select public.has_app_access()));
reset role;
set role authenticated; select bbtest.as_user('ab000000-0000-4000-8000-0000000000a4');
select bbtest.ok('tarjeta: N4 canceló antes del día 7 y sigue con acceso hasta el fin de la prueba', (select public.has_app_access()));
reset role;
set role authenticated; select bbtest.as_user('ab000000-0000-4000-8000-0000000000a5');
select bbtest.ok('tarjeta: N5 llegó al día 7 sin cobro confirmado: muro', not (select public.has_app_access()));
reset role;
set role authenticated; select bbtest.as_user('ab000000-0000-4000-8000-0000000000a6');
select bbtest.ok('tarjeta: N6 con el cobro fallido: muro', not (select public.has_app_access()));
reset role;
set role authenticated; select bbtest.as_user('ab000000-0000-4000-8000-0000000000a7');
select bbtest.ok('tarjeta: N7 esperando el reintento del día 8: muro', not (select public.has_app_access()));
reset role;
set role authenticated; select bbtest.as_user('ab000000-0000-4000-8000-0000000000b1');
select bbtest.ok('tarjeta: O1 (cuenta de la beta) no recibe una prueba nueva aunque tenga tarjeta', not (select public.has_app_access()));
reset role;
set role authenticated; select bbtest.as_user('ab000000-0000-4000-8000-0000000000b2');
select bbtest.ok('tarjeta: O2 (registrada 3 días antes del fin de la beta) no tiene días extra', not (select public.has_app_access()));
reset role;
select bbtest.ok('tarjeta: un regalo para N2 empieza al terminar su prueba', (select public._access_covered_until('ab000000-0000-4000-8000-0000000000a2', 'completo') = t.trial_ends_at from public.trial_charges t where t.user_id = 'ab000000-0000-4000-8000-0000000000a2'));
select bbtest.ok('tarjeta: un regalo para O2 empieza hoy', (select abs(extract(epoch from public._access_covered_until('ab000000-0000-4000-8000-0000000000b2', 'completo') - now())) < 5));
-- Con plan pagado (webhook) el cobro ya no importa: V paga Completo.
update public.profiles set plan = 'entreno' where id = 'ab000000-0000-4000-8000-0000000000b1';
select bbtest.ok('tarjeta: el plan pagado (webhook) da acceso sin depender de la prueba', public._has_app_access('ab000000-0000-4000-8000-0000000000b1'));
update public.profiles set plan = 'free' where id = 'ab000000-0000-4000-8000-0000000000b1';

-- 10b. RLS: cada persona lee solo su marca y últimos 4; nadie escribe por la API.
set role authenticated; select bbtest.as_user('ab000000-0000-4000-8000-0000000000a2');
select bbtest.ok('tarjeta: N2 lee su marca y últimos 4', (select brand = 'visa' and last4 = '4242' and status = 'active' from public.payment_methods where user_id = auth.uid()));
select bbtest.fails('tarjeta: N2 no lee el ID de ONVO de su tarjeta', $q$ select provider_payment_method_id from public.payment_methods $q$, '42501');
select bbtest.fails('tarjeta: N2 no lee el cliente de ONVO de su tarjeta', $q$ select provider_customer_id from public.payment_methods $q$, '42501');
select bbtest.ok('tarjeta: N2 no ve tarjetas ajenas', bbtest.num($q$ select 1 from public.payment_methods where user_id <> auth.uid() $q$) = 0);
select bbtest.fails('tarjeta: N2 no guarda una tarjeta por la API', $q$ insert into public.payment_methods (user_id, provider_customer_id, provider_payment_method_id) values (auth.uid(), 'cus_x', 'pm_x') $q$, '42501');
select bbtest.fails('tarjeta: N2 no cambia su tarjeta por la API', $q$ update public.payment_methods set last4 = '0000' where user_id = auth.uid() $q$, '42501');
select bbtest.fails('tarjeta: N2 no borra su tarjeta por la API', $q$ delete from public.payment_methods where user_id = auth.uid() $q$, '42501');
select bbtest.ok('cobro: N2 lee su cobro programado', (select status = 'scheduled' and plan = 'entreno' and amount_minor = 999 from public.trial_charges where user_id = auth.uid()));
select bbtest.ok('cobro: N2 no ve cobros ajenos', bbtest.num($q$ select 1 from public.trial_charges where user_id <> auth.uid() $q$) = 0);
select bbtest.fails('cobro: N2 no alarga su prueba', $q$ update public.trial_charges set trial_ends_at = trial_ends_at + interval '30 days', charge_at = charge_at + interval '30 days' where user_id = auth.uid() $q$, '42501');
select bbtest.fails('0043: N2 no se pone la promoción del primer mes', $q$ update public.trial_charges set promo = 'primer_mes_50', amount_minor = 1 where user_id = auth.uid() $q$, '42501');
select bbtest.fails('cobro: N2 no marca su cobro como pagado', $q$ update public.trial_charges set status = 'succeeded' where user_id = auth.uid() $q$, '42501');
select bbtest.fails('cobro: N2 no borra su cobro programado', $q$ delete from public.trial_charges where user_id = auth.uid() $q$, '42501');
reset role;
set role authenticated; select bbtest.as_user('ab000000-0000-4000-8000-0000000000a1');
select bbtest.fails('cobro: N1 no se crea una prueba por la API', $q$ insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_ends_at, charge_at, next_attempt_at) values (auth.uid(), 'trial:ab000000-0000-4000-8000-0000000000a1', 'prueba', 'completo', 'anual', 8999, now() + interval '7 days', now() + interval '7 days', now() + interval '7 days') $q$, '42501');
select bbtest.fails('tarjeta: N1 no llama la función interna', $q$ select public._trial_live(auth.uid()) $q$, '42501');
reset role;
set role anon; select bbtest.login(null);
select bbtest.fails('tarjeta: anon no lee tarjetas', $q$ select brand from public.payment_methods $q$, '42501');
select bbtest.fails('cobro: anon no lee cobros', $q$ select 1 from public.trial_charges $q$, '42501');
reset role;

-- 10c. Reglas de la tabla: una sola prueba por persona, 7 días exactos, clave de idempotencia única.
select bbtest.fails('cobro: una segunda prueba para la misma persona', $q$ insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_ends_at, charge_at, next_attempt_at) values ('ab000000-0000-4000-8000-0000000000a2', 'trial:ab000000-0000-4000-8000-0000000000a9', 'prueba', 'entreno', 'mes', 999, now() + interval '7 days', now() + interval '7 days', now() + interval '7 days') $q$, '23505');
select bbtest.fails('cobro: la misma clave de idempotencia dos veces', $q$ insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_ends_at, charge_at, next_attempt_at) values ('ab000000-0000-4000-8000-0000000000a1', 'trial:ab000000-0000-4000-8000-0000000000a2', 'prueba', 'entreno', 'mes', 999, now() + interval '7 days', now() + interval '7 days', now() + interval '7 days') $q$, '23505');
select bbtest.fails('cobro: una prueba de 8 días', $q$ insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_ends_at, charge_at, next_attempt_at) values ('ab000000-0000-4000-8000-0000000000a1', 'trial:ab000000-0000-4000-8000-0000000000a1', 'prueba', 'entreno', 'mes', 999, now() + interval '8 days', now() + interval '8 days', now() + interval '8 days') $q$, '23514');
select bbtest.fails('cobro: cobrar antes del fin de la prueba', $q$ insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_ends_at, charge_at, next_attempt_at) values ('ab000000-0000-4000-8000-0000000000a1', 'trial:ab000000-0000-4000-8000-0000000000a1', 'prueba', 'entreno', 'mes', 999, now() + interval '7 days', now() + interval '6 days', now() + interval '6 days') $q$, '23514');
select bbtest.fails('cobro: programado sin fecha de intento', $q$ insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_ends_at, charge_at) values ('ab000000-0000-4000-8000-0000000000a1', 'trial:ab000000-0000-4000-8000-0000000000a1', 'beta', 'entreno', 'mes', 999, now() + interval '1 day', now() + interval '1 day') $q$, '23514');
select bbtest.fails('0043: la promoción no aplica a un cobro inmediato', $q$ insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_ends_at, charge_at, next_attempt_at, promo) values ('ab000000-0000-4000-8000-0000000000a1', 'trial:ab000000-0000-4000-8000-0000000000a1', 'inmediato', 'entreno', 'mes', 499, now(), now(), now(), 'primer_mes_50') $q$, '23514');
select bbtest.fails('0043: una promoción inventada no entra', $q$ insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_started_at, trial_ends_at, charge_at, next_attempt_at, promo) values ('ab000000-0000-4000-8000-0000000000a1', 'trial:ab000000-0000-4000-8000-0000000000a1', 'prueba', 'entreno', 'mes', 100, now(), now() + interval '7 days', now() + interval '7 days', now() + interval '7 days', 'gratis_100') $q$, '23514');
select bbtest.ok('0043: el servidor guarda una promoción válida', bbtest.affected($q$ insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_started_at, trial_ends_at, charge_at, next_attempt_at, promo) values ('ab000000-0000-4000-8000-0000000000a8', 'trial:ab000000-0000-4000-8000-0000000000a8', 'beta', 'completo', 'mes', 749, now(), now() + interval '1 day', now() + interval '1 day', now() + interval '1 day', 'primer_mes_50') $q$) = 1);
delete from public.trial_charges where user_id = 'ab000000-0000-4000-8000-0000000000a8';
select bbtest.fails('cobro: monto en otra moneda', $q$ insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, currency, trial_ends_at, charge_at, next_attempt_at) values ('ab000000-0000-4000-8000-0000000000a1', 'trial:ab000000-0000-4000-8000-0000000000a1', 'inmediato', 'entreno', 'mes', 999, 'CRC', now(), now(), now()) $q$, '23514');
select bbtest.fails('tarjeta: últimos 4 con letras', $q$ insert into public.payment_methods (user_id, provider_customer_id, provider_payment_method_id, last4) values ('ab000000-0000-4000-8000-0000000000a1', 'cus_n1', 'pm_n1', '42a2') $q$, '23514');
select bbtest.fails('tarjeta: la misma tarjeta de ONVO en dos cuentas', $q$ insert into public.payment_methods (user_id, provider_customer_id, provider_payment_method_id) values ('ab000000-0000-4000-8000-0000000000a1', 'cus_n1', 'pm_ab000000-0000-4000-8000-0000000000a2') $q$, '23505');
-- Borrar la cuenta borra su tarjeta guardada y su cobro programado (no queda nada por cobrar).
delete from auth.users where id = 'ab000000-0000-4000-8000-0000000000a6';
select bbtest.ok('borrado: sin tarjeta ni cobro programado de la cuenta borrada', not exists (select 1 from public.payment_methods where user_id = 'ab000000-0000-4000-8000-0000000000a6') and not exists (select 1 from public.trial_charges where user_id = 'ab000000-0000-4000-8000-0000000000a6'));

-- ───────────── 11. Testers de la beta (0029) ─────────────
-- Sigue con la beta terminada (sección 9). T1: cuenta de la beta sin tarjeta ni plan (sin acceso hoy). T2: otra igual.
reset role; select bbtest.login(null);
insert into auth.users (id, email) values ('7e570000-0000-4000-8000-0000000000a1', 't1@prueba.test'), ('7e570000-0000-4000-8000-0000000000a2', 't2@prueba.test');
update public.profiles set created_at = public._beta_ends_at() - interval '40 days', onboarded = true, full_name = 'Tina Tester', username = 'tina', visibility = 'publico'
 where id = '7e570000-0000-4000-8000-0000000000a1';
update public.profiles set created_at = public._beta_ends_at() - interval '40 days', onboarded = true, full_name = 'Toño', username = 'tono', visibility = 'privado'
 where id = '7e570000-0000-4000-8000-0000000000a2';
select bbtest.ok('tester: T1 sin plan después de la beta no tiene la app', not public._has_app_access('7e570000-0000-4000-8000-0000000000a1'));

-- 11a. Nadie fuera de admin y superadmin asigna o quita testers; nadie se edita su estado.
set role authenticated; select bbtest.login('A');
select bbtest.fails('tester: un usuario no se hace tester', $q$ select public.admin_set_tester(auth.uid(), 'quiero probar') $q$, '42501');
select bbtest.fails('tester: un usuario no hace tester a otro', $q$ select public.admin_set_tester('7e570000-0000-4000-8000-0000000000a1', 'quiero probar') $q$, '42501');
select bbtest.fails('tester: un usuario no quita testers', $q$ select public.admin_revoke_tester('7e570000-0000-4000-8000-0000000000a1', 'porque sí') $q$, '42501');
select bbtest.fails('tester: un usuario no usa la función interna', $q$ select public._tester_until(auth.uid()) $q$, '42501');
select bbtest.fails('tester: un usuario no se inserta una asignación', $q$ insert into public.tester_grants (user_id, expires_at) values (auth.uid(), now() + interval '30 days') $q$, '42501');
select bbtest.fails('tester: un usuario no se crea acceso de tester', $q$ insert into public.comp_grants (user_id, plan, expires_at, source) values (auth.uid(), 'completo', now() + interval '30 days', 'tester') $q$, '42501');
reset role;
set role authenticated; select bbtest.login('P');
select bbtest.fails('tester: soporte no asigna testers (solo admin)', $q$ select public.admin_set_tester('7e570000-0000-4000-8000-0000000000a1', 'probó la app') $q$, '42501');
select bbtest.fails('tester: soporte no quita testers', $q$ select public.admin_revoke_tester('7e570000-0000-4000-8000-0000000000a1', 'probó la app') $q$, '42501');
reset role;
set role anon; select bbtest.login(null);
select bbtest.fails('tester: anon no asigna testers', $q$ select public.admin_set_tester('7e570000-0000-4000-8000-0000000000a1', 'probó la app') $q$, '42501');
select bbtest.fails('tester: anon no lee asignaciones', $q$ select 1 from public.tester_grants $q$, '42501');
select bbtest.fails('tester: anon no consulta insignias', $q$ select public.community_testers(array['7e570000-0000-4000-8000-0000000000a1'::uuid]) $q$, '42501');
reset role;

-- 11b. Admin asigna: 30 días de Entreno + Nutrición, sin tocar rol ni plan, con aviso y auditoría.
set role authenticated; select bbtest.login('S');
select bbtest.fails('tester: pide motivo', $q$ select public.admin_set_tester('7e570000-0000-4000-8000-0000000000a1', '') $q$, 'P0001');
select bbtest.fails('tester: admin no se hace tester a sí mismo', $q$ select public.admin_set_tester(auth.uid(), 'para probar') $q$, 'P0001');
select bbtest.fails('tester: usuario inexistente', $q$ select public.admin_set_tester('00000000-0000-4000-8000-000000000000', 'para probar') $q$, 'P0001');
select bbtest.ok('tester: admin hace tester a T1', (select public.admin_set_tester('7e570000-0000-4000-8000-0000000000a1', 'probó la beta desde septiembre')) > 0);
select bbtest.ok('tester: el panel lo ve en el filtro de testers', bbtest.num($q$ select 1 from public.admin_list_users(null, null, null, 'tester') where id = '7e570000-0000-4000-8000-0000000000a1' and tester_until > now() + interval '29 days' $q$) = 1);
select bbtest.ok('tester: el mes de tester no cuenta como cortesía en el panel', bbtest.num($q$ select 1 from public.admin_list_users(null, null, null, 'cortesia') where id = '7e570000-0000-4000-8000-0000000000a1' $q$) = 0);
reset role;
select bbtest.ok('tester: dura 30 días desde ahora', (select abs(extract(epoch from starts_at - now())) < 60 and expires_at = starts_at + interval '30 days' and revoked_at is null and not renewal
  from public.tester_grants where user_id = '7e570000-0000-4000-8000-0000000000a1'));
select bbtest.ok('tester: el acceso sale de comp_grants (completo, origen tester)', (select count(*) = 1 from public.comp_grants g join public.tester_grants t on t.comp_grant_id = g.id
  where g.user_id = '7e570000-0000-4000-8000-0000000000a1' and g.source = 'tester' and g.plan = 'completo' and g.revoked_at is null and g.expires_at = t.expires_at));
select bbtest.ok('tester: no cambia el rol ni el plan del perfil', (select role::text = 'free' and plan = 'free' from public.profiles where id = '7e570000-0000-4000-8000-0000000000a1'));
select bbtest.ok('tester: aviso en la campanita', (select count(*) = 1 from public.notifications where user_id = '7e570000-0000-4000-8000-0000000000a1' and kind = 'tester' and title = 'Eres tester de Banana Burn'));
select bbtest.ok('tester: queda en auditoría con el admin y el motivo', (select count(*) = 1 from public.audit_log where action = 'user.tester_grant' and actor = bbtest.u('S') and target = '7e570000-0000-4000-8000-0000000000a1' and meta->>'reason' = 'probó la beta desde septiembre'));
select bbtest.ok('tester: un regalo nuevo para T1 empieza al terminar su mes de tester', (select public._access_covered_until('7e570000-0000-4000-8000-0000000000a1', 'completo') = t.expires_at
  from public.tester_grants t where t.user_id = '7e570000-0000-4000-8000-0000000000a1'));

-- 11c. T1 con su mes de tester (beta terminada): app y nutrición, ve lo suyo y no puede alargarlo.
set role authenticated; select bbtest.as_user('7e570000-0000-4000-8000-0000000000a1');
select bbtest.ok('tester: T1 tiene la app después de la beta', (select public.has_app_access()));
select bbtest.ok('tester: T1 tiene nutrición', (select public.has_nutrition_access()));
select bbtest.ok('tester: T1 es tester', (select public.is_tester()));
select bbtest.ok('tester: T1 registra su peso', bbtest.affected($q$ insert into public.weights (user_id, day, kg) values (auth.uid(), current_date, 70) $q$) = 1);
select bbtest.ok('tester: T1 registra comidas', bbtest.affected($q$ insert into public.meals (user_id, day, name, kcal) values (auth.uid(), current_date, 'Avena', 300) $q$) = 1);
select bbtest.ok('tester: T1 ve su asignación', bbtest.num($q$ select 1 from public.tester_grants where user_id = auth.uid() $q$) = 1);
select bbtest.zero('tester: T1 no alarga su mes', $q$ update public.tester_grants set expires_at = expires_at + interval '1 day' where user_id = auth.uid() $q$);
select bbtest.zero('tester: T1 no borra su asignación', $q$ delete from public.tester_grants where user_id = auth.uid() $q$);
select bbtest.zero('tester: T1 no alarga su acceso', $q$ update public.comp_grants set expires_at = now() + interval '10 years' where user_id = auth.uid() $q$);
select bbtest.ok('tester: T1 marca vista la bienvenida', (select public.tester_mark_seen()) = 1);
select bbtest.ok('tester: marcar de nuevo no cambia nada', (select public.tester_mark_seen()) = 0);
reset role;
set role authenticated; select bbtest.as_user('7e570000-0000-4000-8000-0000000000a2');
select bbtest.ok('tester: T2 no ve la asignación de T1', bbtest.num($q$ select 1 from public.tester_grants $q$) = 0);
select bbtest.ok('tester: T2 no es tester', not (select public.is_tester()));
select bbtest.ok('tester: T2 sin plan no tiene la app', not (select public.has_app_access()));
reset role;
set role authenticated; select bbtest.login('A');
select bbtest.ok('tester: la comunidad ve la insignia de T1 (perfil público)', bbtest.num($q$ select * from public.community_testers(array['7e570000-0000-4000-8000-0000000000a1', 'a1a1a1a1-0000-4000-8000-0000000000a1']::uuid[]) $q$) = 1);
reset role;
set role authenticated; select bbtest.login('P');
select bbtest.ok('tester: soporte ve el estado de tester en la ficha', bbtest.num($q$ select 1 from public.tester_grants where user_id = '7e570000-0000-4000-8000-0000000000a1' $q$) = 1);
reset role;

-- 11d. Renovar: 30 días desde ahora, una sola asignación y un solo acceso vigente.
reset role;
update public.tester_grants set starts_at = now() - interval '20 days', expires_at = now() + interval '10 days' where user_id = '7e570000-0000-4000-8000-0000000000a1';
update public.comp_grants set starts_at = now() - interval '20 days', expires_at = now() + interval '10 days' where user_id = '7e570000-0000-4000-8000-0000000000a1' and source = 'tester';
set role authenticated; select bbtest.login('S');
select bbtest.ok('tester: admin renueva a T1', (select public.admin_set_tester('7e570000-0000-4000-8000-0000000000a1', 'sigue reportando errores')) > 0);
reset role;
select bbtest.ok('tester: la renovación vence en 30 días desde ahora', (select count(*) = 1 and bool_and(renewal) and bool_and(abs(extract(epoch from expires_at - (now() + interval '30 days'))) < 60)
  from public.tester_grants where user_id = '7e570000-0000-4000-8000-0000000000a1' and revoked_at is null));
select bbtest.ok('tester: la asignación anterior queda cerrada como renovada', (select count(*) = 1 from public.tester_grants where user_id = '7e570000-0000-4000-8000-0000000000a1' and end_kind = 'renovado' and revoked_by = bbtest.u('S')));
select bbtest.ok('tester: un solo acceso de tester vigente', (select count(*) = 1 from public.comp_grants where user_id = '7e570000-0000-4000-8000-0000000000a1' and source = 'tester' and revoked_at is null));
select bbtest.ok('tester: aviso de renovación', (select count(*) = 1 from public.notifications where user_id = '7e570000-0000-4000-8000-0000000000a1' and kind = 'tester' and title = 'Renovamos tu mes de tester'));

-- 11e. Al vencer, vuelve a las reglas normales (sin proceso nocturno: solo la fecha).
update public.tester_grants set starts_at = now() - interval '31 days', expires_at = now() - interval '1 minute' where user_id = '7e570000-0000-4000-8000-0000000000a1' and revoked_at is null;
update public.comp_grants set starts_at = now() - interval '31 days', expires_at = now() - interval '1 minute' where user_id = '7e570000-0000-4000-8000-0000000000a1' and source = 'tester' and revoked_at is null;
select bbtest.ok('tester: vencido, T1 ya no tiene la app', not public._has_app_access('7e570000-0000-4000-8000-0000000000a1'));
select bbtest.ok('tester: vencido, T1 ya no tiene nutrición', not public._has_nutrition_access('7e570000-0000-4000-8000-0000000000a1'));
set role authenticated; select bbtest.as_user('7e570000-0000-4000-8000-0000000000a1');
select bbtest.ok('tester: vencido, T1 ya no es tester', not (select public.is_tester()));
select bbtest.fails('tester: vencido, T1 no registra entrenos', $q$ insert into public.weights (user_id, day, kg) values (auth.uid(), current_date - 1, 70) $q$, '42501');
reset role;
set role authenticated; select bbtest.login('A');
select bbtest.ok('tester: vencido, sin insignia en la comunidad', bbtest.num($q$ select * from public.community_testers(array['7e570000-0000-4000-8000-0000000000a1']::uuid[]) $q$) = 0);
reset role;
select bbtest.ok('tester: vencido, el panel no lo cuenta como tester', not exists (select 1 from public.tester_grants where user_id = '7e570000-0000-4000-8000-0000000000a1' and revoked_at is null and expires_at > now()));

-- 11f. Quitar antes de tiempo: cierra la asignación y el acceso, con auditoría.
set role authenticated; select bbtest.login('S');
select bbtest.ok('tester: admin vuelve a hacer tester a T1 (después de vencer)', (select public.admin_set_tester('7e570000-0000-4000-8000-0000000000a1', 'vuelve a probar')) > 0);
select bbtest.ok('tester: después de vencer no cuenta como renovación', (select not renewal from public.tester_grants where user_id = '7e570000-0000-4000-8000-0000000000a1' and revoked_at is null and expires_at > now()));
select bbtest.fails('tester: quitar pide motivo', $q$ select public.admin_revoke_tester('7e570000-0000-4000-8000-0000000000a1', 'no') $q$, 'P0001');
select bbtest.ok('tester: admin quita a T1', (select public.admin_revoke_tester('7e570000-0000-4000-8000-0000000000a1', 'dejó de probar la app')) = 1);
select bbtest.ok('tester: quitar de nuevo no cierra nada', (select public.admin_revoke_tester('7e570000-0000-4000-8000-0000000000a1', 'dejó de probar la app')) = 0);
reset role;
select bbtest.ok('tester: quitado, sin acceso', not public._has_app_access('7e570000-0000-4000-8000-0000000000a1'));
select bbtest.ok('tester: quitado, el acceso quedó revocado', not exists (select 1 from public.comp_grants where user_id = '7e570000-0000-4000-8000-0000000000a1' and source = 'tester' and revoked_at is null and expires_at > now()));
select bbtest.ok('tester: quitado, queda en auditoría', (select count(*) = 1 from public.audit_log where action = 'user.tester_revoke' and target = '7e570000-0000-4000-8000-0000000000a1'));

-- 11g. "Reportar algo": la base marca si viene de un tester; nadie lo falsea; el staff cambia el estado.
set role authenticated; select bbtest.login('S');
select public.admin_set_tester('7e570000-0000-4000-8000-0000000000a1', 'reportes de prueba');
reset role;
set role authenticated; select bbtest.as_user('7e570000-0000-4000-8000-0000000000a1');
select bbtest.ok('reporte: T1 envía un error', (select public.submit_feedback('error', 'El botón de guardar peso no responde', '/app')) > 0);
select bbtest.ok('reporte: queda marcado como de tester', (select from_tester and status = 'nuevo' and page = '/app' from public.feedback_reports where user_id = auth.uid()));
reset role;
set role authenticated; select bbtest.as_user('7e570000-0000-4000-8000-0000000000a2');
select bbtest.ok('reporte: T2 envía una idea', (select public.submit_feedback('idea', 'Me gustaría un modo oscuro', 'javascript:alert(1)')) > 0);
select bbtest.ok('reporte: T2 no es tester y la ruta rara no se guarda', (select not from_tester and page is null from public.feedback_reports where user_id = auth.uid()));
select bbtest.fails('reporte: T2 no se marca como tester', $q$ insert into public.feedback_reports (user_id, kind, body, from_tester) values (auth.uid(), 'otro', 'soy tester', true) $q$, '42501');
select bbtest.zero('reporte: T2 no cambia el estado de su reporte', $q$ update public.feedback_reports set status = 'resuelto' where user_id = auth.uid() $q$);
select bbtest.ok('reporte: T2 no ve reportes ajenos', bbtest.num($q$ select 1 from public.feedback_reports where user_id <> auth.uid() $q$) = 0);
select bbtest.fails('reporte: tipo inválido', $q$ select public.submit_feedback('queja', 'algo', null) $q$, '22023');
select bbtest.fails('reporte: texto vacío', $q$ select public.submit_feedback('otro', '  ', null) $q$, 'P0001');
select bbtest.ok('reporte: máximo 10 por día', bbtest.passes($q$ select public.submit_feedback('otro', 'otra cosa más', null) $q$, 12) = 9);
reset role;
set role authenticated; select bbtest.login('P');
select bbtest.ok('reporte: soporte ve los reportes', bbtest.num($q$ select 1 from public.feedback_reports where user_id in ('7e570000-0000-4000-8000-0000000000a1', '7e570000-0000-4000-8000-0000000000a2') $q$) = 11);
select bbtest.ok('reporte: soporte marca resuelto', bbtest.affected($q$ update public.feedback_reports set status = 'resuelto' where user_id = '7e570000-0000-4000-8000-0000000000a1' $q$) = 1);
select bbtest.fails('reporte: soporte no cambia el texto', $q$ update public.feedback_reports set body = 'otro texto' where user_id = '7e570000-0000-4000-8000-0000000000a1' $q$, '42501');
reset role;
set role anon; select bbtest.login(null);
select bbtest.fails('reporte: anon no envía reportes', $q$ select public.submit_feedback('otro', 'hola hola', null) $q$, '42501');
reset role;
-- 11h. Un tester no paga durante su mes de tester: el primer cobro con tarjeta espera al final y vuelve si se lo quitan.
-- T3: cuenta de la beta con tarjeta guardada (cobro "beta" al fin de la beta, que ya pasó: tocaba cobrar).
-- T4: cuenta nueva con prueba de 7 días. T5: cobro rechazado con reintento mañana.
reset role; select bbtest.login(null);
insert into auth.users (id, email) values ('7e570000-0000-4000-8000-0000000000a3', 't3@prueba.test'), ('7e570000-0000-4000-8000-0000000000a4', 't4@prueba.test'), ('7e570000-0000-4000-8000-0000000000a5', 't5@prueba.test');
update public.profiles set created_at = public._beta_ends_at() - interval '30 days', onboarded = true where id in ('7e570000-0000-4000-8000-0000000000a3', '7e570000-0000-4000-8000-0000000000a5');
update public.profiles set onboarded = true where id = '7e570000-0000-4000-8000-0000000000a4';
insert into public.payment_methods (user_id, provider_customer_id, provider_payment_method_id) values
  ('7e570000-0000-4000-8000-0000000000a3', 'cus_t3', 'pm_t3'), ('7e570000-0000-4000-8000-0000000000a5', 'cus_t5', 'pm_t5');
insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_started_at, trial_ends_at, charge_at, next_attempt_at, status)
  values ('7e570000-0000-4000-8000-0000000000a3', 'trial:7e570000-0000-4000-8000-0000000000a3', 'beta', 'completo', 'mes', 1499, public._beta_ends_at() - interval '10 days', public._beta_ends_at(), public._beta_ends_at(), public._beta_ends_at(), 'scheduled');
select bbtest.card_trial('7e570000-0000-4000-8000-0000000000a4');
insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_started_at, trial_ends_at, charge_at, next_attempt_at, status, attempts)
  values ('7e570000-0000-4000-8000-0000000000a5', 'trial:7e570000-0000-4000-8000-0000000000a5', 'beta', 'entreno', 'mes', 999, public._beta_ends_at() - interval '10 days', public._beta_ends_at(), public._beta_ends_at(), now() + interval '1 day', 'retry_scheduled', 1);
select bbtest.ok('cobro tester: a T3 le tocaba cobrar hoy', (select next_attempt_at <= now() from public.trial_charges where user_id = '7e570000-0000-4000-8000-0000000000a3'));

set role authenticated; select bbtest.login('S');
select bbtest.ok('cobro tester: admin hace tester a T3, T4 y T5', (select public.admin_set_tester('7e570000-0000-4000-8000-0000000000a3', 'prueba cobros') > 0 and public.admin_set_tester('7e570000-0000-4000-8000-0000000000a4', 'prueba cobros') > 0 and public.admin_set_tester('7e570000-0000-4000-8000-0000000000a5', 'prueba cobros') > 0));
reset role; select bbtest.login(null);
select bbtest.ok('cobro tester: el cobro de T3 pasa al final de su mes de tester (y el intento también)', (select c.charge_at = t.expires_at and c.next_attempt_at = t.expires_at and c.moved_from = c.trial_ends_at and c.tester_hold and c.reminder_sent_at is null and c.status = 'scheduled'
  from public.trial_charges c join public.tester_grants t on t.user_id = c.user_id and t.revoked_at is null where c.user_id = '7e570000-0000-4000-8000-0000000000a3'));
select bbtest.ok('cobro tester: a T3 ya no le toca cobrar hoy', (select next_attempt_at > now() + interval '29 days' from public.trial_charges where user_id = '7e570000-0000-4000-8000-0000000000a3'));
select bbtest.ok('cobro tester: el aviso de 2 días antes queda para la fecha nueva', (select not (now() >= charge_at - interval '2 days') and reminder_sent_at is null from public.trial_charges where user_id = '7e570000-0000-4000-8000-0000000000a3'));
select bbtest.ok('cobro tester: aviso en la campanita de que el cobro se movió', (select count(*) = 1 from public.notifications where user_id = '7e570000-0000-4000-8000-0000000000a3' and kind = 'cobro' and title = 'Tu cobro pasa al final de tu mes de tester'));
select bbtest.ok('cobro tester: la prueba de 7 días de T4 no se alarga, solo el cobro', (select trial_ends_at = trial_started_at + interval '7 days' and charge_at > now() + interval '29 days' and moved_from = trial_ends_at and tester_hold from public.trial_charges where user_id = '7e570000-0000-4000-8000-0000000000a4'));
select bbtest.ok('cobro tester: el reintento de T5 espera al final del mes de tester', (select next_attempt_at > now() + interval '29 days' and tester_hold and status = 'retry_scheduled' from public.trial_charges where user_id = '7e570000-0000-4000-8000-0000000000a5'));
select bbtest.ok('cobro tester: el servidor revisa antes de cobrar', (select public.tester_hold_charge('7e570000-0000-4000-8000-0000000000a3')) is not null);
select bbtest.ok('cobro tester: revisar de nuevo no mueve ni avisa otra vez', (select count(*) = 1 from public.notifications where user_id = '7e570000-0000-4000-8000-0000000000a3' and kind = 'cobro'));
select bbtest.ok('cobro tester: a una persona que no es tester no le mueve nada', (select public.tester_hold_charge('ab000000-0000-4000-8000-0000000000a2')) is null);
select bbtest.fails('cobro tester: un cobro movido necesita su fecha original', $q$ update public.trial_charges set moved_from = null where user_id = '7e570000-0000-4000-8000-0000000000a3' $q$, '23514');
set role authenticated; select bbtest.as_user('7e570000-0000-4000-8000-0000000000a3');
select bbtest.fails('cobro tester: una persona no llama la revisión del servidor', $q$ select public.tester_hold_charge(auth.uid()) $q$, '42501');
select bbtest.fails('cobro tester: una persona no usa la función interna', $q$ select public._tester_release_charge(auth.uid()) $q$, '42501');
select bbtest.ok('cobro tester: T3 ve su cobro aplazado', (select tester_hold and charge_at > now() + interval '29 days' from public.trial_charges where user_id = auth.uid()));
reset role;

-- Renovar: el cobro se vuelve a mover al nuevo final.
reset role; select bbtest.login(null);
update public.tester_grants set starts_at = now() - interval '20 days', expires_at = now() + interval '10 days' where user_id = '7e570000-0000-4000-8000-0000000000a3' and revoked_at is null;
update public.comp_grants set starts_at = now() - interval '20 days', expires_at = now() + interval '10 days' where user_id = '7e570000-0000-4000-8000-0000000000a3' and source = 'tester' and revoked_at is null;
update public.trial_charges set charge_at = now() + interval '10 days', next_attempt_at = now() + interval '10 days', reminder_sent_at = now() where user_id = '7e570000-0000-4000-8000-0000000000a3';
set role authenticated; select bbtest.login('S');
select public.admin_set_tester('7e570000-0000-4000-8000-0000000000a3', 'renueva');
reset role; select bbtest.login(null);
select bbtest.ok('cobro tester: renovar mueve el cobro al nuevo final y rearma el aviso', (select abs(extract(epoch from c.charge_at - t.expires_at)) < 1 and c.next_attempt_at = c.charge_at and c.reminder_sent_at is null and c.moved_from = c.trial_ends_at
  from public.trial_charges c join public.tester_grants t on t.user_id = c.user_id and t.revoked_at is null and t.expires_at > now() where c.user_id = '7e570000-0000-4000-8000-0000000000a3'));

-- Quitar antes de tiempo: vuelve a max(ahora, fecha original), nunca a menos de 2 días; sin cobrar dos veces.
set role authenticated; select bbtest.login('S');
select bbtest.ok('cobro tester: admin quita a T3, T4 y T5', (select public.admin_revoke_tester('7e570000-0000-4000-8000-0000000000a3', 'fin de pruebas') + public.admin_revoke_tester('7e570000-0000-4000-8000-0000000000a4', 'fin de pruebas') + public.admin_revoke_tester('7e570000-0000-4000-8000-0000000000a5', 'fin de pruebas')) = 3);
reset role; select bbtest.login(null);
select bbtest.ok('cobro tester: la fecha original de T3 ya pasó: se cobra en 2 días, con aviso', (select abs(extract(epoch from charge_at - (now() + interval '2 days'))) < 60 and next_attempt_at = charge_at and not tester_hold and reminder_sent_at is null and status = 'scheduled'
  and now() >= charge_at - interval '2 days' and moved_from is not null from public.trial_charges where user_id = '7e570000-0000-4000-8000-0000000000a3'));
select bbtest.ok('cobro tester: aviso honesto en la campanita al volver a programar', (select count(*) = 1 from public.notifications where user_id = '7e570000-0000-4000-8000-0000000000a3' and kind = 'cobro' and title = 'Tu cobro vuelve a estar programado'));
select bbtest.ok('cobro tester: T4 vuelve a su día 7 original', (select charge_at = trial_ends_at and next_attempt_at = charge_at and moved_from is null and not tester_hold from public.trial_charges where user_id = '7e570000-0000-4000-8000-0000000000a4'));
select bbtest.ok('cobro tester: el reintento de T5 queda para ahora (sin intento extra)', (select next_attempt_at <= now() and not tester_hold and attempts = 1 and status = 'retry_scheduled' from public.trial_charges where user_id = '7e570000-0000-4000-8000-0000000000a5'));
select bbtest.ok('cobro tester: liberar de nuevo no mueve nada', (select public._tester_release_charge('7e570000-0000-4000-8000-0000000000a4')) = 0);
select bbtest.ok('cobro tester: T4 sigue en su día 7', (select charge_at = trial_ends_at from public.trial_charges where user_id = '7e570000-0000-4000-8000-0000000000a4'));

-- Al terminar solo: el cobro sigue en el final del mes de tester (ese día se cobra) y la marca de aplazado se limpia.
set role authenticated; select bbtest.login('S');
select public.admin_set_tester('7e570000-0000-4000-8000-0000000000a4', 'otra vez');
reset role; select bbtest.login(null);
update public.tester_grants set starts_at = now() - interval '30 days', expires_at = now() - interval '1 minute' where user_id = '7e570000-0000-4000-8000-0000000000a4' and revoked_at is null;
update public.comp_grants set starts_at = now() - interval '30 days', expires_at = now() - interval '1 minute' where user_id = '7e570000-0000-4000-8000-0000000000a4' and source = 'tester' and revoked_at is null;
update public.trial_charges set charge_at = now() - interval '1 minute', next_attempt_at = now() - interval '1 minute', trial_started_at = now() - interval '31 days', trial_ends_at = now() - interval '24 days' where user_id = '7e570000-0000-4000-8000-0000000000a4';
select bbtest.ok('cobro tester: terminado el mes, el servidor ya no aplaza', (select public.tester_hold_charge('7e570000-0000-4000-8000-0000000000a4')) is null);
select bbtest.ok('cobro tester: terminado el mes, el cobro toca y ya no dice aplazado', (select next_attempt_at <= now() and not tester_hold from public.trial_charges where user_id = '7e570000-0000-4000-8000-0000000000a4'));

-- Borrar la cuenta borra su estado de tester y sus reportes.
delete from auth.users where id = '7e570000-0000-4000-8000-0000000000a2';
select bbtest.ok('borrado: sin reportes de la cuenta borrada', not exists (select 1 from public.feedback_reports where user_id = '7e570000-0000-4000-8000-0000000000a2'));

-- Restaurar la beta original (misma fecha que src/lib/plans.ts).
create or replace function public._beta_ends_at() returns timestamptz language sql stable set search_path = public as $$ select timestamptz '2026-11-01 06:00:00+00' $$;
revoke all on function public._beta_ends_at() from public, anon, authenticated;

-- ───────────── 11. Guía de la app (0031) ─────────────
-- Cada persona marca solo su guía y sus consejos; la fecha la pone el servidor; claves y versiones validadas.
update public.profiles set guide_version = null, guide_seen_at = null, guide_tips = '{}' where id in (bbtest.u('A'), bbtest.u('B'));
set role authenticated; select bbtest.login('A');
select public.guide_mark_seen(1);
select public.guide_tip_seen('entrenar');
select public.guide_tip_seen('entrenar');
select public.guide_tip_seen('nutricion');
select bbtest.ok('guía: A ve su versión vista', (select guide_version = 1 and guide_seen_at is not null from public.profiles where id = auth.uid()));
select bbtest.ok('guía: un consejo repetido no se duplica', (select guide_tips = array['entrenar','nutricion'] from public.profiles where id = auth.uid()));
select public.guide_mark_seen(1);
select bbtest.ok('guía: marcar una versión vieja no baja la versión', (select guide_version = 1 from public.profiles where id = auth.uid()));
select bbtest.zero('guía: A no marca la guía de B', $q$ update public.profiles set guide_version = 1, guide_tips = array['entrenar'] where id = bbtest.u('B') $q$);
select bbtest.fails('guía: versión fuera de rango', $q$ select public.guide_mark_seen(0) $q$, '22023');
select bbtest.fails('guía: versión nula', $q$ select public.guide_mark_seen(null) $q$, '22023');
select bbtest.fails('guía: consejo con caracteres raros', $q$ select public.guide_tip_seen('x'',''y') $q$, '22023');
select bbtest.fails('guía: consejo demasiado largo', $q$ select public.guide_tip_seen(repeat('a', 25)) $q$, '22023');
select bbtest.fails('guía: versión inválida directo en la tabla', $q$ update public.profiles set guide_version = 500 where id = auth.uid() $q$, '23514');
select bbtest.fails('guía: consejo inválido directo en la tabla', $q$ update public.profiles set guide_tips = array['Hola Mundo'] where id = auth.uid() $q$, '23514');
update public.profiles set guide_seen_at = '2099-01-01' where id = auth.uid();
select bbtest.ok('guía: la fecha de vista la pone el servidor', (select guide_seen_at <= now() + interval '1 minute' from public.profiles where id = auth.uid()));
select bbtest.fails('guía: A no se sube el rol al marcar la guía', $q$ update public.profiles set guide_version = 1, role = 'superadmin' where id = auth.uid() $q$, '42501');
reset role;
select bbtest.ok('guía: B quedó sin tocar', (select guide_version is null and guide_tips = '{}' from public.profiles where id = bbtest.u('B')));
set role authenticated; select bbtest.login('B');
select bbtest.ok('guía: B no ve la guía de A como suya', (select guide_version is null from public.profiles where id = auth.uid()));
select bbtest.fails('guía: 17 consejos no caben', $q$ update public.profiles set guide_tips = array['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q'] where id = auth.uid() $q$, '23514');
reset role;
set role anon; select bbtest.login(null);
select bbtest.fails('guía: anon no marca guías', $q$ select public.guide_mark_seen(1) $q$, '42501');
select bbtest.fails('guía: anon no marca consejos', $q$ select public.guide_tip_seen('entrenar') $q$, '42501');
reset role;

-- ───────────── 14. Cómo te hablo (0035) ─────────────
-- Cada persona elige su registro (básico, intermedio o técnico) solo en su fila; otro valor no entra.
update public.profiles set lenguaje = 'intermedio' where id in (bbtest.u('A'), bbtest.u('B'));
select bbtest.ok('lenguaje: por defecto intermedio', (select bool_and(lenguaje = 'intermedio') from public.profiles));
set role authenticated; select bbtest.login('A');
select bbtest.ok('lenguaje: A elige básico', bbtest.affected($q$ update public.profiles set lenguaje = 'basico' where id = auth.uid() $q$) = 1);
select bbtest.ok('lenguaje: A lee su registro', (select lenguaje = 'basico' from public.profiles where id = auth.uid()));
select bbtest.ok('lenguaje: A cambia a técnico', bbtest.affected($q$ update public.profiles set lenguaje = 'tecnico' where id = auth.uid() $q$) = 1);
select bbtest.zero('lenguaje: A no cambia el registro de B', $q$ update public.profiles set lenguaje = 'tecnico' where id = bbtest.u('B') $q$);
select bbtest.fails('lenguaje: valor inventado', $q$ update public.profiles set lenguaje = 'experto' where id = auth.uid() $q$, '23514');
select bbtest.fails('lenguaje: vacío no entra', $q$ update public.profiles set lenguaje = null where id = auth.uid() $q$, '23502');
select bbtest.fails('lenguaje: A no se sube el rol al cambiar el registro', $q$ update public.profiles set lenguaje = 'basico', role = 'superadmin' where id = auth.uid() $q$, '42501');
reset role;
select bbtest.ok('lenguaje: B quedó en intermedio', (select lenguaje = 'intermedio' from public.profiles where id = bbtest.u('B')));
select bbtest.ok('lenguaje: A quedó en técnico', (select lenguaje = 'tecnico' from public.profiles where id = bbtest.u('A')));
set role anon; select bbtest.login(null);
select bbtest.zero('lenguaje: anon no cambia registros', $q$ update public.profiles set lenguaje = 'basico' $q$);
reset role;
update public.profiles set lenguaje = 'intermedio' where id = bbtest.u('A');
-- ───────────── 12. Cupo de Coach Banana por plan (0032) ─────────────
-- Topes por día y mes según el plan, sin pasarse, sin editar contadores, staff sin límite (contado), devolución con
-- ticket, y la beta encendida y apagada (se fija aquí y se restaura al final).
reset role; select bbtest.login(null);
create function bbtest.cq(n text) returns uuid language sql immutable as $$ select ('c0a00000-0000-4000-8000-0000000000' || n)::uuid $$;
/** Toma `times` preguntas como la sesión actual; devuelve cuántas salieron ok. */
create function bbtest.take(times int) returns int language plpgsql as $$
declare ok int := 0;
begin
  for i in 1..times loop if (public.coach_take_quota('chat') ->> 'ok')::boolean then ok := ok + 1; end if; end loop;
  return ok;
end $$;
create function bbtest.used(u uuid) returns int language sql as $$ select coalesce(sum(n), 0)::int from public.coach_usage where user_id = u and kind = 'chat' and day = public.cr_today() $$;
-- C1 sin plan, C2 Entreno, C3 Entreno + Nutrición, C4 tester, C5 Entreno (devoluciones), C6 Entreno (tope mensual), C7 regalo Entreno.
insert into auth.users (id, email) select bbtest.cq(k), 'cuota' || k || '@prueba.test' from unnest(array['01','02','03','04','05','06','07']) k;
update public.profiles set created_at = now() - interval '90 days', onboarded = true where id in (select bbtest.cq(k) from unnest(array['01','02','03','04','05','06','07']) k);
update public.profiles set plan = 'entreno' where id in (bbtest.cq('02'), bbtest.cq('05'), bbtest.cq('06'));
update public.profiles set plan = 'completo' where id = bbtest.cq('03');
insert into public.comp_grants (user_id, plan, previous_plan, starts_at, expires_at, reason, source)
  values (bbtest.cq('07'), 'entreno', 'free', now() - interval '1 day', now() + interval '20 days', 'regalo de prueba', 'regalo');
set role authenticated; select bbtest.login('S');
select public.admin_set_tester(bbtest.cq('04'), 'prueba la app');
reset role; select bbtest.login(null);

-- 12a. Beta apagada: cada plan con su tope.
create or replace function public._beta_ends_at() returns timestamptz language sql stable set search_path = public as $$ select now() - interval '8 days' $$;
select bbtest.ok('cuota: niveles sin beta (sin plan, entreno, completo, tester, staff, regalo entreno)',
  public._coach_tier(bbtest.cq('01')) = 'none' and public._coach_tier(bbtest.cq('02')) = 'entreno' and public._coach_tier(bbtest.cq('03')) = 'completo'
  and public._coach_tier(bbtest.cq('04')) = 'prueba' and public._coach_tier(bbtest.u('S')) = 'staff' and public._coach_tier(bbtest.u('P')) = 'staff'
  and public._coach_tier(bbtest.cq('07')) = 'entreno');

set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', bbtest.cq('01'), 'role', 'authenticated')::text, false);
select bbtest.ok('cuota: sin plan no toma preguntas (locked)', (select (r ->> 'ok')::boolean = false and r ->> 'reason' = 'locked' and r ->> 'left' = '0' from public.coach_take_quota('chat') r));
reset role;
select bbtest.ok('cuota: sin plan no suma nada', bbtest.used(bbtest.cq('01')) = 0);

set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', bbtest.cq('02'), 'role', 'authenticated')::text, false);
select bbtest.ok('cuota: Entreno, la primera deja 9 y trae ticket', (select (r ->> 'ok')::boolean and (r ->> 'left')::int = 9 and (r ->> 'day_limit')::int = 10 and (r ->> 'month_limit')::int = 150 and r ->> 'ticket' is not null from public.coach_take_quota('chat') r));
select bbtest.ok('cuota: Entreno toma 9 más y la 11 no pasa', bbtest.take(12) = 9);
select bbtest.ok('cuota: Entreno agotado responde reason day y left 0', (select (r ->> 'ok')::boolean = false and r ->> 'reason' = 'day' and (r ->> 'left')::int = 0 from public.coach_take_quota('chat') r));
select bbtest.ok('cuota: Entreno, el estado dice 0 y 10 usadas', (select (r ->> 'left')::int = 0 and (r ->> 'day_used')::int = 10 from public.coach_quota_status() r));
select bbtest.ok('cuota: lee solo su propio contador', (select count(*) = 1 and sum(n) = 10 from public.coach_usage where kind = 'chat' and day = public.cr_today()));
select bbtest.fails('cuota: no se resetea el contador', $q$ update public.coach_usage set n = 0 where user_id = auth.uid() $q$, '42501');
select bbtest.fails('cuota: no borra su contador', $q$ delete from public.coach_usage where user_id = auth.uid() $q$, '42501');
select bbtest.fails('cuota: no inserta contadores', $q$ insert into public.coach_usage (user_id, day, kind, n) values (auth.uid(), public.cr_today() + 1, 'chat', 0) $q$, '42501');
select bbtest.fails('cuota: no lee tickets', $q$ select * from public.coach_quota_tickets $q$, '42501');
select bbtest.fails('cuota: no crea tickets', $q$ insert into public.coach_quota_tickets (user_id, day) values (auth.uid(), public.cr_today()) $q$, '42501');
select bbtest.fails('cuota: no llama funciones internas', $q$ select public._coach_tier(auth.uid()) $q$, '42501');
select bbtest.fails('cuota: tipo inválido', $q$ select public.coach_take_quota('feedback') $q$, '22023');
select bbtest.fails('cuota: no ve el panel de uso', $q$ select public.admin_coach_usage(null) $q$, '42501');
select bbtest.ok('cuota: devolver un ticket inventado no suma', public.coach_refund_quota(gen_random_uuid()) = false and bbtest.used(bbtest.cq('02')) = 10);
reset role;
select bbtest.ok('cuota: Entreno quedó en 10 exactas', bbtest.used(bbtest.cq('02')) = 10);

set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', bbtest.cq('03'), 'role', 'authenticated')::text, false);
select bbtest.ok('cuota: Entreno + Nutrición toma 20 de 25', bbtest.take(25) = 20);
select bbtest.ok('cuota: Entreno + Nutrición topes 20 y 300', (select (r ->> 'day_limit')::int = 20 and (r ->> 'month_limit')::int = 300 and (r ->> 'left')::int = 0 from public.coach_quota_status() r));
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', bbtest.cq('04'), 'role', 'authenticated')::text, false);
select bbtest.ok('cuota: tester (prueba) toma 10 de 15 aunque su acceso sea completo', bbtest.take(15) = 10);
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', bbtest.cq('07'), 'role', 'authenticated')::text, false);
select bbtest.ok('cuota: regalo de Entreno toma 10', bbtest.take(11) = 10);

-- Staff: sin límite, pero contado.
set role authenticated; select bbtest.login('S');
select bbtest.ok('cuota: staff toma 30 de 30', bbtest.take(30) = 30);
select bbtest.ok('cuota: staff sin tope (left null)', (select r -> 'left' = 'null'::jsonb and r -> 'day_limit' = 'null'::jsonb and (r ->> 'day_used')::int = 30 from public.coach_quota_status() r));
select bbtest.ok('cuota: panel de una persona', (select (r ->> 'day_used')::int = 10 and r ->> 'tier' = 'entreno' from public.admin_coach_usage(bbtest.cq('02')) r));
select bbtest.ok('cuota: panel total y quién llegó al tope', (select (r ->> 'day_total')::int >= 80 and (r ->> 'at_limit_today')::int >= 4 from public.admin_coach_usage(null) r));
reset role;
select bbtest.ok('cuota: lo del staff queda registrado', bbtest.used(bbtest.u('S')) = 30);

-- 12b. Devolución: una vez, solo el dueño, 10 minutos.
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', bbtest.cq('05'), 'role', 'authenticated')::text, false);
create temp table cq_t (k text, t uuid);
grant all on cq_t to authenticated;
insert into cq_t select 'a', (public.coach_take_quota('chat') ->> 'ticket')::uuid;
insert into cq_t select 'b', (public.coach_take_quota('chat') ->> 'ticket')::uuid;
insert into cq_t select 'c', (public.coach_take_quota('chat') ->> 'ticket')::uuid;
select bbtest.ok('cuota: C5 lleva 3', bbtest.used(bbtest.cq('05')) = 3);
select bbtest.ok('cuota: devolver su ticket resta 1', public.coach_refund_quota((select t from cq_t where k = 'a')) and bbtest.used(bbtest.cq('05')) = 2);
select bbtest.ok('cuota: el mismo ticket no se devuelve dos veces', public.coach_refund_quota((select t from cq_t where k = 'a')) = false and bbtest.used(bbtest.cq('05')) = 2);
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', bbtest.cq('02'), 'role', 'authenticated')::text, false);
select bbtest.ok('cuota: nadie devuelve el ticket de otra persona', public.coach_refund_quota((select t from cq_t where k = 'b')) = false);
reset role;
select bbtest.ok('cuota: C2 sigue en 10 y C5 en 2', bbtest.used(bbtest.cq('02')) = 10 and bbtest.used(bbtest.cq('05')) = 2);
update public.coach_quota_tickets set created_at = now() - interval '11 minutes' where id = (select t from cq_t where k = 'c');
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', bbtest.cq('05'), 'role', 'authenticated')::text, false);
select bbtest.ok('cuota: un ticket viejo ya no se devuelve', public.coach_refund_quota((select t from cq_t where k = 'c')) = false and bbtest.used(bbtest.cq('05')) = 2);
select bbtest.ok('cuota: devolver y volver a tomar no pasa del tope', bbtest.take(20) = 8 and bbtest.used(bbtest.cq('05')) = 10);
reset role;

-- 12c. Tope mensual: lo de días anteriores del mes cuenta; lo del mes pasado no.
insert into public.coach_usage (user_id, day, kind, n) values (bbtest.cq('06'), (date_trunc('month', public.cr_today()) - interval '1 day')::date, 'chat', 500);
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', bbtest.cq('06'), 'role', 'authenticated')::text, false);
select bbtest.ok('cuota: el mes pasado no cuenta', (select (r ->> 'month_used')::int = 0 and (r ->> 'left')::int = 10 from public.coach_quota_status() r));
reset role;
insert into public.coach_usage (user_id, day, kind, n) values (bbtest.cq('06'), date_trunc('month', public.cr_today())::date, 'chat', 150)
  on conflict (user_id, day, kind) do update set n = 150;
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', bbtest.cq('06'), 'role', 'authenticated')::text, false);
select bbtest.ok('cuota: con 150 en el mes ya no hay preguntas', (select (r ->> 'ok')::boolean = false and r ->> 'reason' = case when date_trunc('month', public.cr_today())::date = public.cr_today() then 'day' else 'month' end from public.coach_take_quota('chat') r));
reset role;

-- 12d. Beta encendida: la cuenta sin plan tiene 10 (prueba); los planes pagados conservan su tope.
create or replace function public._beta_ends_at() returns timestamptz language sql stable set search_path = public as $$ select now() + interval '10 days' $$;
select bbtest.ok('cuota: en la beta, sin plan es prueba y los planes conservan su nivel',
  public._coach_tier(bbtest.cq('01')) = 'prueba' and public._coach_tier(bbtest.cq('02')) = 'entreno' and public._coach_tier(bbtest.cq('03')) = 'completo');
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', bbtest.cq('01'), 'role', 'authenticated')::text, false);
select bbtest.ok('cuota: en la beta, sin plan toma 10 de 12', bbtest.take(12) = 10);
reset role;
set role anon; select bbtest.login(null);
select bbtest.fails('cuota: anon no toma preguntas', $q$ select public.coach_take_quota('chat') $q$, '42501');
select bbtest.fails('cuota: anon no devuelve preguntas', $q$ select public.coach_refund_quota(gen_random_uuid()) $q$, '42501');
reset role;
-- Borrar la cuenta borra su uso y sus tickets.
delete from auth.users where id = bbtest.cq('05');
select bbtest.ok('cuota: borrar la cuenta borra uso y tickets', not exists (select 1 from public.coach_usage where user_id = bbtest.cq('05')) and not exists (select 1 from public.coach_quota_tickets where user_id = bbtest.cq('05')));
-- Restaurar la beta original (misma fecha que src/lib/plans.ts).
create or replace function public._beta_ends_at() returns timestamptz language sql stable set search_path = public as $$ select timestamptz '2026-11-01 06:00:00+00' $$;
revoke all on function public._beta_ends_at() from public, anon, authenticated;
-- ───────────── 12. Soporte: casos, conversación y estados (0034) ─────────────
-- A y B: personas. P: soporte. S: admin. K: coach (staff sin soporte).
reset role; select bbtest.login(null);
insert into auth.users (id, email) values ('c0ac0000-0000-4000-8000-0000000000c0', 'coach@prueba.test');
update public.profiles set role = 'coach' where id = 'c0ac0000-0000-4000-8000-0000000000c0';
create function bbtest.tk(t text) returns bigint language sql security definer as $$ select max(id) from public.support_tickets where title = t $$;
grant execute on function bbtest.tk(text) to public;

-- 12a. La persona crea su caso: solo lo suyo, contexto limpio, captura de su carpeta.
set role authenticated; select bbtest.login('A');
select bbtest.ok('soporte: A crea un caso', (select public.support_create_ticket('app', 'No guarda mi peso', 'Toco guardar y se queda cargando la pantalla de Hoy.', '{"page":"/app","version":"abc","device":"iPhone, Safari","plan":"completo","email":"a@x.com","peso":90}'::jsonb)) > 0);
select bbtest.ok('soporte: el contexto solo guarda llaves permitidas (sin correo ni datos de salud)', (select context ? 'page' and context ? 'device' and not context ? 'email' and not context ? 'peso' and status = 'recibido' and priority = 'normal' from public.support_tickets where id = bbtest.tk('No guarda mi peso')));
select bbtest.ok('soporte: aviso de recibido en la campanita', (select count(*) = 1 from public.notifications where user_id = auth.uid() and kind = 'soporte' and title like 'Recibimos tu reporte BB-%'));
select bbtest.ok('soporte: A ve el evento de creado', bbtest.num($q$ select 1 from public.support_events where kind = 'creado' and ticket_id = bbtest.tk('No guarda mi peso') $q$) = 1);
select bbtest.ok('soporte: A sube una captura a su carpeta', bbtest.affected($q$ insert into storage.objects (bucket_id, name) values ('soporte', 'a1a1a1a1-0000-4000-8000-0000000000a1/captura1.png') $q$) = 1);
select bbtest.fails('soporte: A no sube a la carpeta de B', $q$ insert into storage.objects (bucket_id, name) values ('soporte', 'b2b2b2b2-0000-4000-8000-0000000000b2/x.png') $q$, '42501');
select bbtest.fails('soporte: A no crea subcarpetas', $q$ insert into storage.objects (bucket_id, name) values ('soporte', 'a1a1a1a1-0000-4000-8000-0000000000a1/x/y.png') $q$, '42501');
select bbtest.fails('soporte: A no adjunta una captura ajena', $q$ select public.support_create_ticket('app', 'Captura ajena', 'Intento adjuntar algo que no es mío.', '{}'::jsonb, 'b2b2b2b2-0000-4000-8000-0000000000b2/x.png') $q$, 'P0001');
select bbtest.fails('soporte: A no adjunta una captura que no existe', $q$ select public.support_create_ticket('app', 'Sin captura', 'La captura no está en el almacenamiento.', '{}'::jsonb, 'a1a1a1a1-0000-4000-8000-0000000000a1/nada.png') $q$, 'P0001');
select bbtest.ok('soporte: A crea un caso con su captura', (select public.support_create_ticket('pagos', 'Me cobraron dos veces', 'Veo dos cargos iguales en mi tarjeta este mes.', '{}'::jsonb, 'a1a1a1a1-0000-4000-8000-0000000000a1/captura1.png')) > 0);
select bbtest.fails('soporte: categoría inválida', $q$ select public.support_create_ticket('quejas', 'Título válido', 'Descripción suficientemente larga.') $q$, '22023');
select bbtest.fails('soporte: título corto', $q$ select public.support_create_ticket('otro', 'ay', 'Descripción suficientemente larga.') $q$, 'P0001');
select bbtest.fails('soporte: descripción corta', $q$ select public.support_create_ticket('otro', 'Título válido', 'corta') $q$, 'P0001');
select bbtest.fails('soporte: A no crea casos directo en la tabla', $q$ insert into public.support_tickets (user_id, category, title, body) values (auth.uid(), 'otro', 'Directo', 'Directo a la tabla sin pasar por la función.') $q$, '42501');
select bbtest.zero('soporte: A no cambia el estado de su caso', $q$ update public.support_tickets set status = 'resuelto' where user_id = auth.uid() $q$);
select bbtest.zero('soporte: A no cambia la prioridad de su caso', $q$ update public.support_tickets set priority = 'urgente' where user_id = auth.uid() $q$);
select bbtest.fails('soporte: A no escribe como equipo', $q$ insert into public.support_messages (ticket_id, author, author_kind, body) values (bbtest.tk('No guarda mi peso'), auth.uid(), 'equipo', 'hola') $q$, '42501');
select bbtest.fails('soporte: A no usa las funciones del equipo (responder)', $q$ select public.admin_support_reply(bbtest.tk('No guarda mi peso'), 'me respondo', false, null) $q$, '42501');
select bbtest.fails('soporte: A no usa las funciones del equipo (estado)', $q$ select public.admin_support_update(bbtest.tk('No guarda mi peso'), 'resuelto') $q$, '42501');
select bbtest.fails('soporte: A no pide capturas como equipo', $q$ select public.admin_support_file(bbtest.tk('No guarda mi peso')) $q$, '42501');
select bbtest.ok('soporte: A responde en su caso abierto', (select public.support_reply(bbtest.tk('No guarda mi peso'), 'Pasa también en la computadora.')) > 0);
select bbtest.ok('soporte: máximo 5 casos por hora', bbtest.passes($q$ select public.support_create_ticket('otro', 'Uno más', 'Otro reporte para probar el límite.') $q$, 6) = 3);
reset role;

-- 12b. Aislamiento: B no ve ni toca lo de A.
set role authenticated; select bbtest.login('B');
select bbtest.ok('soporte: B no ve casos de A', bbtest.num($q$ select 1 from public.support_tickets where user_id = bbtest.u('A') $q$) = 0);
select bbtest.ok('soporte: B no ve mensajes de A', bbtest.num($q$ select 1 from public.support_messages m join public.support_tickets t on t.id = m.ticket_id where t.user_id = bbtest.u('A') $q$) = 0 and bbtest.num($q$ select 1 from public.support_messages $q$) = 0);
select bbtest.ok('soporte: B no ve eventos de A', bbtest.num($q$ select 1 from public.support_events $q$) = 0);
select bbtest.ok('soporte: B no ve capturas de A', bbtest.num($q$ select 1 from storage.objects where bucket_id = 'soporte' $q$) = 0);
select bbtest.fails('soporte: B no responde en el caso de A', $q$ select public.support_reply(bbtest.tk('No guarda mi peso'), 'intruso') $q$, '42501');
select bbtest.fails('soporte: B no cierra el caso de A', $q$ select public.support_user_action(bbtest.tk('No guarda mi peso'), 'confirmar') $q$, '42501');
select bbtest.zero('soporte: B no borra la captura de A', $q$ delete from storage.objects where bucket_id = 'soporte' $q$);
reset role;
set role authenticated; select bbtest.as_user('c0ac0000-0000-4000-8000-0000000000c0');
select bbtest.ok('soporte: un coach no ve casos (no es del equipo de soporte)', bbtest.num($q$ select 1 from public.support_tickets $q$) = 0);
select bbtest.fails('soporte: un coach no responde casos', $q$ select public.admin_support_reply(bbtest.tk('No guarda mi peso'), 'hola', false, null) $q$, '42501');
reset role;
set role anon; select bbtest.login(null);
select bbtest.fails('soporte: anon no crea casos', $q$ select public.support_create_ticket('otro', 'Anónimo', 'Intento sin sesión, no debería pasar.') $q$, '42501');
select bbtest.fails('soporte: anon no lee casos', $q$ select 1 from public.support_tickets $q$, '42501');
reset role;

-- 12c. Equipo: responde, notas internas ocultas, estados válidos, asignación y prioridad.
set role authenticated; select bbtest.login('P');
select bbtest.ok('soporte: soporte ve los casos de A', bbtest.num($q$ select 1 from public.support_tickets where user_id = bbtest.u('A') $q$) >= 2);
select bbtest.ok('soporte: soporte responde (pasa a en proceso)', (select public.admin_support_reply(bbtest.tk('No guarda mi peso'), '¿Desde qué versión pasa?', false, null)) > 0);
select bbtest.ok('soporte: nota interna', (select public.admin_support_reply(bbtest.tk('No guarda mi peso'), 'Revisar logs del 22, posible tarjeta duplicada', true, null)) > 0);
select bbtest.fails('soporte: una nota interna no cambia el estado', $q$ select public.admin_support_reply(bbtest.tk('No guarda mi peso'), 'nota', true, 'resuelto') $q$, 'P0001');
select public.admin_support_update(bbtest.tk('No guarda mi peso'), 'necesita_info');
select bbtest.ok('soporte: pide más información', (select status = 'necesita_info' from public.support_tickets where id = bbtest.tk('No guarda mi peso')));
select bbtest.fails('soporte: no se asigna a alguien fuera del equipo', $q$ select public.admin_support_update(bbtest.tk('No guarda mi peso'), null, null, bbtest.u('A')) $q$, 'P0001');
select bbtest.fails('soporte: no se asigna a un coach', $q$ select public.admin_support_update(bbtest.tk('No guarda mi peso'), null, null, 'c0ac0000-0000-4000-8000-0000000000c0') $q$, 'P0001');
select public.admin_support_update(bbtest.tk('No guarda mi peso'), null, 'alta', bbtest.u('S'));
select bbtest.ok('soporte: prioridad y asignación guardadas', (select priority = 'alta' and assigned_to = bbtest.u('S') and first_response_at is not null and status = 'necesita_info' from public.support_tickets where id = bbtest.tk('No guarda mi peso')));
select bbtest.fails('soporte: prioridad inválida', $q$ select public.admin_support_update(bbtest.tk('No guarda mi peso'), null, 'maxima') $q$, '22023');
select bbtest.ok('soporte: soporte pide la captura', (select public.admin_support_file(bbtest.tk('Me cobraron dos veces'))) = 'a1a1a1a1-0000-4000-8000-0000000000a1/captura1.png');
select bbtest.fails('soporte: un caso sin captura', $q$ select public.admin_support_file(bbtest.tk('No guarda mi peso')) $q$, 'P0001');
reset role;
select bbtest.ok('soporte: cada acción del equipo queda en auditoría (también ver la captura)', (select count(distinct action) = 4 from public.audit_log where actor = bbtest.u('P') and action in ('support.reply', 'support.note', 'support.update', 'support.file_view')));
select bbtest.ok('soporte: avisos a la persona por respuesta y por estado (no por nota, asignación ni prioridad)', (select count(*) = 2 from public.notifications where user_id = bbtest.u('A') and kind = 'soporte' and title not like 'Recibimos%'));
select bbtest.ok('soporte: eventos pendientes de correo solo para lo que la persona debe saber', (select count(*) from public.support_events e join public.support_tickets t on t.id = e.ticket_id where t.user_id = bbtest.u('A') and e.notified_at is null and e.kind in ('asignado', 'prioridad')) = 0);
set role authenticated; select bbtest.login('A');
select bbtest.ok('soporte: A ve la respuesta pública pero no la nota interna', bbtest.num($q$ select 1 from public.support_messages where ticket_id = bbtest.tk('No guarda mi peso') and author_kind = 'equipo' $q$) = 1
  and bbtest.num($q$ select 1 from public.support_messages where internal $q$) = 0);
select bbtest.ok('soporte: A no ve asignación ni prioridad en la línea de tiempo', bbtest.num($q$ select 1 from public.support_events where kind in ('asignado', 'prioridad') $q$) = 0);
select bbtest.ok('soporte: A responde lo que le pidieron', (select public.support_reply(bbtest.tk('No guarda mi peso'), 'Desde la versión de ayer.')) > 0);
select bbtest.ok('soporte: y el caso vuelve a en proceso', (select status = 'en_proceso' from public.support_tickets where id = bbtest.tk('No guarda mi peso')));
reset role;

-- 12d. Resolver con resumen, confirmar, reabrir hasta 7 días.
set role authenticated; select bbtest.login('S');
select bbtest.ok('soporte: admin resuelve con un resumen (una respuesta pública)', (select public.admin_support_reply(bbtest.tk('No guarda mi peso'), 'Corregimos el guardado del peso. Ya funciona.', false, 'resuelto')) > 0);
select bbtest.fails('soporte: de resuelto no se pasa a necesita información', $q$ select public.admin_support_update(bbtest.tk('No guarda mi peso'), 'necesita_info') $q$, 'P0001');
reset role;
select bbtest.ok('soporte: resuelto con fecha', (select status = 'resuelto' and resolved_at is not null from public.support_tickets where id = bbtest.tk('No guarda mi peso')));
select bbtest.ok('soporte: un solo aviso al resolver (el del estado, con el resumen)', (select count(*) = 1 from public.notifications where user_id = bbtest.u('A') and title like 'Resolvimos tu reporte%'));
set role authenticated; select bbtest.login('A');
select bbtest.fails('soporte: A no escribe en un caso resuelto sin reabrir', $q$ select public.support_reply(bbtest.tk('No guarda mi peso'), 'otra cosa') $q$, 'P0001');
select bbtest.ok('soporte: A lo reabre', (select public.support_user_action(bbtest.tk('No guarda mi peso'), 'reabrir')) = 'recibido');
select bbtest.ok('soporte: A confirma que se resolvió', (select public.support_user_action(bbtest.tk('No guarda mi peso'), 'confirmar')) = 'cerrado');
select bbtest.fails('soporte: acción inválida', $q$ select public.support_user_action(bbtest.tk('No guarda mi peso'), 'borrar') $q$, '22023');
reset role;
update public.support_tickets set closed_at = now() - interval '8 days', resolved_at = now() - interval '8 days' where id = bbtest.tk('No guarda mi peso');
set role authenticated; select bbtest.login('A');
select bbtest.fails('soporte: después de 7 días no se reabre', $q$ select public.support_user_action(bbtest.tk('No guarda mi peso'), 'reabrir') $q$, 'P0001');
reset role;

-- 12e. Reportes de 0029 copiados como casos (sin perder nada) y borrado de cuenta.
select bbtest.ok('soporte: los reportes de "Reportar algo" pasan a ser casos', (select public._support_import_feedback()) > 0);
select bbtest.ok('soporte: cada reporte tiene su caso', not exists (select 1 from public.feedback_reports f where not exists (select 1 from public.support_tickets t where t.legacy_feedback_id = f.id)));
select bbtest.ok('soporte: copiar de nuevo no duplica', (select public._support_import_feedback()) = 0);
select bbtest.ok('soporte: los casos copiados conservan si eran de tester', not exists (select 1 from public.feedback_reports f join public.support_tickets t on t.legacy_feedback_id = f.id where t.from_tester <> f.from_tester));
set role authenticated; select bbtest.login('A');
select bbtest.fails('soporte: una persona no copia reportes', $q$ select public._support_import_feedback() $q$, '42501');
reset role;
insert into auth.users (id, email) values ('50900000-0000-4000-8000-0000000000a1', 'borra@prueba.test');
set role authenticated; select bbtest.as_user('50900000-0000-4000-8000-0000000000a1');
select public.support_create_ticket('cuenta', 'Quiero borrar', 'Voy a borrar mi cuenta después de esto.');
reset role;
delete from auth.users where id = '50900000-0000-4000-8000-0000000000a1';
select bbtest.ok('borrado: sin casos de la cuenta borrada', not exists (select 1 from public.support_tickets where user_id = '50900000-0000-4000-8000-0000000000a1'));

-- ───────────── 13. Novedades (0036) ─────────────
-- Cada persona marca solo su última novedad vista; la fecha la pone el servidor; ids validados; nunca baja de fecha.
update public.profiles set news_seen = null, news_seen_at = null where id in (bbtest.u('A'), bbtest.u('B'));
set role authenticated; select bbtest.login('A');
select public.news_mark_seen('2026-10-23-programas');
select bbtest.ok('novedades: A guarda su última vista con fecha del servidor', (select news_seen = '2026-10-23-programas' and news_seen_at is not null and news_seen_at <= now() + interval '1 minute' from public.profiles where id = auth.uid()));
select public.news_mark_seen('2026-10-23-retos-y-guia');
select bbtest.ok('novedades: el mismo día se puede avanzar', (select news_seen = '2026-10-23-retos-y-guia' from public.profiles where id = auth.uid()));
select public.news_mark_seen('2026-11-15-algo-nuevo');
select public.news_mark_seen('2026-10-01-vieja');
select bbtest.ok('novedades: una versión de fecha anterior no baja la vista', (select news_seen = '2026-11-15-algo-nuevo' from public.profiles where id = auth.uid()));
select bbtest.zero('novedades: A no marca las novedades de B', $q$ update public.profiles set news_seen = '2026-10-23-programas' where id = bbtest.u('B') $q$);
select bbtest.fails('novedades: id con formato inválido', $q$ select public.news_mark_seen('hola') $q$, '22023');
select bbtest.fails('novedades: id con caracteres raros', $q$ select public.news_mark_seen('2026-10-23-x'',''y') $q$, '22023');
select bbtest.fails('novedades: id nulo', $q$ select public.news_mark_seen(null) $q$, '22023');
select bbtest.fails('novedades: id demasiado largo', $q$ select public.news_mark_seen('2026-10-23-' || repeat('a', 60)) $q$, '22023');
select bbtest.fails('novedades: id inválido directo en la tabla', $q$ update public.profiles set news_seen = 'Hola Mundo' where id = auth.uid() $q$, '23514');
update public.profiles set news_seen_at = '2099-01-01' where id = auth.uid();
select bbtest.ok('novedades: la fecha de vista no se inventa', (select news_seen_at <= now() + interval '1 minute' from public.profiles where id = auth.uid()));
select bbtest.fails('novedades: A no se sube el rol al marcar novedades', $q$ update public.profiles set news_seen = '2026-10-23-programas', role = 'superadmin' where id = auth.uid() $q$, '42501');
reset role;
select bbtest.ok('novedades: B quedó sin tocar', (select news_seen is null and news_seen_at is null from public.profiles where id = bbtest.u('B')));
set role authenticated; select bbtest.login('B');
select bbtest.ok('novedades: B no ve la vista de A como suya', (select news_seen is null from public.profiles where id = auth.uid()));
reset role;
set role anon; select bbtest.login(null);
select bbtest.fails('novedades: anon no marca novedades', $q$ select public.news_mark_seen('2026-10-23-programas') $q$, '42501');
reset role;

-- ───────────── 14. Pilates en casa 30 días y Coach Platanita (0037) ─────────────
select bbtest.ok('0037: Pilates en casa está en la tienda con portada lila y dura 30 días', (select days = 30 and cover = 'lila' and kind = 'programa' and status = 'publicado' and public._program_days(program) = 30 and public._program_weeks(program) = 5 from public.challenges_catalog where slug = 'pilates-casa-30'));
select bbtest.ok('0037: 21 sesiones (4 semanas de 5 y la prueba final)', (select count(*) = 21 from public.program_sessions where slug = 'pilates-casa-30'));
select bbtest.ok('0037: Coach Platanita en Pilates y en Banana Girl', (select bool_and(program->'experience'->>'coach' = 'platanita') from public.challenges_catalog where slug in ('pilates-casa-30', 'banana-girl')));
select bbtest.ok('0037: los programas en semanas siguen igual', (select bool_and(public._program_days(program) = public._program_weeks(program) * 7) from public.challenges_catalog where kind = 'programa' and slug <> 'pilates-casa-30'));
select bbtest.ok('0037: days fuera de rango se ignora', public._program_days('{"phases":[{"weeks":2}],"days":30}'::jsonb) = 14 and public._program_days('{"phases":[{"weeks":2}],"days":"x"}'::jsonb) = 14 and public._program_days('{"phases":[{"weeks":2}],"days":10}'::jsonb) = 10);
select bbtest.fails('0037: una portada desconocida no entra', $q$ update public.challenges_catalog set cover = 'violeta' where slug = 'pilates-casa-30' $q$, '23514');
delete from public.user_programs where user_id = bbtest.u('A');
insert into public.user_programs (user_id, slug, status, started_on) values (bbtest.u('A'), 'pilates-casa-30', 'activo', current_date - 29);
set role authenticated; select bbtest.login('A');
select bbtest.fails('0037: el día 30 todavía no se cierra sin las sesiones', $q$ select public.program_finish('pilates-casa-30', current_date) $q$, 'P0001');
reset role;
update public.user_programs set started_on = current_date - 30 where user_id = bbtest.u('A') and slug = 'pilates-casa-30';
set role authenticated; select bbtest.login('A');
select bbtest.ok('0037: pasados los 30 días se cierra y da el certificado', public.program_finish('pilates-casa-30', current_date));
reset role;
delete from public.user_programs where user_id = bbtest.u('A') and slug = 'pilates-casa-30';

-- ───────────── 15. Tercera auditoría (0038) ─────────────
-- 15a. public_profiles es de solo lectura: la vista corre como su dueño y salta la RLS de profiles.
reset role; select bbtest.login(null);
update public.profiles set username = 'beto', full_name = 'Beto', bio = 'bio de beto', visibility = 'publico' where id = bbtest.u('B');
set role authenticated; select bbtest.login('A');
select bbtest.ok('0038: A todavía lee perfiles públicos', bbtest.num($q$ select 1 from public.public_profiles where id = bbtest.u('B') $q$) = 1);
select bbtest.zero('0038: A no edita el nombre de B por public_profiles', $q$ update public.public_profiles set full_name = 'HACK', bio = 'pwned' where id = bbtest.u('B') $q$);
select bbtest.zero('0038: A no cambia el usuario ni la visibilidad de B por public_profiles', $q$ update public.public_profiles set username = 'hack_b', visibility = 'privado' where id = bbtest.u('B') $q$);
select bbtest.ok('0038: D es visible para A en public_profiles', bbtest.num($q$ select 1 from public.public_profiles where id = bbtest.u('D') $q$) = 1);
select bbtest.zero('0038: A no borra el perfil de D por public_profiles', $q$ delete from public.public_profiles where id = bbtest.u('D') $q$);
select bbtest.zero('0038: A no edita su propio perfil por la vista (solo por profiles, con su RLS)', $q$ update public.public_profiles set bio = 'x' where id = auth.uid() $q$);
select bbtest.fails('0038: A no inserta en public_profiles', $q$ insert into public.public_profiles (id, username) values (gen_random_uuid(), 'nuevo_x') $q$, '42501');
reset role;
select bbtest.ok('0038: el perfil de D sigue existiendo', exists (select 1 from public.profiles where id = bbtest.u('D')));
select bbtest.ok('0038: el perfil de B quedó intacto', (select full_name = 'Beto' and bio = 'bio de beto' and username = 'beto' and visibility = 'publico' from public.profiles where id = bbtest.u('B')));
select bbtest.ok('0038: ninguna vista de public acepta escrituras de authenticated/anon', not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace, unnest(array['anon','authenticated']) r, unnest(array['INSERT','UPDATE','DELETE']) p
   where n.nspname = 'public' and c.relkind in ('v','m') and has_table_privilege(r, c.oid, p)));
set role authenticated; select bbtest.login('A');
select bbtest.ok('0038: A sigue editando su perfil por profiles', bbtest.affected($q$ update public.profiles set bio = 'mi bio' where id = auth.uid() $q$) = 1);
reset role;

-- 15b. Datos de pago: el rol coach (staff sin cuentas) ya no lee clientes, eventos crudos del webhook ni compras ajenas.
insert into auth.users (id, email) values ('c0ac0000-0000-4000-8000-0000000000c0', 'coach@prueba.test') on conflict (id) do nothing;
insert into public.profiles (id) values ('c0ac0000-0000-4000-8000-0000000000c0') on conflict (id) do nothing;
update public.profiles set role = 'coach' where id = 'c0ac0000-0000-4000-8000-0000000000c0';
insert into public.challenge_purchases (user_id, challenge_slug, status, amount_minor, list_price_minor, provider_payment_intent_id)
values (bbtest.u('B'), 'abdomen-21', 'pendiente', 499, 499, 'pi_test_0038');
create or replace function bbtest.login_coach() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', 'c0ac0000-0000-4000-8000-0000000000c0', 'role', 'authenticated')::text, false);
end $$;
set role authenticated; select bbtest.login_coach();
select bbtest.ok('0038: coach no lee clientes de pago ajenos', bbtest.num($q$ select 1 from public.billing_customers $q$) = 0);
select bbtest.ok('0038: coach no lee eventos de pago (webhook crudo)', bbtest.num($q$ select 1 from public.payment_events $q$) = 0);
select bbtest.ok('0038: coach no lee compras de retos ajenas', bbtest.num($q$ select 1 from public.challenge_purchases $q$) = 0);
select bbtest.ok('0038: coach todavía lee perfiles (panel de usuarios)', bbtest.num($q$ select 1 from public.profiles where id = bbtest.u('B') $q$) = 1);
select bbtest.login('P');
select bbtest.ok('0038: soporte lee clientes, eventos y compras', bbtest.num($q$ select 1 from public.billing_customers where user_id = bbtest.u('B') $q$) = 1
  and bbtest.num($q$ select 1 from public.payment_events where user_id = bbtest.u('B') $q$) >= 1
  and bbtest.num($q$ select 1 from public.challenge_purchases where provider_payment_intent_id = 'pi_test_0038' $q$) = 1);
select bbtest.login('S');
select bbtest.ok('0038: admin lee eventos y compras', bbtest.num($q$ select 1 from public.payment_events where user_id = bbtest.u('B') $q$) >= 1
  and bbtest.num($q$ select 1 from public.challenge_purchases where provider_payment_intent_id = 'pi_test_0038' $q$) = 1);
select bbtest.login('B');
select bbtest.ok('0038: B lee lo suyo', bbtest.num($q$ select 1 from public.billing_customers $q$) = 1 and bbtest.num($q$ select 1 from public.challenge_purchases where provider_payment_intent_id = 'pi_test_0038' $q$) = 1);
select bbtest.login('A');
select bbtest.ok('0038: A no lee pagos de B', bbtest.num($q$ select 1 from public.payment_events where user_id = bbtest.u('B') $q$) = 0 and bbtest.num($q$ select 1 from public.challenge_purchases where provider_payment_intent_id = 'pi_test_0038' $q$) = 0);
reset role;
delete from public.challenge_purchases where provider_payment_intent_id = 'pi_test_0038';

-- ───────────── 16. Textos neutros (0039) ─────────────
select bbtest.ok('0039: sin frases que asumen a un hombre en programas y planes de retos', not exists (select 1 from public.challenges_catalog where program::text ~ '(si estás cansado|cuando estás listo|cuando estás fresco|Llega descansado)') and not exists (select 1 from public.challenge_plans where days::text ~ '(si estás cansado|cuando estás listo)') and not exists (select 1 from public.program_sessions where focus like '%Llega descansado%'));
select bbtest.ok('0039: las versiones neutras quedaron en su lugar', exists (select 1 from public.challenges_catalog where slug = 'reconstruccion-8-semanas' and program::text like '%cuando ya puedes más%') and exists (select 1 from public.program_sessions where focus like '%Llega con energía al cierre.%'));

-- ───────────── 17. Monitoreo (0041): errores sin datos personales, solo admin lee ─────────────
set role anon; select bbtest.login(null);
select bbtest.fails('0041: anon no reporta errores directo', $q$ select public.app_error_report('client', 'TypeError', '/app', 'x', null, null, null, 'k') $q$, '42501');
select bbtest.fails('0041: anon no inserta en app_errors', $q$ insert into public.app_errors (fingerprint, source, kind, route) values ('x', 'client', 'E', '/') $q$, '42501');
select bbtest.ok('0041: anon sí puede hacer el ping de salud', public.health_ping());
reset role;
set role authenticated; select bbtest.login('A');
select bbtest.fails('0041: un usuario no reporta errores directo', $q$ select public.app_error_report('client', 'TypeError', '/app', 'x', null, null, null, 'k') $q$, '42501');
select bbtest.fails('0041: un usuario no inserta en app_errors', $q$ insert into public.app_errors (fingerprint, source, kind, route) values ('x', 'client', 'E', '/') $q$, '42501');
select bbtest.fails('0041: un usuario no escribe ops_heartbeats', $q$ insert into public.ops_heartbeats (name, ok) values ('cron', true) $q$, '42501');
select bbtest.fails('0041: un usuario no ve el resumen', $q$ select * from public.admin_error_summary(24) $q$, '42501');
select bbtest.fails('0041: un usuario no purga', $q$ select public.app_errors_purge(30) $q$, '42501');
reset role;
set role service_role; select bbtest.login(null);
select bbtest.ok('0041: el servidor guarda un error', public.app_error_report('client', 'TypeError', '/app/hoy', 'Falló para ana@correo.com con id 3f2b1c4d-1111-4222-8333-444455556666 y tel 8888-1234', 'abc123', 'deadbee', 'chrome', 'cliente-1'));
select bbtest.ok('0041: el mismo error otra vez', public.app_error_report('client', 'TypeError', '/app/hoy', 'Falló para ana@correo.com con id 3f2b1c4d-1111-4222-8333-444455556666 y tel 8888-1234', null, 'deadbee', 'chrome', 'cliente-1'));
select bbtest.ok('0041: el mismo error suma hits en vez de otra fila', (select count(*) = 1 and sum(hits) = 2 from public.app_errors where route = '/app/hoy'));
select bbtest.ok('0041: la base limpia correo, id y números', (select message from public.app_errors where route = '/app/hoy') !~ '(ana@correo|3f2b1c4d|8888|1234)'
  and (select message from public.app_errors where route = '/app/hoy') like '%[correo]%');
select bbtest.ok('0041: fuente inválida se descarta', not public.app_error_report('hacker', 'E', '/', 'x', null, null, null, 'cliente-1'));
select bbtest.ok('0041: tope por cliente (30 cada 10 min)', (select count(*) filter (where not public.app_error_report('client', 'E', '/tope', 'x' || g, null, null, null, 'cliente-tope')) from generate_series(1, 35) g) = 5);
insert into public.app_errors (fingerprint, source, kind, route, last_at, first_at) values ('viejo', 'server', 'E', '/viejo', now() - interval '40 days', now() - interval '40 days');
select bbtest.ok('0041: la purga borra una fila vieja', public.app_errors_purge(30) = 1);
select bbtest.ok('0041: la purga borra lo de más de 30 días y deja lo reciente', not exists (select 1 from public.app_errors where fingerprint = 'viejo') and exists (select 1 from public.app_errors where route = '/app/hoy'));
insert into public.ops_heartbeats (name, ok, ms) values ('cron:recordatorios', true, 1200) on conflict (name) do update set ok = excluded.ok, ms = excluded.ms, last_at = now();
reset role;
set role service_role; select bbtest.login('A');
select bbtest.fails('0041: con sesión de usuario no reporta', $q$ select public.app_error_report('client', 'E', '/', 'x', null, null, null, 'k') $q$, '42501');
reset role;
set role authenticated; select bbtest.login('A');
select bbtest.ok('0041: un usuario no lee errores ni tareas', bbtest.num($q$ select 1 from public.app_errors $q$) = 0 and bbtest.num($q$ select 1 from public.ops_heartbeats $q$) = 0);
select bbtest.login('P');
select bbtest.ok('0041: soporte no lee errores (solo admin)', bbtest.num($q$ select 1 from public.app_errors $q$) = 0);
select bbtest.login('S');
select bbtest.ok('0041: admin lee errores y tareas', bbtest.num($q$ select 1 from public.app_errors where route = '/app/hoy' $q$) = 1 and bbtest.num($q$ select 1 from public.ops_heartbeats where name = 'cron:recordatorios' $q$) = 1);
select bbtest.ok('0041: admin ve el resumen agrupado', (select hits from public.admin_error_summary(24) where route = '/app/hoy') = 2);
select bbtest.fails('0041: el resumen valida la ventana', $q$ select * from public.admin_error_summary(0) $q$, '22023');
reset role;


-- ───────────── 18. Escala para el lanzamiento (0040) ─────────────
-- 17a. Tope diario global del Coach IA: solo service_role, atómico, corta por preguntas y por tokens.
set role authenticated; select bbtest.login('A');
select bbtest.fails('0040: un usuario no reserva preguntas globales', $q$ select public.ai_budget_take('chat', 100, 0) $q$, '42501');
select bbtest.fails('0040: un usuario no suma tokens', $q$ select public.ai_budget_add('chat', 0, 1, 1, 0, 0) $q$, '42501');
select bbtest.zero('0040: un usuario no lee el uso global', $q$ select * from public.ai_usage_daily $q$);
select bbtest.fails('0040: un usuario no escribe el uso global', $q$ insert into public.ai_usage_daily (day, kind) values (current_date, 'chat') $q$, '42501');
select bbtest.fails('0040: un usuario no corre la limpieza', $q$ select public.purge_housekeeping(10) $q$, '42501');
select bbtest.fails('0040: un usuario no busca cuentas por correo', $q$ select public.auth_user_id_by_email('ana@prueba.test') $q$, '42501');
reset role;
set role anon; select bbtest.login(null);
select bbtest.fails('0040: anon no reserva preguntas globales', $q$ select public.ai_budget_take('chat', 100, 0) $q$, '42501');
select bbtest.fails('0040: anon no busca cuentas por correo', $q$ select public.auth_user_id_by_email('ana@prueba.test') $q$, '42501');
reset role;
-- Un JWT de usuario no puede usarlas aunque el rol de base fuera service_role.
set role service_role; select bbtest.login('A');
select bbtest.fails('0040: con sesión de usuario no reserva', $q$ select public.ai_budget_take('chat', 100, 0) $q$, '42501');
select bbtest.fails('0040: con sesión de usuario no busca correos', $q$ select public.auth_user_id_by_email('ana@prueba.test') $q$, '42501');
reset role;
delete from public.ai_usage_daily;
set role service_role; select bbtest.login(null);
select bbtest.ok('0040: reserva dentro del tope', public.ai_budget_take('feedback', 2, 0) and public.ai_budget_take('feedback', 2, 0));
select bbtest.ok('0040: corta al llegar al tope de preguntas', not public.ai_budget_take('feedback', 2, 0));
select bbtest.ok('0040: el chat tiene su propio contador', public.ai_budget_take('chat', 2, 1000));
select bbtest.ok('0040: tope 0 = apagado', not public.ai_budget_take('chat', 0, 0));
select public.ai_budget_add('chat', 0, 600, 300, 50, 50);
select bbtest.ok('0040: corta al llegar al tope de tokens', not public.ai_budget_take('chat', 100, 1000));
select bbtest.ok('0040: sin tope de tokens sigue contando preguntas', public.ai_budget_take('chat', 100, 0));
select public.ai_budget_add('feedback', -1, 0, 0, 0, 0);
select bbtest.ok('0040: devolver una pregunta abre un lugar', public.ai_budget_take('feedback', 2, 0));
select public.ai_budget_add('feedback', -50, -5, 0, 0, 0);
select bbtest.fails('0040: tipo inválido', $q$ select public.ai_budget_take('otro', 5, 0) $q$, '22023');
reset role;
select bbtest.ok('0040: los conteos nunca bajan de cero ni restan tokens', (select requests = 0 and input_tokens = 0 from public.ai_usage_daily where kind = 'feedback' and day = public.cr_today()));
select bbtest.ok('0040: el uso del chat quedó con sus tokens', (select requests = 2 and input_tokens = 600 and output_tokens = 300 and cache_read_tokens = 50 and cache_write_tokens = 50 from public.ai_usage_daily where kind = 'chat' and day = public.cr_today()));
delete from public.ai_usage_daily;

-- 17b. Limpieza: borra solo lo viejo y por lotes.
insert into public.rate_limits (key, window_start, n) values ('vieja:1', now() - interval '9 days', 1), ('vieja:2', now() - interval '10 days', 1), ('nueva:1', now() - interval '1 hour', 1);
insert into public.notification_log (user_id, kind, local_day) values (bbtest.u('A'), 'purga_vieja', current_date - 200), (bbtest.u('A'), 'purga_nueva', current_date - 3);
insert into public.notifications (user_id, kind, title, read_at, created_at) values
  (bbtest.u('A'), 'purga', 'leida vieja', now() - interval '200 days', now() - interval '200 days'),
  (bbtest.u('A'), 'purga', 'sin leer reciente', null, now() - interval '200 days'),
  (bbtest.u('A'), 'purga', 'sin leer muy vieja', null, now() - interval '400 days');
insert into public.coach_usage (user_id, day, kind, n) values (bbtest.u('A'), current_date - 500, 'chat', 3) on conflict do nothing;
set role service_role; select bbtest.login(null);
select bbtest.ok('0040: la limpieza respeta el lote', (public.purge_housekeeping(1) ->> 'rate_limits')::int = 1);
select bbtest.ok('0040: la limpieza devuelve sus conteos', public.purge_housekeeping(5000) ? 'notifications');
reset role;
select bbtest.ok('0040: ventanas viejas de rate_limits borradas, la actual intacta', not exists (select 1 from public.rate_limits where key like 'vieja:%') and exists (select 1 from public.rate_limits where key = 'nueva:1'));
select bbtest.ok('0040: registro de avisos viejo borrado, el reciente intacto', not exists (select 1 from public.notification_log where kind = 'purga_vieja') and exists (select 1 from public.notification_log where kind = 'purga_nueva'));
select bbtest.ok('0040: avisos leídos viejos y los de más de un año borrados; sin leer de 200 días se queda', (select array_agg(title order by title) = array['sin leer reciente'] from public.notifications where kind = 'purga'));
select bbtest.ok('0040: uso del coach de hace más de 400 días borrado', not exists (select 1 from public.coach_usage where user_id = bbtest.u('A') and day = current_date - 500));
delete from public.rate_limits where key = 'nueva:1';
delete from public.notification_log where kind = 'purga_nueva';
delete from public.notifications where kind = 'purga';

-- 17c. Cuenta por correo.
insert into auth.users (id, email) values ('40404040-0000-4000-8000-000000000040', 'escala@prueba.test') on conflict (id) do nothing;
set role service_role; select bbtest.login(null);
select bbtest.ok('0040: encuentra la cuenta por correo (con espacios y mayúsculas)', public.auth_user_id_by_email('  Escala@Prueba.test ') = '40404040-0000-4000-8000-000000000040');
select bbtest.ok('0040: correo inexistente = null', public.auth_user_id_by_email('nadie@prueba.test') is null);
reset role;

-- 17d. Conteos del feed: mismos números que contar las filas con la RLS de quien mira.
insert into public.posts (user_id, kind, body, visibility) values (bbtest.u('B'), 'text', 'conteo 0040', 'publico');
insert into public.kudos (post_id, user_id) select id, bbtest.u('A') from public.posts where body = 'conteo 0040';
insert into public.kudos (post_id, user_id) select id, bbtest.u('D') from public.posts where body = 'conteo 0040';
insert into public.comments (post_id, user_id, body) select id, bbtest.u('D'), 'visible' from public.posts where body = 'conteo 0040';
insert into public.comments (post_id, user_id, body, hidden) select id, bbtest.u('D'), 'oculto', true from public.posts where body = 'conteo 0040';
select bbtest.ok('0040: feed_counts corre con la RLS de quien mira (security invoker)', (select not prosecdef from pg_proc where proname = 'feed_counts'));
set role authenticated; select bbtest.login('A');
select bbtest.ok('0040: feed_counts cuenta bananas, comentarios visibles y la mía', (select kudos = 2 and comments = 1 and i_kudo from public.feed_counts((select array_agg(id) from public.posts where body = 'conteo 0040'))));
select bbtest.login('D');
select bbtest.ok('0040: feed_counts coincide con contar las filas', (select f.kudos = (select count(*) from public.kudos k where k.post_id = f.post_id) and f.comments = (select count(*) from public.comments c where c.post_id = f.post_id) from public.feed_counts((select array_agg(id) from public.posts where body = 'conteo 0040')) f));
reset role;
set role anon; select bbtest.login(null);
select bbtest.fails('0040: anon no usa feed_counts', $q$ select * from public.feed_counts(array[1::bigint]) $q$, '42501');
reset role;
delete from public.posts where body = 'conteo 0040';

-- 17e. Índices nuevos.
select bbtest.ok('0040: índices de lecturas frecuentes', to_regclass('public.comments_post_created') is not null and to_regclass('public.follows_followee') is not null
  and to_regclass('public.posts_workout') is not null and to_regclass('public.user_challenges_active_id') is not null
  and to_regclass('public.notifications_created') is not null and to_regclass('public.notification_log_local_day') is not null and to_regclass('public.coach_quota_tickets_created') is not null);

-- ───────────── 19. Tilopay (0042): tarjetas de otros países y renovaciones que cobramos nosotros ─────────────
select bbtest.ok('0042: payment_methods acepta onvo y tilopay', pg_get_constraintdef((select oid from pg_constraint where conname = 'payment_methods_provider_ok')) like '%tilopay%');
select bbtest.ok('0042: ya no queda el check viejo de solo onvo', not exists (select 1 from pg_constraint con join pg_class r on r.oid = con.conrelid where r.relname = 'payment_methods' and pg_get_constraintdef(con.oid) ~ 'provider = ''onvo'''));
select bbtest.fails('0042: proveedor desconocido no entra', $q$ insert into public.payment_methods (user_id, provider, provider_customer_id, provider_payment_method_id) values (bbtest.u('A'), 'otro', 'tlp:x', 'tok_x') $q$, '23514');
select bbtest.fails('0042: token de más de 400 caracteres no entra', $q$ insert into public.payment_methods (user_id, provider, provider_customer_id, provider_payment_method_id) values (bbtest.u('A'), 'tilopay', 'tlp:x', repeat('a', 401)) $q$, '23514');
insert into public.payment_methods (user_id, provider, provider_customer_id, provider_payment_method_id, brand, last4) values ('ab000000-0000-4000-8000-0000000000a1', 'tilopay', 'tlp:ab000000-0000-4000-8000-0000000000a1', repeat('t', 300), 'visa', '4242') on conflict (user_id) do update set provider = excluded.provider, provider_payment_method_id = excluded.provider_payment_method_id;
select bbtest.ok('0042: el servidor guarda una tarjeta de Tilopay con token largo', exists (select 1 from public.payment_methods where user_id = 'ab000000-0000-4000-8000-0000000000a1' and provider = 'tilopay' and char_length(provider_payment_method_id) = 300));
delete from public.payment_methods where user_id = 'ab000000-0000-4000-8000-0000000000a1' and provider = 'tilopay';
select bbtest.fails('0042: suscripción con proveedor desconocido no entra', $q$ insert into public.subscriptions (user_id, provider, status) values (bbtest.u('A'), 'otro', 'incomplete') $q$, '23514');
select bbtest.fails('0042: intentos de renovación fuera de rango', $q$ insert into public.subscriptions (user_id, provider, status, renewal_attempts) values (bbtest.u('A'), 'tilopay', 'incomplete', 11) $q$, '23514');
set role authenticated; select bbtest.login('A');
select bbtest.fails('0042: A no se crea una suscripción de Tilopay', $q$ insert into public.subscriptions (user_id, provider, provider_subscription_id, status, plan, billing) values (auth.uid(), 'tilopay', 'tlp:bbc-falsa', 'active', 'completo', 'anual') $q$, '42501');
select bbtest.fails('0042: A no toca los intentos de renovación', $q$ update public.subscriptions set renewal_attempts = 0, next_renewal_attempt_at = null where user_id = auth.uid() $q$, '42501');
select bbtest.fails('0042: A no guarda una tarjeta de Tilopay por la API', $q$ insert into public.payment_methods (user_id, provider, provider_customer_id, provider_payment_method_id) values (auth.uid(), 'tilopay', 'tlp:x', 'tok_falso') $q$, '42501');
reset role;

-- ───────────── 20. Lanzamiento (0045): 7 días más para las cuentas de la beta y huella de tarjeta ─────────────
select bbtest.ok('0045: las cuentas de la beta siguen gratis hasta 7 días después del lanzamiento', public._beta_grace_until() = public._beta_ends_at() + interval '7 days');
select bbtest.ok('0045: _trial_live incluye a las cuentas de la beta hasta _beta_grace_until()', pg_get_functiondef('public._trial_live(uuid)'::regprocedure) like '%_beta_grace_until%');
-- Cuenta de la beta (creada antes del lanzamiento): con acceso mientras no pase _beta_grace_until(); sin acceso después.
insert into auth.users (id, email) values ('acacacac-0000-4000-8000-0000000000ad', 'beta45@prueba.test');
update public.profiles set created_at = public._beta_ends_at() - interval '20 days' where id = 'acacacac-0000-4000-8000-0000000000ad';
select bbtest.ok('0045: cuenta de la beta tiene la app antes de _beta_grace_until()', public._has_app_access('acacacac-0000-4000-8000-0000000000ad')) where now() < public._beta_grace_until();
select bbtest.ok('0045: cuenta de la beta tiene nutrición antes de _beta_grace_until()', public._has_nutrition_access('acacacac-0000-4000-8000-0000000000ad')) where now() < public._beta_grace_until();
select bbtest.ok('0045: cuenta de la beta sin plan no tiene la app desde _beta_grace_until()', not public._has_app_access('acacacac-0000-4000-8000-0000000000ad')) where now() >= public._beta_grace_until();
select bbtest.ok('0045: un regalo para una cuenta de la beta empieza al terminar sus 7 días después del lanzamiento', abs(extract(epoch from public._access_covered_until('acacacac-0000-4000-8000-0000000000ad', 'completo') - public._beta_grace_until())) < 1) where now() < public._beta_grace_until();
-- Cuenta nueva desde el lanzamiento: sus 7 días desde el registro, sin cambios.
update public.profiles set created_at = greatest(now(), public._beta_ends_at()) - interval '1 day' where id = 'acacacac-0000-4000-8000-0000000000ad';
select bbtest.ok('0045: cuenta nueva (después del lanzamiento) sigue con sus 7 días', public._has_app_access('acacacac-0000-4000-8000-0000000000ad')) where now() >= public._beta_ends_at() + interval '1 day';
delete from auth.users where id = 'acacacac-0000-4000-8000-0000000000ad';
-- Cobros de la beta: el servidor programa el cobro para _beta_grace_until(); la migración mueve los que caían antes.
-- Mismo UPDATE de 0045 sobre dos filas de prueba: una normal y una movida por el mes de tester (moved_from).
insert into auth.users (id, email) values ('acacacac-0000-4000-8000-0000000000ae', 'beta45b@prueba.test'), ('acacacac-0000-4000-8000-0000000000af', 'beta45c@prueba.test');
insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_started_at, trial_ends_at, charge_at, next_attempt_at, status, reminder_sent_at)
  values ('acacacac-0000-4000-8000-0000000000ae', 'trial:acacacac-0000-4000-8000-0000000000ae', 'beta', 'entreno', 'mes', 999, public._beta_ends_at() - interval '5 days', public._beta_ends_at(), public._beta_ends_at(), public._beta_ends_at(), 'scheduled', public._beta_ends_at() - interval '2 days');
insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_started_at, trial_ends_at, charge_at, next_attempt_at, status, moved_from)
  values ('acacacac-0000-4000-8000-0000000000af', 'trial:acacacac-0000-4000-8000-0000000000af', 'beta', 'entreno', 'mes', 999, public._beta_ends_at() - interval '5 days', public._beta_ends_at(), public._beta_ends_at() + interval '3 days', public._beta_ends_at() + interval '3 days', 'scheduled', public._beta_ends_at());
update public.trial_charges
   set trial_ends_at = greatest(trial_ends_at, public._beta_grace_until()),
       charge_at = greatest(charge_at, public._beta_grace_until()),
       next_attempt_at = case when next_attempt_at is null then null else greatest(next_attempt_at, public._beta_grace_until()) end,
       reminder_sent_at = case when charge_at < public._beta_grace_until() then null else reminder_sent_at end,
       updated_at = now()
 where user_id in ('acacacac-0000-4000-8000-0000000000ae', 'acacacac-0000-4000-8000-0000000000af') and kind = 'beta'
   and status in ('scheduled', 'retry_scheduled') and (charge_at < public._beta_grace_until() or trial_ends_at < public._beta_grace_until());
select bbtest.ok('0045: el cobro de la beta pasa al 8 de noviembre y el aviso vuelve a salir', exists (select 1 from public.trial_charges where user_id = 'acacacac-0000-4000-8000-0000000000ae' and charge_at = public._beta_grace_until() and trial_ends_at = public._beta_grace_until() and next_attempt_at = public._beta_grace_until() and reminder_sent_at is null));
select bbtest.ok('0045: una fila movida por el mes de tester también queda en el 8 (o después), sin romper el check de fechas', exists (select 1 from public.trial_charges where user_id = 'acacacac-0000-4000-8000-0000000000af' and charge_at >= public._beta_grace_until() and trial_ends_at = public._beta_grace_until()));
delete from auth.users where id in ('acacacac-0000-4000-8000-0000000000ae', 'acacacac-0000-4000-8000-0000000000af');
-- Huellas de tarjeta: solo service_role.
select bbtest.ok('0045: card_fingerprints tiene RLS', (select relrowsecurity from pg_class where oid = 'public.card_fingerprints'::regclass));
select bbtest.ok('0045: nadie lee las huellas por la API', not has_table_privilege('authenticated', 'public.card_fingerprints', 'select') and not has_table_privilege('anon', 'public.card_fingerprints', 'select'));
select bbtest.fails('0045: una huella que no es sha256 no entra', $q$ insert into public.card_fingerprints (key, fingerprint, user_id, provider) values ('xxxxxxxxxx:1', 'abc', null, 'onvo') $q$, '23514');
set role authenticated; select bbtest.login('A');
select bbtest.fails('0045: A no escribe huellas', $q$ insert into public.card_fingerprints (key, fingerprint, user_id, provider) values (repeat('a', 64) || ':' || auth.uid()::text, repeat('a', 64), auth.uid(), 'onvo') $q$, '42501');
-- ───────────── 20. Temporadas deportivas (0048) ─────────────
reset role;
select bbtest.ok('0048: tres temporadas sembradas con su programa y 8 semanas', (select count(*) = 3 from public.seasons s join public.challenges_catalog c on c.slug = s.slug where c.kind = 'programa' and public._program_weeks(c.program) = 8));
select bbtest.ok('0048: precios por deporte', (select bool_and(price_minor = case sport when 'running' then 1499 when 'raquetas' then 1699 else 1899 end) from public.seasons));
select bbtest.fails('0048: una temporada dura 8 semanas exactas', $q$ insert into public.seasons (slug, sport, number, starts_on, ends_on, enroll_until, price_minor) values ('temporada-running-1', 'running', 9, '2027-01-04', '2027-01-31', '2027-01-17', 1499) $q$, '23514');
select bbtest.fails('0048: el canje anual no acepta fuentes inventadas', $q$ insert into public.challenge_entitlements (user_id, challenge_slug, source) values (bbtest.u('A'), 'temporada-running-1', 'regalo') $q$, '23514');
set role anon; select bbtest.login(null);
select bbtest.ok('0048: cualquiera ve las fechas y precios', bbtest.num($q$ select 1 from public.seasons $q$) = 3);
select bbtest.fails('0048: anon no ve cuestionarios', $q$ select 1 from public.season_intake $q$, '42501');
reset role;
set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
select bbtest.fails('0048: F no crea temporadas', $q$ insert into public.seasons (slug, sport, number, starts_on, ends_on, enroll_until, price_minor) values ('temporada-cross-2', 'cross', 2, '2027-01-04', '2027-02-28', '2027-01-17', 1) $q$, '42501');
select bbtest.fails('0048: F no se canjea una temporada', $q$ insert into public.season_redemptions (user_id, slug, sub_id, period_start) values (auth.uid(), 'temporada-running-1', 'x', current_date) $q$, '42501');
select bbtest.fails('0048: F no se otorga la temporada', $q$ insert into public.challenge_entitlements (user_id, challenge_slug, source) values (auth.uid(), 'temporada-running-1', 'anual') $q$, '42501');
select bbtest.fails('0048: sin la temporada no guarda cuestionario', $q$ insert into public.season_intake (user_id, slug, answers) values (auth.uid(), 'temporada-running-1', '{"trainDays":[1]}') $q$, '42501');
select bbtest.fails('0048: sin la temporada no opina', $q$ insert into public.season_feedback (user_id, slug, week, day, exercise_id, liked) values (auth.uid(), 'temporada-running-1', 1, 1, 'rdl', true) $q$, '42501');
select bbtest.fails('0048: sin comprar no empieza la temporada', $q$ select public.program_start('temporada-running-1', current_date, true) $q$, '42501');
select bbtest.fails('0048: F no lee el resumen del panel', $q$ select public.admin_season_stats('temporada-running-1') $q$, '42501');
reset role;
-- El servidor confirma el canje del plan anual de F (monto 0) y una compra de Raquetas.
insert into public.challenge_entitlements (user_id, challenge_slug, source) values ('0f0f0f0f-0000-4000-8000-00000000000f', 'temporada-running-1', 'anual'), ('0f0f0f0f-0000-4000-8000-00000000000f', 'temporada-raquetas-1', 'compra');
insert into public.season_redemptions (user_id, slug, sub_id, period_start) values ('0f0f0f0f-0000-4000-8000-00000000000f', 'temporada-running-1', 'sub-f', '2026-11-01');
select bbtest.fails('0048: un solo canje por periodo anual', $q$ insert into public.season_redemptions (user_id, slug, sub_id, period_start) values ('0f0f0f0f-0000-4000-8000-00000000000f', 'temporada-raquetas-1', 'sub-f', '2026-11-01') $q$, '23505');
select bbtest.fails('0048: la misma temporada no se canjea dos veces', $q$ insert into public.season_redemptions (user_id, slug, sub_id, period_start) values ('0f0f0f0f-0000-4000-8000-00000000000f', 'temporada-running-1', 'sub-f', '2027-11-01') $q$, '23505');
set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
select bbtest.ok('0048: con la temporada guarda su cuestionario', bbtest.affected($q$ insert into public.season_intake (user_id, slug, answers) values (auth.uid(), 'temporada-running-1', '{"trainDays":[0,2,4],"sessions":3}') $q$) = 1);
select bbtest.ok('0048: edita su cuestionario', bbtest.affected($q$ update public.season_intake set answers = '{"trainDays":[0,2]}', from_week = 3 where user_id = auth.uid() and slug = 'temporada-running-1' $q$) = 1);
select bbtest.fails('0048: no guarda el cuestionario de otra persona', $q$ insert into public.season_intake (user_id, slug, answers) values (bbtest.u('A'), 'temporada-running-1', '{}') $q$, '42501');
select bbtest.fails('0048: no guarda un cuestionario gigante', $q$ insert into public.season_intake (user_id, slug, answers) values (auth.uid(), 'temporada-raquetas-1', jsonb_build_object('x', repeat('a', 9000))) $q$, '23514');
select bbtest.ok('0048: opina sobre un ejercicio', bbtest.affected($q$ insert into public.season_feedback (user_id, slug, week, day, exercise_id, liked, difficulty) values (auth.uid(), 'temporada-running-1', 1, 1, 'rdl', true, 'dificil') $q$) = 1);
select bbtest.fails('0048: una opinión por ejercicio y sesión', $q$ insert into public.season_feedback (user_id, slug, week, day, exercise_id, liked) values (auth.uid(), 'temporada-running-1', 1, 1, 'rdl', false) $q$, '23505');
select bbtest.fails('0048: id de ejercicio inválido', $q$ insert into public.season_feedback (user_id, slug, week, day, exercise_id) values (auth.uid(), 'temporada-running-1', 1, 2, 'DROP TABLE') $q$, '23514');
select bbtest.zero('0048: no borra opiniones', $q$ delete from public.season_feedback where user_id = auth.uid() $q$);
select bbtest.ok('0048: empieza la temporada', public.program_start('temporada-running-1', current_date, true) = 'empezado');
select bbtest.ok('0048: con la fecha oficial y sin pausas', (select started_on = '2026-11-09' and paused_days = 0 from public.user_programs where user_id = auth.uid() and slug = 'temporada-running-1'));
select bbtest.ok('0048: solo una activa: empieza la otra', public.program_start('temporada-raquetas-1', current_date, true) = 'empezado');
select bbtest.ok('0048: y la primera queda en pausa', (select status = 'pausado' from public.user_programs where user_id = auth.uid() and slug = 'temporada-running-1'));
select bbtest.ok('0048: vuelve a la primera', public.program_start('temporada-running-1', current_date, true) = 'reanudado');
select bbtest.ok('0048: al volver, la semana sigue el calendario (sin días en pausa)', (select started_on = '2026-11-09' and paused_days = 0 and status = 'activo' from public.user_programs where user_id = auth.uid() and slug = 'temporada-running-1'));
reset role;
update public.user_programs set status = 'completado', completed_at = now() where user_id = '0f0f0f0f-0000-4000-8000-00000000000f' and slug = 'temporada-raquetas-1';
set role authenticated; select bbtest.as_user('0f0f0f0f-0000-4000-8000-00000000000f');
select bbtest.fails('0048: una temporada terminada no se repite', $q$ select public.program_start('temporada-raquetas-1', current_date, true) $q$, 'P0001');
reset role;
set role authenticated; select bbtest.login('A');
select bbtest.ok('0048: A no ve el cuestionario de F', bbtest.num($q$ select 1 from public.season_intake $q$) = 0);
select bbtest.ok('0048: A no ve las opiniones de F', bbtest.num($q$ select 1 from public.season_feedback $q$) = 0);
select bbtest.zero('0048: A no edita el cuestionario de F', $q$ update public.season_intake set from_week = 1 $q$);
select bbtest.ok('0048: A no ve canjes ajenos', bbtest.num($q$ select 1 from public.season_redemptions $q$) = 0);
reset role;
set role authenticated; select bbtest.login('S');
select bbtest.ok('0048: el panel lee el resumen sin identificar a nadie', (select (v->>'owners')::int = 1 and (v->'runs'->>'count')::int >= 0 and jsonb_array_length(v->'feedback') = 1 and jsonb_array_length(v->'intakes') = 1 and not (v::text ~ '0f0f0f0f') from (select public.admin_season_stats('temporada-running-1') v) x));
reset role;

select bbtest.ok('0050: la Temporada 1 trae sus ejercicios originales con animación', exists (select 1 from public.program_sessions where slug = 'temporada-running-1' and phase = 1 and day = 1 and exercises::text like '%ds:0417%'));

-- ───────────── 21. Carreras con GPS (0049) ─────────────
set role authenticated; select bbtest.login('A');
select bbtest.ok('0049: guarda su carrera', bbtest.affected($q$ insert into public.runs (client_id, day, started_at, ended_at, distance_m, moving_s, pace_s_km, splits, track) values ('11111111-2222-4333-8444-555555555555', current_date, now() - interval '40 minutes', now() - interval '10 minutes', 5000, 1500, 300, '[{"km":1,"seconds":300}]', '[]') $q$) = 1);
select bbtest.fails('0049: el mismo id de carrera no se duplica', $q$ insert into public.runs (client_id, day, started_at, ended_at, distance_m, moving_s) values ('11111111-2222-4333-8444-555555555555', current_date, now() - interval '40 minutes', now() - interval '10 minutes', 5000, 1500) $q$, '23505');
select bbtest.fails('0049: no guarda una carrera a 40 km/h', $q$ insert into public.runs (client_id, day, started_at, ended_at, distance_m, moving_s) values (gen_random_uuid(), current_date, now() - interval '30 minutes', now(), 20000, 1800) $q$, '23514');
select bbtest.fails('0049: no guarda una carrera de más de 24 horas', $q$ insert into public.runs (client_id, day, started_at, ended_at, distance_m, moving_s) values (gen_random_uuid(), current_date, now() - interval '30 hours', now(), 20000, 9000) $q$, '23514');
select bbtest.fails('0049: no guarda carreras de otra persona', $q$ insert into public.runs (user_id, client_id, day, started_at, ended_at, distance_m, moving_s) values (bbtest.u('B'), gen_random_uuid(), current_date, now() - interval '30 minutes', now(), 5000, 1500) $q$, '42501');
select bbtest.zero('0049: no edita sus carreras', $q$ update public.runs set distance_m = 9000 $q$);
reset role;
set role authenticated; select bbtest.login('B');
select bbtest.ok('0049: B no ve las carreras de A', bbtest.num($q$ select 1 from public.runs $q$) = 0);
select bbtest.zero('0049: B no borra las carreras de A', $q$ delete from public.runs $q$);
reset role;
set role authenticated; select bbtest.login('S');
select bbtest.ok('0049: ni el staff ve recorridos ajenos', bbtest.num($q$ select 1 from public.runs $q$) = 0);
reset role;
set role authenticated; select bbtest.login('E');
select bbtest.fails('0049: sin plan ni prueba no guarda carreras', $q$ insert into public.runs (client_id, day, started_at, ended_at, distance_m, moving_s) values (gen_random_uuid(), current_date, now() - interval '30 minutes', now(), 5000, 1500) $q$, '42501') where not (select public.has_app_access());
reset role;
set role authenticated; select bbtest.login('A');
select bbtest.ok('0049: borra su carrera', bbtest.affected($q$ delete from public.runs where client_id = '11111111-2222-4333-8444-555555555555' $q$) = 1);
reset role;

-- ───────────── 0046 LinkApp instalada ─────────────
set role authenticated; select bbtest.login('A');
select public.app_mark_installed();
select bbtest.ok('0046: A marca su app como instalada', (select app_installed_at is not null and app_last_standalone_at is not null from public.profiles where id = auth.uid()));
update public.profiles set app_installed_at = '2020-01-01' where id = auth.uid();
select bbtest.ok('0046: A no puede inventar la fecha de instalación', (select app_installed_at > '2025-01-01' from public.profiles where id = auth.uid()));
reset role;
select bbtest.ok('0046: marcar A no toca a B', (select app_installed_at is null from public.profiles where id = bbtest.u('B')));
set role anon;
select bbtest.fails('0046: sin sesión no se marca', $q$ select public.app_mark_installed() $q$, '42501');
reset role;

-- ───────────── 21. Primeros pasos (0047) ─────────────
set role authenticated; select bbtest.login('A');
select public.learn_mark('pp-semana');
select public.learn_mark('pp-semana');
select bbtest.ok('0047: A marca su paso una sola vez', (select learn_keys = array['pp-semana'] from public.profiles where id = bbtest.u('A')));
select bbtest.fails('0047: una clave mal formada no entra', $q$ select public.learn_mark('Pp Semana!') $q$, '22023');
select bbtest.login(null);
select bbtest.fails('0047: sin sesión no se marca nada', $q$ select public.learn_mark('pp-semana') $q$, '42501');
reset role;
select bbtest.ok('0047: A no marca pasos de B', (select learn_keys = '{}' from public.profiles where id = bbtest.u('B')));
select bbtest.ok('0047: anon no ejecuta learn_mark', not has_function_privilege('anon', 'public.learn_mark(text)', 'execute'));
update public.profiles set learn_keys = (select array_agg('k' || g) from generate_series(1, 64) g) where id = bbtest.u('A');
set role authenticated; select bbtest.login('A');
select public.learn_mark('extra');
select bbtest.ok('0047: tope de 64 claves', (select cardinality(learn_keys) = 64 from public.profiles where id = bbtest.u('A')));
reset role;
update public.profiles set learn_keys = '{}' where id = bbtest.u('A');

-- ───────────── 0051 Referidores ─────────────
reset role;
select bbtest.login(null);
insert into public.affiliates (user_id, code) values (bbtest.u('A'), 'ana-fit');
insert into auth.users (id, email, raw_user_meta_data) values ('5a5a5a5a-0000-4000-8000-00000000005a', 'referida@prueba.test', '{"full_name":"Lucía Pérez"}');
select bbtest.ok('0051: atribuye una cuenta nueva al código', public.affiliate_attribute('5a5a5a5a-0000-4000-8000-00000000005a', 'ANA-FIT', '{"utm_source":"ig"}', now()) = 'atribuida');
select bbtest.ok('0051: una sola atribución por cuenta', public.affiliate_attribute('5a5a5a5a-0000-4000-8000-00000000005a', 'ana-fit') = 'ya_atribuida');
select bbtest.ok('0051: no se refiere a sí mismo', public.affiliate_attribute(bbtest.u('A'), 'ana-fit') = 'propio');
select bbtest.ok('0051: código inexistente', public.affiliate_attribute(bbtest.u('B'), 'no-existe') = 'codigo_invalido');
update auth.users set created_at = now() - interval '10 days' where id = bbtest.u('D');
select bbtest.ok('0051: una cuenta vieja no se atribuye', public.affiliate_attribute(bbtest.u('D'), 'ana-fit') = 'cuenta_existente');
select bbtest.fails('0051: no se puede referir a uno mismo ni con insert directo', $q$ insert into public.affiliate_referrals (user_id, affiliate_id) values ('a1a1a1a1-0000-4000-8000-0000000000a1', 'a1a1a1a1-0000-4000-8000-0000000000a1') $q$, '23514');
insert into public.affiliate_commissions (affiliate_id, referred_user, payment_ref, provider, gross_minor, net_minor, rate_pct, commission_minor)
  values (bbtest.u('A'), '5a5a5a5a-0000-4000-8000-00000000005a', 'onvo:pay_sql_1', 'onvo', 999, 810, 10, 81);
select bbtest.fails('0051: una comisión por pago (payment_ref único)', $q$ insert into public.affiliate_commissions (affiliate_id, payment_ref, commission_minor) values ('a1a1a1a1-0000-4000-8000-0000000000a1', 'onvo:pay_sql_1', 81) $q$, '23505');
select bbtest.fails('0051: un pago no genera comisión negativa', $q$ insert into public.affiliate_commissions (affiliate_id, payment_ref, kind, commission_minor) values ('a1a1a1a1-0000-4000-8000-0000000000a1', 'onvo:neg', 'pago', -5) $q$, '23514');
select bbtest.ok('0051: anon y authenticated no atribuyen', not has_function_privilege('authenticated', 'public.affiliate_attribute(uuid,text,jsonb,timestamp with time zone)', 'execute') and not has_function_privilege('anon', 'public.affiliate_attribute(uuid,text,jsonb,timestamp with time zone)', 'execute'));
select bbtest.ok('0051: anon no lee estadísticas de referidor', not has_function_privilege('anon', 'public.my_affiliate_stats()', 'execute'));
select bbtest.ok('0051: authenticated no cuenta activos de otros', not has_function_privilege('authenticated', 'public.affiliate_active_count(uuid)', 'execute'));

set role authenticated; select bbtest.login('A');
select bbtest.ok('0051: A ve su fila de referidor', bbtest.num($q$ select 1 from public.affiliates $q$) = 1);
select bbtest.zero('0051: A no cambia su código ni se reactiva', $q$ update public.affiliates set code = 'otro', active = true $q$);
select bbtest.fails('0051: A no se asigna otro referidor', $q$ insert into public.affiliates (user_id, code) values ('b2b2b2b2-0000-4000-8000-0000000000b2', 'beto') $q$, '42501');
select bbtest.ok('0051: A ve su comisión', bbtest.num($q$ select 1 from public.affiliate_commissions $q$) = 1);
select bbtest.fails('0051: A no se anota comisiones', $q$ insert into public.affiliate_commissions (affiliate_id, payment_ref, commission_minor) values ('a1a1a1a1-0000-4000-8000-0000000000a1', 'x:1', 999) $q$, '42501');
select bbtest.zero('0051: A no marca su comisión como disponible', $q$ update public.affiliate_commissions set status = 'available' $q$);
select bbtest.ok('0051: A no ve la tabla de atribuciones (correos ni ids)', bbtest.num($q$ select 1 from public.affiliate_referrals $q$) = 0);
select bbtest.zero('0051: A no cambia atribuciones', $q$ update public.affiliate_referrals set affiliate_id = auth.uid() $q$);
select bbtest.ok('0051: A ve a su referida anonimizada', (select count(*) = 1 and bool_and(label = 'Lucía P.') from public.my_affiliate_referrals()));
select bbtest.ok('0051: A ve sus registros', (public.my_affiliate_stats() ->> 'signups_total')::int = 1);
select bbtest.ok('0051: A lee los ajustes del programa', bbtest.num($q$ select 1 from public.affiliate_settings $q$) = 1);
select bbtest.zero('0051: A no cambia los ajustes', $q$ update public.affiliate_settings set tax_pct = 0 $q$);
select bbtest.ok('0051: A guarda su método de pago', bbtest.affected($q$ insert into public.affiliate_payout_methods (user_id, kind, sinpe_phone, holder_name) values (auth.uid(), 'sinpe', '88884821', 'Ana Test') $q$) = 1);
select bbtest.fails('0051: SINPE de 8 dígitos', $q$ update public.affiliate_payout_methods set sinpe_phone = '123' $q$, '23514');
select bbtest.zero('0051: A no se crea pagos', $q$ update public.affiliate_payouts set status = 'pagado' $q$);
reset role;

set role authenticated; select bbtest.login('B');
select bbtest.ok('0051: B no ve referidores', bbtest.num($q$ select 1 from public.affiliates $q$) = 0);
select bbtest.ok('0051: B no ve comisiones de A', bbtest.num($q$ select 1 from public.affiliate_commissions $q$) = 0);
select bbtest.ok('0051: B no ve el método de pago de A', bbtest.num($q$ select 1 from public.affiliate_payout_methods $q$) = 0);
select bbtest.fails('0051: B no guarda método de pago sin ser referidor', $q$ insert into public.affiliate_payout_methods (user_id, kind, sinpe_phone, holder_name) values (auth.uid(), 'sinpe', '88880000', 'Beto') $q$, '42501');
select bbtest.zero('0051: B no borra el método de A', $q$ delete from public.affiliate_payout_methods $q$);
select bbtest.ok('0051: B no ve ajustes ni invitaciones', bbtest.num($q$ select 1 from public.affiliate_settings $q$) = 0 and bbtest.num($q$ select 1 from public.affiliate_invites $q$) = 0);
select bbtest.ok('0051: B no tiene estadísticas de referidor', public.my_affiliate_stats() is null);
select bbtest.ok('0051: B no ve referidos de nadie', (select count(*) = 0 from public.my_affiliate_referrals()));
select bbtest.fails('0051: B no lee clics', $q$ select 1 from public.affiliate_clicks $q$, '42501');
reset role;
delete from public.affiliate_payout_methods; delete from public.affiliate_commissions; delete from public.affiliate_referrals; delete from public.affiliates;
delete from auth.users where id = '5a5a5a5a-0000-4000-8000-00000000005a';

-- ───────────── 22. Solicitudes de condominios (0052): solo el staff de soporte lee, nadie escribe por la API ─────────────
reset role;
select bbtest.login(null);
insert into public.b2b_leads (name, role, org_name, email) values ('Prueba Admin', 'administrador', 'Condominio Prueba', 'admin@condo.test');
select bbtest.fails('0052: correo inválido no entra', $q$ insert into public.b2b_leads (name, role, org_name, email) values ('X Y', 'otro', 'Condo', 'no-es-correo') $q$, '23514');
select bbtest.fails('0052: cargo fuera de la lista no entra', $q$ insert into public.b2b_leads (name, role, org_name, email) values ('X Y', 'dueño', 'Condo', 'a@b.co') $q$, '23514');
set role anon; select bbtest.login(null);
select bbtest.fails('0052: anon no lee solicitudes', $q$ select 1 from public.b2b_leads $q$, '42501');
select bbtest.fails('0052: anon no crea solicitudes por la API', $q$ insert into public.b2b_leads (name, role, org_name, email) values ('Bot Bot', 'otro', 'Spam', 'bot@spam.co') $q$, '42501');
reset role;
set role authenticated; select bbtest.login('A');
select bbtest.ok('0052: una cuenta normal no ve solicitudes', bbtest.num($q$ select 1 from public.b2b_leads $q$) = 0);
select bbtest.fails('0052: una cuenta normal no crea solicitudes', $q$ insert into public.b2b_leads (name, role, org_name, email) values ('Ana A', 'otro', 'Condo', 'ana@x.co') $q$, '42501');
select bbtest.zero('0052: una cuenta normal no cambia solicitudes', $q$ update public.b2b_leads set status = 'cerrado' $q$);
reset role;
set role authenticated; select bbtest.login('P');
select bbtest.ok('0052: soporte ve las solicitudes', bbtest.num($q$ select 1 from public.b2b_leads $q$) = 1);
select bbtest.zero('0052: soporte no las cambia por la API (lo hace el servidor)', $q$ update public.b2b_leads set status = 'cerrado' $q$);
reset role;
delete from public.b2b_leads;

-- ───────────── 23. Condominios afiliados (0053): cada residente ve solo su vínculo, nadie escribe por la API ─────────────
reset role;
select bbtest.login(null);
insert into public.condos (code, name, notes) values ('condo-uno', 'Condominio Uno', 'nota interna'), ('condo-dos', 'Condominio Dos', null);
select bbtest.fails('0053: código con mayúsculas o espacios no entra', $q$ insert into public.condos (code, name) values ('Condo Uno', 'X Y') $q$, '23514');
select bbtest.fails('0053: activo sin plan ni fecha no entra', $q$ insert into public.condos (code, name, status) values ('condo-tres', 'Tres', 'activo') $q$, '23514');
insert into public.comp_grants (user_id, plan, starts_at, expires_at, source) values (bbtest.u('A'), 'completo', now(), now() + interval '30 days', 'condominio');
select bbtest.fails('0053: una sola cortesía de condominio por cuenta', $q$ insert into public.comp_grants (user_id, plan, starts_at, expires_at, source) values (bbtest.u('A'), 'completo', now(), now() + interval '30 days', 'condominio') $q$, '23505');
insert into public.condo_members (condo_id, user_id, grant_id) select c.id, bbtest.u('A'), (select g.id from public.comp_grants g where g.user_id = bbtest.u('A') and g.source = 'condominio') from public.condos c where c.code = 'condo-uno';
insert into public.condo_members (condo_id, user_id) select c.id, bbtest.u('B') from public.condos c where c.code = 'condo-dos';
select bbtest.fails('0053: una cuenta en un solo condominio', $q$ insert into public.condo_members (condo_id, user_id) select c.id, bbtest.u('A') from public.condos c where c.code = 'condo-dos' $q$, '23505');
set role authenticated; select bbtest.login('A');
select bbtest.ok('0053: el residente ve solo su vínculo', bbtest.num($q$ select 1 from public.condo_members $q$) = 1);
select bbtest.ok('0053: el residente ve solo su condominio', bbtest.num($q$ select 1 from public.condos $q$) = 1 and bbtest.num($q$ select 1 from public.condos where code = 'condo-dos' $q$) = 0);
select bbtest.fails('0053: el residente no lee las notas internas', $q$ select notes from public.condos $q$, '42501');
select bbtest.fails('0053: el residente no se vincula por la API', $q$ insert into public.condo_members (condo_id, user_id) select id, auth.uid() from public.condos $q$, '42501');
select bbtest.zero('0053: el residente no cambia su condominio', $q$ update public.condos set status = 'terminado' $q$);
select bbtest.zero('0053: el residente no borra su vínculo', $q$ delete from public.condo_members $q$);
select bbtest.fails('0053: el residente no se regala otra cortesía', $q$ insert into public.comp_grants (user_id, plan, starts_at, expires_at, source) values (auth.uid(), 'completo', now(), now() + interval '1 year', 'condominio') $q$, '42501');
reset role;
set role authenticated; select bbtest.login('D');
select bbtest.ok('0053: una cuenta sin condominio no ve ninguno ni ve residentes', bbtest.num($q$ select 1 from public.condos $q$) = 0 and bbtest.num($q$ select 1 from public.condo_members $q$) = 0);
reset role;
set role anon; select bbtest.login(null);
select bbtest.fails('0053: anon no lee condominios', $q$ select 1 from public.condos $q$, '42501');
reset role;
set role authenticated; select bbtest.login('P');
select bbtest.ok('0053: soporte ve condominios y residentes', bbtest.num($q$ select 1 from public.condos $q$) = 2 and bbtest.num($q$ select 1 from public.condo_members $q$) = 2);
select bbtest.zero('0053: soporte no cambia condominios por la API (lo hace el servidor)', $q$ update public.condos set status = 'terminado' $q$);
reset role;
delete from public.condo_members; delete from public.condos; delete from public.comp_grants where source = 'condominio';

-- ───────────── 0054 Carrera objetivo ─────────────
set role authenticated; select bbtest.login('A');
select bbtest.ok('0054: guarda su carrera objetivo', bbtest.affected($q$ insert into public.race_goals (name, race_date, kind, distance_m, goal_s, recent_distance_m, recent_s) values ('Medio de prueba', current_date + 60, '21k', 21097, 6600, 10000, 3000) $q$) = 1);
select bbtest.ok('0054: edita su carrera objetivo', bbtest.affected($q$ update public.race_goals set goal_s = 6900, hard_days = '{1,3}' $q$) = 1);
select bbtest.fails('0054: una sola carrera objetivo por persona', $q$ insert into public.race_goals (race_date, kind, distance_m) values (current_date + 30, '10k', 10000) $q$, '23505');
select bbtest.fails('0054: no acepta días inválidos', $q$ update public.race_goals set hard_days = '{8}' $q$, '23514');
select bbtest.fails('0054: no acepta una carrera de hace meses', $q$ update public.race_goals set race_date = current_date - 90 $q$, '23514');
select bbtest.fails('0054: no guarda la carrera de otra persona', $q$ insert into public.race_goals (user_id, race_date, kind, distance_m) values (bbtest.u('B'), current_date + 30, '10k', 10000) $q$, '42501');
reset role;
set role authenticated; select bbtest.login('B');
select bbtest.ok('0054: B no ve la carrera de A', bbtest.num($q$ select 1 from public.race_goals $q$) = 0);
select bbtest.zero('0054: B no edita la carrera de A', $q$ update public.race_goals set goal_s = 7000 $q$);
select bbtest.zero('0054: B no borra la carrera de A', $q$ delete from public.race_goals $q$);
reset role;
set role authenticated; select bbtest.login('E');
select bbtest.fails('0054: sin plan ni prueba no guarda carrera objetivo', $q$ insert into public.race_goals (race_date, kind, distance_m) values (current_date + 30, '10k', 10000) $q$, '42501') where not (select public.has_app_access());
reset role;
set role anon; select bbtest.login(null);
select bbtest.fails('0054: anon no lee carreras objetivo', $q$ select 1 from public.race_goals $q$, '42501');
reset role;
set role authenticated; select bbtest.login('A');
select bbtest.ok('0054: borra su carrera objetivo', bbtest.affected($q$ delete from public.race_goals $q$) = 1);
reset role;

-- ───────────── Resumen ─────────────
select bbtest.ok('aislamiento: ninguna fila de B quedó modificada por A', (select count(*) = 1 from public.weights where user_id = bbtest.u('B')));
do $$
declare total int; bad int;
begin
  select count(*), count(*) filter (where not pass) into total, bad from bbtest.results;
  raise notice 'RESUMEN % verificaciones, % fallas', total, bad;
  if bad > 0 then raise exception 'Fallaron % verificaciones', bad; end if;
end $$;
