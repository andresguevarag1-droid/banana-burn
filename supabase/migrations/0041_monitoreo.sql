-- Banana Burn · 0041 monitoreo (errores de la app y última corrida del cron)
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0039 (usa rate_hit de 0023).
-- Qué hace:
--   1. app_errors: errores de la app SIN datos personales (tipo, mensaje limpio, ruta sin ids, digest, versión, familia
--      del navegador). Sin user_id ni IP. El mismo error en 10 minutos suma `hits` en vez de crear otra fila.
--      Nadie escribe directo: solo app_error_report() (service_role, la llama /api/errores y el servidor), que vuelve a
--      limpiar el texto y frena con rate_hit (por cliente y global). Lee solo admin/superadmin.
--   2. admin_error_summary(horas): conteos agrupados para /admin/salud (solo admin/superadmin).
--   3. app_errors_purge(días): borra lo de más de 30 días. La llama el cron diario (service_role).
--   4. ops_heartbeats: última corrida de cada tarea (cron), con resultado y duración. Escribe service_role; lee admin.
--   5. health_ping(): ida y vuelta mínima a Postgres para /api/salud (sin leer tablas).

-- ───────────── 1. Errores ─────────────
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  fingerprint text not null check (char_length(fingerprint) between 1 and 64),
  source text not null check (source in ('client', 'boundary', 'server')),
  kind text not null check (char_length(kind) between 1 and 40),
  route text not null check (char_length(route) between 1 and 120),
  message text not null default '' check (char_length(message) <= 300),
  digest text check (digest is null or char_length(digest) <= 64),
  release text check (release is null or char_length(release) <= 40),
  browser text check (browser is null or char_length(browser) <= 12),
  hits int not null default 1 check (hits >= 1),
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);
create index if not exists app_errors_last_idx on public.app_errors (last_at desc);
create index if not exists app_errors_fp_idx on public.app_errors (fingerprint, last_at desc);

alter table public.app_errors enable row level security;
drop policy if exists "errores: leer admin" on public.app_errors;
create policy "errores: leer admin" on public.app_errors for select using (public.is_admin());
-- Sin políticas de escritura; además sin privilegios (defensa doble). service_role salta la RLS.
revoke all on public.app_errors from public, anon;
revoke insert, update, delete, truncate, references, trigger on public.app_errors from authenticated;
grant select on public.app_errors to authenticated;

/** Texto sin datos personales (repite en la base la limpieza de src/lib/monitor/report.ts). */
create or replace function public._scrub_error_text(p text, p_max int)
returns text language sql immutable set search_path = public as $$
  select left(btrim(regexp_replace(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''),
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[correo]', 'g'),
      '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '[id]', 'g'),
      '(eyJ[A-Za-z0-9_.-]+|[A-Za-z0-9_-]{40,})', '[token]', 'g'),
      '[0-9]{3,}', '[n]', 'g'),
    '[[:cntrl:][:space:]]+', ' ', 'g')), p_max)
$$;
revoke execute on function public._scrub_error_text(text, int) from public, anon, authenticated;

/**
 * Guarda (o suma) un error. Solo service_role. p_key identifica al cliente para el límite (hash, nunca la IP en claro).
 * Devuelve true si quedó guardado, false si se descartó por límite o por datos inválidos.
 */
create or replace function public.app_error_report(p_source text, p_kind text, p_route text, p_message text,
  p_digest text, p_release text, p_browser text, p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  k text := left(coalesce(nullif(regexp_replace(p_kind, '[^A-Za-z0-9_.:-]', '', 'g'), ''), 'Error'), 40);
  r text := left(coalesce(nullif(regexp_replace(p_route, '[^A-Za-z0-9_.:/()\[\]-]', '', 'g'), ''), '/'), 120);
  m text := public._scrub_error_text(p_message, 300);
  d text := nullif(left(regexp_replace(coalesce(p_digest, ''), '[^A-Za-z0-9_-]', '', 'g'), 64), '');
  rel text := nullif(left(regexp_replace(coalesce(p_release, ''), '[^A-Za-z0-9_.-]', '', 'g'), 40), '');
  b text := nullif(left(regexp_replace(coalesce(p_browser, ''), '[^a-z]', '', 'g'), 12), '');
  fp text;
  hit bigint;
begin
  if auth.uid() is not null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_source is null or p_source not in ('client', 'boundary', 'server') then return false; end if;
  if m = '' and d is null and p_source <> 'server' then return false; end if;
  -- Límites: por cliente (30 cada 10 min) y global (600 por minuto). Un bucle de errores no llena la tabla.
  if p_key is not null and not public.rate_hit(left('errores:' || p_key, 200), 600, 30) then return false; end if;
  if not public.rate_hit('errores:global', 60, 600) then return false; end if;
  fp := md5(p_source || '|' || k || '|' || r || '|' || left(m, 120) || '|' || coalesce(rel, ''));
  update public.app_errors set hits = hits + 1, last_at = now(), digest = coalesce(d, digest)
   where id = (select id from public.app_errors where fingerprint = fp and last_at > now() - interval '10 minutes' order by last_at desc limit 1)
  returning id into hit;
  if hit is null then
    insert into public.app_errors (fingerprint, source, kind, route, message, digest, release, browser)
    values (fp, p_source, k, r, m, d, rel, b);
  end if;
  return true;
end $$;
revoke execute on function public.app_error_report(text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.app_error_report(text, text, text, text, text, text, text, text) to service_role;

-- ───────────── 2. Resumen para el panel ─────────────
create or replace function public.admin_error_summary(p_hours int default 24)
returns table (source text, kind text, route text, message text, hits bigint, last_at timestamptz, release text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_hours is null or p_hours not between 1 and 720 then raise exception 'Ventana inválida' using errcode = '22023'; end if;
  return query
    select e.source, e.kind, e.route, e.message, sum(e.hits)::bigint, max(e.last_at), (array_agg(e.release order by e.last_at desc))[1]
      from public.app_errors e
     where e.last_at > now() - make_interval(hours => p_hours)
     group by e.source, e.kind, e.route, e.message
     order by 5 desc, 6 desc
     limit 100;
end $$;
revoke execute on function public.admin_error_summary(int) from public, anon;
grant execute on function public.admin_error_summary(int) to authenticated;

-- ───────────── 3. Limpieza (30 días) ─────────────
create or replace function public.app_errors_purge(p_days int default 30)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is not null then raise exception 'No autorizado' using errcode = '42501'; end if;
  delete from public.app_errors where last_at < now() - make_interval(days => greatest(coalesce(p_days, 30), 1));
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.app_errors_purge(int) from public, anon, authenticated;
grant execute on function public.app_errors_purge(int) to service_role;

-- ───────────── 4. Última corrida de tareas ─────────────
create table if not exists public.ops_heartbeats (
  name text primary key check (name ~ '^[a-z0-9_:-]{1,40}$'),
  last_at timestamptz not null default now(),
  ok boolean not null,
  ms int check (ms is null or ms >= 0),
  detail jsonb not null default '{}'::jsonb check (pg_column_size(detail) < 4000)
);
alter table public.ops_heartbeats enable row level security;
drop policy if exists "tareas: leer admin" on public.ops_heartbeats;
create policy "tareas: leer admin" on public.ops_heartbeats for select using (public.is_admin());
revoke all on public.ops_heartbeats from public, anon;
revoke insert, update, delete, truncate, references, trigger on public.ops_heartbeats from authenticated;
grant select on public.ops_heartbeats to authenticated;

-- ───────────── 5. Ping de salud ─────────────
create or replace function public.health_ping() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.health_ping() to anon, authenticated, service_role;
