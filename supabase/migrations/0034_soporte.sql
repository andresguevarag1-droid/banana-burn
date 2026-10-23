-- Banana Burn · 0034 soporte: "Reportar un problema" con casos, estados y respuestas del equipo
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0031.
-- Qué hace (pedido del dueño, octubre de 2026):
--   1. support_tickets: un caso por reporte, para TODAS las personas (no solo testers). Categoría, título, descripción,
--      captura opcional (bucket privado 'soporte', solo la carpeta propia) y contexto técnico sin datos sensibles
--      (pantalla, versión, dispositivo y navegador en palabras, plan). La base marca si quien escribe es tester.
--   2. support_messages: la conversación. Las notas internas del equipo (internal = true) nunca las lee la persona.
--   3. support_events: la línea de tiempo (recibido, en proceso, necesitamos más información, resuelto, cerrado) y las
--      respuestas. Cada evento que la persona debe saber deja aviso en la campanita en la misma transacción; correo y
--      push los manda el servidor una sola vez por evento (notified_at se reclama de forma atómica).
--   4. Nadie cambia estado, prioridad ni asignación por la API: todo pasa por funciones SECURITY DEFINER que validan
--      auth.uid(), las transiciones permitidas y escriben audit_log (las del equipo). La persona solo responde mientras
--      está abierto, confirma que se resolvió o lo reabre hasta 7 días después.
--   5. Equipo de soporte: support, admin y superadmin (igual que support.tickets en admin-perms.ts).
--   6. Los reportes de 0029 (feedback_reports) se copian como casos (legacy_feedback_id), sin borrar nada.
--   7. Límites: 5 casos por hora y 15 por día por persona, 40 mensajes por día; textos con tope de largo.

-- ───────────── 1. Equipo de soporte ─────────────
create or replace function public.is_support_staff() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(array['support','admin','superadmin']::public.app_role[]);
$$;
revoke all on function public.is_support_staff() from public, anon;
grant execute on function public.is_support_staff() to authenticated;

/** Número visible del caso: BB-00042. */
create or replace function public.support_number(p_id bigint) returns text language sql immutable as $$
  select 'BB-' || lpad(p_id::text, 5, '0');
$$;

-- ───────────── 2. Tablas ─────────────
create table if not exists public.support_tickets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('app', 'pagos', 'entreno', 'nutricion', 'comunidad', 'cuenta', 'otro')),
  title text not null check (char_length(btrim(title)) between 4 and 120),
  body text not null check (char_length(btrim(body)) between 10 and 4000),
  status text not null default 'recibido' check (status in ('recibido', 'en_proceso', 'necesita_info', 'resuelto', 'cerrado')),
  priority text not null default 'normal' check (priority in ('baja', 'normal', 'alta', 'urgente')),
  assigned_to uuid references auth.users(id) on delete set null,
  from_tester boolean not null default false,
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object' and pg_column_size(context) <= 2000),
  attachment_path text check (attachment_path is null or attachment_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}$'),
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  reopened_count smallint not null default 0 check (reopened_count between 0 and 10),
  last_user_at timestamptz not null default now(),
  last_staff_at timestamptz,
  legacy_feedback_id bigint unique references public.feedback_reports(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_queue on public.support_tickets (status, created_at);

create table if not exists public.support_messages (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.support_tickets(id) on delete cascade,
  author uuid references auth.users(id) on delete set null,
  author_kind text not null check (author_kind in ('usuario', 'equipo')),
  internal boolean not null default false,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  check (not internal or author_kind = 'equipo')
);
create index if not exists support_messages_ticket on public.support_messages (ticket_id, created_at);

create table if not exists public.support_events (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.support_tickets(id) on delete cascade,
  kind text not null check (kind in ('creado', 'estado', 'respuesta', 'asignado', 'prioridad')),
  status text check (status is null or status in ('recibido', 'en_proceso', 'necesita_info', 'resuelto', 'cerrado')),
  by_user boolean not null default false,
  actor uuid references auth.users(id) on delete set null,
  message_id bigint references public.support_messages(id) on delete set null,
  -- Correo y push a la persona: se reclama antes de enviar. Los eventos que hizo la misma persona nacen "avisados".
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists support_events_ticket on public.support_events (ticket_id, created_at);
create index if not exists support_events_pending on public.support_events (created_at) where notified_at is null;

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_events enable row level security;
-- Mínimo privilegio: nadie escribe por la API; todo pasa por las funciones de abajo.
revoke insert, update, delete on public.support_tickets, public.support_messages, public.support_events from public, anon, authenticated;
revoke all on public.support_tickets, public.support_messages, public.support_events from anon;

drop policy if exists "soporte: casos propios o equipo" on public.support_tickets;
create policy "soporte: casos propios o equipo" on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or public.is_support_staff());
-- La persona lee los mensajes públicos de sus casos; las notas internas, solo el equipo.
drop policy if exists "soporte: mensajes públicos propios o equipo" on public.support_messages;
create policy "soporte: mensajes públicos propios o equipo" on public.support_messages for select to authenticated
  using (public.is_support_staff() or (not internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())));
