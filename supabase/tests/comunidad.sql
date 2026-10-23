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

-- ───────────── 0030: poder del perfil, insignias y verificación de identidad ─────────────
reset role; select bbtest.login(null);
delete from public.notifications where kind in ('perfil_nivel', 'verificacion');
-- B compra dos programas Premium y completa uno: sube de Semilla y recibe el aviso.
insert into public.challenge_entitlements (user_id, challenge_slug, source) values (bbtest.u('B'), 'abdomen-marcado', 'compra'), (bbtest.u('B'), 'banana-girl', 'compra') on conflict do nothing;
insert into public.user_programs (user_id, slug, status, started_on, completed_at) values (bbtest.u('B'), 'abdomen-marcado', 'completado', current_date - 50, now() - interval '2 days') on conflict (user_id, slug) do update set status = 'completado', completed_at = excluded.completed_at;
select bbtest.ok('poder: comprar y completar programas sube el nivel de perfil (Racimo: 2x20 + 25 + nivel 2)', (select tier = 2 and points = 70 from public.profile_flair where user_id = bbtest.u('B')));
select bbtest.ok('poder: aviso en la campanita al subir', exists (select 1 from public.notifications where user_id = bbtest.u('B') and kind = 'perfil_nivel'));
select bbtest.ok('poder: puntos con la misma regla que profile-power.ts', public._power_points(2, 1, 0, 1, 0, false) = 65 and public._power_points(4, 1, 1, 4, 11, true) = 140 and public._power_tier(29) = 1 and public._power_tier(30) = 2 and public._power_tier(250) = 5);
select bbtest.ok('poder: retos gratis topan en 10 medallas', public._power_points(0, 0, 25, 1, 0, false) = 50);

set role authenticated; select bbtest.login('A');
select bbtest.ok('insignias: A solo ve su propia fila de profile_flair', bbtest.num($q$ select 1 from public.profile_flair where user_id <> auth.uid() $q$) = 0);
select bbtest.zero('insignias: A no se sube el nivel de perfil a mano', $q$ update public.profile_flair set tier = 5, points = 999 $q$);
select bbtest.fails('insignias: A no inserta su nivel de perfil', $q$ insert into public.profile_flair (user_id, tier) values (auth.uid(), 5) $q$, '42501');
select bbtest.fails('insignias: no puede destacar un certificado que no ganó', $q$ select public.set_featured_badge('prog:abdomen-marcado') $q$, '42501');
select bbtest.fails('insignias: no puede destacar un id inventado', $q$ select public.set_featured_badge('verificado') $q$, '42501');
select public.set_featured_badge('nivel');
select bbtest.ok('insignias: destacar su nivel (siempre ganado)', (select featured = 'nivel' from public.profile_flair where user_id = auth.uid()));
select bbtest.ok('comunidad: B (público y comparte) muestra nivel de perfil a A', (select tier = 2 from public.community_flair(array[bbtest.u('B')])));
select bbtest.ok('comunidad: E no comparte entrenos, sin nivel de perfil ni insignia', (select tier is null and featured is null from public.community_flair(array[bbtest.u('E')])));
select bbtest.ok('perfil: vitrina de B con su programa completado', (select (x -> 'showcase') @> '[{"slug":"abdomen-marcado"}]'::jsonb and (x ->> 'certs')::int = 1 and (x -> 'best_streak') = 'null'::jsonb from public.community_profile_power(bbtest.u('B')) x));
select bbtest.ok('perfil: a otros no se muestran insignias de racha', not ((select x from public.community_profile_power(bbtest.u('B')) x) -> 'insignias') @> '[{"kind":"racha"}]'::jsonb);
reset role;
set role authenticated; select bbtest.login('B');
select public.set_featured_badge('prog:abdomen-marcado');
reset role;
set role authenticated; select bbtest.login('A');
select bbtest.ok('comunidad: A ve la insignia destacada de B con su nombre del catálogo', (select featured = 'prog:abdomen-marcado' and featured_label = 'Core de acero' and featured_cover = 'sky' from public.community_flair(array[bbtest.u('B')])));
reset role;

