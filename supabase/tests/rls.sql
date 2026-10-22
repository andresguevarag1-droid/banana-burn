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
reset role;

-- ───────────── 0012_seguridad ─────────────
insert into auth.users (id,email) values ('00000000-0000-0000-0000-00000000000e','e@x'),('00000000-0000-0000-0000-00000000000f','f@x');
update profiles set role='support' where id='00000000-0000-0000-0000-00000000000e';
update profiles set role='admin' where id='00000000-0000-0000-0000-00000000000f';
insert into coach_messages (user_id, role, content) values ('00000000-0000-0000-0000-00000000000a','user','hola coach');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
\echo T21 A no puede des-ocultar su post moderado (debe ERROR):
update posts set hidden=false where user_id='00000000-0000-0000-0000-00000000000a';
\echo T22 A sí puede editar el texto de su post (debe 1):
with u as (update posts set body='editado' where user_id='00000000-0000-0000-0000-00000000000a' returning 1) select count(*) from u;
\echo T23 A no puede insertar XP inflado (debe ERROR):
insert into xp_events (user_id, kind, xp) values ('00000000-0000-0000-0000-00000000000a','workout',999999);
\echo T24 A no puede inventar tipos de XP (debe ERROR):
insert into xp_events (user_id, kind, xp) values ('00000000-0000-0000-0000-00000000000a','hack',10);
\echo T25 A no puede editar ni borrar XP (debe ERROR x2):
update xp_events set xp=5000 where user_id='00000000-0000-0000-0000-00000000000a';
delete from xp_events where user_id='00000000-0000-0000-0000-00000000000a';
\echo T26 tope diario de XP: de 4 entrenos de 430 XP pasan 3 (debe 3):
do $$ declare ok int := 0; begin for i in 1..4 loop begin insert into xp_events (user_id, kind, xp) values (auth.uid(),'workout',430); ok := ok + 1; exception when others then null; end; end loop; raise notice 'insertados=%', ok; end $$;
\echo T27 push a un endpoint arbitrario (debe ERROR):
insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-00000000000a','https://169.254.169.254.nip.io/x','k','a');
\echo T28 push a FCM (debe INSERT):
insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-00000000000a','https://fcm.googleapis.com/fcm/send/abc','k','a');
\echo T29 A no puede registrar una foto en la carpeta de B (debe ERROR):
insert into progress_photos (user_id, path) values ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b/x.jpg');
\echo T30 A no puede usar ../ en la ruta (debe ERROR):
insert into progress_photos (user_id, path) values ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000a/../00000000-0000-0000-0000-00000000000b/x.jpg');
\echo T31 cupo del coach: 41 llamadas, la última devuelve -1 (debe -1):
select min(r) from (select coach_consume('chat') r from generate_series(1,41)) x;
\echo T32 A no puede resetear su cupo (debe ERROR x2):
update coach_usage set n=0;
delete from coach_usage;
\echo T33 A no puede crear avisos con enlace externo (debe ERROR):
insert into notifications (user_id, kind, title, url) values ('00000000-0000-0000-0000-00000000000a','test','x','https://evil.example');
\echo T34 límite de frecuencia: de 25 posts nuevos pasan menos de 20 (debe <=19):
do $$ declare ok int := 0; begin for i in 1..25 loop begin insert into posts (user_id, kind, data) values (auth.uid(),'text','{}'); ok := ok + 1; exception when others then null; end; end loop; raise notice 'insertados=%', ok; end $$;
\echo T35 reporte con status oculto queda abierto (debe abierto):
insert into reports (target_type, target_id, reporter, reason, status) values ('user','x','00000000-0000-0000-0000-00000000000a','spam','oculto');
select status from reports where reporter='00000000-0000-0000-0000-00000000000a';
\echo T36 comentario insertado como oculto queda visible (debe f):
insert into comments (post_id, user_id, body, hidden) select id, auth.uid(), 'hola', true from posts where user_id=auth.uid() and kind='text' limit 1;
select bool_or(hidden) from comments where user_id=auth.uid();
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000f'); set role authenticated;
\echo T37 admin no puede volverse superadmin por REST (debe ERROR):
update profiles set role='superadmin' where id='00000000-0000-0000-0000-00000000000f';
\echo T38 admin no puede cambiar el plan por REST (debe ERROR):
update profiles set plan='completo' where id='00000000-0000-0000-0000-00000000000a';
\echo T39 admin sí puede regalar cortesía por RPC (debe numero):
select admin_grant_comp('00000000-0000-0000-0000-00000000000a','completo', now() + interval '30 days','prueba');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000e'); set role authenticated;
\echo T40 soporte no lee pesos ni chats del coach (debe 0 0):
select (select count(*) from weights), (select count(*) from coach_messages);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); set role authenticated;
\echo T41 coach lee pesos de A pero no sus chats (debe 1 0):
select (select count(*) from weights where user_id='00000000-0000-0000-0000-00000000000a'), (select count(*) from coach_messages);
\echo T42 coach no puede reescribir el post de A (debe ERROR):
update posts set body='hackeado' where user_id='00000000-0000-0000-0000-00000000000a';
\echo T43 coach sí puede ocultar el post de A (debe >=1):
with u as (update posts set hidden=true where user_id='00000000-0000-0000-0000-00000000000a' and kind='text' returning 1) select count(*) from u;
reset role;

\echo T44 anon no lee public_profiles ni ranking (debe ERROR x2):
select pg_temp.as_user(''); set role anon;
select count(*) from public_profiles;
select * from weekly_leaderboard();
reset role;

\echo T45 ranking excluye seguidos que no comparten entrenos (debe solo ana):
update profiles set share_workouts=false where id='00000000-0000-0000-0000-00000000000b';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
insert into follows values ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b');
select string_agg(username, ',') from weekly_leaderboard();
reset role;

\echo T46 se puede borrar una cuenta de staff con auditoría (debe DELETE 1):
delete from auth.users where id='00000000-0000-0000-0000-00000000000f';
\echo T47 bucket progreso privado con límites (debe f 8388608):
select public, file_size_limit from storage.buckets where id='progreso';