-- Línea de tiempo: la persona ve creado, estados y respuestas de sus casos (no asignaciones ni prioridad).
drop policy if exists "soporte: eventos propios o equipo" on public.support_events;
create policy "soporte: eventos propios o equipo" on public.support_events for select to authenticated
  using (public.is_support_staff() or (kind in ('creado', 'estado', 'respuesta') and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())));

-- ───────────── 3. Capturas: bucket PRIVADO 'soporte' (solo la carpeta propia; el equipo con enlaces firmados) ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('soporte', 'soporte', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "soporte: subir propio" on storage.objects;
drop policy if exists "soporte: leer propio" on storage.objects;
drop policy if exists "soporte: borrar propio" on storage.objects;
-- Máx. 20 capturas por persona en 24 h (no se usa Storage como disco gratis).
create policy "soporte: subir propio" on storage.objects for insert to authenticated
  with check (bucket_id = 'soporte' and auth.uid() is not null and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}$')
    and (select count(*) from storage.objects o where o.bucket_id = 'soporte' and split_part(o.name, '/', 1) = auth.uid()::text and o.created_at > now() - interval '24 hours') < 20);
create policy "soporte: leer propio" on storage.objects for select to authenticated
  using (bucket_id = 'soporte' and auth.uid() is not null and split_part(name, '/', 1) = auth.uid()::text);
create policy "soporte: borrar propio" on storage.objects for delete to authenticated
  using (bucket_id = 'soporte' and auth.uid() is not null and split_part(name, '/', 1) = auth.uid()::text);

-- ───────────── 4. Reglas ─────────────
/** Transiciones que puede hacer el equipo (espejo de staffCanMove en src/lib/support.ts). */
create or replace function public._support_staff_can(p_from text, p_to text) returns boolean language sql immutable as $$
  select p_from is distinct from p_to and case p_from
    when 'recibido' then p_to in ('en_proceso', 'necesita_info', 'resuelto', 'cerrado')
    when 'en_proceso' then p_to in ('necesita_info', 'resuelto', 'cerrado')
    when 'necesita_info' then p_to in ('en_proceso', 'resuelto', 'cerrado')
    when 'resuelto' then p_to in ('en_proceso', 'cerrado')
    when 'cerrado' then p_to in ('en_proceso')
    else false end;
$$;

/** Contexto técnico permitido: solo estas llaves, como texto corto. Nada de correo, IP ni datos de salud. */
create or replace function public._support_context(p jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(k, left(p ->> k, 120)) filter (where p ? k and jsonb_typeof(p -> k) = 'string'), '{}'::jsonb)
    from unnest(array['page', 'version', 'device', 'plan', 'origin']) k;
$$;