-- Verificación: fotos en el bucket privado.
set role authenticated; select bbtest.login('A');
insert into storage.objects (bucket_id, name) values ('identidad', 'a1a1a1a1-0000-4000-8000-0000000000a1/frente.jpg'), ('identidad', 'a1a1a1a1-0000-4000-8000-0000000000a1/selfie.jpg');
select bbtest.ok('identidad: A sube a su carpeta', bbtest.num($q$ select 1 from storage.objects where bucket_id = 'identidad' and name like 'a1a1a1a1%' $q$) = 2);
select bbtest.fails('identidad: A no sube a la carpeta de B', $q$ insert into storage.objects (bucket_id, name) values ('identidad', 'b2b2b2b2-0000-4000-8000-0000000000b2/x.jpg') $q$, '42501');
select bbtest.fails('identidad: A no crea subcarpetas', $q$ insert into storage.objects (bucket_id, name) values ('identidad', 'a1a1a1a1-0000-4000-8000-0000000000a1/x/y.jpg') $q$, '42501');
select bbtest.zero('identidad: A no reemplaza sus fotos (sin update)', $q$ update storage.objects set name = name where bucket_id = 'identidad' $q$);
select bbtest.fails('identidad: no acepta el número completo', $q$ select public.identity_submit('cedula_cr', 'CR', '112345678', 'Ana Pérez Mora', 'a1a1a1a1-0000-4000-8000-0000000000a1/frente.jpg', 'a1a1a1a1-0000-4000-8000-0000000000a1/selfie.jpg', 'v1') $q$, '22023');
select bbtest.fails('identidad: cédula de Costa Rica con otro país', $q$ select public.identity_submit('cedula_cr', 'MX', '678', 'Ana Pérez Mora', 'a1a1a1a1-0000-4000-8000-0000000000a1/frente.jpg', 'a1a1a1a1-0000-4000-8000-0000000000a1/selfie.jpg', 'v1') $q$, '22023');
select bbtest.fails('identidad: fotos de otra persona', $q$ select public.identity_submit('cedula_cr', 'CR', '678', 'Ana Pérez Mora', 'b2b2b2b2-0000-4000-8000-0000000000b2/frente.jpg', 'a1a1a1a1-0000-4000-8000-0000000000a1/selfie.jpg', 'v1') $q$, '22023');
select bbtest.fails('identidad: fotos que no se subieron', $q$ select public.identity_submit('cedula_cr', 'CR', '678', 'Ana Pérez Mora', 'a1a1a1a1-0000-4000-8000-0000000000a1/otra.jpg', 'a1a1a1a1-0000-4000-8000-0000000000a1/selfie.jpg', 'v1') $q$, 'P0001');
select bbtest.fails('identidad: A no inserta su fila directo', $q$ insert into public.identity_verifications (user_id, status, doc_type, country, consent_version, consent_at, reviewed_at) values (auth.uid(), 'aprobada', 'pasaporte', 'CR', 'v1', now(), now()) $q$, '42501');
select bbtest.ok('identidad: envío válido queda pendiente', public.identity_submit('cedula_cr', 'cr', '678', '  Ana   Pérez Mora ', 'a1a1a1a1-0000-4000-8000-0000000000a1/frente.jpg', 'a1a1a1a1-0000-4000-8000-0000000000a1/selfie.jpg', 'v1') = 'pendiente');
select bbtest.ok('identidad: guarda solo tipo, país y últimos 3', (select doc_type = 'cedula_cr' and country = 'CR' and last3 = '678' and full_name = 'Ana Pérez Mora' from public.identity_verifications where user_id = auth.uid()));
select bbtest.fails('identidad: no reenvía mientras está en revisión', $q$ select public.identity_submit('pasaporte', 'CR', 'X12', 'Ana Pérez Mora', 'a1a1a1a1-0000-4000-8000-0000000000a1/frente.jpg', 'a1a1a1a1-0000-4000-8000-0000000000a1/selfie.jpg', 'v1') $q$, 'P0001');
select bbtest.zero('identidad: A no se aprueba sola (update directo)', $q$ update public.identity_verifications set status = 'aprobada', reviewed_at = now() $q$);
select bbtest.fails('identidad: A no se aprueba con la función del panel', $q$ select * from public.admin_identity_decide(auth.uid(), true) $q$, '42501');
select bbtest.fails('identidad: A no pide las fotos del panel', $q$ select * from public.admin_identity_files(auth.uid()) $q$, '42501');
select bbtest.fails('identidad: A no ve la cola de revisión', $q$ select * from public.admin_identity_queue('pendiente') $q$, '42501');
select bbtest.ok('identidad: sin verificar todavía', not (select verified from public.community_flair(array[auth.uid()])));
reset role;
set role authenticated; select bbtest.login('B');
select bbtest.ok('identidad: B no ve la fila de A', bbtest.num($q$ select 1 from public.identity_verifications $q$) = 0);
select bbtest.ok('identidad: B no ve las fotos de A', bbtest.num($q$ select 1 from storage.objects where bucket_id = 'identidad' $q$) = 0);
select bbtest.zero('identidad: B no borra las fotos de A', $q$ delete from storage.objects where bucket_id = 'identidad' $q$);
reset role;

