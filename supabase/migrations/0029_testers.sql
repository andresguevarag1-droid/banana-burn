-- Banana Burn · 0029 testers de la beta (un mes de cortesía para quien prueba la app)
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0027.
-- Qué hace (decisión del dueño, octubre de 2026):
--   1. "Tester" NO es un rol de staff: no toca profiles.role ni da ningún permiso del panel. Es un estado con fecha de
--      vencimiento guardado en public.tester_grants (una fila por asignación, con su historial).
--   2. El acceso del mes de tester sale de comp_grants (source = 'tester', plan 'completo', 30 días desde que se asigna).
--      _has_app_access() y _has_nutrition_access() ya cuentan cualquier fila vigente de comp_grants con plan completo,
--      así que el tester tiene Entreno + Nutrición durante la beta y también después del fin de la beta (sin tarjeta,
--      sin las reglas de la prueba de 0026). Al vencer, la fila deja de contar sola: el acceso se calcula con la fecha,
--      no depende de ningún proceso nocturno, y la persona vuelve a las reglas normales.
--   3. Solo admin y superadmin asignan, renuevan (30 días desde ahora) o quitan el estado de tester, con motivo,
--      por funciones SECURITY DEFINER que validan auth.uid() y escriben audit_log. Nadie lo edita por la API.
--   4. Aviso en la campanita al asignar (en la misma transacción). Correo y push los manda el servidor una sola vez por
--      asignación (tester_grants.notified_at se reclama de forma atómica). Igual con el aviso de 3 días antes del final
--      (soon_notified_at) y el agradecimiento al terminar (ended_notified_at).
--   5. feedback_reports: "Reportar algo" desde la app. La base marca si quien escribe es tester (la persona no lo elige).
--   6. Comunidad: community_testers() dice qué autores visibles son testers (para la insignia), sin exponer fechas.
--   7. Panel: admin_list_users() suma el filtro "tester" y la columna tester_until; las cortesías ya no cuentan el mes de tester.

-- ───────────── 1. Acceso: comp_grants acepta source = 'tester' ─────────────
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'comp_grants_source_check' and conrelid = 'public.comp_grants'::regclass
              and pg_get_constraintdef(oid) not like '%tester%') then
    alter table public.comp_grants drop constraint comp_grants_source_check;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'comp_grants_source_check' and conrelid = 'public.comp_grants'::regclass) then
    alter table public.comp_grants add constraint comp_grants_source_check check (source in ('cortesia', 'regalo', 'referido', 'tester'));
  end if;
end $$;

-- ───────────── 2. Asignaciones de tester ─────────────
create table if not exists public.tester_grants (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- La fila de comp_grants que da el acceso (se revoca junto con esta).
  comp_grant_id bigint references public.comp_grants(id) on delete set null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  granted_by uuid references auth.users(id) on delete set null,
  -- Cierre antes de tiempo: 'renovado' (se reemplazó por una asignación nueva) o 'quitado' (lo quitó un admin).
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  end_kind text check (end_kind is null or end_kind in ('renovado', 'quitado')),
  renewal boolean not null default false,
  notified_at timestamptz,
  seen_at timestamptz,
  soon_notified_at timestamptz,
  ended_notified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint tester_grants_dates check (expires_at > starts_at and expires_at <= starts_at + interval '31 days'),
  constraint tester_grants_end check ((revoked_at is null) = (end_kind is null))
);
create index if not exists tester_grants_user on public.tester_grants (user_id, expires_at desc);
create index if not exists tester_grants_pending on public.tester_grants (created_at) where notified_at is null and revoked_at is null;
create index if not exists tester_grants_live on public.tester_grants (expires_at) where revoked_at is null;
alter table public.tester_grants enable row level security;
-- Lectura: lo propio, o staff (lista y ficha del panel). Escrituras: solo las funciones de abajo y el servidor.
revoke insert, update, delete on public.tester_grants from public, anon, authenticated;
revoke all on public.tester_grants from anon;
drop policy if exists "tester: leer el propio o staff" on public.tester_grants;
create policy "tester: leer el propio o staff" on public.tester_grants for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

