-- Solo lectura. Una fila por día de adquisición, avance observado AHORA.
-- Uso y definiciones: docs/metas/tablero-diario.md.
with
parametros as (
  select date '2026-10-25' as desde,
         (now() at time zone 'America/Costa_Rica')::date as hasta,
         now() as observado_en
),
-- Sustituye la fila vacía por filas como (date '2026-10-25', 12.34::numeric).
-- Una fila por día; 0 = gasto confirmado cero; NULL/ausente = pendiente.
gasto_manual(dia, usd) as (
  values (null::date, null::numeric)
),
dias as (
  select p.desde + n as dia
  from parametros p cross join lateral generate_series(0, p.hasta - p.desde) n
),
cuentas as (
  select p.id, (p.created_at at time zone 'America/Costa_Rica')::date as dia,
    exists (select 1 from public.funnel_events f
      where f.user_id = p.id and f.name = 'onboarding_done'
        and f.created_at >= p.created_at and f.created_at <= q.observado_en) as registro,
    exists (select 1 from public.workouts w
      where w.user_id = p.id and w.finished_at is not null
        and w.finished_at <= q.observado_en) as entreno,
    exists (select 1 from public.trial_charges t where t.user_id = p.id) as tarjeta,
    exists (select 1 from public.trial_charges t
      where t.user_id = p.id and t.status = 'succeeded') as cobro,
    exists (select 1 from public.subscriptions s
      where s.user_id = p.id
        and (s.status = 'active'
          or (s.status = 'canceled' and s.cancel_at_period_end))
        and s.current_period_end > q.observado_en
        and s.provider in ('onvo', 'tilopay')) as suscripcion,
    exists (select 1 from public.comp_grants g
      where g.user_id = p.id and g.revoked_at is null
        and g.starts_at <= q.observado_en and g.expires_at > q.observado_en) as cortesia
  from public.profiles p cross join parametros q
  where p.created_at >= (q.desde::timestamp at time zone 'America/Costa_Rica')
    and p.created_at < ((q.hasta + 1)::timestamp at time zone 'America/Costa_Rica')
    and p.created_at <= q.observado_en
),
conteos as (
  select d.dia,
    count(c.id) as cuentas_creadas,
    count(c.id) filter (where c.registro) as registros_observados,
    count(c.id) filter (where c.entreno) as primer_entreno,
    count(c.id) filter (where c.tarjeta) as tarjeta_guardada,
    count(c.id) filter (where c.cobro and not c.cortesia) as cobros_exitosos,
    count(c.id) filter (where c.suscripcion and not c.cobro and not c.cortesia) as pagos_suscripcion_sin_duplicar,
    count(c.id) filter (where (c.cobro or c.suscripcion) and not c.cortesia) as usuarios_pago,
    count(c.id) filter (where c.registro and (c.cobro or c.suscripcion) and not c.cortesia) as registros_que_pagan
  from dias d left join cuentas c using (dia)
  group by d.dia
),
base as (
  select c.*, case when dia >= date '2026-10-28' then registros_observados end as registros_completos,
    (select sum(g.usd) from gasto_manual g where g.dia = c.dia) as gasto_usd
  from conteos c
)
select b.*, q.observado_en,
  round(100.0 * registros_que_pagan / nullif(registros_completos, 0), 2) as prueba_a_pago_pct,
  round(gasto_usd / nullif(usuarios_pago, 0), 2) as costo_cliente_pago_usd,
  sum(usuarios_pago) over () as total_usuarios_pago,
  case when count(registros_completos) over () = count(*) over ()
    then sum(registros_completos) over () end as total_registros_completos,
  case when count(gasto_usd) over () = count(*) over ()
    then round(sum(gasto_usd) over () / nullif(sum(usuarios_pago) over (), 0), 2)
    end as costo_cliente_pago_total_usd,
  100 as meta_usuarios_pago, 285 as meta_registros,
  35 as meta_prueba_a_pago_pct, 14.98 as techo_costo_cliente_pago_usd
from base b cross join parametros q
order by dia;
