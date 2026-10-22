-- Banana Burn · comunidad "La tropa" (0019): tipos de publicación, ranking por alcance, Descubrir, niveles y perfil.
-- Corre DESPUÉS de multiusuario.sql en la misma BD (reusa el esquema bbtest y sus usuarios A, B, D, E):
--   psql -d bb -X -q -f supabase/tests/multiusuario.sql && psql -d bb -X -q -f supabase/tests/comunidad.sql 2>&1 | grep -E 'FAIL|RESUMEN'
\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
delete from bbtest.results;

-- Datos: país y objetivo; D (público) entrena esta semana; A sigue a B.
update public.profiles set country = 'CR', goal_type = 'grasa'  where id = bbtest.u('A');
update public.profiles set country = 'CR', goal_type = 'grasa', visibility = 'publico', share_workouts = true where id = bbtest.u('B');
update public.profiles set country = 'MX', goal_type = 'fuerza', visibility = 'publico', share_workouts = true where id = bbtest.u('D');
update public.profiles set visibility = 'publico', share_workouts = false where id = bbtest.u('E');
insert into public.xp_events (user_id, kind, xp) values (bbtest.u('D'), 'workout', 120), (bbtest.u('B'), 'workout', 80);
insert into public.workouts (user_id, day, template, started_at) values (bbtest.u('D'), current_date, 'torso', now() - interval '1 hour');

-- ───────────── Tipos de publicación ─────────────
set role authenticated; select bbtest.login('D');
insert into public.posts (user_id, kind, body, data) values (auth.uid(), 'text', 'pregunta con tag', '{"tag":"pregunta","prs":["falso"],"volume":999}');
select bbtest.ok('texto: solo se conserva la etiqueta', (select data = '{"tag":"pregunta"}'::jsonb from public.posts where body = 'pregunta con tag'));
insert into public.posts (user_id, kind, body, data) values (auth.uid(), 'text', 'tag inventado', '{"tag":"record_mundial"}');
select bbtest.ok('texto: etiqueta no permitida se descarta', (select data = '{}'::jsonb from public.posts where body = 'tag inventado'));
insert into public.posts (user_id, kind, body, data) values (auth.uid(), 'text', 'tag no objeto', '["tag"]');
select bbtest.ok('texto: data que no es objeto se vacía', (select data = '{}'::jsonb from public.posts where body = 'tag no objeto'));
select bbtest.fails('sigue sin poder publicar un récord falso', $q$ insert into public.posts (user_id, kind, data) values (auth.uid(), 'pr', '{"tag":"logro"}') $q$, '42501');
select bbtest.fails('no cambia la etiqueta después', $q$ update public.posts set data = '{"tag":"logro"}' where body = 'pregunta con tag' $q$, '42501');
reset role;

-- ───────────── Ranking por alcance ─────────────
set role authenticated; select bbtest.login('A');
select bbtest.ok('ranking global: incluye a D (público y comparte)', bbtest.num($q$ select 1 from public.community_board('global') where username = 'dani' $q$) = 1);
select bbtest.ok('ranking global: excluye a E (no comparte entrenos)', bbtest.num($q$ select 1 from public.community_board('global') where username = 'eli' $q$) = 0);
select bbtest.ok('ranking global: siempre estás tú', bbtest.num($q$ select 1 from public.community_board('global') where user_id = auth.uid() $q$) = 1);
select bbtest.ok('ranking país: B (CR) sí, D (MX) no', bbtest.num($q$ select 1 from public.community_board('pais') where username = 'beto' $q$) = 1
  and bbtest.num($q$ select 1 from public.community_board('pais') where username = 'dani' $q$) = 0);
select bbtest.ok('ranking siguiendo: B (lo sigues) sí, D no', bbtest.num($q$ select 1 from public.community_board('siguiendo') where username = 'beto' $q$) = 1
  and bbtest.num($q$ select 1 from public.community_board('siguiendo') where username = 'dani' $q$) = 0);
select bbtest.ok('ranking: D (520 XP) por encima de B (480 XP)', (select pos from public.community_board('global') where username = 'dani') < (select pos from public.community_board('global') where username = 'beto'));
reset role;
update public.profiles set visibility = 'seguidores' where id = bbtest.u('D');
set role authenticated; select bbtest.login('A');
select bbtest.ok('ranking global: perfil "seguidores" no aparece', bbtest.num($q$ select 1 from public.community_board('global') where username = 'dani' $q$) = 0);
reset role;
update public.profiles set visibility = 'publico', suspended_at = now() where id = bbtest.u('D');
set role authenticated; select bbtest.login('A');
select bbtest.ok('ranking global: cuenta suspendida no aparece', bbtest.num($q$ select 1 from public.community_board('global') where username = 'dani' $q$) = 0);
select bbtest.ok('Descubrir: cuenta suspendida no aparece', bbtest.num($q$ select 1 from public.community_people('todos') where username = 'dani' $q$) = 0);
reset role;
update public.profiles set suspended_at = null where id = bbtest.u('D');

