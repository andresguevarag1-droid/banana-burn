-- 0016: acceso de administrador para el dueño de Banana Burn.
-- Idempotente. Ejecútalo en el editor SQL de Supabase DESPUÉS de que la cuenta exista
-- (regístrate primero en la app con andresguevarag@hotmail.com). Si la cuenta aún no existe, no hace nada.
-- Corre como postgres en el editor SQL, así que el bloqueo de role/plan de 0012 (solo API) no lo impide.

update public.profiles p
set role = 'superadmin'
from auth.users u
where u.id = p.id
  and lower(u.email) = 'andresguevarag@hotmail.com'
  and p.role is distinct from 'superadmin';

-- Comprobación: debe devolver una fila con role = superadmin.
select u.email, p.role, p.plan
from auth.users u join public.profiles p on p.id = u.id
where lower(u.email) = 'andresguevarag@hotmail.com';
