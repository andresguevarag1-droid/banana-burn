-- Banana Burn · 0064 referidos: el amigo cuenta cuando paga su primer plan (decisión de Andrés, 1 nov 2026)
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0063. Correr ANTES de fusionar la PR.
-- Qué cambia (las reglas de 0025 que no se nombran aquí siguen igual):
--   1. Calificado = la persona referida hizo su PRIMER PAGO VERIFICADO de un plan (Entreno o Entreno + Nutrición, mensual o
--      anual, por ONVO o Tilopay) dentro de los 60 días desde que se registró con el enlace. Lo avisa el servidor con
--      referral_paid() desde activate() en src/lib/billing.ts, el punto por donde pasa todo cobro verificado (webhook de
--      ONVO y activateVerified). Terminar la bienvenida, entrenar o registrar agua, pasos o sueño ya no califica.
--   2. No es pago: la prueba de 7 días, la tarjeta guardada sin cobro, cortesías, regalos, beta, condominio, retos y
--      temporadas sueltas (ninguno pasa por activate()). Un pago reembolsado se anula con admin_referral_refund().
--   3. Antifraude de siempre (atribución de 72 horas, cuentas propias o repetidas, revisión de sospechosos) y además
--      misma tarjeta: si la persona referida paga con una tarjeta que también usó quien invita, no cuenta.
--   4. Lo ya entregado se respeta: las filas 'calificado', sus grupos y sus recompensas de antes de esta migración no se
--      tocan. Un referido 'registrado' que ya pagó un plan antes de hoy queda anotado con su primer pago.
--   5. Recompensas sin cambios: grupos de 3 = 1 mes; si uno del grupo paga anual, 3 meses en total; tope de 12 en 365 días.

-- ───────────── 1. Primer pago del referido ─────────────
alter table public.referrals add column if not exists paid_at timestamptz;

-- ───────────── 2. La actividad ya no califica ─────────────
drop trigger if exists referral_on_workout on public.workouts;
drop trigger if exists referral_on_daily on public.daily_logs;
drop trigger if exists referral_on_onboard on public.profiles;
drop function if exists public._referral_on_activity();

-- ───────────── 3. Calificación ─────────────
/** ¿La persona referida ya califica? Primer pago verificado dentro de los 60 días desde la atribución y sin tarjeta compartida. */
create or replace function public._referral_try_qualify(p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.referrals;
begin
  if p_user is null then return false; end if;
  select * into r from public.referrals where referred = p_user and status = 'registrado' for update;
  if not found or r.paid_at is null or r.paid_at > r.created_at + interval '60 days' then return false; end if;
  if exists (select 1 from public.card_fingerprints a join public.card_fingerprints b on b.fingerprint = a.fingerprint
              where a.user_id = r.referrer and b.user_id = p_user) then
    update public.referrals set status = 'descartado', flag = 'misma_tarjeta' where id = r.id;
    return false;
  end if;
  update public.referrals set status = 'calificado', qualified_at = now() where id = r.id;
  perform public._referral_settle(r.referrer);
  return true;
end $$;
revoke all on function public._referral_try_qualify(uuid) from public, anon, authenticated;

/** Agrupa los calificados de a 3 y entrega las recompensas pendientes. Idempotente. Igual que 0025, con el texto nuevo. */
create or replace function public._referral_settle(p_referrer uuid)
returns int language plpgsql security definer set search_path = public as $$
declare ids bigint[]; v_group int; v_months int; v_plan text; v_grant bigint; n int := 0; v_annual boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('referral:' || p_referrer::text, 0));
  loop
    select array_agg(id order by qualified_at, id) into ids from (
      select id, qualified_at from public.referrals
       where referrer = p_referrer and status = 'calificado' and group_no is null
       order by qualified_at, id limit 3) t;
    exit when coalesce(cardinality(ids), 0) < 3;
    exit when (select count(*) from public.referral_rewards where referrer = p_referrer and revoked_at is null and created_at > now() - interval '365 days') >= 12;
    select coalesce(max(group_no), 0) + 1 into v_group from public.referral_rewards where referrer = p_referrer;
    select bool_or(annual_paid_at is not null) into v_annual from public.referrals where id = any(ids);
    v_months := case when v_annual then 3 else 1 end;
    v_plan := case when (select plan from public.profiles where id = p_referrer) = 'entreno' then 'entreno' else 'completo' end;
    update public.referrals set group_no = v_group where id = any(ids);
    v_grant := public._gift_grant(p_referrer, v_plan, v_months, 'referido',
      case when v_annual then 'Tres personas que invitaste ya pagan su plan de Banana Burn y una eligió el plan anual.'
           else 'Tres personas que invitaste ya pagan su plan de Banana Burn.' end, null);
    insert into public.referral_rewards (referrer, group_no, months, plan, grant_ids, upgraded_at)
    values (p_referrer, v_group, v_months, v_plan, array[v_grant], null);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public._referral_settle(uuid) from public, anon, authenticated;

/**
 * Cobro verificado de un plan de la persona referida. SOLO service_role (activate() en billing.ts). Idempotente: anota solo
 * el primer pago; renovaciones y reintentos no suman. Si es anual, pasa por referral_annual_paid() (0025) para el trimestre.
 * Devuelve el estado del referido después del pago, 'trimestre' si el grupo subió a 3 meses o 'sin_referido'.
 */
