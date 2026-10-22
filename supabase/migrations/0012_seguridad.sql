-- Banana Burn · 0012 endurecimiento de seguridad (auditoría pre-producción)
-- Qué hace (idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001–0011):
--   1. Nadie cambia role/plan por la API REST, ni siquiera un admin: solo las RPC admin_* (SECURITY DEFINER) o service_role.
--   2. Publicaciones/comentarios: el autor no puede des-ocultar contenido moderado; staff solo puede cambiar `hidden`.
--   3. XP: tipos y montos permitidos por evento + tope diario; los usuarios ya no pueden editar xp_events.
--   4. Límites de frecuencia (anti-spam) en posts, comentarios, bananas, reportes, follows, entrenos, fotos, push y avisos de prueba.
--   5. Cupo diario del Coach IA en una tabla que el usuario no puede tocar (coach_consume).
--   6. Push: el endpoint debe ser de un servicio de push conocido (evita SSRF desde el cron).
--   7. Fotos: la ruta debe estar en la carpeta del dueño; bucket "progreso" privado con límites de tamaño/MIME.
--   8. public_profiles y funciones de comunidad: no accesibles para anon. Ranking respeta privacidad.
--   9. Datos de salud: el staff de soporte ya no los lee (solo coach/admin/superadmin); chats del coach solo el dueño.
--  10. Borrado de cuentas de staff: FKs de auditoría/autoría con ON DELETE SET NULL.
--  11. Cortesías: al revocar/vencer se respeta una suscripción pagada vigente.
-- Las restricciones CHECK nuevas van NOT VALID: aplican a filas nuevas/actualizadas sin bloquear filas viejas.

-- ───────────── Helpers ─────────────
create or replace function public.is_api_role() returns boolean language sql stable as $$
  select current_user in ('authenticated', 'anon');
$$;
create or replace function public.is_health_staff() returns boolean language sql stable as $$
  select public.has_role(array['coach','admin','superadmin']::public.app_role[]);
$$;

-- ───────────── 1. role/plan solo por RPC o service_role ─────────────
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql as $$
begin
  if (new.role is distinct from old.role or new.plan is distinct from old.plan) and public.is_api_role() then
    raise exception 'No autorizado para cambiar rol o plan' using errcode = '42501';
  end if;
  if public.is_api_role() then
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

alter table public.profiles drop constraint if exists profiles_full_name_len;
alter table public.profiles add constraint profiles_full_name_len check (full_name is null or char_length(full_name) <= 80) not valid;

-- ───────────── 2. Posts y comentarios ─────────────
-- Los guardas son SECURITY INVOKER a propósito: así current_user distingue la API (authenticated/anon)
-- de las funciones SECURITY DEFINER del staff y de service_role.
create or replace function public.guard_post_write()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_api_role() then return new; end if;
  if tg_op = 'INSERT' then
    new.hidden := false;
    new.created_at := now();
    if new.workout_id is not null and not exists (select 1 from public.workouts w where w.id = new.workout_id and w.user_id = auth.uid()) then
      raise exception 'Entreno inválido' using errcode = '42501';
    end if;
    return new;
  end if;
  -- UPDATE
  if old.user_id = auth.uid() and not public.is_staff() then
    -- El autor solo edita texto y visibilidad.
    if new.hidden is distinct from old.hidden or new.user_id is distinct from old.user_id or new.kind is distinct from old.kind
       or new.workout_id is distinct from old.workout_id or new.data is distinct from old.data or new.created_at is distinct from old.created_at then
      raise exception 'Solo puedes editar el texto y la visibilidad' using errcode = '42501';
    end if;
  elsif public.is_staff() then
    -- Staff modera: solo `hidden` (y su propio post como autor, mismas reglas que cualquiera).
    if new.user_id is distinct from old.user_id or new.kind is distinct from old.kind or new.workout_id is distinct from old.workout_id
       or new.data is distinct from old.data or new.created_at is distinct from old.created_at
       or (old.user_id <> auth.uid() and (new.body is distinct from old.body or new.visibility is distinct from old.visibility)) then
      raise exception 'El staff solo puede ocultar o mostrar contenido ajeno' using errcode = '42501';
    end if;
    if old.user_id = auth.uid() and new.hidden is distinct from old.hidden and not public.is_admin() then
      raise exception 'No puedes moderar tu propio contenido' using errcode = '42501';
    end if;
  else
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists posts_guard on public.posts;
create trigger posts_guard before insert or update on public.posts for each row execute function public.guard_post_write();

alter table public.posts drop constraint if exists posts_data_size;
alter table public.posts add constraint posts_data_size check (pg_column_size(data) <= 4096) not valid;

