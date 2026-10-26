-- 0056_admin_cuentas.sql: el superadmin administra cuentas desde el panel. Idempotente: se puede pegar varias veces.
-- Requiere 0001-0055.
--   1. profiles.blocked_at / blocked_reason: cuenta bloqueada (la app no la deja entrar). Solo el panel la cambia.
--   2. badge_overrides: insignias otorgadas o quitadas a mano. _insignias() las respeta (el resto sigue calculado con
--      datos reales). _insignias_base() es la regla de 0030 sin cambios.
--   3. RPC del superadmin, cada una valida el rol y escribe audit_log (con antes y después) en la misma transacción:
--      admin_update_profile, admin_set_blocked, admin_grant_comp_long (cortesía hasta 10 años), admin_revoke_challenge,
--      admin_reset_challenge, admin_reset_season_intake, admin_set_badge, admin_adjust_xp y admin_user_manage (lectura).
--   4. admin_sign_out_all(): cierra todas las sesiones de una cuenta. Solo service_role (lo llama el servidor).
--   5. admin_list_users_v2(): la lista del panel con país, temporada y estados (prueba, pagando, beta, vencido, bloqueado).

-- ───────────── 1. Cuenta bloqueada ─────────────
alter table public.profiles add column if not exists blocked_at timestamptz;
alter table public.profiles add column if not exists blocked_reason text;
alter table public.profiles drop constraint if exists profiles_blocked_reason_len;
alter table public.profiles add constraint profiles_blocked_reason_len check (blocked_reason is null or char_length(blocked_reason) <= 300) not valid;

-- Igual que 0013, más el bloqueo: por la API nadie cambia su rol, plan, suspensión ni bloqueo.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql as $$
begin
  if (new.role is distinct from old.role or new.plan is distinct from old.plan) and public.is_api_role() then
    raise exception 'No autorizado para cambiar rol o plan' using errcode = '42501';
  end if;
  if (new.suspended_at is distinct from old.suspended_at or new.suspended_reason is distinct from old.suspended_reason) and public.is_api_role() then
    raise exception 'No autorizado para cambiar la suspensión' using errcode = '42501';
  end if;
  if (new.blocked_at is distinct from old.blocked_at or new.blocked_reason is distinct from old.blocked_reason) and public.is_api_role() then
    raise exception 'No autorizado para cambiar el bloqueo' using errcode = '42501';
  end if;
  if public.is_api_role() then
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

/** Auditoría de las acciones de esta migración (antes y después). */
create or replace function public._admin_audit(p_action text, p_target uuid, p_meta jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor, action, target, meta) values (auth.uid(), p_action, p_target::text, p_meta);
$$;
revoke all on function public._admin_audit(text, uuid, jsonb) from public, anon, authenticated;

/** Motivo obligatorio (4 a 300 caracteres) en toda acción del superadmin. */
create or replace function public._admin_reason(p_reason text)
returns text language plpgsql immutable as $$
begin
  if p_reason is null or char_length(btrim(p_reason)) < 4 then raise exception 'Escribe el motivo' using errcode = 'P0001'; end if;
  return left(btrim(p_reason), 300);
end $$;

-- ───────────── 2. Insignias a mano ─────────────
create table if not exists public.badge_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null check (badge_id ~ '^[a-z0-9][a-z0-9:._-]{0,79}$'),
  mode text not null check (mode in ('otorgada', 'quitada')),
  -- Quién y por qué quedan en audit_log (la persona puede leer esta tabla: ve sus insignias, no el motivo).
  created_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);
alter table public.badge_overrides enable row level security;
drop policy if exists "insignias a mano: propias o staff" on public.badge_overrides;
create policy "insignias a mano: propias o staff" on public.badge_overrides for select using (user_id = (select auth.uid()) or public.is_staff());
revoke insert, update, delete on public.badge_overrides from anon, authenticated; -- solo admin_set_badge
revoke all on public.badge_overrides from anon;

