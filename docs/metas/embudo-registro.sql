-- Solo lectura. Embudo del registro (#236): de tocar "Empezar" a la cuenta creada y la bienvenida terminada.
-- Solo usa public.funnel_events (name, path, props, created_at, user_id), en días de Costa Rica. Son tres consultas:
-- selecciona una y córrela en el editor SQL de Supabase.
--
-- Pasos (eventos de src/app/api/track/event.ts):
--   empezar        cta_click con un botón que cuenta como Lead en el píxel (LEAD_CTA de src/lib/meta-pixel.ts), sin los
--                  registro-* (esos son el botón de /entrar y ya cuentan como intento).
--   vista_registro signup_view: se abrió /entrar?modo=registro.
--   intento        signup_submit: tocó crear la cuenta (props.method: password, code, google o apple).
--   cuenta         personas con algún onboarding_step: solo se llega a /bienvenida con la cuenta creada y la sesión abierta.
--   paso_6         personas que llegaron al último paso de la bienvenida (onboarding_step con step 6).
--   bienvenida     personas con onboarding_done (registro terminado, el CompleteRegistration del píxel).
-- Antes de la cuenta no hay user_id, así que empezar, vista_registro e intento cuentan eventos (una recarga suma otro);
-- desde cuenta se cuentan personas distintas. caida_pct es el % que no pasa del paso anterior.
--
-- 1) Una fila por día, últimos 14 días.
with
parametros as (
  select (now() at time zone 'America/Costa_Rica')::date as hasta,
         14 as dias
),
dias as (
  select q.hasta - n as dia,
    ((q.hasta - n)::timestamp at time zone 'America/Costa_Rica') as inicio,
    ((q.hasta - n + 1)::timestamp at time zone 'America/Costa_Rica') as fin
  from parametros q cross join lateral generate_series(0, q.dias - 1) n
),
filas as (
  select d.dia,
    (select count(*) from public.funnel_events e
      where e.name = 'cta_click' and e.created_at >= d.inicio and e.created_at < d.fin
        and e.props->>'cta' ~ '^(hero|final|nav|sticky|glp1-(hero|final|sticky|banda)|precios?-[a-z0-9-]+|plan-[a-z0-9-]+)$') as empezar,
    (select count(*) from public.funnel_events e
      where e.name = 'signup_view' and e.created_at >= d.inicio and e.created_at < d.fin) as vista_registro,
    (select count(*) from public.funnel_events e
      where e.name = 'signup_submit' and e.created_at >= d.inicio and e.created_at < d.fin) as intento,
    (select count(*) from public.funnel_events e
      where e.name = 'signup_error' and e.created_at >= d.inicio and e.created_at < d.fin) as errores,
    (select count(distinct e.user_id) from public.funnel_events e
      where e.name = 'onboarding_step' and e.created_at >= d.inicio and e.created_at < d.fin) as cuenta,
    (select count(distinct e.user_id) from public.funnel_events e
      where e.name = 'onboarding_step' and e.props->>'step' = '6' and e.created_at >= d.inicio and e.created_at < d.fin) as paso_6,
    (select count(distinct e.user_id) from public.funnel_events e
      where e.name = 'onboarding_done' and e.created_at >= d.inicio and e.created_at < d.fin) as bienvenida
  from dias d
)
select dia, empezar,
  vista_registro, round(100 - 100.0 * vista_registro / nullif(empezar, 0), 1) as caida_landing_pct,
  intento, round(100 - 100.0 * intento / nullif(vista_registro, 0), 1) as caida_entrar_pct,
  errores,
  cuenta, round(100 - 100.0 * cuenta / nullif(intento, 0), 1) as caida_crear_cuenta_pct,
  paso_6, round(100 - 100.0 * paso_6 / nullif(cuenta, 0), 1) as caida_bienvenida_pct,
  bienvenida, round(100 - 100.0 * bienvenida / nullif(paso_6, 0), 1) as caida_guardar_plan_pct
from filas
order by dia desc;

-- 2) Por paso, últimos 14 días juntos, con cada paso de la bienvenida (0 a 6) por separado.
with
parametros as (
  select (((now() at time zone 'America/Costa_Rica')::date - 13)::timestamp at time zone 'America/Costa_Rica') as desde
),
e as (
  select f.* from public.funnel_events f, parametros q where f.created_at >= q.desde
),
pasos(orden, paso, unidad, total) as (
  select 1, 'empezar', 'eventos', (select count(*) from e where e.name = 'cta_click'
    and e.props->>'cta' ~ '^(hero|final|nav|sticky|glp1-(hero|final|sticky|banda)|precios?-[a-z0-9-]+|plan-[a-z0-9-]+)$')
  union all select 2, 'vista_registro', 'eventos', (select count(*) from e where e.name = 'signup_view')
  union all select 3, 'intento', 'eventos', (select count(*) from e where e.name = 'signup_submit')
  union all select 4 + s, 'bienvenida_paso_' || s, 'personas',
    (select count(distinct e.user_id) from e where e.name = 'onboarding_step' and e.props->>'step' = s::text)
    from generate_series(0, 6) s
  union all select 11, 'bienvenida_terminada', 'personas', (select count(distinct e.user_id) from e where e.name = 'onboarding_done')
)
select orden, paso, unidad, total,
  round(100 - 100.0 * total / nullif(lag(total) over (order by orden), 0), 1) as caida_pct
from pasos
order by orden;

-- 3) Cómo intentan registrarse y por qué falla, últimos 14 días: signup_submit por método y signup_error por motivo.
with
parametros as (
  select (((now() at time zone 'America/Costa_Rica')::date - 13)::timestamp at time zone 'America/Costa_Rica') as desde
)
select f.name as evento, coalesce(f.props->>'method', f.props->>'reason') as detalle, count(*) as total
from public.funnel_events f, parametros q
where f.name in ('signup_submit', 'signup_error') and f.created_at >= q.desde
group by 1, 2
order by 1 desc, 3 desc, 2;