create or replace function public.guard_comment_write()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_api_role() then return new; end if;
  if tg_op = 'INSERT' then
    new.hidden := false;
    new.created_at := now();
    return new;
  end if;
  if new.body is distinct from old.body or new.user_id is distinct from old.user_id or new.post_id is distinct from old.post_id or new.created_at is distinct from old.created_at then
    raise exception 'El staff solo puede ocultar o mostrar comentarios' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists comments_guard on public.comments;
create trigger comments_guard before insert or update on public.comments for each row execute function public.guard_comment_write();

-- Reportes: la sincronización con posts/comments solo corre cuando cambia el estado (o un staff crea uno ya oculto).
create or replace function public.sync_report_hidden()
returns trigger language plpgsql security definer set search_path = public as $$
declare hide boolean := new.status = 'oculto';
begin
  if tg_op = 'INSERT' and not hide then return new; end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  if new.target_id !~ '^[0-9]+$' then return new; end if;
  if new.target_type = 'post' then
    update public.posts set hidden = hide or public.is_hidden('post', new.target_id) where id = new.target_id::bigint;
  elsif new.target_type = 'comment' then
    update public.comments set hidden = hide or public.is_hidden('comment', new.target_id) where id = new.target_id::bigint;
  end if;
  return new;
end $$;

create or replace function public.guard_report_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_api_role() then return new; end if;
  new.status := 'abierto'; new.resolved_by := null; new.resolved_at := null; new.resolution_note := null; new.created_at := now();
  if new.target_type not in ('post', 'comment', 'user') then raise exception 'Tipo de reporte inválido' using errcode = '22023'; end if;
  return new;
end $$;
drop trigger if exists reports_guard on public.reports;
create trigger reports_guard before insert on public.reports for each row execute function public.guard_report_insert();

-- ───────────── 3. XP ─────────────
create or replace function public.guard_xp_event()
returns trigger language plpgsql set search_path = public as $$
declare max_xp int; today_sum int;
begin
  if not public.is_api_role() then return new; end if;
  new.created_at := now();
  max_xp := case new.kind
    when 'workout' then 430 when 'pr' then 50 when 'checkin' then 15 when 'weigh' then 10 when 'measure' then 15
    when 'photo' then 20 when 'challenge_day' then 10 when 'challenge' then 400 when 'onboard' then 50 else null end;
  if max_xp is null then raise exception 'Tipo de XP inválido' using errcode = '22023'; end if;
  if new.xp < 0 or new.xp > max_xp then raise exception 'XP fuera de rango' using errcode = '22023'; end if;
  if new.kind = 'onboard' and exists (select 1 from public.xp_events where user_id = new.user_id and kind = 'onboard') then
    return null; -- solo una vez en la vida: se ignora en silencio
  end if;
  select coalesce(sum(xp), 0) into today_sum from public.xp_events where user_id = new.user_id and created_at > now() - interval '24 hours';
  if today_sum + new.xp > 1500 then raise exception 'Tope diario de XP alcanzado' using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists xp_events_guard on public.xp_events;
create trigger xp_events_guard before insert on public.xp_events for each row execute function public.guard_xp_event();
create index if not exists xp_events_user_created on public.xp_events (user_id, created_at desc);
revoke update, delete on public.xp_events from authenticated, anon;

alter table public.workouts drop constraint if exists workouts_xp_range;
alter table public.workouts add constraint workouts_xp_range check (xp is null or xp between 0 and 1000) not valid;

-- ───────────── 4. Límites de frecuencia ─────────────
-- Uso: trigger BEFORE INSERT con argumentos (columna_usuario, ventana, máximo). Ventana 'total' = sin ventana.
-- Cuenta filas recientes DEL USUARIO ACTUAL (definer: incluye filas que su RLS no le muestra, p. ej. comentarios ocultos).
create or replace function public._my_recent_count(p_table text, p_col text, p_window text)
returns int language plpgsql stable security definer set search_path = public as $$
declare n int;
begin
  if p_table not in ('posts','comments','kudos','reports','follows','workouts','progress_photos','push_subscriptions','notifications')
     or p_col not in ('user_id','reporter','follower') then
    raise exception 'tabla no permitida';
  end if;
  if p_window = 'total' then
    execute format('select count(*) from public.%I where %I = $1', p_table, p_col) into n using auth.uid();
  else
    execute format('select count(*) from public.%I where %I = $1 and created_at > now() - $2::interval', p_table, p_col) into n using auth.uid(), p_window;
  end if;
  return n;
