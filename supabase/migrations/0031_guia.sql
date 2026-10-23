-- 0031: guía de la app. Recuerda en el servidor si la persona ya vio la guía (y qué versión), para que se abra una sola
-- vez después de la bienvenida y una versión nueva se pueda volver a mostrar. También guarda los consejos de la primera
-- vez que ya cerró (Entrenar, el reproductor y Nutrición).
-- Cada persona solo marca lo suyo: las funciones usan auth.uid() y la política de profiles ya limita la edición a la
-- fila propia. No toca rol, plan ni acceso. Requiere 0012 (is_api_role). Idempotente: se puede correr más de una vez.

-- ───────────── 1. Columnas ─────────────
alter table public.profiles add column if not exists guide_version smallint;
alter table public.profiles add column if not exists guide_seen_at timestamptz;
alter table public.profiles add column if not exists guide_tips text[] not null default '{}';

do $$ begin
  alter table public.profiles drop constraint if exists profiles_guide_check;
  alter table public.profiles add constraint profiles_guide_check check (
    (guide_version is null or guide_version between 1 and 100)
    and cardinality(guide_tips) <= 16
    and array_to_string(guide_tips, ',') ~ '^[a-z0-9,-]*$'
  );
end $$;

-- ───────────── 2. La fecha la pone el servidor ─────────────
-- Por la API nadie escribe una fecha inventada: si cambia la versión o la fecha, vale la hora del servidor.
create or replace function public._guide_seen_now()
returns trigger language plpgsql as $$
begin
  if public.is_api_role() and (new.guide_version is distinct from old.guide_version or new.guide_seen_at is distinct from old.guide_seen_at) then
    new.guide_seen_at := case when new.guide_version is null then null else now() end;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guide_seen on public.profiles;
create trigger profiles_guide_seen before update of guide_version, guide_seen_at on public.profiles
  for each row execute function public._guide_seen_now();

-- ───────────── 3. Marcar como vista (solo la cuenta propia) ─────────────
create or replace function public.guide_mark_seen(p_version integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_version is null or p_version < 1 or p_version > 100 then raise exception 'Versión inválida' using errcode = '22023'; end if;
  update public.profiles
     set guide_version = greatest(coalesce(guide_version, 0), p_version), guide_seen_at = now()
   where id = v_uid;
end $$;
revoke execute on function public.guide_mark_seen(integer) from public, anon;
grant execute on function public.guide_mark_seen(integer) to authenticated;

/** Consejo de la primera vez cerrado. Clave corta en minúsculas; repetirla no la duplica. */
create or replace function public.guide_tip_seen(p_key text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_key is null or p_key !~ '^[a-z0-9-]{1,24}$' then raise exception 'Consejo inválido' using errcode = '22023'; end if;
  update public.profiles
     set guide_tips = guide_tips || p_key
   where id = v_uid and not (p_key = any(guide_tips)) and cardinality(guide_tips) < 16;
end $$;
revoke execute on function public.guide_tip_seen(text) from public, anon;
grant execute on function public.guide_tip_seen(text) to authenticated;
