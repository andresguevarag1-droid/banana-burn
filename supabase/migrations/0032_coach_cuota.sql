-- Banana Burn · 0032 cupo de Coach Banana por plan (para que el coach no dispare el costo de la app)
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0031.
-- Qué hace (decisión del dueño, octubre de 2026):
--   1. Límites por plan, por día y por mes (calendario de Costa Rica, el mismo "hoy" de toda la app: cr_today()).
--      Los números viven en _coach_limits() y son los mismos de COACH_LIMITS en src/lib/coach-quota.ts (hay prueba que lo revisa):
--        prueba (prueba de 7 días, beta y testers): 10 al día, 150 al mes
--        entreno: 10 al día, 150 al mes
--        completo (Entreno + Nutrición, cortesías): 20 al día, 300 al mes
--        staff (coach, soporte, admin, superadmin): sin límite, pero cada pregunta se cuenta igual
--        sin plan ni prueba: 0 (el coach ya estaba cerrado)
--   2. coach_take_quota('chat'): revisa el plan con las mismas reglas de acceso de la base (_has_app_access de 0026 y
--      comp_grants), y solo si queda cupo suma 1 en coach_usage (tabla de 0012, que nadie edita por la API).
--      Un candado por usuario (pg_advisory_xact_lock) hace que dos preguntas al mismo tiempo no se pasen del tope.
--      Devuelve lo usado, los topes y un ticket para devolver la pregunta.
--   3. coach_refund_quota(ticket): si la respuesta falla antes de mandar texto, el servidor devuelve la unidad.
--      Un ticket sirve una sola vez, solo a su dueño y por 10 minutos. Los tickets no se pueden leer por la API,
--      así que nadie devuelve preguntas que sí se respondieron.
--   4. coach_quota_status(): solo lee, para mostrar "Te quedan X preguntas hoy".
--   5. admin_coach_usage(user): uso de hoy y del mes de una persona, o el total (solo staff), para el panel.
-- coach_consume() de 0012/0013 sigue igual para el feedback del entreno ('feedback', 20 al día).

-- ───────────── 1. Topes y nivel ─────────────
/** Topes por nivel: (por día, por mes). null = sin límite. Mismos números que COACH_LIMITS (src/lib/coach-quota.ts). */
create or replace function public._coach_limits(p_tier text, out per_day int, out per_month int)
language sql immutable set search_path = public as $$
  select case p_tier when 'prueba' then 10 when 'entreno' then 10 when 'completo' then 20 when 'staff' then null else 0 end,
         case p_tier when 'prueba' then 150 when 'entreno' then 150 when 'completo' then 300 when 'staff' then null else 0 end;
$$;
revoke all on function public._coach_limits(text) from public, anon, authenticated;

/**
 * Nivel de cupo de una persona. Mismo orden que tierFromAccess() en src/lib/coach-quota.ts:
 * sin acceso → none; staff → staff; plan o cortesía con nutrición → completo; plan o regalo Entreno → entreno;
 * todo lo demás con acceso (beta, prueba de 7 días, mes de tester) → prueba.
 */
create or replace function public._coach_tier(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_user is null or not public._has_app_access(p_user) then 'none'
    when exists (select 1 from public.profiles p where p.id = p_user and p.role::text in ('coach','support','admin','superadmin')) then 'staff'
    when exists (select 1 from public.profiles p where p.id = p_user and p.plan in ('completo','pro'))
      or exists (select 1 from public.comp_grants g where g.user_id = p_user and g.revoked_at is null and g.starts_at <= now() and g.expires_at > now()
                   and g.source <> 'tester' and (g.plan = 'completo' or g.source = 'cortesia')) then 'completo'
    when exists (select 1 from public.profiles p where p.id = p_user and p.plan = 'entreno')
      or exists (select 1 from public.comp_grants g where g.user_id = p_user and g.revoked_at is null and g.starts_at <= now() and g.expires_at > now()
                   and g.source <> 'tester') then 'entreno'
    else 'prueba'
  end;
$$;
revoke all on function public._coach_tier(uuid) from public, anon, authenticated;

-- ───────────── 2. Tickets para devolver una pregunta ─────────────
create table if not exists public.coach_quota_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  refunded_at timestamptz
);
create index if not exists coach_quota_tickets_user on public.coach_quota_tickets (user_id, created_at);
alter table public.coach_quota_tickets enable row level security;
-- Sin políticas: nadie lee ni escribe por la API (solo las funciones de abajo).
revoke all on public.coach_quota_tickets from public, anon, authenticated;

-- coach_usage (0012): la persona solo lee lo suyo; ya no puede insertar, editar ni borrar. Se repite por si acaso.
revoke insert, update, delete, truncate on public.coach_usage from public, anon, authenticated;

/** Estado en jsonb (mismo formato para tomar, consultar y el panel). */
create or replace function public._coach_quota_json(p_tier text, p_day_used int, p_month_used int, p_ok boolean, p_reason text, p_ticket uuid)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'ok', p_ok, 'reason', p_reason, 'tier', p_tier, 'ticket', p_ticket,
    'day_used', p_day_used, 'month_used', p_month_used,
    'day_limit', l.per_day, 'month_limit', l.per_month,
    'left', case when l.per_day is null and l.per_month is null then null
                 else greatest(0, least(coalesce(l.per_day - p_day_used, l.per_month - p_month_used), coalesce(l.per_month - p_month_used, l.per_day - p_day_used))) end,
    'now', now())
  from public._coach_limits(p_tier) l;