end $$;
revoke execute on function public._my_recent_count(text, text, text) from public, anon;
grant execute on function public._my_recent_count(text, text, text) to authenticated;

create or replace function public.enforce_rate_limit()
returns trigger language plpgsql set search_path = public as $$
declare col text := tg_argv[0]; win text := tg_argv[1]; lim int := tg_argv[2]::int;
begin
  if not public.is_api_role() then return new; end if;
  if (to_jsonb(new) ->> col) is distinct from auth.uid()::text then return new; end if; -- RLS rechaza filas ajenas
  if public._my_recent_count(tg_table_name, col, win) >= lim then
    raise exception 'Demasiadas acciones seguidas. Intenta más tarde.' using errcode = 'P0001', hint = 'rate_limit';
  end if;
  return new;
end $$;

create index if not exists comments_user_created on public.comments (user_id, created_at desc);
create index if not exists kudos_user_created on public.kudos (user_id, created_at desc);
create index if not exists reports_reporter_created on public.reports (reporter, created_at desc);
create index if not exists follows_follower_created on public.follows (follower, created_at desc);
create index if not exists workouts_user_created on public.workouts (user_id, created_at desc);
create index if not exists progress_photos_user_created on public.progress_photos (user_id, created_at desc);

drop trigger if exists rl_posts on public.posts;
create trigger rl_posts before insert on public.posts for each row execute function public.enforce_rate_limit('user_id', '1 hour', '20');
drop trigger if exists rl_comments on public.comments;
create trigger rl_comments before insert on public.comments for each row execute function public.enforce_rate_limit('user_id', '1 hour', '60');
drop trigger if exists rl_kudos on public.kudos;
create trigger rl_kudos before insert on public.kudos for each row execute function public.enforce_rate_limit('user_id', '1 hour', '300');
drop trigger if exists rl_reports on public.reports;
create trigger rl_reports before insert on public.reports for each row execute function public.enforce_rate_limit('reporter', '24 hours', '20');
drop trigger if exists rl_follows on public.follows;
create trigger rl_follows before insert on public.follows for each row execute function public.enforce_rate_limit('follower', '1 hour', '100');
drop trigger if exists rl_workouts on public.workouts;
create trigger rl_workouts before insert on public.workouts for each row execute function public.enforce_rate_limit('user_id', '24 hours', '12');
drop trigger if exists rl_photos on public.progress_photos;
create trigger rl_photos before insert on public.progress_photos for each row execute function public.enforce_rate_limit('user_id', '24 hours', '30');
drop trigger if exists rl_push on public.push_subscriptions;
create trigger rl_push before insert on public.push_subscriptions for each row execute function public.enforce_rate_limit('user_id', 'total', '10');
drop trigger if exists rl_notifications_test on public.notifications;
create trigger rl_notifications_test before insert on public.notifications for each row execute function public.enforce_rate_limit('user_id', '1 hour', '10');

-- ───────────── 5. Cupo del Coach IA ─────────────
create table if not exists public.coach_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('chat', 'feedback')),
  n int not null default 0,
  primary key (user_id, day, kind)
);
alter table public.coach_usage enable row level security;
drop policy if exists "coach_usage: leer propio" on public.coach_usage;
create policy "coach_usage: leer propio" on public.coach_usage for select using (user_id = auth.uid());
revoke insert, update, delete on public.coach_usage from authenticated, anon;

/** Consume 1 del cupo diario. Devuelve los restantes (>= 0) o -1 si ya se agotó. Los límites viven aquí, no en el cliente. */
create or replace function public.coach_consume(p_kind text)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); lim int; used int;
begin
  if uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  lim := case p_kind when 'chat' then 40 when 'feedback' then 20 else null end;
  if lim is null then raise exception 'Tipo inválido' using errcode = '22023'; end if;
  insert into public.coach_usage as cu (user_id, day, kind, n) values (uid, public.cr_today(), p_kind, 1)
  on conflict (user_id, day, kind) do update set n = cu.n + 1 where cu.n < lim
  returning n into used;
  if used is null then return -1; end if;
  return lim - used;
end $$;
revoke execute on function public.coach_consume(text) from public, anon;
grant execute on function public.coach_consume(text) to authenticated;

-- ───────────── 6. Push: solo servicios de push conocidos ─────────────
alter table public.push_subscriptions drop constraint if exists push_endpoint_known;
alter table public.push_subscriptions add constraint push_endpoint_known check (
  char_length(endpoint) <= 1024 and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com|[a-z0-9-]+\.push\.apple\.com)/'
) not valid;
alter table public.push_subscriptions drop constraint if exists push_keys_len;
alter table public.push_subscriptions add constraint push_keys_len check (char_length(p256dh) < 256 and char_length(auth) < 256) not valid;

