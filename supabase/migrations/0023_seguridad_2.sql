-- Banana Burn · 0023 segunda auditoría de seguridad
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0022.
-- Qué hace:
--   1. Registro: nadie nace superadmin por su correo. 0020 subía a superadmin a cualquier cuenta NUEVA con el correo del
--      dueño, pero el registro de la app (signUpConfirmed) crea cuentas ya confirmadas sin verificar el correo. Si esa
--      cuenta no existía (borrada, correo cambiado, BD nueva o de preview), cualquiera se registraba con ese correo y
--      quedaba como superadmin. Ahora toda cuenta nueva es 'free'; el rol de staff solo lo da admin_set_role() o el
--      editor SQL (ver la consulta de comprobación al final).
--   2. Límites de frecuencia que no dependen de la instancia: tabla rate_limits + rate_hit(), solo para service_role.
--      La usan el registro, la confirmación de cuentas y la creación de cobros (antes solo había un límite en memoria
--      por instancia de Vercel, que con varias instancias no frena nada).
--   3. Borrado de cuenta: scrub_deleted_user() quita los datos personales que sobrevivían al borrado en cascada
--      (cuerpo crudo de los webhooks de pago, extractos de reportes sobre su contenido y el texto de sus reportes).

-- ───────────── 1. Registro sin roles por correo ─────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, nullif(left(btrim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), 80), ''), 'free')
  on conflict (id) do nothing;
  return new;
end $$;

-- ───────────── 2. Límites de frecuencia en la base ─────────────
create table if not exists public.rate_limits (
  key text not null check (char_length(key) between 1 and 200),
  window_start timestamptz not null,
  n int not null default 0,
  primary key (key, window_start)
);
create index if not exists rate_limits_window on public.rate_limits (window_start);
alter table public.rate_limits enable row level security;
-- Sin políticas: ni anon ni authenticated leen o escriben. Solo rate_hit() (service_role).
revoke all on public.rate_limits from public, anon, authenticated;

/**
 * Cuenta un intento para `p_key` en una ventana fija de `p_window_seconds`. Devuelve true si todavía está dentro del
 * máximo (`p_max`), false si ya lo superó. Atómica (un solo upsert). Solo service_role: las claves las arma el servidor.
 */
create or replace function public.rate_hit(p_key text, p_window_seconds int, p_max int)
returns boolean language plpgsql security definer set search_path = public as $$
declare w timestamptz; used int;
begin
  if auth.uid() is not null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_key is null or char_length(p_key) not between 1 and 200 then raise exception 'Clave inválida' using errcode = '22023'; end if;
  if p_window_seconds is null or p_window_seconds not between 1 and 604800 then raise exception 'Ventana inválida' using errcode = '22023'; end if;
  if p_max is null or p_max not between 1 and 100000 then raise exception 'Máximo inválido' using errcode = '22023'; end if;
  w := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits as r (key, window_start, n) values (p_key, w, 1)
  on conflict (key, window_start) do update set n = r.n + 1 where r.n < p_max
  returning n into used;
  -- Limpieza ocasional de ventanas viejas (máx. 7 días).
  if random() < 0.02 then delete from public.rate_limits where window_start < now() - interval '8 days'; end if;
  return used is not null;
end $$;
revoke execute on function public.rate_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_hit(text, int, int) to service_role;

-- ───────────── 3. Borrado de cuenta completo ─────────────
/**
 * Se llama justo ANTES de borrar el usuario en Auth (deleteAccountData). Lo que queda después del borrado en cascada
 * es contable (payment_events, challenge_purchases con user_id nulo) o de moderación (reports): aquí se quitan los
 * datos personales de esas filas. Solo service_role.
 */
create or replace function public.scrub_deleted_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_user is null then return; end if;
  -- Webhooks de pago: el cuerpo crudo puede traer nombre, correo o teléfono del cliente. Se conservan tipo, montos,
  -- moneda, periodos e IDs del procesador (columnas propias) para la contabilidad.
  update public.payment_events set payload = jsonb_build_object('borrado', true, 'type', type)
   where user_id = p_user and payload is distinct from jsonb_build_object('borrado', true, 'type', type);
  -- Reportes SOBRE su perfil o su contenido: el extracto es una copia de lo que escribió.
  update public.reports set excerpt = null
   where excerpt is not null and (
     (target_type = 'user' and target_id = p_user::text)
     or (target_type = 'post' and target_id in (select id::text from public.posts where user_id = p_user))
     or (target_type = 'comment' and target_id in (select id::text from public.comments where user_id = p_user)));
  -- Reportes que ESCRIBIÓ: reporter queda nulo por la FK; el texto libre también se va.
  update public.reports set details = null where reporter = p_user and details is not null;
end $$;
revoke execute on function public.scrub_deleted_user(uuid) from public, anon, authenticated;
grant execute on function public.scrub_deleted_user(uuid) to service_role;

-- Comprobación (solo lee): quiénes son staff hoy. Si ves una cuenta que no reconoces con rol admin o superadmin,
-- bájala con: update public.profiles set role = 'free' where id = '<id>';
select u.email, p.role, p.created_at
from public.profiles p left join auth.users u on u.id = p.id
where p.role::text in ('admin', 'superadmin')
order by p.created_at;
