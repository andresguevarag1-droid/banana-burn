-- ¿Qué migraciones ya corrí? Pégala completa en Supabase → SQL Editor y toca Run.
-- Solo lee, no cambia nada. Corre en orden las que digan FALTA (cualquiera de 0012 a 0022 se puede repetir sin daño).
select m.archivo,
       case when m.aplicada then 'Ya está' else 'FALTA: córrela' end as estado
from (values
  (1, '0012_seguridad.sql',           to_regprocedure('public.is_api_role()') is not null),
  (2, '0013_acceso_comunidad_retos.sql', to_regprocedure('public._has_app_access(uuid)') is not null),
  (3, '0014_multiusuario.sql',        to_regprocedure('public.can_see_post(bigint)') is not null or exists (select 1 from pg_proc where proname = 'can_see_post')),
  (4, '0015_nutricion.sql',           to_regclass('public.saved_foods') is not null),
  (5, '0016_admin_dueno.sql',         exists (select 1 from auth.users u join public.profiles p on p.id = u.id where lower(u.email) = 'andresguevarag@hotmail.com' and p.role::text = 'superadmin')),
  (6, '0017_mis_recetas.sql',         to_regclass('public.user_recipes') is not null),
  (7, '0018_tienda_retos.sql',        to_regclass('public.challenge_purchases') is not null),
  (8, '0019_comunidad_tribu.sql',     exists (select 1 from pg_proc where proname = 'community_board')),
  (9, '0020_dueno_siempre_admin.sql', exists (select 1 from pg_proc where proname = 'handle_new_user' and prosrc ilike '%andresguevarag@hotmail.com%')),
  (10,'0021_periodo_prueba.sql',      exists (select 1 from pg_proc where proname = '_has_app_access' and prosrc like '%2026-11-01%')),
  (11,'0022_acceso_nutricion.sql',    to_regprocedure('public.has_nutrition_access()') is not null and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'meals' and policyname = 'meals: crear propias con nutrición'))
) as m(orden, archivo, aplicada)
order by m.orden;
