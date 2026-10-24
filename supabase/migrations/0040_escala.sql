-- 0040 · Escala para el lanzamiento (1 de noviembre): tope diario global del Coach IA, limpieza periódica e índices.
-- Idempotente: se puede correr varias veces sin daño. No cambia datos de usuarios.
--
--   1. Tope diario GLOBAL del Coach IA (además del cupo por persona de 0032): tabla ai_usage_daily y funciones
--      ai_budget_take() / ai_budget_add(), solo service_role. Si un error o un ataque dispara las preguntas, el gasto de
--      Anthropic se corta en el número que fije el servidor (COACH_DAILY_MAX y COACH_DAILY_TOKENS en Vercel).
--   2. purge_housekeeping(): borra por lotes lo que crece sin fin y ya no sirve (ventanas viejas de rate_limits, tickets
--      del coach, registro de avisos, avisos in-app leídos y viejos, uso diario viejo). La llama el cron diario.
--   3. auth_user_id_by_email(): busca una cuenta por correo con un índice, en vez de recorrer la lista completa de Auth
--      (el inicio de sesión de cuentas sin confirmar lo hacía de a 1000 por página). Solo service_role.
--   4. Índices para lecturas frecuentes que no tenían uno: comentarios por publicación, seguidores por persona,
--      publicaciones por entreno, retos activos (cron), y fechas para la limpieza.

-- ───────────── 1. Tope diario global del Coach IA ─────────────
create table if not exists public.ai_usage_daily (
  day date not null,
  kind text not null check (kind in ('chat', 'feedback')),
  requests int not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cache_read_tokens bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  primary key (day, kind)
);
alter table public.ai_usage_daily enable row level security;
-- Sin políticas: solo las funciones de abajo (service_role) y el SQL Editor.
revoke all on public.ai_usage_daily from public, anon, authenticated;

/**
 * Reserva una pregunta del día (zona de Costa Rica, igual que el cupo por persona). true = puede llamar a la IA.
 * false = se llegó al tope de preguntas (`p_max_requests`) o de tokens (`p_max_tokens`, suma de entrada, salida y caché)
 * del día para todos. Atómica: un solo upsert con condición. Solo service_role.
 */
