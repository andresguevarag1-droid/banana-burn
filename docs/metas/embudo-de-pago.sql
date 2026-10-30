-- Solo lectura. Una fila por semana de creación de cuenta (lunes a domingo, hora de Costa Rica), avance observado AHORA.
-- Embudo en cadena: cuenta > registro > primer entreno > tarjeta guardada > pagó > renovó, con el plan elegido.
-- Mismas definiciones de pago que tablero-diario.sql. Uso y lectura: docs/metas/embudo-de-pago.md.
with
parametros as (
  select date '2026-10-28' as desde,
         (now() at time zone 'America/Costa_Rica')::date as hasta,
         now() as observado_en
),
-- funnel_events (0061) existe desde el 28 oct: antes, la bienvenida terminada no se puede medir.
-- Último día del primer cobro de las cuentas de la beta (BETA_GRACE_UNTIL en src/lib/plans.ts).
fechas as (
  select date '2026-10-28' as eventos_desde,
         timestamptz '2026-11-08 06:00+00' as cobro_beta
),
semanas as (
  select s::date as semana,
         greatest(s::date, q.desde) as desde_efectivo,
         least(s::date + 7, q.hasta + 1) as hasta_efectivo
  from parametros q
  cross join lateral generate_series(date_trunc('week', q.desde), date_trunc('week', q.hasta), interval '7 days') s
),
cuentas as (
  select p.id, p.created_at, (p.created_at at time zone 'America/Costa_Rica')::date as dia
  from public.profiles p cross join parametros q
  where p.created_at >= (q.desde::timestamp at time zone 'America/Costa_Rica')
    and p.created_at < ((q.hasta + 1)::timestamp at time zone 'America/Costa_Rica')
    and p.created_at <= q.observado_en
),
cortesia as (
  select distinct g.user_id from public.comp_grants g cross join parametros q
  where g.revoked_at is null and g.starts_at <= q.observado_en and g.expires_at > q.observado_en
),
-- Suscripción pagada vigente (muro de planes o cobro activado), la más reciente por persona.
suscripcion as (
  select distinct on (s.user_id) s.user_id, s.plan, s.billing
  from public.subscriptions s cross join parametros q
  where (s.status = 'active' or (s.status = 'canceled' and s.cancel_at_period_end))
    and s.current_period_end > q.observado_en
    and s.provider in ('onvo', 'tilopay')
  order by s.user_id, s.current_period_end desc
),
personas as (
  select c.id, c.dia,
    c.dia >= f.eventos_desde as registro_medible,
    exists (select 1 from public.funnel_events e
      where e.user_id = c.id and e.name = 'onboarding_done'
        and e.created_at >= c.created_at and e.created_at <= q.observado_en) as registro,
    exists (select 1 from public.workouts w
      where w.user_id = c.id and w.finished_at is not null
        and w.finished_at <= q.observado_en) as entreno,
    t.user_id is not null as tarjeta,
    t.billing as tarjeta_billing,
    coalesce(t.status = 'succeeded', false) as cobro,
    s.user_id is not null as suscrito,
    case when t.status = 'succeeded' then t.plan else s.plan end as plan_pago,
    case when t.status = 'succeeded' then t.billing else s.billing end as billing_pago,
    -- Fecha del primer pago, como en rentabilidad-semanal.sql.
    case when t.status = 'succeeded' then coalesce(t.last_attempt_at, t.updated_at)
      else (select min(s2.created_at) from public.subscriptions s2
        where s2.user_id = c.id and s2.provider in ('onvo', 'tilopay')) end as pagado_en,
    exists (select 1 from cortesia k where k.user_id = c.id) as cortesia,
    exists (select 1 from public.funnel_events e
      where e.user_id = c.id and e.name = 'card_banner_view'
        and e.created_at >= c.created_at and e.created_at <= q.observado_en) as vio_oferta_tarjeta,
    exists (select 1 from public.funnel_events e
      where e.user_id = c.id and e.name = 'plan_wall_view'
        and e.created_at >= c.created_at and e.created_at <= q.observado_en) as vio_muro,
    exists (select 1 from public.funnel_events e
      where e.user_id = c.id and e.name = 'checkout_view'
        and e.created_at >= c.created_at and e.created_at <= q.observado_en) as abrio_pago
  from cuentas c cross join parametros q cross join fechas f
  left join public.trial_charges t on t.user_id = c.id
  left join suscripcion s on s.user_id = c.id
),
-- Cadena: cada paso exige el anterior. Sin evento de registro (antes del 28 oct) ese paso se salta.
cadena as (
  select x.*,
    x.paga and x.billing_pago = 'mes' and exists (
      select 1 from public.payment_events e cross join parametros q
      where e.user_id = x.id and e.status = 'processed'
        and e.type in ('subscription.renewal.succeeded', 'payment-intent.succeeded', 'charge.approved')
        and e.received_at <= q.observado_en
        and coalesce(e.period_start, e.received_at) >= x.pagado_en + interval '20 days') as renueva
  from (
    select p.*,
      (p.cobro or p.suscrito) and not p.cortesia as pago_real,
      (case when p.registro_medible then p.registro else true end) and p.entreno as entreno_c,
      (case when p.registro_medible then p.registro else true end) and p.entreno and p.tarjeta as tarjeta_c,
      (case when p.registro_medible then p.registro else true end) and p.entreno and p.tarjeta
        and (p.cobro or p.suscrito) and not p.cortesia as paga
    from personas p
  ) x
),
conteos as (
  select w.semana, w.desde_efectivo, w.hasta_efectivo - 1 as hasta_efectivo,
    count(c.id) as cuentas_creadas,
    case when coalesce(bool_and(c.registro_medible), true)
      then count(c.id) filter (where c.registro) end as registro,
    count(c.id) filter (where c.entreno_c) as primer_entreno,
    count(c.id) filter (where c.tarjeta_c) as tarjeta_guardada,
    count(c.id) filter (where c.tarjeta_c and c.tarjeta_billing = 'mes') as tarjeta_mensual,
    count(c.id) filter (where c.tarjeta_c and c.tarjeta_billing = 'anual') as tarjeta_anual,
    count(c.id) filter (where c.paga) as pagaron,
    count(c.id) filter (where c.paga and c.billing_pago = 'mes') as pagaron_mensual,
    count(c.id) filter (where c.paga and c.billing_pago = 'anual') as pagaron_anual,
    count(c.id) filter (where c.paga and c.plan_pago = 'entreno') as pagaron_entreno,
    count(c.id) filter (where c.paga and c.plan_pago = 'completo') as pagaron_completo,
    count(c.id) filter (where c.renueva) as renovaron,
    count(c.id) filter (where c.pago_real) as usuarios_pago_total,
    count(c.id) filter (where c.pago_real and not c.tarjeta) as pagaron_sin_tarjeta,
    count(c.id) filter (where c.vio_oferta_tarjeta) as vieron_oferta_tarjeta,
    count(c.id) filter (where c.vio_muro) as vieron_muro_planes,
    count(c.id) filter (where c.abrio_pago) as abrieron_pago
  from semanas w left join cadena c on c.dia >= w.desde_efectivo and c.dia < w.hasta_efectivo
  group by w.semana, w.desde_efectivo, w.hasta_efectivo
),
-- Un paso está cerrado cuando a toda la cohorte ya le tocó: prueba de 7 días (o cobro de la beta) más el reintento
-- automático (1 día, RETRY_AFTER_DAYS en src/lib/trial.ts) con margen; la renovación, un mes y 3 días de gracia después.
base as (
  select k.*,
    greatest(((k.hasta_efectivo + 1)::timestamp at time zone 'America/Costa_Rica') + interval '7 days', f.cobro_beta)
      + interval '2 days' as pago_cierra_en
  from conteos k cross join fechas f
)
select b.semana, b.desde_efectivo, b.hasta_efectivo,
  b.cuentas_creadas, b.registro, b.primer_entreno, b.tarjeta_guardada, b.tarjeta_mensual, b.tarjeta_anual,
  b.pagaron, b.pagaron_mensual, b.pagaron_anual, b.pagaron_entreno, b.pagaron_completo, b.renovaron,
  round(100.0 * b.registro / nullif(b.cuentas_creadas, 0), 2) as tasa_registro_pct,
  round(100.0 * b.primer_entreno / nullif(coalesce(b.registro, b.cuentas_creadas), 0), 2) as tasa_primer_entreno_pct,
  round(100.0 * b.tarjeta_guardada / nullif(b.primer_entreno, 0), 2) as tasa_tarjeta_pct,
  round(100.0 * b.pagaron / nullif(b.tarjeta_guardada, 0), 2) as tasa_pago_pct,
  round(100.0 * b.renovaron / nullif(b.pagaron_mensual, 0), 2) as tasa_renovacion_pct,
  q.observado_en >= b.pago_cierra_en as pago_cerrado,
  q.observado_en >= b.pago_cierra_en + interval '1 month 3 days' as renovacion_cerrada,
  (select v.paso from (values
      (1, 'registro', b.cuentas_creadas - b.registro),
      (2, 'primer_entreno', coalesce(b.registro, b.cuentas_creadas) - b.primer_entreno),
      (3, 'tarjeta_guardada', b.primer_entreno - b.tarjeta_guardada),
      (4, 'pago', case when q.observado_en >= b.pago_cierra_en then b.tarjeta_guardada - b.pagaron end),
      (5, 'renovacion', case when q.observado_en >= b.pago_cierra_en + interval '1 month 3 days'
        then b.pagaron_mensual - b.renovaron end)
    ) v(orden, paso, perdidos)
    where v.perdidos > 0 order by v.perdidos desc, v.orden limit 1) as paso_con_mas_perdida,
  b.usuarios_pago_total, b.pagaron_sin_tarjeta, b.vieron_oferta_tarjeta, b.vieron_muro_planes, b.abrieron_pago,
  'sin evento: falta un visit_id que compartan page_view y la creación de la cuenta' as visita_a_cuenta,
  'sin evento: falta card_error con plan, billing y motivo (card_saved solo sale si la tarjeta quedó guardada)' as tarjeta_que_fallo,
  'sin evento: falta plan_select con plan y billing (plan_wall_view no dice qué plan miró)' as plan_mirado_sin_pagar,
  q.observado_en
from base b cross join parametros q
order by b.semana;
