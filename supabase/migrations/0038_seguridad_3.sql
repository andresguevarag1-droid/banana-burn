-- Banana Burn · 0038 tercera auditoría de seguridad
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0037 (no depende de 0037).
-- Qué hace:
--   1. public_profiles queda de SOLO LECTURA. La vista corre con los permisos de su dueño (security_invoker = false, a
--      propósito: así muestra el perfil público sin abrir la tabla profiles), y por eso SALTA la RLS de profiles. Pero
--      authenticated conservaba INSERT/UPDATE/DELETE sobre la vista (privilegios por defecto de Supabase; 0012 solo los
--      quitó a anon). Resultado: cualquier cuenta podía, por la API REST, cambiar el nombre, usuario, bio o visibilidad
--      de cualquier perfil no privado (PATCH /rest/v1/public_profiles?id=eq.<otro>) o borrar su fila de profiles
--      (DELETE). Ahora solo se puede leer. Además, toda vista o vista materializada del esquema public queda sin
--      permisos de escritura para anon/authenticated (defensa para vistas futuras).
--   2. Datos de pago con mínimo privilegio: billing_customers, payment_events (cuerpo crudo del webhook, con nombre,
--      correo o teléfono del cliente) y challenge_purchases los lee la propia persona o el staff de cuentas
--      (soporte/admin/superadmin, is_billing_staff), ya no el rol coach. Es la misma regla del panel
--      ("payments.view" y "challenges.sales" = soporte/admin), ahora también en la base.

-- ───────────── 1. Vistas de solo lectura ─────────────
revoke insert, update, delete, truncate, references, trigger on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to authenticated;
-- security_barrier: los filtros de quien consulta no se evalúan antes del WHERE de la vista (no filtran perfiles privados).
alter view public.public_profiles set (security_barrier = true);

do $$
declare r record;
begin
  for r in
    select c.oid::regclass as rel from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('v', 'm')
  loop
    execute format('revoke insert, update, delete, truncate on %s from public, anon, authenticated', r.rel);
  end loop;
end $$;

-- ───────────── 2. Datos de pago: dueño o staff de cuentas ─────────────
drop policy if exists "cliente de pago: leer propio o staff" on public.billing_customers;
drop policy if exists "cliente de pago: leer propio o staff de cuentas" on public.billing_customers;
create policy "cliente de pago: leer propio o staff de cuentas" on public.billing_customers
  for select using (user_id = auth.uid() or public.is_billing_staff());

drop policy if exists "eventos de pago: leer propios o staff" on public.payment_events;
drop policy if exists "eventos de pago: leer propios o staff de cuentas" on public.payment_events;
create policy "eventos de pago: leer propios o staff de cuentas" on public.payment_events
  for select using (user_id = auth.uid() or public.is_billing_staff());

drop policy if exists "compras de retos: propias o staff" on public.challenge_purchases;
drop policy if exists "compras de retos: propias o staff de cuentas" on public.challenge_purchases;
create policy "compras de retos: propias o staff de cuentas" on public.challenge_purchases
  for select using (user_id = auth.uid() or public.is_billing_staff());

-- Comprobación (solo lee): debe decir false en las tres columnas.
select has_table_privilege('authenticated', 'public.public_profiles', 'update') as puede_editar,
       has_table_privilege('authenticated', 'public.public_profiles', 'delete') as puede_borrar,
       has_table_privilege('authenticated', 'public.public_profiles', 'insert') as puede_insertar;