/** Registra un evento; si es del equipo y la persona debe saberlo, deja el aviso en la campanita. Interna. */
create or replace function public._support_event(p_ticket bigint, p_kind text, p_status text, p_actor uuid, p_message bigint, p_by_user boolean)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_user uuid; v_title text; v_num text; v_head text; v_body text;
begin
  insert into public.support_events (ticket_id, kind, status, actor, message_id, by_user, notified_at)
  values (p_ticket, p_kind, p_status, p_actor, p_message, p_by_user,
          case when p_by_user or p_kind in ('asignado', 'prioridad') then now() end)
  returning id into v_id;
  if p_by_user or p_kind in ('asignado', 'prioridad') then return v_id; end if;
  select user_id, title into v_user, v_title from public.support_tickets where id = p_ticket;
  v_num := public.support_number(p_ticket);
  v_head := case
    when p_kind = 'creado' then 'Recibimos tu reporte ' || v_num
    when p_kind = 'respuesta' then 'El equipo respondió tu reporte ' || v_num
    when p_status = 'en_proceso' then 'Estamos trabajando en tu reporte ' || v_num
    when p_status = 'necesita_info' then 'Necesitamos más información sobre ' || v_num
    when p_status = 'resuelto' then 'Resolvimos tu reporte ' || v_num
    when p_status = 'cerrado' then 'Cerramos tu reporte ' || v_num
    else 'Tu reporte ' || v_num || ' cambió' end;
  v_body := left(v_title, 120);
  insert into public.notifications (user_id, kind, title, body, url) values (v_user, 'soporte', v_head, v_body, '/app/soporte/' || p_ticket);
  return v_id;
end $$;
revoke all on function public._support_event(bigint, text, text, uuid, bigint, boolean) from public, anon, authenticated;

-- ───────────── 5. Lo que hace la persona ─────────────
/** Crea un caso. La captura (opcional) ya debe estar en el bucket 'soporte', en la carpeta propia. */
create or replace function public.support_create_ticket(p_category text, p_title text, p_body text, p_context jsonb default '{}'::jsonb, p_attachment text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id bigint;
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_category is null or p_category not in ('app', 'pagos', 'entreno', 'nutricion', 'comunidad', 'cuenta', 'otro') then raise exception 'Elige una categoría' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 4 and 120 then raise exception 'Escribe un título de 4 a 120 caracteres' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 10 and 4000 then raise exception 'Cuéntanos qué pasó (de 10 a 4.000 caracteres)' using errcode = 'P0001'; end if;
  if (select count(*) from public.support_tickets where user_id = v_uid and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.support_tickets where user_id = v_uid and created_at > now() - interval '24 hours') >= 15 then
    raise exception 'Ya enviaste varios reportes hace poco. Los estamos revisando; responde en uno de ellos si tienes algo más.' using errcode = 'P0001';
  end if;
  if p_attachment is not null and (split_part(p_attachment, '/', 1) <> v_uid::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'soporte' and o.name = p_attachment)) then
    raise exception 'No encontramos la captura. Vuelve a adjuntarla.' using errcode = 'P0001';
  end if;
  insert into public.support_tickets (user_id, category, title, body, context, attachment_path, from_tester)
  values (v_uid, p_category, btrim(p_title), btrim(p_body), public._support_context(coalesce(p_context, '{}'::jsonb)), p_attachment,
          public._tester_until(v_uid) is not null)
  returning id into v_id;
  perform public._support_event(v_id, 'creado', 'recibido', v_uid, null, false);
  return v_id;
end $$;
revoke all on function public.support_create_ticket(text, text, text, jsonb, text) from public, anon;
grant execute on function public.support_create_ticket(text, text, text, jsonb, text) to authenticated;