create or replace function public.referral_paid(p_user uuid, p_annual boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare v_status text; v_annual text;
begin
  if auth.uid() is not null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_user is null or not exists (select 1 from public.referrals where referred = p_user) then return 'sin_referido'; end if;
  update public.referrals set paid_at = now() where referred = p_user and paid_at is null and status <> 'descartado';
  if coalesce(p_annual, false) then v_annual := public.referral_annual_paid(p_user); end if;
  perform public._referral_try_qualify(p_user);
  if v_annual = 'trimestre' then return v_annual; end if;
  select status into v_status from public.referrals where referred = p_user;
  return v_status;
end $$;

/**
 * Pago reembolsado de una persona referida: deja de contar. Solo admin. Auditada. Si su grupo ya cobró, la recompensa se
 * anula (sus meses se quitan) y las otras personas del grupo vuelven a esperar para formar un grupo nuevo.
 */
create or replace function public.admin_referral_refund(p_referral bigint, p_reason text)
returns text language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); r public.referrals; w public.referral_rewards; v_result text := 'descartado';
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if coalesce(char_length(btrim(p_reason)), 0) < 4 then raise exception 'Escribe el motivo' using errcode = 'P0001'; end if;
  select * into r from public.referrals where id = p_referral;
  if not found or r.status = 'descartado' then raise exception 'Ese referido no existe o ya no cuenta' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('referral:' || r.referrer::text, 0));
  select * into r from public.referrals where id = p_referral for update;
  if r.group_no is not null then
    select * into w from public.referral_rewards where referrer = r.referrer and group_no = r.group_no for update;
    if found and w.revoked_at is null then
      update public.comp_grants set revoked_at = now(), revoked_by = v_actor where id = any(w.grant_ids) and revoked_at is null;
      update public.referral_rewards set revoked_at = now(), revoked_by = v_actor, revoke_reason = left('Pago reembolsado: ' || p_reason, 300) where id = w.id;
      v_result := 'recompensa_anulada';
    end if;
    update public.referrals set group_no = null where referrer = r.referrer and group_no = r.group_no and id <> r.id and status = 'calificado';
  end if;
  update public.referrals set status = 'descartado', flag = 'pago_reembolsado', reviewed_by = v_actor, reviewed_at = now() where id = r.id;
  insert into public.audit_log (actor, action, target, meta)
  values (v_actor, 'referral.refund', r.referrer::text, jsonb_build_object('referral', r.id, 'group', r.group_no, 'reward', w.id, 'reason', left(p_reason, 300)));
  perform public._referral_settle(r.referrer);
  return v_result;
end $$;

/** Mis referidos: "vencido" = no pagó dentro de los 60 días desde que se registró con el enlace. */
create or replace function public.my_referrals()
returns table (initial text, status text, created_at timestamptz, qualified_at timestamptz, annual boolean, group_no int, expired boolean)
language sql stable security definer set search_path = public as $$
  select upper(left(coalesce(nullif(btrim(p.full_name), ''), '?'), 1)), r.status, r.created_at, r.qualified_at, r.annual_paid_at is not null, r.group_no,
         r.status = 'registrado' and r.created_at + interval '60 days' < now() and (r.paid_at is null or r.paid_at > r.created_at + interval '60 days')
  from public.referrals r left join public.profiles p on p.id = r.referred
  where r.referrer = auth.uid()
  order by r.created_at desc
  limit 200;
$$;

-- ───────────── 4. Referidos que ya pagaron antes de hoy ─────────────
-- Primer cobro de plan ya procesado (payment_events con nota "plan=..." de activate(); las renovaciones fallidas no).
update public.referrals r set paid_at = e.first_paid
  from (select user_id, min(coalesce(processed_at, received_at)) first_paid from public.payment_events
         where status = 'processed' and user_id is not null and note ~ '(^|, )plan=' and note not like 'renovación fallida%'
         group by user_id) e
 where r.referred = e.user_id and r.paid_at is null and r.status in ('registrado', 'sospechoso');
do $$ declare u uuid; begin
  for u in select referred from public.referrals where status = 'registrado' and paid_at is not null and referred is not null loop
    perform public._referral_try_qualify(u);
  end loop;
end $$;

-- ───────────── 5. Permisos ─────────────
revoke execute on function public.referral_paid(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.admin_referral_refund(bigint, text) from public, anon;
revoke execute on function public.my_referrals() from public, anon;
grant execute on function public.referral_paid(uuid, boolean) to service_role;
grant execute on function public.admin_referral_refund(bigint, text) to authenticated;
grant execute on function public.my_referrals() to authenticated;

-- Verificación al aplicar: todo debe salir true.
select 'ok 0064' as migracion,
  to_regprocedure('public.referral_paid(uuid, boolean)') is not null as pago_califica,
  to_regprocedure('public.admin_referral_refund(bigint, text)') is not null as reembolso,
  to_regprocedure('public._referral_on_activity()') is null as actividad_ya_no_califica,
  not exists (select 1 from pg_trigger where tgname in ('referral_on_workout', 'referral_on_daily', 'referral_on_onboard')) as sin_triggers_de_actividad;
