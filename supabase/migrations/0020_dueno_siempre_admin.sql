-- 0020: sube a superadmin la cuenta del dueño si ya existe.
-- Idempotente. Ejecútalo completo en el editor SQL de Supabase.

-- 1. Si la cuenta ya existe: subirla a superadmin ahora (crea el perfil si faltara).
insert into public.profiles (id)
select u.id from auth.users u
where lower(u.email) = 'andresguevarag@hotmail.com'
on conflict (id) do nothing;

update public.profiles p
set role = 'superadmin'
from auth.users u
where u.id = p.id
  and lower(u.email) = 'andresguevarag@hotmail.com'
  and p.role is distinct from 'superadmin';

-- 2. (Retirado en 0023) Antes este archivo hacía que cualquier cuenta NUEVA con el correo del dueño naciera superadmin.
--    El registro de la app crea cuentas sin verificar el correo, así que eso permitía a cualquiera quedarse con el rol
--    si la cuenta del dueño no existía. Ahora toda cuenta nueva es 'free' (ver 0023_seguridad_2.sql).
--    Corre el paso 1 solo justo después de crear TÚ la cuenta y de entrar con ella.

-- Comprobación: debe devolver una fila con role = superadmin.
select u.email, p.role, p.plan, p.onboarded
from auth.users u join public.profiles p on p.id = u.id
where lower(u.email) = 'andresguevarag@hotmail.com';
