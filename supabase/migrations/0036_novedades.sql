-- 0036: novedades. Recuerda en el servidor la última versión de "Lo nuevo en Banana Burn" que vio cada persona, para
-- mostrar al entrar todo lo que cambió desde su última visita (y el punto "Nuevo" del menú) en cualquier dispositivo.
-- El historial vive en el código (src/lib/novedades.ts); aquí solo se guarda su id ("AAAA-MM-DD-tema") y cuándo se vio.
-- Cada persona solo marca lo suyo: la función usa auth.uid() y la política de profiles ya limita la edición a la fila
-- propia. No toca rol, plan ni acceso. Requiere 0012 (is_api_role). Idempotente: se puede correr más de una vez.

-- ───────────── 1. Columnas ─────────────
alter table public.profiles add column if not exists news_seen text;
alter table public.profiles add column if not exists news_seen_at timestamptz;

do $$ begin
  alter table public.profiles drop constraint if exists profiles_news_check;
  alter table public.profiles add constraint profiles_news_check check (
    news_seen is null or (char_length(news_seen) <= 59 and news_seen ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(-[a-z0-9]+)*$')
  );
end $$;

-- ───────────── 2. La fecha la pone el servidor ─────────────
-- Por la API nadie escribe una fecha inventada: si cambia la versión o la fecha, vale la hora del servidor.
create or replace function public._news_seen_now()
returns trigger language plpgsql as $$
begin
  if public.is_api_role() and (new.news_seen is distinct from old.news_seen or new.news_seen_at is distinct from old.news_seen_at) then
    new.news_seen_at := case when new.news_seen is null then null else now() end;
  end if;
  return new;
end $$;
drop trigger if exists profiles_news_seen on public.profiles;
create trigger profiles_news_seen before update of news_seen, news_seen_at on public.profiles
  for each row execute function public._news_seen_now();

-- ───────────── 3. Marcar como vista (solo la cuenta propia) ─────────────
-- Nunca baja a una versión de una fecha anterior (una pestaña vieja no borra lo visto). El orden dentro del mismo día
-- lo decide la app (src/app/actions/novedades.ts), que conoce el historial.
create or replace function public.news_mark_seen(p_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_id is null or char_length(p_id) > 59 or p_id !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Novedad inválida' using errcode = '22023';
  end if;
  update public.profiles
     set news_seen = p_id, news_seen_at = now()
   where id = v_uid and (news_seen is null or left(news_seen, 10) <= left(p_id, 10));
end $$;
revoke execute on function public.news_mark_seen(text) from public, anon;
grant execute on function public.news_mark_seen(text) to authenticated;

-- ───────────── 4. Aviso a quien no abre la app ─────────────
-- El cron busca cuentas que no vieron la última versión. El aviso se reclama en notification_log
-- (kind 'novedades', local_day = fecha de la versión): uno por persona y por versión. No hace falta nada más aquí.