-- ───────────── Descubrir ─────────────
set role authenticated; select bbtest.login('A');
select bbtest.ok('Descubrir: no muestra a quien ya sigues (B)', bbtest.num($q$ select 1 from public.community_people('todos') where username = 'beto' $q$) = 0);
select bbtest.ok('Descubrir: muestra a D con actividad', (select active_days from public.community_people('todos') where username = 'dani') >= 1);
reset role;
set role authenticated; select bbtest.login('D');
select bbtest.ok('Descubrir: E no comparte entrenos, sin actividad ni XP', (select active_days = 0 and total_xp is null from public.community_people('todos') where username = 'eli'));
reset role;
set role authenticated; select bbtest.login('A');
select bbtest.ok('Descubrir: no muestra a E (A ya la sigue)', bbtest.num($q$ select 1 from public.community_people('todos') where username = 'eli' $q$) = 0);
select bbtest.ok('Descubrir cerca: D (otro país) fuera', bbtest.num($q$ select 1 from public.community_people('cerca') where username = 'dani' $q$) = 0);
reset role;
set role authenticated; select bbtest.login('D');
select bbtest.ok('Descubrir activos: E (sin actividad visible) fuera', bbtest.num($q$ select 1 from public.community_people('activos') where username = 'eli' $q$) = 0);
select bbtest.ok('Descubrir objetivo: B (otro objetivo) fuera para D', bbtest.num($q$ select 1 from public.community_people('objetivo') where username = 'beto' $q$) = 0);
select bbtest.ok('Descubrir: nunca te incluye', bbtest.num($q$ select 1 from public.community_people('todos') where id = auth.uid() $q$) = 0);
reset role;

-- ───────────── Niveles y perfil ─────────────
set role authenticated; select bbtest.login('A');
select bbtest.ok('niveles: D visible con su XP', (select total_xp from public.community_levels(array['d4d4d4d4-0000-4000-8000-0000000000d4'::uuid])) >= 120);
select bbtest.ok('niveles: E no comparte, sin XP', bbtest.num($q$ select 1 from public.community_levels(array['f6f6f6f6-0000-4000-8000-0000000000f6'::uuid]) $q$) = 0);
select bbtest.ok('perfil: estadísticas de D (público)', (select workouts_week from public.community_profile_stats('d4d4d4d4-0000-4000-8000-0000000000d4')) >= 1);
select bbtest.ok('perfil: E no comparte entrenos, sin estadísticas', bbtest.num($q$ select 1 from public.community_profile_stats('f6f6f6f6-0000-4000-8000-0000000000f6') $q$) = 0);
select bbtest.ok('perfil: las propias siempre', bbtest.num($q$ select 1 from public.community_profile_stats(auth.uid()) $q$) = 1);
reset role;
update public.profiles set visibility = 'privado' where id = bbtest.u('D');
set role authenticated; select bbtest.login('A');
select bbtest.ok('perfil privado: sin estadísticas ni nivel', bbtest.num($q$ select 1 from public.community_profile_stats('d4d4d4d4-0000-4000-8000-0000000000d4') $q$) = 0
  and bbtest.num($q$ select 1 from public.community_levels(array['d4d4d4d4-0000-4000-8000-0000000000d4'::uuid]) $q$) = 0);
reset role;
update public.profiles set visibility = 'publico' where id = bbtest.u('D');

-- ───────────── Anónimo ─────────────
set role anon; select bbtest.login(null);
select bbtest.fails('anon no llama community_board', $q$ select * from public.community_board('global') $q$, '42501');
select bbtest.fails('anon no llama community_people', $q$ select * from public.community_people('todos') $q$, '42501');
select bbtest.fails('anon no llama community_levels', $q$ select * from public.community_levels(array[]::uuid[]) $q$, '42501');
select bbtest.fails('anon no llama community_profile_stats', $q$ select * from public.community_profile_stats('d4d4d4d4-0000-4000-8000-0000000000d4') $q$, '42501');
reset role;
set role authenticated; select bbtest.login('A');
select bbtest.fails('nadie llama _community_week directo', $q$ select * from public._community_week() $q$, '42501');
reset role;

do $$
declare total int; bad int;
begin
  select count(*), count(*) filter (where not pass) into total, bad from bbtest.results;
  raise notice 'RESUMEN comunidad % verificaciones, % fallas', total, bad;
  if bad > 0 then raise exception 'Fallaron % verificaciones', bad; end if;
end $$;