-- Avisos: el enlace siempre es una ruta interna.
alter table public.notifications drop constraint if exists notifications_url_internal;
alter table public.notifications add constraint notifications_url_internal check (url is null or url ~ '^/([^/\\]|$)') not valid;

-- ───────────── 7. Fotos de progreso ─────────────
alter table public.progress_photos drop constraint if exists progress_photos_path_owner;
alter table public.progress_photos add constraint progress_photos_path_owner check (
  split_part(path, '/', 1) = user_id::text and path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}$' and path !~ '\.\.'
) not valid;
update storage.buckets set public = false, file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic']
where id = 'progreso';

-- ───────────── 8. Comunidad: anon fuera, ranking con privacidad ─────────────
revoke all on public.public_profiles from anon, public;
grant select on public.public_profiles to authenticated;
revoke execute on function public.can_see_post(uuid, text, boolean) from public, anon;
revoke execute on function public.profile_visibility(uuid) from public, anon;
revoke execute on function public.is_hidden(text, text) from public, anon;
grant execute on function public.can_see_post(uuid, text, boolean) to authenticated;
grant execute on function public.profile_visibility(uuid) to authenticated;
grant execute on function public.is_hidden(text, text) to authenticated;

create or replace function public.weekly_leaderboard()
returns table (user_id uuid, username text, full_name text, workouts bigint, xp bigint)
language sql stable security definer set search_path = public as $$
  with circle as (select auth.uid() as id union select followee from follows where follower = auth.uid())
  select p.id, p.username, p.full_name,
    (select count(distinct w.day) from workouts w where w.user_id = p.id and w.day >= date_trunc('week', now())::date),
    (select coalesce(sum(x.xp), 0) from xp_events x where x.user_id = p.id and x.created_at >= date_trunc('week', now()))
  from profiles p join circle c on c.id = p.id
  where auth.uid() is not null and (p.id = auth.uid() or (p.visibility <> 'privado' and p.share_workouts))
  order by 5 desc limit 50;
$$;
revoke execute on function public.weekly_leaderboard() from public, anon;
grant execute on function public.weekly_leaderboard() to authenticated;

-- ───────────── 9. Datos de salud: mínimo privilegio para staff ─────────────
do $$
declare t text;
begin
  foreach t in array array['goals','weights','measurements','daily_logs','meals','workouts','workout_sets','xp_events']
  loop
    execute format('drop policy if exists "staff: leer" on public.%I', t);
    execute format('drop policy if exists "staff salud: leer" on public.%I', t);
    execute format('create policy "staff salud: leer" on public.%I for select using (public.is_health_staff())', t);
  end loop;
end $$;
drop policy if exists "staff: leer" on public.coach_messages;
drop policy if exists "staff salud: leer" on public.coach_messages;

-- ───────────── 10. FKs de autoría: no bloquean el borrado de cuentas ─────────────
do $$
declare r record;
begin
  for r in select * from (values
    ('audit_log','actor'), ('comp_grants','granted_by'), ('comp_grants','revoked_by'), ('reports','resolved_by'),
    ('exercise_overrides','updated_by'), ('challenges_catalog','created_by'), ('announcements','created_by')
  ) as v(tbl, col)
  loop
    execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.tbl || '_' || r.col || '_fkey');
    execute format('alter table public.%I add constraint %I foreign key (%I) references auth.users(id) on delete set null', r.tbl, r.tbl || '_' || r.col || '_fkey', r.col);
  end loop;
end $$;

-- ───────────── 11. Cortesías: no bajar a quien paga ─────────────
create or replace function public._restore_plan_after_comp(p_user uuid, p_prev text)
returns text language plpgsql security definer set search_path = public as $$
declare v_plan text; v_paid text;
begin
  select coalesce(p_prev, 'free') into v_plan;
  if v_plan not in ('free','entreno','completo','pro') then v_plan := 'free'; end if;
  select case when bool_or(plan = 'completo') then 'completo' when bool_or(plan = 'entreno') then 'entreno' end into v_paid
    from public.subscriptions
   where user_id = p_user and plan in ('entreno','completo')
     and (status in ('active','trialing','past_due') and (current_period_end is null or current_period_end + interval '3 days' > now())
          or (status = 'canceled' and cancel_at_period_end and current_period_end > now()));
  if v_paid is not null then v_plan := v_paid; end if;
  update public.profiles set plan = v_plan where id = p_user;
  return v_plan;
end $$;
revoke all on function public._restore_plan_after_comp(uuid, text) from public, anon, authenticated;