$$;
revoke all on function public._coach_quota_json(text, int, int, boolean, text, uuid) from public, anon, authenticated;

/** Lo usado hoy y en el mes (calendario de Costa Rica). */
create or replace function public._coach_used(p_user uuid, out day_used int, out month_used int)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(n) filter (where day = public.cr_today()), 0)::int, coalesce(sum(n), 0)::int
    from public.coach_usage
   where user_id = p_user and kind = 'chat' and day >= date_trunc('month', public.cr_today())::date and day <= public.cr_today();
$$;
revoke all on function public._coach_used(uuid) from public, anon, authenticated;

-- ───────────── 3. Tomar, devolver y consultar ─────────────
/**
 * Toma 1 pregunta del cupo si queda. Atómico: candado por usuario durante la transacción, así dos pestañas o dos
 * peticiones al mismo tiempo no pasan del tope. Sin cupo no suma nada. Devuelve el estado (ok, reason, left, ticket...).
 */
create or replace function public.coach_take_quota(p_kind text default 'chat')
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t text; l record; u record; tk uuid; d date := public.cr_today();
begin
  if uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_kind is distinct from 'chat' then raise exception 'Tipo inválido' using errcode = '22023'; end if;
  t := public._coach_tier(uid);
  if t = 'none' then return public._coach_quota_json(t, 0, 0, false, 'locked', null); end if;
  perform pg_advisory_xact_lock(hashtextextended('coach_quota:' || uid::text, 0));
  select * into l from public._coach_limits(t);
  select * into u from public._coach_used(uid);
  if l.per_month is not null and u.month_used >= l.per_month then return public._coach_quota_json(t, u.day_used, u.month_used, false, 'month', null); end if;
  if l.per_day is not null and u.day_used >= l.per_day then return public._coach_quota_json(t, u.day_used, u.month_used, false, 'day', null); end if;
  insert into public.coach_usage as cu (user_id, day, kind, n) values (uid, d, 'chat', 1)
  on conflict (user_id, day, kind) do update set n = cu.n + 1;
  insert into public.coach_quota_tickets (user_id, day) values (uid, d) returning id into tk;
  delete from public.coach_quota_tickets where user_id = uid and created_at < now() - interval '2 days';
  return public._coach_quota_json(t, u.day_used + 1, u.month_used + 1, true, null, tk);
end $$;
revoke all on function public.coach_take_quota(text) from public, anon;
grant execute on function public.coach_take_quota(text) to authenticated;

/** Devuelve la pregunta de un ticket (la respuesta falló antes de mandar texto). Una vez, solo su dueño, 10 minutos. */
create or replace function public.coach_refund_quota(p_ticket uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d date;
begin
  if uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.coach_quota_tickets set refunded_at = now()
   where id = p_ticket and user_id = uid and refunded_at is null and created_at > now() - interval '10 minutes'
  returning day into d;
  if d is null then return false; end if;
  update public.coach_usage set n = greatest(n - 1, 0) where user_id = uid and day = d and kind = 'chat';
  return true;
end $$;
revoke all on function public.coach_refund_quota(uuid) from public, anon;
grant execute on function public.coach_refund_quota(uuid) to authenticated;

/** Solo lee: cuánto le queda a la persona de la sesión. */
create or replace function public.coach_quota_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); t text; u record;
begin
  if uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  t := public._coach_tier(uid);
  select * into u from public._coach_used(uid);
  return public._coach_quota_json(t, u.day_used, u.month_used, t <> 'none', case when t = 'none' then 'locked' end, null);
end $$;
revoke all on function public.coach_quota_status() from public, anon;
grant execute on function public.coach_quota_status() to authenticated;

-- ───────────── 4. Panel ─────────────
/**
 * Staff: con p_user, el uso de esa persona (nivel, hoy, mes); sin p_user, el total de hoy y del mes y cuántas
 * personas llegaron hoy a su tope diario. Solo conteos: nunca el contenido de las conversaciones.
 */
create or replace function public.admin_coach_usage(p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t text; u record; d date := public.cr_today(); m date := date_trunc('month', public.cr_today())::date;
begin
  if not public.is_staff() then raise exception 'Solo staff' using errcode = '42501'; end if;
  if p_user is not null then
    t := public._coach_tier(p_user);
    select * into u from public._coach_used(p_user);
    return public._coach_quota_json(t, u.day_used, u.month_used, t <> 'none', null, null);
  end if;
  return (select jsonb_build_object(
      'day_total', coalesce(sum(n) filter (where day = d), 0),
      'month_total', coalesce(sum(n), 0),
      'users_today', count(distinct user_id) filter (where day = d and n > 0),
      'users_month', count(distinct user_id) filter (where n > 0),
      'at_limit_today', (select count(*) from public.coach_usage c, public._coach_limits(public._coach_tier(c.user_id)) l
                          where c.kind = 'chat' and c.day = d and l.per_day is not null and c.n >= l.per_day),
      'now', now())
    from public.coach_usage where kind = 'chat' and day between m and d);
end $$;
revoke all on function public.admin_coach_usage(uuid) from public, anon;
grant execute on function public.admin_coach_usage(uuid) to authenticated;

-- Comprobación (solo lee): preguntas al coach de hoy.
select coalesce(sum(n), 0) as preguntas_hoy from public.coach_usage where kind = 'chat' and day = public.cr_today();