/** La persona responde en su caso abierto. Si le pedimos más información, el caso vuelve a "en proceso". */
create or replace function public.support_reply(p_ticket bigint, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); t public.support_tickets; v_msg bigint;
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into t from public.support_tickets where id = p_ticket for update;
  if not found or t.user_id <> v_uid then raise exception 'Reporte no encontrado' using errcode = '42501'; end if;
  if t.status not in ('recibido', 'en_proceso', 'necesita_info') then raise exception 'Este reporte ya está cerrado. Reábrelo para escribir.' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then raise exception 'Escribe tu mensaje (hasta 4.000 caracteres)' using errcode = 'P0001'; end if;
  if (select count(*) from public.support_messages m join public.support_tickets x on x.id = m.ticket_id
       where x.user_id = v_uid and m.author_kind = 'usuario' and m.created_at > now() - interval '24 hours') >= 40 then
    raise exception 'Ya enviaste muchos mensajes hoy. Te respondemos pronto.' using errcode = 'P0001';
  end if;
  insert into public.support_messages (ticket_id, author, author_kind, body) values (p_ticket, v_uid, 'usuario', btrim(p_body)) returning id into v_msg;
  update public.support_tickets set last_user_at = now(), updated_at = now(),
         status = case when status = 'necesita_info' then 'en_proceso' else status end where id = p_ticket;
  if t.status = 'necesita_info' then perform public._support_event(p_ticket, 'estado', 'en_proceso', v_uid, v_msg, true);
  else perform public._support_event(p_ticket, 'respuesta', null, v_uid, v_msg, true); end if;
  return v_msg;
end $$;
revoke all on function public.support_reply(bigint, text) from public, anon;
grant execute on function public.support_reply(bigint, text) to authenticated;

/**
 * La persona confirma que ya se resolvió ('confirmar': queda cerrado) o lo reabre ('reabrir': hasta 7 días después de
 * resuelto o cerrado, máx. 3 veces). Devuelve el estado nuevo.
 */
create or replace function public.support_user_action(p_ticket bigint, p_action text)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); t public.support_tickets; v_new text; v_since timestamptz;
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into t from public.support_tickets where id = p_ticket for update;
  if not found or t.user_id <> v_uid then raise exception 'Reporte no encontrado' using errcode = '42501'; end if;
  if p_action = 'confirmar' then
    if t.status = 'cerrado' then return t.status; end if;
    v_new := 'cerrado';
    update public.support_tickets set status = v_new, closed_at = now(), resolved_at = coalesce(resolved_at, now()), last_user_at = now(), updated_at = now() where id = p_ticket;
  elsif p_action = 'reabrir' then
    if t.status not in ('resuelto', 'cerrado') then raise exception 'Este reporte sigue abierto' using errcode = 'P0001'; end if;
    v_since := greatest(t.resolved_at, t.closed_at);
    if v_since is null or v_since < now() - interval '7 days' then raise exception 'Pasaron más de 7 días. Crea un reporte nuevo y lo vemos.' using errcode = 'P0001'; end if;
    if t.reopened_count >= 3 then raise exception 'Este reporte ya se reabrió varias veces. Crea uno nuevo y lo vemos.' using errcode = 'P0001'; end if;
    v_new := 'recibido';
    update public.support_tickets set status = v_new, resolved_at = null, closed_at = null, reopened_count = reopened_count + 1, last_user_at = now(), updated_at = now() where id = p_ticket;
  else
    raise exception 'Acción inválida' using errcode = '22023';
  end if;
  perform public._support_event(p_ticket, 'estado', v_new, v_uid, null, true);
  return v_new;
end $$;
revoke all on function public.support_user_action(bigint, text) from public, anon;
grant execute on function public.support_user_action(bigint, text) to authenticated;

-- ───────────── 6. Lo que hace el equipo ─────────────
/**
 * Responde (público) o deja una nota interna; opcionalmente cambia el estado en el mismo paso (p. ej. "resuelto" con
 * el resumen como respuesta). Una respuesta pública a un caso "recibido" lo pasa a "en proceso". Auditado.
 */
