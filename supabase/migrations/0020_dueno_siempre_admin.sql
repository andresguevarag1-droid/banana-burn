-- 0020: el dueño queda como superadmin sin importar el orden (registro antes o después de las migraciones).
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

-- 2. Si la cuenta se crea (o se vuelve a crear) después: el registro la deja como superadmin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), 80), ''),
    case when lower(new.email) = 'andresguevarag@hotmail.com' then 'superadmin'::public.app_role else 'free'::public.app_role end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Comprobación: debe devolver una fila con role = superadmin.
select u.email, p.role, p.plan, p.onboarded
from auth.users u join public.profiles p on p.id = u.id
where lower(u.email) = 'andresguevarag@hotmail.com';