-- Soporte revisa: ve la cola, pide las fotos (auditado), aprueba; el nombre del documento se borra y A recibe el aviso.
set role authenticated; select bbtest.login('P');
select bbtest.ok('panel: soporte ve a A en la cola', bbtest.num($q$ select 1 from public.admin_identity_queue('pendiente') where user_id = 'a1a1a1a1-0000-4000-8000-0000000000a1' $q$) = 1);
select bbtest.ok('panel: rutas de las fotos para firmar', (select front_path like 'a1a1a1a1%' from public.admin_identity_files(bbtest.u('A'))));
select bbtest.fails('panel: rechazar exige motivo', $q$ select * from public.admin_identity_decide('a1a1a1a1-0000-4000-8000-0000000000a1', false, ' ') $q$, 'P0001');
select bbtest.ok('panel: aprobar devuelve las fotos a borrar', (select selfie_path like 'a1a1a1a1%' from public.admin_identity_decide(bbtest.u('A'), true)));
select bbtest.fails('panel: no se decide dos veces', $q$ select * from public.admin_identity_decide('a1a1a1a1-0000-4000-8000-0000000000a1', false, 'Foto borrosa') $q$, 'P0001');
select public.identity_files_purged(bbtest.u('A'));
reset role; select bbtest.login(null);
select bbtest.ok('panel: aprobada, sin nombre del documento ni rutas de fotos', (select status = 'aprobada' and full_name is null and front_path is null and files_deleted_at is not null and reviewer = bbtest.u('P') from public.identity_verifications where user_id = bbtest.u('A')));
select bbtest.ok('panel: auditoría de ver y aprobar, sin datos del documento', exists (select 1 from public.audit_log where action = 'identity.view' and target = bbtest.u('A')::text)
  and exists (select 1 from public.audit_log where action = 'identity.approve' and target = bbtest.u('A')::text and not (meta ? 'last3') and meta::text not like '%678%'));
select bbtest.ok('aviso: A recibe "Tu identidad está verificada"', exists (select 1 from public.notifications where user_id = bbtest.u('A') and kind = 'verificacion'));
set role authenticated; select bbtest.login('B');
select bbtest.ok('comunidad: B ve a A verificada', (select verified from public.community_flair(array[bbtest.u('A')])));
reset role;
set role authenticated; select bbtest.login('A');
select public.set_featured_badge('verificado');
select bbtest.ok('insignias: A destaca Verificado (ganada)', (select featured = 'verificado' from public.profile_flair where user_id = auth.uid()));
select bbtest.ok('retirar: devuelve lo que queda por borrar (nada, ya se borró)', (select front_path is null from public.identity_withdraw()));
select bbtest.ok('retirar: sin fila, sin Verificado y sin la insignia destacada', bbtest.num($q$ select 1 from public.identity_verifications $q$) = 0
  and not (select verified from public.community_flair(array[auth.uid()])) and (select featured is null from public.profile_flair where user_id = auth.uid()));
reset role;

-- Soporte no decide su propia verificación; el cron vence lo viejo y solo service_role lo corre.
insert into storage.objects (bucket_id, name) values ('identidad', 'e5e5e5e5-0000-4000-8000-0000000000e5/f.jpg'), ('identidad', 'e5e5e5e5-0000-4000-8000-0000000000e5/s.jpg');
set role authenticated; select bbtest.login('P');
select public.identity_submit('pasaporte', 'NI', 'C4x', 'Pedro Soporte Ruiz', 'e5e5e5e5-0000-4000-8000-0000000000e5/f.jpg', 'e5e5e5e5-0000-4000-8000-0000000000e5/s.jpg', 'v1');
select bbtest.fails('panel: soporte no decide su propia verificación', $q$ select * from public.admin_identity_decide(auth.uid(), true) $q$, '42501');
select bbtest.fails('cron: authenticated no corre la purga', $q$ select * from public.identity_purge_due(10) $q$, '42501');
reset role; select bbtest.login(null);
update public.identity_verifications set submitted_at = now() - interval '31 days' where user_id = bbtest.u('P');
select bbtest.ok('cron: lo pendiente por más de 30 días vence y sale para borrar', (select count(*) = 1 from public.identity_purge_due(10) where user_id = bbtest.u('P') and front_path is not null));
select bbtest.ok('cron: quedó rechazada con motivo y aviso', (select status = 'rechazada' and rejection_reason is not null and full_name is null from public.identity_verifications where user_id = bbtest.u('P'))
  and exists (select 1 from public.notifications where user_id = bbtest.u('P') and kind = 'verificacion'));

set role anon; select bbtest.login(null);
select bbtest.fails('anon no llama community_flair', $q$ select * from public.community_flair(array[]::uuid[]) $q$, '42501');
select bbtest.fails('anon no destaca insignias', $q$ select public.set_featured_badge('nivel') $q$, '42501');
select bbtest.fails('anon no envía verificaciones', $q$ select public.identity_submit('pasaporte', 'CR', '123', 'Nadie Nadie', 'x', 'y', 'v1') $q$, '42501');
select bbtest.fails('anon no sube al bucket de identidad', $q$ insert into storage.objects (bucket_id, name) values ('identidad', 'a1a1a1a1-0000-4000-8000-0000000000a1/z.jpg') $q$, '42501');
reset role;

do $$
declare total int; bad int;
begin
  select count(*), count(*) filter (where not pass) into total, bad from bbtest.results;
  raise notice 'RESUMEN comunidad % verificaciones, % fallas', total, bad;
  if bad > 0 then raise exception 'Fallaron % verificaciones', bad; end if;
end $$;
