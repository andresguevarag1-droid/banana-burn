-- 0022: acceso a nutrición en la base de datos (defensa en profundidad).
-- Idempotente: se puede correr varias veces sobre una BD con 0001-0021.
-- Fuente de verdad en la app: src/lib/entitlements.ts (`ent.nutrition`). Las acciones del servidor ya lo exigen;
-- aquí se repite la regla para que nadie registre comidas, guarde alimentos ni cree recetas por la API REST
-- sin el plan que las incluye.
-- Quién tiene nutrición:
--   - Todas las cuentas durante el período de prueba del servicio (hasta el 1 de noviembre de 2026, medianoche de
--     Costa Rica; misma fecha que BETA_ENDS_AT en src/lib/plans.ts y que _has_app_access() en 0021).
--   - Staff (coach, support, admin, superadmin).
--   - Plan Entreno + Nutrición (profiles.plan 'completo' o el histórico 'pro').
--   - Prueba gratis de 7 días desde profiles.created_at.
--   - Cortesía vigente: en la app toda cortesía vale como completo (entitlements.ts), aunque comp_grants.plan diga
--     'entreno'; aquí igual, para que la base nunca sea más estricta que la app.
-- Leer y borrar lo propio sigue abierto (no da nada de más); crear y editar piden nutrición.

create or replace function public._has_nutrition_access(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    now() < timestamptz '2026-11-01 06:00:00+00'
    or exists (
      select 1 from public.profiles p where p.id = p_user and (
        p.role::text in ('coach','support','admin','superadmin')
        or p.plan in ('completo','pro')
        or p.created_at > now() - interval '7 days'))
    or exists (
      select 1 from public.comp_grants g where g.user_id = p_user and g.revoked_at is null and g.starts_at <= now() and g.expires_at > now())
  );
$$;
revoke all on function public._has_nutrition_access(uuid) from public, anon, authenticated;

/** ¿El usuario actual tiene nutrición (plan Entreno + Nutrición, prueba, beta, cortesía o staff)? */
create or replace function public.has_nutrition_access()
returns boolean language sql stable security definer set search_path = public as $$
  select public._has_nutrition_access(auth.uid());
$$;
revoke execute on function public.has_nutrition_access() from public, anon;
grant execute on function public.has_nutrition_access() to authenticated;

-- ───────────── Comidas (meals): la política "propio: todo" de 0001 se divide por operación ─────────────
drop policy if exists "propio: todo" on public.meals;
drop policy if exists "meals: leer propias" on public.meals;
drop policy if exists "meals: crear propias con nutrición" on public.meals;
drop policy if exists "meals: editar propias con nutrición" on public.meals;
drop policy if exists "meals: borrar propias" on public.meals;
create policy "meals: leer propias" on public.meals for select using (user_id = auth.uid());
create policy "meals: crear propias con nutrición" on public.meals for insert
  with check (user_id = auth.uid() and public.has_nutrition_access());
create policy "meals: editar propias con nutrición" on public.meals for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_nutrition_access());
create policy "meals: borrar propias" on public.meals for delete using (user_id = auth.uid());

-- ───────────── Mis comidas (saved_foods, 0015) ─────────────
drop policy if exists "saved_foods: crear propias" on public.saved_foods;
drop policy if exists "saved_foods: editar propias" on public.saved_foods;
create policy "saved_foods: crear propias" on public.saved_foods for insert
  with check (user_id = auth.uid() and public.has_nutrition_access());
create policy "saved_foods: editar propias" on public.saved_foods for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_nutrition_access());

-- ───────────── Mis recetas (user_recipes, 0017) ─────────────
drop policy if exists "user_recipes: crear propias" on public.user_recipes;
drop policy if exists "user_recipes: editar propias" on public.user_recipes;
create policy "user_recipes: crear propias" on public.user_recipes for insert
  with check (user_id = auth.uid() and public.has_nutrition_access());
create policy "user_recipes: editar propias" on public.user_recipes for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_nutrition_access());
