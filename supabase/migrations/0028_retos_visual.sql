-- 0028: retos más llamativos. Nombres nuevos, un color propio por programa, "21 días de abdomen" oculto (quien lo
-- compró o ya está inscrito lo sigue viendo y puede terminarlo) y el modo de los programas renombrados.
-- Las portadas ilustradas con Coach Banana viven en el código (src/lib/challenge-art.ts). Idempotente.
-- Requiere 0027.

-- Empezar un programa oculto: sigue permitido para quien ya lo compró (antes solo para quien ya lo había empezado).
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
  -- 0028: un programa oculto ya no se vende, pero quien lo compró o lo recibió de cortesía todavía puede empezarlo.
  if c.status <> 'publicado' and cur.id is null and not (c.status = 'oculto' and public._owns_challenge(v_uid, p_slug)) then raise exception 'Este programa ya no está disponible' using errcode = '22023'; end if;
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

-- Datos de 0028 (generados desde src/lib/catalog-0028.ts). Solo cambian lo que el panel no editó.
update public.challenges_catalog set title = 'Reconstrucción Total' where slug = 'reconstruccion-8-semanas' and title = 'Reconstrucción corporal 8 semanas';
update public.challenges_catalog set title = 'Operación Abdomen' where slug = 'abdomen-marcado' and title = 'Abdomen marcado';
update public.challenges_catalog set program = jsonb_set(program, '{experience,mode}', to_jsonb('Modo operación abdomen'::text)) where slug = 'abdomen-marcado' and kind = 'programa' and program->'experience'->>'mode' = 'Modo abdomen';
update public.challenges_catalog set title = 'Brazos de Gorila' where slug = 'brazos-definidos' and title = 'Brazos definidos';
update public.challenges_catalog set cover = 'peel' where slug = 'brazos-definidos' and cover = 'ember';
update public.challenges_catalog set program = jsonb_set(program, '{experience,mode}', to_jsonb('Modo gorila'::text)) where slug = 'brazos-definidos' and kind = 'programa' and program->'experience'->>'mode' = 'Modo brazos';
update public.challenges_catalog set title = 'Mi Primera Dominada' where slug = 'dominadas-desde-cero' and title = 'Dominadas desde cero';
update public.challenges_catalog set cover = 'selva' where slug = 'dominadas-desde-cero' and cover = 'noche';
update public.challenges_catalog set title = 'Quema Banana 6 semanas' where slug = 'pierde-3kg-6-semanas' and title = 'Pierde 3 kg en 6 semanas';
update public.challenges_catalog set program = jsonb_set(program, '{experience,mode}', to_jsonb('Modo quema banana'::text)) where slug = 'pierde-3kg-6-semanas' and kind = 'programa' and program->'experience'->>'mode' = 'Modo quema';
update public.challenges_catalog set status = 'oculto', featured = false where slug = 'abdomen-21' and status = 'publicado';
update public.challenges_catalog set title = 'Rey de las flexiones' where slug = 'flexiones-30' and title = 'Reto de flexiones';
update public.challenges_catalog set title = 'Caminata de la selva: 10.000 pasos' where slug = 'pasos-30' and title = '10.000 pasos';
update public.challenges_catalog set title = 'Hidratado 21 días' where slug = 'agua-21' and title = 'Hidratado';
update public.challenges_catalog set title = 'Sprint de pasos 14 días' where slug = 'pasos-14' and title = '10.000 pasos en 14 días';
update public.challenges_catalog set title = 'Detox de azúcar 7 días' where slug = 'sin-azucar-7' and title = 'Sin azúcar 7 días';
update public.challenges_catalog set title = 'Flexible como mono 14 días' where slug = 'movilidad-14' and title = 'Movilidad diaria 14 días';

-- Comprobación
select slug, title, cover, status, program->'experience'->>'mode' as modo from public.challenges_catalog order by kind desc, sort;
