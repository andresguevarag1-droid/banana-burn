-- Banana Burn · 0074 referidos con tarjeta obligatoria (#333): "En prueba" o "Pagó" por amigo, con su nombre de pila.
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0073. Correr ANTES de fusionar la PR.
-- La regla de 0064 no cambia: desde el 23 nov (0073) el amigo deja la tarjeta el día 0 y eso NO es un pago; cuenta solo
-- cuando entra su primer cobro verificado (día 8), que pasa por activate() en billing.ts y llama a referral_paid().
-- Si cancela antes del día 8 no hay cobro y no cuenta. Aquí solo cambia lo que ve quien invita en /app/referidos:
--   - first_name: el nombre de pila (la primera palabra de profiles.full_name, máximo 30 caracteres). Nada más del amigo.
--     Si full_name es un correo (tiene '@') o la primera palabra tiene '.', '_' o dígitos (ana.rojas, ana_r, ana92), es null
--     y la página muestra solo la inicial: esa palabra puede traer el apellido.
--   - in_trial: registrado, sin pago y con un cobro programado (dejó la tarjeta y su prueba sigue). Si canceló, false.
-- Cambian las columnas que devuelve: hay que borrar la función y volver a crearla (con sus permisos).

drop function if exists public.my_referrals();
create function public.my_referrals()
returns table (initial text, first_name text, status text, created_at timestamptz, qualified_at timestamptz, annual boolean, group_no int, expired boolean, in_trial boolean)
language sql stable security definer set search_path = public as $$
  select upper(left(coalesce(nullif(btrim(p.full_name), ''), '?'), 1)),
         case when p.full_name like '%@%' or w.word ~ '[._[:digit:]]' then null else nullif(left(w.word, 30), '') end,
         r.status, r.created_at, r.qualified_at, r.annual_paid_at is not null, r.group_no,
         r.status = 'registrado' and r.created_at + interval '60 days' < now() and (r.paid_at is null or r.paid_at > r.created_at + interval '60 days'),
         r.status = 'registrado' and r.paid_at is null and exists (
           select 1 from public.trial_charges t
            where t.user_id = r.referred and t.status in ('scheduled', 'retry_scheduled', 'charging', 'pending', 'unknown'))
  from public.referrals r left join public.profiles p on p.id = r.referred
  cross join lateral (select split_part(regexp_replace(btrim(coalesce(p.full_name, '')), '[[:space:]]+', ' ', 'g'), ' ', 1) as word) w
  where r.referrer = auth.uid()
  order by r.created_at desc
  limit 200;
$$;
revoke execute on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated;

-- Verificación al aplicar: todo debe salir true.
select 'ok 0074' as migracion,
  to_regprocedure('public.my_referrals()') is not null as mis_referidos,
  exists (select 1 from pg_proc where proname = 'my_referrals' and 'in_trial' = any(proargnames)) as en_prueba,
  exists (select 1 from pg_proc where proname = 'my_referrals' and 'first_name' = any(proargnames)) as nombre_de_pila;