/** La regla de 0030, sin cambios: lo que la persona ganó con datos reales. */
create or replace function public._insignias_base(p_user uuid)
returns table (id text, label text, detail text, icon text, cover text, kind text, earned_at timestamptz)
language sql stable security definer set search_path = public as $$
  with st as (select * from public._power_stats(p_user)),
  wk as (select count(*) as n from public.workouts where user_id = p_user)
  select 'prog:' || c.slug, coalesce(nullif(c.reward_title, ''), c.badge), c.title, c.icon, c.cover, 'certificado', up.completed_at
    from public.user_programs up join public.challenges_catalog c on c.slug = up.slug
   where up.user_id = p_user and up.status = 'completado'
  union all
  select distinct on (c.slug) 'reto:' || c.slug, c.badge, c.title, c.icon, c.cover, case when c.price_usd > 0 then 'certificado' else 'medalla' end, uc.completed_at
    from public.user_challenges uc join public.challenges_catalog c on c.slug = uc.challenge_id
   where uc.user_id = p_user and uc.status = 'completado'
     and not exists (select 1 from public.user_programs up where up.user_id = p_user and up.slug = c.slug and up.status = 'completado')
  union all select 'nivel', null, null, null, null, 'nivel', null from st
  union all select 'racha7', null, null, null, null, 'racha', null from st where st.best_streak >= 7
  union all select 'racha30', null, null, null, null, 'racha', null from st where st.best_streak >= 30
  union all select 'verificado', null, null, null, null, 'verificado', (select reviewed_at from public.identity_verifications where user_id = p_user) from st where st.verified
  union all select 'coleccion', null, null, null, null, 'coleccion', null from st where st.premium_owned >= 3
  union all select 'tester', null, null, null, null, 'logro', null where public._was_tester(p_user)
  union all select 'pr', null, null, null, null, 'logro', null where exists (select 1 from public.xp_events where user_id = p_user and kind = 'pr')
  union all select 'w10', null, null, null, null, 'logro', null from wk where wk.n >= 10
  union all select 'w50', null, null, null, null, 'logro', null from wk where wk.n >= 50;
$$;
revoke all on function public._insignias_base(uuid) from public, anon, authenticated;

/** Insignias que se ven: las ganadas menos las quitadas a mano, más las otorgadas a mano. */
create or replace function public._insignias(p_user uuid)
returns table (id text, label text, detail text, icon text, cover text, kind text, earned_at timestamptz)
language sql stable security definer set search_path = public as $$
  with b as (select * from public._insignias_base(p_user)),
  o as (select * from public.badge_overrides where user_id = p_user)
  select b.* from b where not exists (select 1 from o where o.badge_id = b.id and o.mode = 'quitada')
  union all
  select o.badge_id,
         case when o.badge_id like 'prog:%' then coalesce(nullif(c.reward_title, ''), c.badge) else c.badge end,
         c.title, c.icon, c.cover,
         case when o.badge_id like 'prog:%' then 'certificado'
              when o.badge_id like 'reto:%' then case when c.price_usd > 0 then 'certificado' else 'medalla' end
              when o.badge_id in ('racha7', 'racha30') then 'racha'
              when o.badge_id = 'coleccion' then 'coleccion'
              else 'logro' end,
         o.created_at
    from o left join public.challenges_catalog c on o.badge_id ~ '^(prog|reto):' and c.slug = substring(o.badge_id from 6)
   where o.mode = 'otorgada' and not exists (select 1 from b where b.id = o.badge_id);
$$;
revoke all on function public._insignias(uuid) from public, anon, authenticated;