create or replace function public.admin_support_reply(p_ticket bigint, p_body text, p_internal boolean default false, p_status text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); t public.support_tickets; v_msg bigint; v_new text;
begin
  if not public.is_support_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into t from public.support_tickets where id = p_ticket for update;
  if not found then raise exception 'Reporte no encontrado' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then raise exception 'Escribe el mensaje (hasta 4.000 caracteres)' using errcode = 'P0001'; end if;
  v_new := coalesce(nullif(p_status, ''), case when not coalesce(p_internal, false) and t.status = 'recibido' then 'en_proceso' end);
  if v_new is not null and v_new <> t.status and not public._support_staff_can(t.status, v_new) then
    raise exception 'No se puede pasar de % a %', t.status, v_new using errcode = 'P0001';
  end if;
  if coalesce(p_internal, false) and v_new is not null and v_new <> t.status then
    raise exception 'Una nota interna no cambia el estado: usa una respuesta o el cambio de estado' using errcode = 'P0001';
  end if;
  insert into public.support_messages (ticket_id, author, author_kind, internal, body)
  values (p_ticket, v_actor, 'equipo', coalesce(p_internal, false), btrim(p_body)) returning id into v_msg;
  if not coalesce(p_internal, false) then
    update public.support_tickets set last_staff_at = now(), first_response_at = coalesce(first_response_at, now()), updated_at = now(),
           assigned_to = coalesce(assigned_to, v_actor),
           status = coalesce(v_new, status),
           resolved_at = case when v_new = 'resuelto' then now() when v_new in ('en_proceso', 'necesita_info') then null else resolved_at end,
           closed_at = case when v_new = 'cerrado' then now() when v_new is not null and v_new <> 'cerrado' then null else closed_at end
     where id = p_ticket;
    -- Un solo aviso por paso: si cambia el estado, el aviso del estado lleva la respuesta.
    if v_new is not null and v_new <> t.status then perform public._support_event(p_ticket, 'estado', v_new, v_actor, v_msg, false);
    else perform public._support_event(p_ticket, 'respuesta', null, v_actor, v_msg, false); end if;
  end if;
  insert into public.audit_log (actor, action, target, meta)
  values (v_actor, case when coalesce(p_internal, false) then 'support.note' else 'support.reply' end, 'ticket:' || p_ticket,
          jsonb_build_object('user', t.user_id, 'status', coalesce(v_new, t.status), 'length', char_length(p_body)));
  return v_msg;
end $$;
revoke all on function public.admin_support_reply(bigint, text, boolean, text) from public, anon;
grant execute on function public.admin_support_reply(bigint, text, boolean, text) to authenticated;

/** Cambia estado, prioridad o asignación (solo a alguien del equipo de soporte). Cada cambio queda en eventos y auditoría. */
create or replace function public.admin_support_update(p_ticket bigint, p_status text default null, p_priority text default null, p_assignee uuid default null, p_unassign boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); t public.support_tickets; v_changes jsonb := '{}'::jsonb;
begin
  if not public.is_support_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into t from public.support_tickets where id = p_ticket for update;
  if not found then raise exception 'Reporte no encontrado' using errcode = 'P0001'; end if;
  if nullif(p_status, '') is not null and p_status <> t.status then
    if not public._support_staff_can(t.status, p_status) then raise exception 'No se puede pasar de % a %', t.status, p_status using errcode = 'P0001'; end if;
    update public.support_tickets set status = p_status, updated_at = now(), last_staff_at = now(),
           resolved_at = case when p_status = 'resuelto' then now() when p_status in ('en_proceso', 'necesita_info') then null else resolved_at end,
           closed_at = case when p_status = 'cerrado' then now() else null end
     where id = p_ticket;
    perform public._support_event(p_ticket, 'estado', p_status, v_actor, null, false);
    v_changes := v_changes || jsonb_build_object('status', p_status);
  end if;
  if nullif(p_priority, '') is not null and p_priority <> t.priority then
    if p_priority not in ('baja', 'normal', 'alta', 'urgente') then raise exception 'Prioridad inválida' using errcode = '22023'; end if;
    update public.support_tickets set priority = p_priority, updated_at = now() where id = p_ticket;
    perform public._support_event(p_ticket, 'prioridad', null, v_actor, null, false);
    v_changes := v_changes || jsonb_build_object('priority', p_priority);
  end if;
  if p_unassign and t.assigned_to is not null then
    update public.support_tickets set assigned_to = null, updated_at = now() where id = p_ticket;
    perform public._support_event(p_ticket, 'asignado', null, v_actor, null, false);
    v_changes := v_changes || jsonb_build_object('assigned_to', null);
  elsif p_assignee is not null and p_assignee is distinct from t.assigned_to then
    if not exists (select 1 from public.profiles where id = p_assignee and role::text in ('support', 'admin', 'superadmin')) then
      raise exception 'Solo se asigna a alguien del equipo de soporte' using errcode = 'P0001';
    end if;
    update public.support_tickets set assigned_to = p_assignee, updated_at = now() where id = p_ticket;
    perform public._support_event(p_ticket, 'asignado', null, v_actor, null, false);
    v_changes := v_changes || jsonb_build_object('assigned_to', p_assignee);
  end if;
  if v_changes <> '{}'::jsonb then
    insert into public.audit_log (actor, action, target, meta) values (v_actor, 'support.update', 'ticket:' || p_ticket, v_changes || jsonb_build_object('user', t.user_id));
  end if;