/** Fin del mes de tester vigente (null si no es tester hoy). Interna. */
create or replace function public._tester_until(p_user uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select max(t.expires_at) from public.tester_grants t
   where t.user_id = p_user and t.revoked_at is null and t.starts_at <= now() and t.expires_at > now();
$$;
revoke all on function public._tester_until(uuid) from public, anon, authenticated;

/** ¿La persona de la sesión es tester hoy? */
create or replace function public.is_tester()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public._tester_until(auth.uid()) is not null;
$$;
revoke all on function public.is_tester() from public, anon;
grant execute on function public.is_tester() to authenticated;

/**
 * Panel: hace tester a una persona por 30 días desde ahora. Si ya era tester, renueva (cierra la asignación vigente y
 * empieza otra de 30 días desde ahora, nunca recorta). Solo admin y superadmin. Motivo obligatorio (solo en auditoría).
 */
create or replace function public.admin_set_tester(p_target uuid, p_reason text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_prev text; v_comp bigint; v_id bigint; v_end timestamptz := now() + interval '30 days'; v_renew boolean;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_target is null then raise exception 'Usuario no encontrado' using errcode = 'P0001'; end if;
  if p_target = v_actor then raise exception 'No puedes hacerte tester a ti mismo' using errcode = 'P0001'; end if;
  if coalesce(char_length(btrim(p_reason)), 0) < 4 then raise exception 'Escribe el motivo' using errcode = 'P0001'; end if;
  -- Bloquea el perfil: dos asignaciones a la vez para la misma persona se hacen una detrás de otra.
  select plan into v_prev from public.profiles where id = p_target for update;
  if not found then raise exception 'Usuario no encontrado' using errcode = 'P0001'; end if;
  v_prev := coalesce((select g.previous_plan from public.comp_grants g where g.user_id = p_target and g.source = 'cortesia'
                       and g.revoked_at is null and g.expires_at > now() order by g.created_at desc limit 1), v_prev);
  -- Renovación: la asignación vigente se cierra (y su acceso) y empieza otra de 30 días desde ahora.
  v_renew := exists (select 1 from public.tester_grants where user_id = p_target and revoked_at is null and expires_at > now());
  update public.comp_grants set revoked_at = now(), revoked_by = v_actor
   where id in (select comp_grant_id from public.tester_grants where user_id = p_target and revoked_at is null and expires_at > now())
     and revoked_at is null;
  update public.tester_grants set revoked_at = now(), revoked_by = v_actor, end_kind = 'renovado'
   where user_id = p_target and revoked_at is null and expires_at > now();
  -- El acceso: plan completo, sin tocar profiles.plan. Visto y "notificado" desde ya para que no salga como regalo.
  insert into public.comp_grants (user_id, plan, previous_plan, reason, starts_at, expires_at, granted_by, source, seen_at, notified_at)
  values (p_target, 'completo', v_prev, 'Tester de la beta', now(), v_end, v_actor, 'tester', now(), now())
  returning id into v_comp;
  insert into public.tester_grants (user_id, comp_grant_id, starts_at, expires_at, granted_by, renewal)
  values (p_target, v_comp, now(), v_end, v_actor, v_renew)
  returning id into v_id;
  insert into public.notifications (user_id, kind, title, body, url)
  values (p_target, 'tester', case when v_renew then 'Renovamos tu mes de tester' else 'Eres tester de Banana Burn' end,
          'Tienes Entreno + Nutrición gratis por 30 días, como agradecimiento por ayudarnos a probar la beta.', '/app');
  insert into public.audit_log (actor, action, target, meta)
  values (v_actor, 'user.tester_grant', p_target::text, jsonb_build_object('grant', v_id, 'comp_grant', v_comp, 'expires_at', v_end,
          'renewal', v_renew, 'reason', left(p_reason, 300)));
  return v_id;
end $$;
revoke all on function public.admin_set_tester(uuid, text) from public, anon;
grant execute on function public.admin_set_tester(uuid, text) to authenticated;

/** Panel: quita el estado de tester (y su acceso) antes de tiempo. Devuelve cuántas asignaciones cerró (0 si no era tester). */
create or replace function public.admin_revoke_tester(p_target uuid, p_reason text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); n int;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if coalesce(char_length(btrim(p_reason)), 0) < 4 then raise exception 'Escribe el motivo' using errcode = 'P0001'; end if;
  perform 1 from public.profiles where id = p_target for update;
  if not found then raise exception 'Usuario no encontrado' using errcode = 'P0001'; end if;
  update public.comp_grants set revoked_at = now(), revoked_by = v_actor
   where id in (select comp_grant_id from public.tester_grants where user_id = p_target and revoked_at is null and expires_at > now())
     and revoked_at is null;
  update public.tester_grants set revoked_at = now(), revoked_by = v_actor, end_kind = 'quitado'
   where user_id = p_target and revoked_at is null and expires_at > now();
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.audit_log (actor, action, target, meta)
    values (v_actor, 'user.tester_revoke', p_target::text, jsonb_build_object('closed', n, 'reason', left(p_reason, 300)));
  end if;
  return n;
end $$;
revoke all on function public.admin_revoke_tester(uuid, text) from public, anon;
grant execute on function public.admin_revoke_tester(uuid, text) to authenticated;

/** La persona cerró la ventana de "Eres tester": no se vuelve a mostrar en ningún dispositivo. */
create or replace function public.tester_mark_seen()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.tester_grants set seen_at = now() where user_id = auth.uid() and seen_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.tester_mark_seen() from public, anon;
grant execute on function public.tester_mark_seen() to authenticated;

-- ───────────── 3. Comunidad: insignia "Tester" ─────────────
/** De una lista de autores, los que hoy son testers y que la persona puede ver (public_profiles). Máx. 200 ids. */
create or replace function public.community_testers(p_ids uuid[])
returns table (user_id uuid) language sql stable security definer set search_path = public as $$
  select pp.id from public.public_profiles pp
   where auth.uid() is not null and pp.id = any(p_ids[1:200]) and public._tester_until(pp.id) is not null;
$$;
revoke all on function public.community_testers(uuid[]) from public, anon;
grant execute on function public.community_testers(uuid[]) to authenticated;

-- ───────────── 4. Reportes desde la app ("Reportar algo") ─────────────
create table if not exists public.feedback_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('error', 'idea', 'otro')),
  body text not null check (char_length(btrim(body)) between 3 and 1000),
  page text check (page is null or (char_length(page) <= 200 and page ~ '^/')),
  from_tester boolean not null default false,
  status text not null default 'nuevo' check (status in ('nuevo', 'visto', 'resuelto')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_reports_user on public.feedback_reports (user_id, created_at desc);
create index if not exists feedback_reports_open on public.feedback_reports (created_at desc) where status <> 'resuelto';
alter table public.feedback_reports enable row level security;
revoke insert, update, delete on public.feedback_reports from public, anon, authenticated;
revoke all on public.feedback_reports from anon;
-- El staff marca visto o resuelto (solo esa columna).
grant update (status) on public.feedback_reports to authenticated;
drop policy if exists "reportes app: leer los propios o staff" on public.feedback_reports;
create policy "reportes app: leer los propios o staff" on public.feedback_reports for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
drop policy if exists "reportes app: staff cambia el estado" on public.feedback_reports;
create policy "reportes app: staff cambia el estado" on public.feedback_reports for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

/** Envía un reporte. La base decide si viene de un tester. Máximo 10 por persona cada 24 horas. */
create or replace function public.submit_feedback(p_kind text, p_body text, p_page text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id bigint; v_page text;
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('error', 'idea', 'otro') then raise exception 'Tipo de reporte inválido' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 3 and 1000 then raise exception 'Cuéntanos qué pasó (de 3 a 1.000 caracteres)' using errcode = 'P0001'; end if;
  if (select count(*) from public.feedback_reports where user_id = v_uid and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'Ya enviaste varios reportes hoy. Gracias: los estamos revisando.' using errcode = 'P0001';
  end if;
  v_page := case when p_page ~ '^/[A-Za-z0-9/_\-]{0,199}$' then p_page end;
  insert into public.feedback_reports (user_id, kind, body, page, from_tester)
  values (v_uid, p_kind, btrim(p_body), v_page, public._tester_until(v_uid) is not null)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.submit_feedback(text, text, text) from public, anon;
grant execute on function public.submit_feedback(text, text, text) to authenticated;

-- ───────────── 5. Panel: lista de usuarios con filtro "tester" ─────────────
-- Cambia el tipo de retorno (columna tester_until): hay que borrarla antes de crearla de nuevo.
drop function if exists public.admin_list_users(text, text, text, text, date, date, int, int);
create function public.admin_list_users(
  p_q text default null, p_plan text default null, p_role text default null, p_status text default null,
  p_from date default null, p_to date default null, p_limit int default 25, p_offset int default 0)
returns table (id uuid, full_name text, email text, role public.app_role, plan text, onboarded boolean,
               created_at timestamptz, last_active date, comp_until timestamptz, tester_until timestamptz, total bigint)
language plpgsql stable security definer set search_path = public as $$
declare t date := public.cr_today();
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query
  with base as (
    select p.id, p.full_name, u.email::text, p.role, p.plan, p.onboarded, p.created_at,
      greatest(
        (select max(w.day) from public.workouts w where w.user_id = p.id),
        (select max(x.day) from public.weights x where x.user_id = p.id),
        (select max(l.day) from public.daily_logs l where l.user_id = p.id),
        (select max(m.day) from public.meals m where m.user_id = p.id)
      ) last_active,
      (select max(g.expires_at) from public.comp_grants g where g.user_id = p.id and g.revoked_at is null and g.expires_at > now()
        and g.source <> 'tester') comp_until,
      public._tester_until(p.id) tester_until
    from public.profiles p left join auth.users u on u.id = p.id
    where (p_q is null or p_q = '' or p.full_name ilike '%' || p_q || '%' or u.email ilike '%' || p_q || '%' or p.id::text = p_q)
      and (p_plan is null or p_plan = '' or p.plan = p_plan)
      and (p_role is null or p_role = '' or p.role::text = p_role)
      and (p_from is null or (p.created_at at time zone 'America/Costa_Rica')::date >= p_from)
      and (p_to is null or (p.created_at at time zone 'America/Costa_Rica')::date <= p_to)
  ), filtered as (
    select * from base b where
      p_status is null or p_status = '' or
      (p_status = 'activo' and b.last_active > t - 7) or
      (p_status = 'inactivo' and b.onboarded and (b.last_active is null or b.last_active <= t - 7)) or
      (p_status = 'pendiente' and not b.onboarded) or
      (p_status = 'cortesia' and b.comp_until is not null) or
      (p_status = 'tester' and b.tester_until is not null)
  )
  select f.*, count(*) over () from filtered f
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke execute on function public.admin_list_users(text, text, text, text, date, date, int, int) from public, anon;
grant execute on function public.admin_list_users(text, text, text, text, date, date, int, int) to authenticated;

-- Comprobación (solo lee): testers vigentes y reportes abiertos.
select (select count(*) from public.tester_grants where revoked_at is null and expires_at > now()) as testers_vigentes,
       (select count(*) from public.feedback_reports where status <> 'resuelto') as reportes_abiertos;
