# Activación: primer entreno en 24 horas

El paso que mueve este cambio es bienvenida completada → primer entreno → pago.
Al guardar la bienvenida se abre Hoy directamente, sin interponer instalación ni
el resumen del plan. Se conserva la oferta opcional de tarjeta anterior al cierre.
Hoy muestra «Tu primer entreno» y un único botón para empezar con los
minutos estimados por el motor a partir de ejercicios y descansos, no el tiempo
preferido del perfil. No es una promesa de duración exacta: el ritmo personal varía.

La primera sesión usa la primera plantilla del calendario en la semana inicial,
con el equipo y nivel del perfil. Mientras no haya un entreno guardado, volver otro
día o semana ofrece los mismos ejercicios. Cambiar equipo o nivel sí los adapta.
Los programas activos conservan su experiencia propia. Primeros pasos, recorrido,
energía y alternativa exprés dejan de competir con el botón inicial. Instalación
sigue disponible después de entrenar. El reproductor conserva sus estados de
vacío, guardado, error y recuperación sin conexión.

## Medición

Se reutiliza `funnel_events`: `workout_open` mide apertura; `brief_start`
registra cuándo la persona pulsa Empezar en la guía de cada ejercicio;
`workout_first_set` mide la primera serie completada;
`workout_saved` confirma guardado correcto. Los cuatro llevan `first_session`
calculado en servidor para la rutina inicial. No se crean tablas ni migraciones.
Usar el primer evento por persona, no contar reintentos o reaperturas como usuarios.
Para incluir exprés y programas en la activación global, contar también sus primeros
eventos aunque no tengan esta propiedad.

Consulta por cohortes de registro (UTC), excluyendo cuentas sin 24 horas de observación:

```sql
with cohort as (
  select id, created_at from profiles
  where created_at >= :cohort_start and created_at < :cohort_end
    and created_at <= now() - interval '24 hours'
), activation as (
  select c.id,
    exists (select 1 from funnel_events f where f.user_id = c.id
      and f.name = 'brief_start' and f.created_at >= c.created_at
      and f.created_at <= c.created_at + interval '24 hours') as started,
    exists (select 1 from workouts w where w.user_id = c.id
      and w.finished_at >= c.created_at
      and w.finished_at <= c.created_at + interval '24 hours') as completed
  from cohort c
)
select count(*) as registrations,
  count(*) filter (where started) as started_24h,
  count(*) filter (where completed) as completed_24h,
  round(100.0 * count(*) filter (where completed) / nullif(count(*), 0), 2)
    as completed_24h_percent
from activation;
```

El inicio es el primer `brief_start` por persona: `first` en ese evento describe
la guía del reproductor, mientras que `first_session` identifica la rutina inicial.
No confundir abrir la pantalla con empezar a entrenar. El porcentaje iniciado
se calcula como `100.0 * started_24h / registrations`, evitando dividir entre cero.

El final autoritativo es `workouts.finished_at`: permite medir una sesión terminada
sin conexión aunque se sincronice después. Los eventos usan la hora de recepción;
pueden faltar si el navegador bloquea analítica. Para medir desde bienvenida,
usar el primer `onboarding_done` como origen y declarar ese denominador aparte.
En ese caso, sustituir la CTE `cohort` de la consulta por esta (los parámetros
del intervalo representan fechas de bienvenida, no de registro):

```sql
with first_welcome as (
  select user_id as id, min(created_at) as created_at
  from funnel_events
  where name = 'onboarding_done' and user_id is not null
  group by user_id
), cohort as (
  select id, created_at from first_welcome
  where created_at >= :cohort_start and created_at < :cohort_end
    and created_at <= now() - interval '24 hours'
)
```

Continuar con `activation` y el resultado de la consulta anterior. El mínimo
se calcula antes de filtrar fechas para que repetir la bienvenida no cambie
la cohorte. Las bienvenidas sin evento no entran en este denominador;
por eso la cohorte de registro sigue siendo el indicador global.

Para comparar inicios históricos anteriores a esta revisión, usar
`workout_first_set` en ambas cohortes: la propiedad `first_session` de
`brief_start` solo está disponible desde este cambio.
Comparar cohortes antes/después y su primer cobro `trial_charges.status = 'succeeded'`;
no atribuir una mejora de pago sin observarla. El guardado parcial cuenta como
entreno registrado; para exigir toda la rutina, analizar `done = total` en el evento.

## Dinero neto potencial

Precios de `src/lib/plans.ts`, USD con IVA incluido. Neto por cobro = precio ÷ 1.13
− precio × comisión porcentual − $0.35. No es beneficio después de otros gastos.

| Plan | Cobro | Neto ONVO (3.9 %) | Neto Tilopay (4.25 %) |
| --- | ---: | ---: | ---: |
| Entreno mensual | $9.99 | $8.10 | $8.07 |
| Entreno + Nutrición mensual | $14.99 | $12.33 | $12.28 |
| Entreno anual | $59.99 | $50.40 | $50.19 |
| Entreno + Nutrición anual | $89.99 | $75.78 | $75.46 |

Cada pago adicional observado mueve ese neto según el plan y procesador.
No se estima cuántos pagos nuevos generará el cambio. El primer mes con descuento
se calcula con el monto realmente cobrado, no con el precio completo de la tabla.
No se modifica cobro ni se publica o gasta presupuesto.

## Revisión visual

Revisar a 390 y 1280 px: bienvenida guardando/error, Hoy inicial, regreso sin
entrenar, reproductor vacío, resumen guardando/error/sin conexión y éxito.
Actualizar captura de Hoy en la landing y cualquier recorrido que muestre el
cierre anterior de bienvenida. El reproductor no cambia de diseño.

En este entorno no se pudieron generar capturas: la descarga de Chromium de
Playwright devuelve HTTP 403. La revisión visual de los estados anteriores queda
pendiente en un entorno con navegador; no se sustituyen por imágenes simuladas.

## Validación de código

La prueba de regreso recorre todos los días, semanas 0, 1 y 4, frecuencias de
3 a 6 días, tres equipos y ambos perfiles: la rutina inicial debe ser idéntica
hasta guardar un entreno; después deja de ofrecerse.

En esta revisión pasan `npx tsc --noEmit -p .`,
`npx eslint src scripts --quiet` y `npx vitest run` (216 archivos, 2,439 pruebas).
La compilación de producción pasa con
`NODE_OPTIONS=--max-old-space-size=1536 npx next build`, limitando la memoria
para los 4 GB disponibles, sin desactivar comprobaciones.