end $$;
revoke all on function public.admin_support_update(bigint, text, text, uuid, boolean) from public, anon;
grant execute on function public.admin_support_update(bigint, text, text, uuid, boolean) to authenticated;

/** El equipo pide la captura: devuelve la ruta (el servidor la firma por 60 s) y lo deja en auditoría. */
create or replace function public.admin_support_file(p_ticket bigint)
returns text language plpgsql security definer set search_path = public as $$
declare v_path text; v_user uuid;
begin
  if not public.is_support_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select attachment_path, user_id into v_path, v_user from public.support_tickets where id = p_ticket;
  if v_path is null then raise exception 'Este reporte no tiene captura' using errcode = 'P0001'; end if;
  insert into public.audit_log (actor, action, target, meta) values (auth.uid(), 'support.file_view', 'ticket:' || p_ticket, jsonb_build_object('user', v_user));
  return v_path;
end $$;
revoke all on function public.admin_support_file(bigint) from public, anon;
grant execute on function public.admin_support_file(bigint) to authenticated;

-- ───────────── 7. Los reportes de 0029 pasan a ser casos (sin borrar feedback_reports) ─────────────
/** Copia los reportes de feedback_reports que aún no son casos. Idempotente (legacy_feedback_id único). Devuelve cuántos copió. */
create or replace function public._support_import_feedback()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with ins as (
    insert into public.support_tickets (user_id, category, title, body, status, from_tester, context, legacy_feedback_id, created_at, updated_at, last_user_at, resolved_at)
    select f.user_id,
           case f.kind when 'error' then 'app' else 'otro' end,
           left(case f.kind when 'error' then 'Algo falla' when 'idea' then 'Una idea' else 'Otra cosa' end || ': ' || btrim(f.body), 120),
           case when char_length(btrim(f.body)) >= 10 then left(btrim(f.body), 4000) else rpad(btrim(f.body), 10, '.') end,
           case f.status when 'resuelto' then 'resuelto' when 'visto' then 'en_proceso' else 'recibido' end,
           f.from_tester,
           case when f.page is not null then jsonb_build_object('page', f.page, 'origin', 'reportar-algo') else jsonb_build_object('origin', 'reportar-algo') end,
           f.id, f.created_at, f.created_at, f.created_at,
           case when f.status = 'resuelto' then f.created_at end
      from public.feedback_reports f
     where not exists (select 1 from public.support_tickets t where t.legacy_feedback_id = f.id)
    returning id, created_at)
  insert into public.support_events (ticket_id, kind, status, by_user, notified_at, created_at)
  select id, 'creado', 'recibido', true, created_at, created_at from ins;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public._support_import_feedback() from public, anon, authenticated;
select public._support_import_feedback() as reportes_copiados;

-- Comprobación (solo lee): casos abiertos por estado.
select status, count(*) from public.support_tickets group by 1 order by 1;
