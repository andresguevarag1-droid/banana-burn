-- Solo lectura. Activación (#200): registro > primer entreno en 72 h > tarjeta > pago, una fila por día de Costa Rica.
-- Mismas definiciones que el resumen diario del dueño y la sección "Activación de hoy" de /admin
-- (src/lib/activacion.ts). Son dos consultas: selecciona una y córrela en el editor SQL de Supabase.
--
-- 1) Una fila por día, observado AHORA:
--    registros            cuentas creadas en el día (profiles.created_at).
--    cohorte_hace_3_dias  cuentas creadas 3 días antes; primer_entreno_72h, las que terminaron un entreno
--                         (workouts.finished_at) dentro de sus primeras 72 h. pct_72h es el indicador (meta 30 %).
--    entrenos_abiertos    personas con workout_open en el día.
--    entrenos_abandonados personas con workout_leave en el día y ningún entreno terminado ese día.
--    entrenos_terminados  personas con un entreno terminado en el día.
--    tarjetas_guardadas   filas nuevas de trial_charges.
--    pagos                personas cuyo primer pago cae en el día: el cobro de la prueba (status 'succeeded') o, sin él,
--                         su primera suscripción ONVO/Tilopay. Igual que rentabilidad-semanal.sql. El push del resumen
--                         cuenta además renovaciones, temporadas y retos (admin_events), así que puede salir mayor.
with
parametros as (
  select (now() at time zone 'America/Costa_Rica')::date as hasta,
         14 as dias,
         now() as observado_en
),
dias as (
  select q.hasta - n as dia,
    ((q.hasta - n)::timestamp at time zone 'America/Costa_Rica') as inicio,
    ((q.hasta - n + 1)::timestamp at time zone 'America/Costa_Rica') as fin
  from parametros q cross join lateral generate_series(0, q.dias - 1) n
),
primer_pago as (
  select x.user_id, min(x.pagado_en) as pagado_en from (
    select t.user_id, coalesce(t.last_attempt_at, t.updated_at) as pagado_en
    from public.trial_charges t where t.status = 'succeeded'
    union all
    select s.user_id, min(s.created_at)
    from public.subscriptions s
    where s.provider in ('onvo', 'tilopay')
      and not exists (select 1 from public.trial_charges t where t.user_id = s.user_id and t.status = 'succeeded')
    group by s.user_id
  ) x group by x.user_id
),
filas as (
  select d.dia,
    (select count(*) from public.profiles p
      where p.created_at >= d.inicio and p.created_at < d.fin and p.created_at <= q.observado_en) as registros,
    (select count(*) from public.profiles p
      where p.created_at >= d.inicio - interval '3 days' and p.created_at < d.fin - interval '3 days') as cohorte_hace_3_dias,
    (select count(*) from public.profiles p
      where p.created_at >= d.inicio - interval '3 days' and p.created_at < d.fin - interval '3 days'
        and exists (select 1 from public.workouts w
          where w.user_id = p.id and w.finished_at is not null
            and w.finished_at >= p.created_at and w.finished_at <= p.created_at + interval '72 hours'
            and w.finished_at <= q.observado_en)) as primer_entreno_72h,
    (select count(distinct e.user_id) from public.funnel_events e
      where e.name = 'workout_open' and e.created_at >= d.inicio and e.created_at < d.fin) as entrenos_abiertos,
    (select count(distinct e.user_id) from public.funnel_events e
      where e.name = 'workout_leave' and e.created_at >= d.inicio and e.created_at < d.fin
        and not exists (select 1 from public.workouts w
          where w.user_id = e.user_id and w.finished_at >= d.inicio and w.finished_at < d.fin)) as entrenos_abandonados,
    (select count(distinct w.user_id) from public.workouts w
      where w.finished_at >= d.inicio and w.finished_at < d.fin) as entrenos_terminados,
    (select count(*) from public.trial_charges t
      where t.created_at >= d.inicio and t.created_at < d.fin) as tarjetas_guardadas,
    (select count(*) from primer_pago g
      where g.pagado_en >= d.inicio and g.pagado_en < d.fin) as pagos,
    -- A toda la cohorte ya le pasaron sus 72 h: la cifra ya no cambia.
    q.observado_en >= d.fin - interval '3 days' + interval '72 hours' as cohorte_cerrada
  from dias d cross join parametros q
)
select f.dia, f.registros, f.cohorte_hace_3_dias, f.primer_entreno_72h,
  round(100.0 * f.primer_entreno_72h / nullif(f.cohorte_hace_3_dias, 0), 1) as pct_72h,
  f.cohorte_cerrada, f.entrenos_abiertos, f.entrenos_abandonados, f.entrenos_terminados,
  f.tarjetas_guardadas, f.pagos, 30 as meta_pct_72h
from filas f
order by f.dia desc;

-- 2) En qué paso se van: salidas del entreno (workout_leave) de los últimos 7 días.
--    fase   'play' = entrenando, 'summary' = en el resumen final sin guardar (src/app/(app)/app/entreno/player.tsx).
--    series_hechas / series_del_plan vienen de props.done y props.total; segundos, de props.seconds_on_screen.
--    despues_terminaron: de esas personas, cuántas terminaron un entreno después de salirse.
with
salidas as (
  select e.user_id, e.created_at,
    coalesce(e.props->>'phase', 'sin dato') as fase,
    case when jsonb_typeof(e.props->'done') = 'number' then (e.props->>'done')::numeric end as hechas,
    case when jsonb_typeof(e.props->'total') = 'number' then (e.props->>'total')::numeric end as del_plan,
    case when jsonb_typeof(e.props->'seconds_on_screen') = 'number' then (e.props->>'seconds_on_screen')::numeric end as segundos
  from public.funnel_events e
  where e.name = 'workout_leave' and e.created_at >= now() - interval '7 days'
),
pasos as (
  select s.*,
    case
      when s.fase = 'summary' then '4. en el resumen, sin guardar'
      when s.hechas is null then '5. sin dato'
      when s.hechas = 0 then '1. antes de la primera serie'
      when s.del_plan is not null and s.hechas >= s.del_plan then '3. con todas las series hechas'
      else '2. a la mitad'
    end as paso
  from salidas s
)
select p.paso, p.fase, p.hechas as series_hechas,
  count(*) as salidas,
  count(distinct p.user_id) as personas,
  round(100.0 * count(*) / nullif(sum(count(*)) over (), 0), 1) as pct_salidas,
  percentile_cont(0.5) within group (order by p.del_plan) as series_del_plan_mediana,
  percentile_cont(0.5) within group (order by p.segundos) as segundos_mediana,
  count(distinct p.user_id) filter (where exists (select 1 from public.workouts w
    where w.user_id = p.user_id and w.finished_at > p.created_at)) as despues_terminaron
from pasos p
group by p.paso, p.fase, p.hechas
order by p.paso, p.hechas nulls last;
