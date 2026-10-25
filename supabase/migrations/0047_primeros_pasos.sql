-- 0047: primeros pasos y "Aprende a entrenar". Recuerda en el servidor qué pasos de la primera semana ya hizo la persona,
-- qué lecciones leyó y qué recorridos guiados ya vio (Hoy, Entrenar), para no repetírselos en otro dispositivo.
-- Solo claves cortas en minúsculas, máximo 64 por persona. Cada persona marca solo lo suyo (auth.uid()). No toca rol,
-- plan ni acceso. Idempotente: se puede correr más de una vez.

alter table public.profiles add column if not exists learn_keys text[] not null default '{}';

do $$ begin
  alter table public.profiles drop constraint if exists profiles_learn_keys_check;
  alter table public.profiles add constraint profiles_learn_keys_check check (
    cardinality(learn_keys) <= 64 and array_to_string(learn_keys, ',') ~ '^[a-z0-9,-]*$'
  );
end $$;

-- Marcar una clave (sin repetir). Desconocida o mal formada: error; tope alcanzado: no hace nada.
create or replace function public.learn_mark(p_key text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_key is null or p_key !~ '^[a-z0-9-]{1,24}$' then raise exception 'Clave inválida' using errcode = '22023'; end if;
  update public.profiles
     set learn_keys = learn_keys || p_key
   where id = v_uid and not (p_key = any(learn_keys)) and cardinality(learn_keys) < 64;
end $$;
revoke execute on function public.learn_mark(text) from public, anon;
grant execute on function public.learn_mark(text) to authenticated;