create or replace function public.ai_budget_take(p_kind text, p_max_requests int, p_max_tokens bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare used int;
begin
  if auth.uid() is not null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('chat', 'feedback') then raise exception 'Tipo inválido' using errcode = '22023'; end if;
  if p_max_requests is null or p_max_requests < 0 then raise exception 'Máximo inválido' using errcode = '22023'; end if;
  if p_max_requests = 0 then return false; end if;
  insert into public.ai_usage_daily as u (day, kind, requests) values (public.cr_today(), p_kind, 1)
  on conflict (day, kind) do update set requests = u.requests + 1
   where u.requests < p_max_requests
     and (p_max_tokens is null or p_max_tokens <= 0
          or u.input_tokens + u.output_tokens + u.cache_read_tokens + u.cache_write_tokens < p_max_tokens)
  returning requests into used;
  return used is not null;
end $$;
revoke execute on function public.ai_budget_take(text, int, bigint) from public, anon, authenticated;
grant execute on function public.ai_budget_take(text, int, bigint) to service_role;

/**
 * Suma los tokens que usó una respuesta (solo conteos, nunca contenido). `p_requests` = -1 devuelve la pregunta reservada
 * cuando la IA no respondió. Nunca baja de cero. Solo service_role.
 */
create or replace function public.ai_budget_add(p_kind text, p_requests int, p_in bigint, p_out bigint, p_cache_read bigint, p_cache_write bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('chat', 'feedback') then raise exception 'Tipo inválido' using errcode = '22023'; end if;
  insert into public.ai_usage_daily as u (day, kind, requests, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens)
  values (public.cr_today(), p_kind, greatest(coalesce(p_requests, 0), 0), greatest(coalesce(p_in, 0), 0), greatest(coalesce(p_out, 0), 0),
          greatest(coalesce(p_cache_read, 0), 0), greatest(coalesce(p_cache_write, 0), 0))
  on conflict (day, kind) do update set
    requests = greatest(u.requests + coalesce(p_requests, 0), 0),
    input_tokens = u.input_tokens + greatest(coalesce(p_in, 0), 0),
    output_tokens = u.output_tokens + greatest(coalesce(p_out, 0), 0),
    cache_read_tokens = u.cache_read_tokens + greatest(coalesce(p_cache_read, 0), 0),
    cache_write_tokens = u.cache_write_tokens + greatest(coalesce(p_cache_write, 0), 0);
end $$;
revoke execute on function public.ai_budget_add(text, int, bigint, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.ai_budget_add(text, int, bigint, bigint, bigint, bigint) to service_role;

-- ───────────── 2. Limpieza periódica ─────────────
create index if not exists rate_limits_window on public.rate_limits (window_start);
create index if not exists coach_quota_tickets_created on public.coach_quota_tickets (created_at);
create index if not exists notification_log_local_day on public.notification_log (local_day);
create index if not exists notifications_created on public.notifications (created_at);

/**
 * Borra por lotes (máx. `p_limit` filas por tabla y corrida, para no bloquear la base) lo que ya no se usa:
 *   rate_limits: ventanas de más de 8 días (la ventana más larga es de 7).
 *   coach_quota_tickets: más de 2 días (un ticket vale 10 minutos).
 *   notification_log: más de 180 días (el cron mira los últimos 2; novedades, hasta 14).
 *   notifications: avisos in-app leídos de más de 180 días, o cualquiera de más de 365.
 *   ai_usage_daily y coach_usage: más de 400 días (el panel muestra hoy y el mes).
 * No toca pagos, auditoría, soporte, comunidad ni datos de entreno. Devuelve cuántas filas borró de cada tabla.
 */
create or replace function public.purge_housekeeping(p_limit int default 5000)
returns jsonb language plpgsql security definer set search_path = public as $$
declare lim int := least(greatest(coalesce(p_limit, 5000), 1), 50000); n_rl int; n_tk int; n_nl int; n_nt int; n_ai int; n_cu int;
begin
  if auth.uid() is not null then raise exception 'No autorizado' using errcode = '42501'; end if;
  delete from public.rate_limits where ctid in (select ctid from public.rate_limits where window_start < now() - interval '8 days' limit lim);
  get diagnostics n_rl = row_count;
  delete from public.coach_quota_tickets where ctid in (select ctid from public.coach_quota_tickets where created_at < now() - interval '2 days' limit lim);
  get diagnostics n_tk = row_count;
  delete from public.notification_log where ctid in (select ctid from public.notification_log where local_day < current_date - 180 limit lim);
  get diagnostics n_nl = row_count;
  delete from public.notifications where ctid in (select ctid from public.notifications
    where (read_at is not null and created_at < now() - interval '180 days') or created_at < now() - interval '365 days' limit lim);
  get diagnostics n_nt = row_count;
  delete from public.ai_usage_daily where ctid in (select ctid from public.ai_usage_daily where day < current_date - 400 limit lim);
  get diagnostics n_ai = row_count;
  delete from public.coach_usage where ctid in (select ctid from public.coach_usage where day < current_date - 400 limit lim);
  get diagnostics n_cu = row_count;
  return jsonb_build_object('rate_limits', n_rl, 'coach_quota_tickets', n_tk, 'notification_log', n_nl, 'notifications', n_nt, 'ai_usage_daily', n_ai, 'coach_usage', n_cu);
end $$;
revoke execute on function public.purge_housekeeping(int) from public, anon, authenticated;
grant execute on function public.purge_housekeeping(int) to service_role;

-- ───────────── 3. Cuenta por correo (sin recorrer toda la lista de Auth) ─────────────
/**
 * id de la cuenta con ese correo, o null. Supabase Auth guarda los correos en minúsculas: se compara igual (usa su índice).
 * Solo service_role (el servidor, para confirmar cuentas).
 */
create or replace function public.auth_user_id_by_email(p_email text)
returns uuid language plpgsql stable security definer set search_path = public, auth as $$
declare found uuid;
begin
  if auth.uid() is not null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_email is null or char_length(p_email) not between 3 and 320 then return null; end if;
  select u.id into found from auth.users u where u.email = lower(btrim(p_email)) order by u.created_at limit 1;
  return found;
end $$;
revoke execute on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;

-- ───────────── 4. Índices de lecturas frecuentes ─────────────
-- Comentarios de una publicación (feed y hoja de comentarios): antes solo había índice por autor.
create index if not exists comments_post_created on public.comments (post_id, created_at);
-- Seguidores de una persona (perfil, "Descubrir", tabla de la tribu): la llave primaria empieza por quien sigue.
create index if not exists follows_followee on public.follows (followee, follower);
-- "¿Ya publicaste el entreno de hoy?": publicación por entreno.
create index if not exists posts_workout on public.posts (workout_id) where workout_id is not null;
-- Cron de retos: recorre los retos activos por id.
create index if not exists user_challenges_active_id on public.user_challenges (id) where status = 'activo';

-- Estadísticas al día para que el planificador use los índices nuevos.
analyze public.comments; analyze public.follows; analyze public.posts; analyze public.user_challenges;
