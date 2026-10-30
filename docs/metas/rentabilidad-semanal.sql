-- Solo lectura. Pagos nuevos de una semana (lunes a domingo, hora de Costa Rica), por plan.
-- Mismas definiciones de pago que tablero-diario.sql. Uso: docs/metas/rentabilidad-semanal.md.
with
parametros as (
  select date '2026-11-02' as lunes,
         now() as observado_en
),
semana as (
  select (lunes::timestamp at time zone 'America/Costa_Rica') as desde,
         ((lunes + 7)::timestamp at time zone 'America/Costa_Rica') as hasta,
         observado_en
  from parametros
),
-- Precios de lista de src/lib/plans.ts, en centavos. Solo para pagos en el muro de planes, sin fila de cobro de prueba.
precios(plan, billing, minor) as (
  values ('entreno', 'mes', 999), ('entreno', 'anual', 5999),
         ('completo', 'mes', 1499), ('completo', 'anual', 8999)
),
cortesia as (
  select distinct g.user_id from public.comp_grants g cross join semana q
  where g.revoked_at is null and g.starts_at <= q.observado_en and g.expires_at > q.observado_en
),
-- Primer cobro automático de la prueba o la beta. amount_minor ya trae el 50 % si aplica.
cobros as (
  select t.user_id, t.plan, t.billing, coalesce(t.promo = 'primer_mes_50', false) and t.billing = 'mes' as primer_mes_50,
    t.amount_minor, coalesce(t.last_attempt_at, t.updated_at) as pagado_en
  from public.trial_charges t
  where t.status = 'succeeded'
),
-- Pago en el muro de planes: suscripción vigente sin cobro succeeded, como en el tablero.
manuales as (
  select distinct on (s.user_id) s.user_id, s.plan, s.billing, false as primer_mes_50, p.minor as amount_minor,
    (select min(s2.created_at) from public.subscriptions s2 where s2.user_id = s.user_id
      and s2.provider in ('onvo', 'tilopay')) as pagado_en
  from public.subscriptions s cross join semana q
  join precios p on p.plan = s.plan and p.billing = s.billing
  where (s.status = 'active' or (s.status = 'canceled' and s.cancel_at_period_end))
    and s.current_period_end > q.observado_en
    and s.provider in ('onvo', 'tilopay')
    and not exists (select 1 from cobros c where c.user_id = s.user_id)
  order by s.user_id, s.current_period_end desc
),
pagos as (
  select x.* from (select * from cobros union all select * from manuales) x cross join semana q
  where x.pagado_en >= q.desde and x.pagado_en < q.hasta and x.pagado_en <= q.observado_en
    and x.user_id not in (select user_id from cortesia)
)
select coalesce(plan, 'total') as plan, coalesce(billing, 'total') as billing,
  coalesce(primer_mes_50::text, 'total') as primer_mes_50,
  count(*) as pagos_nuevos,
  coalesce(round(sum(amount_minor) / 100.0, 2), 0) as ingresos_brutos_usd
from pagos
group by grouping sets ((plan, billing, primer_mes_50), ())
order by grouping(plan, billing, primer_mes_50), 1, 2, 3;
