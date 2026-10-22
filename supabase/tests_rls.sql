\set ON_ERROR_STOP 0
insert into auth.users (id,email) values ('00000000-0000-0000-0000-00000000000a','a@x'),('00000000-0000-0000-0000-00000000000b','b@x'),('00000000-0000-0000-0000-00000000000c','c@x'),('00000000-0000-0000-0000-00000000000d','d@x');
update profiles set role='superadmin' where id='00000000-0000-0000-0000-00000000000c';
update profiles set username='ana', visibility='seguidores' where id='00000000-0000-0000-0000-00000000000a';
update profiles set username='beto', visibility='publico' where id='00000000-0000-0000-0000-00000000000b';
update profiles set username='dani', visibility='privado' where id='00000000-0000-0000-0000-00000000000d';
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); perform set_config('request.jwt.claim.role','authenticated', false); end $$;
-- A data
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
insert into weights (user_id, day, kg) values ('00000000-0000-0000-0000-00000000000a', current_date, 90);
insert into posts (user_id, kind, data, visibility) values ('00000000-0000-0000-0000-00000000000a','workout','{}','seguidores');
\echo T1 A no puede subirse de plan (debe ERROR):
update profiles set plan='completo' where id='00000000-0000-0000-0000-00000000000a';
\echo T2 A no puede escribir pesos de B (debe ERROR):
insert into weights (user_id, day, kg) values ('00000000-0000-0000-0000-00000000000b', current_date, 80);
\echo T3 A no puede seguir a D privado (debe ERROR):
insert into follows values ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000d');
reset role;
-- B
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); set role authenticated;
\echo T4 B ve pesos de A (debe 0):
select count(*) from weights where user_id='00000000-0000-0000-0000-00000000000a';
\echo T5 B ve post 'seguidores' de A sin seguir (debe 0):
select count(*) from posts where user_id='00000000-0000-0000-0000-00000000000a';
\echo T6 B da kudo a post invisible (debe ERROR):
insert into kudos select id, '00000000-0000-0000-0000-00000000000b' from posts where true limit 1;
reset role;
-- A follows B? need B follows A
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); set role authenticated;
insert into follows values ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000a');
\echo T7 B (seguidor) ve post de A (debe 1):
select count(*) from posts where user_id='00000000-0000-0000-0000-00000000000a';
insert into comments (post_id, user_id, body) select id, '00000000-0000-0000-0000-00000000000b', 'pura vida' from posts limit 1;
\echo T8 public_profiles no muestra privados (debe 2: ana, beto):
select string_agg(username, ',') from public_profiles;
\echo T9 B reporta el post:
insert into reports (target_type, target_id, reporter, reason) select 'post', id::text, '00000000-0000-0000-0000-00000000000b', 'spam' from posts limit 1;
reset role;
-- admin oculta
update reports set status='oculto';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); set role authenticated;
\echo T10 tras moderación B ya no ve el post (debe 0):
select count(*) from posts where user_id='00000000-0000-0000-0000-00000000000a';
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
\echo T11 A (autor) sigue viendo su post oculto (debe 1):
select count(*) from posts;
\echo T12 A no puede subir foto a carpeta de B (debe ERROR):
insert into storage.objects (bucket_id, name) values ('progreso', '00000000-0000-0000-0000-00000000000b/x.jpg');
\echo T13 A sí puede en su carpeta (debe INSERT):
insert into storage.objects (bucket_id, name) values ('progreso', '00000000-0000-0000-0000-00000000000a/x.jpg');
\echo T14 A no ve audit_log (debe 0):
select count(*) from audit_log;
\echo T15 A no puede insertar subscriptions (debe ERROR):
insert into subscriptions (user_id, status) values ('00000000-0000-0000-0000-00000000000a','active');
\echo T16 A llama admin_set_role (debe ERROR):
select admin_set_role('00000000-0000-0000-0000-00000000000a','superadmin');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c'); set role authenticated;
\echo T17 superadmin ve el post oculto (debe 1):
select count(*) from posts;
\echo T18 superadmin cambia rol (debe ok):
select admin_set_role('00000000-0000-0000-0000-00000000000b','coach', 'prueba');
reset role;
\echo T19 audit_log registrado (>=1):
select count(*) from audit_log;
\echo T20 ranking para A:
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select username, workouts, xp from weekly_leaderboard();