/** ¿Se puede otorgar o quitar a mano? Nivel y verificado no: salen del XP y de la verificación de identidad. */
create or replace function public._badge_manageable(p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_id in ('racha7', 'racha30', 'coleccion', 'tester', 'pr', 'w10', 'w50')
      or (p_id ~ '^prog:[a-z0-9-]{1,60}$' and exists (select 1 from public.challenges_catalog where slug = substring(p_id from 6) and kind = 'programa'))
      or (p_id ~ '^reto:[a-z0-9-]{1,60}$' and exists (select 1 from public.challenges_catalog where slug = substring(p_id from 6) and kind <> 'programa'));
$$;
revoke all on function public._badge_manageable(text) from public, anon, authenticated;

-- ───────────── 3. Acciones del superadmin ─────────────
/** Nombre y país de la cuenta. */
create or replace function public.admin_update_profile(p_target uuid, p_full_name text, p_country text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare old_name text; old_country text; v_name text := btrim(coalesce(p_full_name, '')); v_country text := upper(nullif(btrim(coalesce(p_country, '')), ''));
  v_reason text;
begin
  if not public.is_superadmin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_reason := public._admin_reason(p_reason);
  if char_length(v_name) < 2 or char_length(v_name) > 60 then raise exception 'El nombre va de 2 a 60 caracteres' using errcode = 'P0001'; end if;
  if v_name ~ '[<>]' then raise exception 'El nombre tiene caracteres no permitidos' using errcode = 'P0001'; end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then raise exception 'País inválido' using errcode = 'P0001'; end if;
  select full_name, country into old_name, old_country from public.profiles where id = p_target for update;
  if not found then raise exception 'Usuario no encontrado' using errcode = 'P0001'; end if;
  if old_name is not distinct from v_name and old_country is not distinct from coalesce(v_country, old_country) then
    raise exception 'No hay cambios para guardar' using errcode = 'P0001';
  end if;
  update public.profiles set full_name = v_name, country = coalesce(v_country, country) where id = p_target;
  perform public._admin_audit('user.profile_update', p_target, jsonb_build_object(
    'before', jsonb_build_object('full_name', old_name, 'country', old_country),
    'after', jsonb_build_object('full_name', v_name, 'country', coalesce(v_country, old_country)), 'reason', v_reason));
end $$;

/** Bloquea o desbloquea la cuenta en la app. El bloqueo en el inicio de sesión y el cierre de sesiones los hace el servidor. */
create or replace function public.admin_set_blocked(p_target uuid, p_block boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_was timestamptz; v_reason text;
begin
  if not public.is_superadmin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_reason := public._admin_reason(p_reason);
  if p_target = auth.uid() then raise exception 'No puedes bloquear tu propia cuenta' using errcode = 'P0001'; end if;
  select blocked_at into v_was from public.profiles where id = p_target for update;
  if not found then raise exception 'Usuario no encontrado' using errcode = 'P0001'; end if;
  if p_block and v_was is not null then raise exception 'La cuenta ya está bloqueada' using errcode = 'P0001'; end if;
  if not p_block and v_was is null then raise exception 'La cuenta no está bloqueada' using errcode = 'P0001'; end if;
  update public.profiles set blocked_at = case when p_block then now() else null end, blocked_reason = case when p_block then v_reason else null end
   where id = p_target;
  perform public._admin_audit(case when p_block then 'user.block' else 'user.unblock' end, p_target,
    jsonb_build_object('before', jsonb_build_object('blocked_at', v_was), 'after', jsonb_build_object('blocked', p_block), 'reason', v_reason));
end $$;

/** Cortesía larga: como admin_grant_comp (0025) pero hasta 10 años ("sin vencimiento" en el panel). Solo superadmin. */
create or replace function public.admin_grant_comp_long(p_target uuid, p_plan text, p_expires timestamptz, p_reason text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_prev text; v_cur text; v_id bigint; v_reason text;
begin
  if not public.is_superadmin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_reason := public._admin_reason(p_reason);
  if p_plan not in ('entreno', 'completo') then raise exception 'Plan inválido' using errcode = 'P0001'; end if;
  if p_expires is null or p_expires <= now() or p_expires > now() + interval '3660 days' then raise exception 'Vencimiento fuera de rango (máx. 10 años)' using errcode = 'P0001'; end if;
  select plan into v_cur from public.profiles where id = p_target for update;
  if not found then raise exception 'Usuario no encontrado' using errcode = 'P0001'; end if;
  v_prev := coalesce((select g.previous_plan from public.comp_grants g where g.user_id = p_target and g.source = 'cortesia'
                       and g.revoked_at is null and g.expires_at > now() order by g.created_at desc limit 1), v_cur);
  update public.comp_grants set revoked_at = now(), revoked_by = v_actor
   where user_id = p_target and source = 'cortesia' and revoked_at is null and expires_at > now();
  insert into public.comp_grants (user_id, plan, previous_plan, reason, expires_at, granted_by)
  values (p_target, p_plan, v_prev, v_reason, p_expires, v_actor) returning id into v_id;
  update public.profiles set plan = p_plan where id = p_target;
  perform public._admin_audit('user.comp_grant', p_target, jsonb_build_object('grant', v_id, 'plan', p_plan, 'previous_plan', v_prev,
    'expires_at', p_expires, 'reason', v_reason, 'before', jsonb_build_object('plan', v_cur), 'after', jsonb_build_object('plan', p_plan)));
  return v_id;
end $$;

/**
 * Quita el acceso a un reto, programa o temporada (cortesía, canje del plan anual o compra) y lo deja como abandonado.
 * Una compra no se reembolsa aquí (eso se hace en ONVO o Tilopay). Devuelve el origen que tenía.
 */
create or replace function public.admin_revoke_challenge(p_target uuid, p_slug text, p_reason text)
returns text language plpgsql security definer set search_path = public as $$
declare v_src text; v_reason text; n_prog int; n_ret int; n_red int;
begin
  if not public.is_superadmin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_reason := public._admin_reason(p_reason);
  delete from public.challenge_entitlements where user_id = p_target and challenge_slug = p_slug returning source into v_src;
  if v_src is null then raise exception 'Esta persona no tiene ese acceso' using errcode = 'P0001'; end if;
  delete from public.season_redemptions where user_id = p_target and slug = p_slug;
  get diagnostics n_red = row_count;
  update public.user_programs set status = 'abandonado', updated_at = now() where user_id = p_target and slug = p_slug and status in ('activo', 'pausado');
  get diagnostics n_prog = row_count;
  update public.user_challenges set status = 'abandonado' where user_id = p_target and challenge_id = p_slug and status = 'activo';
  get diagnostics n_ret = row_count;
  perform public._admin_audit('challenge.revoke', p_target, jsonb_build_object('challenge', p_slug, 'reason', v_reason,
    'before', jsonb_build_object('source', v_src), 'after', jsonb_build_object('access', false, 'annual_redemption_freed', n_red > 0, 'stopped', n_prog + n_ret)));
  return v_src;
end $$;

/** Reinicia el progreso de un reto o programa (se borra su avance; el XP ya ganado se queda). El acceso no cambia. */
create or replace function public.admin_reset_challenge(p_target uuid, p_slug text, p_reason text)
returns int language plpgsql security definer set search_path = public as $$
declare v_reason text; n_ret int; n_prog int;
begin
  if not public.is_superadmin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_reason := public._admin_reason(p_reason);
  delete from public.user_challenges where user_id = p_target and challenge_id = p_slug;
  get diagnostics n_ret = row_count;
  delete from public.user_programs where user_id = p_target and slug = p_slug;
  get diagnostics n_prog = row_count;
  if n_ret + n_prog = 0 then raise exception 'No hay progreso que reiniciar' using errcode = 'P0001'; end if;
  perform public._power_refresh(p_target, false);
  perform public._admin_audit('challenge.reset', p_target, jsonb_build_object('challenge', p_slug, 'reason', v_reason,
    'before', jsonb_build_object('challenge_rows', n_ret, 'program_rows', n_prog), 'after', jsonb_build_object('progress', 0)));
  return n_ret + n_prog;
end $$;

/** Borra el cuestionario de inicio de una temporada: la persona lo vuelve a llenar al abrirla. */
create or replace function public.admin_reset_season_intake(p_target uuid, p_slug text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_reason text; v_at timestamptz;
begin
  if not public.is_superadmin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_reason := public._admin_reason(p_reason);
  delete from public.season_intake where user_id = p_target and slug = p_slug returning updated_at into v_at;
  if v_at is null then raise exception 'Esta persona no ha llenado ese cuestionario' using errcode = 'P0001'; end if;
  perform public._admin_audit('season.intake_reset', p_target, jsonb_build_object('season', p_slug, 'reason', v_reason,
    'before', jsonb_build_object('answered_at', v_at), 'after', jsonb_build_object('intake', null)));
end $$;

/** Otorga ('otorgada'), quita ('quitada') o devuelve a lo calculado ('ninguna') una insignia. */
create or replace function public.admin_set_badge(p_target uuid, p_badge text, p_mode text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_reason text; v_old text;
begin
  if not public.is_superadmin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_reason := public._admin_reason(p_reason);
  if p_mode not in ('otorgada', 'quitada', 'ninguna') then raise exception 'Acción inválida' using errcode = 'P0001'; end if;
  if not public._badge_manageable(p_badge) then raise exception 'Esa insignia no se puede cambiar a mano' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where id = p_target) then raise exception 'Usuario no encontrado' using errcode = 'P0001'; end if;
  select mode into v_old from public.badge_overrides where user_id = p_target and badge_id = p_badge for update;
  if coalesce(v_old, 'ninguna') = p_mode then raise exception 'La insignia ya está así' using errcode = 'P0001'; end if;
  if p_mode = 'ninguna' then
    delete from public.badge_overrides where user_id = p_target and badge_id = p_badge;
  else
    insert into public.badge_overrides (user_id, badge_id, mode) values (p_target, p_badge, p_mode)
    on conflict (user_id, badge_id) do update set mode = excluded.mode, created_at = now();
  end if;
  perform public._power_refresh(p_target, false);
  perform public._admin_audit('badge.set', p_target, jsonb_build_object('badge', p_badge, 'reason', v_reason,
    'before', jsonb_build_object('override', v_old), 'after', jsonb_build_object('override', nullif(p_mode, 'ninguna'))));
end $$;

/** Ajuste de XP (positivo o negativo). El total nunca queda bajo 0. */
create or replace function public.admin_adjust_xp(p_target uuid, p_delta int, p_reason text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_reason text; v_total bigint;
begin
  if not public.is_superadmin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_reason := public._admin_reason(p_reason);
  if p_delta is null or p_delta = 0 or p_delta < -20000 or p_delta > 20000 then raise exception 'El ajuste va de -20.000 a 20.000 XP y no puede ser 0' using errcode = 'P0001'; end if;
  perform 1 from public.profiles where id = p_target for update;
  if not found then raise exception 'Usuario no encontrado' using errcode = 'P0001'; end if;
  select coalesce(sum(xp), 0) into v_total from public.xp_events where user_id = p_target;
  if v_total + p_delta < 0 then raise exception 'El XP no puede quedar bajo 0 (tiene %)', v_total using errcode = 'P0001'; end if;
  insert into public.xp_events (user_id, kind, xp) values (p_target, 'ajuste', p_delta);
  perform public._admin_audit('xp.adjust', p_target, jsonb_build_object('delta', p_delta, 'reason', v_reason,
    'before', jsonb_build_object('xp', v_total), 'after', jsonb_build_object('xp', v_total + p_delta)));
  return v_total + p_delta;
end $$;

/** Lectura para la ficha del superadmin: accesos, progreso, cuestionarios, insignias, XP y bloqueo. */
create or replace function public.admin_user_manage(p_target uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'blocked_at', (select blocked_at from public.profiles where id = p_target),
    'blocked_reason', (select blocked_reason from public.profiles where id = p_target),
    'xp', (select coalesce(sum(xp), 0) from public.xp_events where user_id = p_target),
    'xp_adjust', (select coalesce(sum(xp), 0) from public.xp_events where user_id = p_target and kind = 'ajuste'),
    'access', coalesce((select jsonb_agg(jsonb_build_object('slug', e.challenge_slug, 'source', e.source, 'title', c.title, 'kind', c.kind,
                 'season', s.slug is not null, 'created_at', e.created_at, 'reason', e.reason) order by e.created_at desc)
               from public.challenge_entitlements e left join public.challenges_catalog c on c.slug = e.challenge_slug
               left join public.seasons s on s.slug = e.challenge_slug where e.user_id = p_target), '[]'::jsonb),
    'programs', coalesce((select jsonb_agg(jsonb_build_object('slug', up.slug, 'title', c.title, 'status', up.status, 'started_on', up.started_on,
                 'season', s.slug is not null) order by up.updated_at desc)
               from public.user_programs up left join public.challenges_catalog c on c.slug = up.slug
               left join public.seasons s on s.slug = up.slug where up.user_id = p_target), '[]'::jsonb),
    'challenges', coalesce((select jsonb_agg(jsonb_build_object('slug', uc.challenge_id, 'title', c.title, 'status', uc.status, 'started_on', uc.started_on,
                 'checkins', (select count(*) from public.challenge_checkins k where k.user_challenge_id = uc.id)) order by uc.created_at desc)
               from public.user_challenges uc left join public.challenges_catalog c on c.slug = uc.challenge_id where uc.user_id = p_target), '[]'::jsonb),
    'intakes', coalesce((select jsonb_agg(i.slug) from public.season_intake i where i.user_id = p_target), '[]'::jsonb),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'label', b.label, 'kind', b.kind)) from public._insignias(p_target) b), '[]'::jsonb),
    'overrides', coalesce((select jsonb_agg(jsonb_build_object('id', o.badge_id, 'mode', o.mode, 'created_at', o.created_at) order by o.created_at desc)
               from public.badge_overrides o where o.user_id = p_target), '[]'::jsonb)
  );
end $$;

revoke execute on function public.admin_update_profile(uuid, text, text, text) from public, anon;
revoke execute on function public.admin_set_blocked(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_grant_comp_long(uuid, text, timestamptz, text) from public, anon;
revoke execute on function public.admin_revoke_challenge(uuid, text, text) from public, anon;
revoke execute on function public.admin_reset_challenge(uuid, text, text) from public, anon;
revoke execute on function public.admin_reset_season_intake(uuid, text, text) from public, anon;
revoke execute on function public.admin_set_badge(uuid, text, text, text) from public, anon;
revoke execute on function public.admin_adjust_xp(uuid, int, text) from public, anon;
revoke execute on function public.admin_user_manage(uuid) from public, anon;
grant execute on function public.admin_update_profile(uuid, text, text, text) to authenticated;
grant execute on function public.admin_set_blocked(uuid, boolean, text) to authenticated;
grant execute on function public.admin_grant_comp_long(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.admin_revoke_challenge(uuid, text, text) to authenticated;
grant execute on function public.admin_reset_challenge(uuid, text, text) to authenticated;
grant execute on function public.admin_reset_season_intake(uuid, text, text) to authenticated;
grant execute on function public.admin_set_badge(uuid, text, text, text) to authenticated;
grant execute on function public.admin_adjust_xp(uuid, int, text) to authenticated;
grant execute on function public.admin_user_manage(uuid) to authenticated;

-- ───────────── 4. Cerrar todas las sesiones ─────────────
/** Borra las sesiones de Auth de la cuenta: en su próxima petición tiene que volver a entrar. Solo el servidor. */
create or replace function public.admin_sign_out_all(p_target uuid)
returns int language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  if auth.uid() is not null then raise exception 'No autorizado' using errcode = '42501'; end if;
  delete from auth.refresh_tokens where user_id = p_target::text;
  delete from auth.sessions where user_id = p_target;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.admin_sign_out_all(uuid) from public, anon, authenticated;
grant execute on function public.admin_sign_out_all(uuid) to service_role;

-- ───────────── 5. Lista del panel con más filtros ─────────────
create or replace function public.admin_list_users_v2(
  p_q text default null, p_plan text default null, p_role text default null, p_status text default null,
  p_from date default null, p_to date default null, p_country text default null, p_season text default null,
  p_limit int default 25, p_offset int default 0)
returns table (id uuid, full_name text, email text, role public.app_role, plan text, onboarded boolean,
               created_at timestamptz, last_active date, comp_until timestamptz, tester_until timestamptz,
               country text, blocked boolean, total bigint)
language plpgsql stable security definer set search_path = public as $$
declare t date := public.cr_today();
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query
  with base as (
    select p.id, p.full_name, u.email::text, p.role, p.plan, p.onboarded, p.created_at,
      greatest(
        (select max(w.day) from public.workouts w where w.user_id = p.id),
        (select max(x.day) from public.weights x where x.user_id = p.id),
        (select max(l.day) from public.daily_logs l where l.user_id = p.id),
        (select max(m.day) from public.meals m where m.user_id = p.id)
      ) last_active,
      (select max(g.expires_at) from public.comp_grants g where g.user_id = p.id and g.revoked_at is null and g.expires_at > now()
        and g.source <> 'tester') comp_until,
      public._tester_until(p.id) tester_until,
      p.country,
      (p.blocked_at is not null or coalesce(u.banned_until > now(), false)) blocked
    from public.profiles p left join auth.users u on u.id = p.id
    where (p_q is null or p_q = '' or p.full_name ilike '%' || p_q || '%' or u.email ilike '%' || p_q || '%' or p.id::text = p_q)
      and (p_plan is null or p_plan = '' or p.plan = p_plan)
      and (p_role is null or p_role = '' or p.role::text = p_role)
      and (p_country is null or p_country = '' or p.country = upper(p_country))
      and (p_season is null or p_season = '' or exists (select 1 from public.challenge_entitlements e where e.user_id = p.id and e.challenge_slug = p_season))
      and (p_from is null or (p.created_at at time zone 'America/Costa_Rica')::date >= p_from)
      and (p_to is null or (p.created_at at time zone 'America/Costa_Rica')::date <= p_to)
  ), filtered as (
    select * from base b where
      p_status is null or p_status = '' or
      (p_status = 'activo' and b.last_active > t - 7) or
      (p_status = 'inactivo' and b.onboarded and (b.last_active is null or b.last_active <= t - 7)) or
      (p_status = 'pendiente' and not b.onboarded) or
      (p_status = 'cortesia' and b.comp_until is not null) or
      (p_status = 'tester' and b.tester_until is not null) or
      (p_status = 'bloqueado' and b.blocked) or
      (p_status = 'beta' and b.created_at < public._beta_ends_at()) or
      (p_status = 'prueba' and public._trial_live(b.id) and not exists (select 1 from public.subscriptions s where s.user_id = b.id and s.status = 'active')) or
      (p_status = 'pagando' and exists (select 1 from public.subscriptions s where s.user_id = b.id and s.status in ('active', 'past_due') and s.current_period_end > now())) or
      (p_status = 'vencido' and b.role::text not in ('coach', 'support', 'admin', 'superadmin') and not public._has_app_access(b.id))
  )
  select f.*, count(*) over () from filtered f
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke execute on function public.admin_list_users_v2(text, text, text, text, date, date, text, text, int, int) from public, anon;
grant execute on function public.admin_list_users_v2(text, text, text, text, date, date, text, text, int, int) to authenticated;

-- Comprobación (solo lee): ¿el dueño de las funciones puede cerrar sesiones de Auth?
select has_table_privilege('auth.sessions', 'delete') as puede_cerrar_sesiones,
       has_table_privilege('auth.refresh_tokens', 'delete') as puede_borrar_tokens,
       (select count(*) from public.badge_overrides) as insignias_a_mano;
