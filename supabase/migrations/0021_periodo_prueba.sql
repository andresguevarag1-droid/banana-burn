-- 0021: período de prueba del servicio (beta).
-- Hasta el 1 de noviembre de 2026 (medianoche de Costa Rica) todas las cuentas tienen acceso completo y gratis.
-- Desde esa fecha vuelve la regla normal: staff, plan, cortesía o prueba de 7 días desde el registro.
-- Misma fecha que BETA_ENDS_AT en src/lib/plans.ts: si mueves una, mueve la otra. Idempotente.

create or replace function public._has_app_access(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    now() < timestamptz '2026-11-01 06:00:00+00'
    or exists (
      select 1 from public.profiles p where p.id = p_user and (
        p.role::text in ('coach','support','admin','superadmin')
        or p.plan in ('entreno','completo','pro')
        or p.created_at > now() - interval '7 days'))
    or exists (
      select 1 from public.comp_grants g where g.user_id = p_user and g.revoked_at is null and g.starts_at <= now() and g.expires_at > now())
  );
$$;
revoke all on function public._has_app_access(uuid) from public, anon, authenticated;
