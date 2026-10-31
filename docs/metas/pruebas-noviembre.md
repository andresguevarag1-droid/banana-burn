# Pruebas A/B de precio y oferta para noviembre

Tres pruebas, ordenadas por cuánto dinero pueden mover. Ninguna gasta en anuncios ni contrata herramientas: cambian algo que la app ya muestra o un correo que ya sale. **Es solo un plan**: no cambia código, correos, precios, campañas ni términos, y **ninguna prueba se activa sin la aprobación de Andrés**. Las cifras salen de `src/lib/plans.ts` y `src/lib/trial.ts`, y las vigila `src/lib/pruebas-noviembre.test.ts`. Lo que no tiene dato dice "por medir".

| # | Prueba | Paso del embudo que mueve | Lo que mueve cada persona que cambia de camino |
| --- | --- | --- | --- |
| 1 | Anual o mensual marcado por defecto en la pantalla de elegir plan | Anual (y pago) | +$55.00 en Entreno y +$82.50 en Entreno + Nutrición en el primer cobro |
| 2 | 50 % del primer mes contra solo los 7 días gratis | Tarjeta guardada y pago | $5.00 en Entreno y $7.50 en Entreno + Nutrición por cada pago con tarjeta |
| 3 | Asunto del correo del día 6 | Prueba a pago de quien no dejó tarjeta | Solo cambia cuántas personas abren el correo: de $4.99 a $89.99 por cada pago nuevo, con efecto esperado pequeño |

## Reglas comunes

**Métrica que decide: pagos por cohorte**, no aperturas ni clics. Un pago es lo mismo que en el tablero: `trial_charges.status = 'succeeded'` o suscripción vigente de ONVO o Tilopay, sin cortesías. La tarjeta guardada no es un pago.

**Quién entra.** Solo cuentas de la prueba normal de 7 días, creadas desde el lanzamiento (`BETA_ENDS_AT`, 1 de noviembre en Costa Rica). Se excluyen las cuentas de la beta (su oferta ya se les prometió con fecha), y cualquier cuenta con `comp_grants`: cortesías, regalos, referidos, testers y el mes gratis de condominios.

**Cómo se reparte.** Cada cuenta cae en A o en B por un cálculo fijo sobre su id, sin tabla nueva: el primer byte del md5 de `<id>:<nombre de la prueba>`, par es A e impar es B. Cada prueba tiene su propio nombre (`nov-anual`, `nov-50`, `nov-asunto-d6`), así que el grupo de una no decide el de otra. La app que active una prueba debe usar exactamente el mismo cálculo; la consulta lo repite así:

```sql
get_byte(decode(md5(p.id::text || ':nov-anual'), 'hex'), 0) % 2 = 0
```

**Tamaño mínimo de muestra**, por grupo, para comparar dos proporciones con 95 % de confianza y 80 % de potencia:

> n = (1.96 + 0.8416)² × [p1 × (1 − p1) + p2 × (1 − p2)] ÷ (p1 − p2)²

`p1` es la tasa de pago del grupo A y `p2` la más pequeña diferencia que vale la pena detectar. No hay datos de pago todavía (el primer cobro es el 8 de noviembre), así que `p1` parte de la meta del [acta](100-usuarios-de-pago.md), **35.2 %** de registro a pago. Es un supuesto de cálculo, no un dato: con la primera cohorte cerrada se recalcula `n` con la tasa real.

**Duración** = semanas de entrada + maduración. Semanas de entrada = 2 × n ÷ cuentas elegibles por semana (por medir). Como referencia, si llegan los 285 registros de la meta en los 30 días de noviembre, son unos 66.5 por semana. Maduración: se lee cuando `pago_cerrado` es verdadero en todas las semanas incluidas (7 días de prueba, el reintento del día 8 y un día de margen después de la última cuenta).

**Cómo se lee la diferencia.** Con `xA` pagos de `nA` cuentas en A y `xB` de `nB` en B:

> p̄ = (xA + xB) ÷ (nA + nB); z = (xB ÷ nB − xA ÷ nA) ÷ √(p̄ × (1 − p̄) × (1 ÷ nA + 1 ÷ nB))

Si z es 1.96 o más, B paga más; si es −1.96 o menos, B paga menos; en medio, no hay diferencia demostrada. Solo se lee una vez, al llegar a `n` con las cohortes cerradas: mirar antes y parar cuando conviene inventa ganadores.

**Cómo se corre `embudo-de-pago.sql` para un grupo.** Dos cambios, nada más:

1. En `parametros`, `select date '2026-10-28' as desde` pasa a `select date '2026-11-01' as desde`.
2. En `cuentas`, después de `and p.created_at <= q.observado_en`, se agregan estas líneas (con el nombre de la prueba y `= 0` para A o `= 1` para B):

```sql
    and get_byte(decode(md5(p.id::text || ':nov-anual'), 'hex'), 0) % 2 = 0
    and not exists (select 1 from public.comp_grants g where g.user_id = p.id)
```

Se corre una vez por grupo, igual que siempre (rol administrativo, solo lectura) y se guardan los dos CSV con la fecha. Se suman las semanas de cada grupo: `cuentas_creadas` es `n` y `usuarios_pago_total` es `x`.

**Dinero exacto.** Para el ingreso de cada grupo, `rentabilidad-semanal.sql` con el mismo filtro dentro de `pagos` (`and get_byte(decode(md5(x.user_id::text || ':nov-anual'), 'hex'), 0) % 2 = 0` y la cuenta creada en el rango de la prueba), corrida para cada lunes desde el 2 de noviembre hasta la semana del último cobro. Se suma `ingresos_brutos_usd` de la fila total. Comisiones del procesador: por confirmar con Andrés.

**Qué no se mezcla.** Las pruebas 1 y 2 no corren juntas: el 50 % solo existe en el mensual, así que marcar el anual cambia lo que vale la oferta y no se sabría cuál movió el pago. La prueba 3 sí puede correr junto a cualquiera, porque tiene su propio nombre de reparto.

## Prueba 1: anual o mensual marcado por defecto

**Qué cambia.** La pantalla de elegir plan antes de guardar la tarjeta (`PlanPicker`, en la bienvenida y en Mi plan) hoy marca `{ plan: "completo", billing: "mes" }` cuando la persona llega sin un plan elegido (`src/app/bienvenida/wizard.tsx` y `src/app/(app)/app/suscripcion/page.tsx`). El muro de planes y `/precios` ya marcan el anual (`src/components/pricing.tsx`). A: mensual marcado, como hoy. B: anual marcado. Quien ya trae un plan elegido desde la landing sigue viendo ese plan en los dos grupos. Precios, textos y la nota "El 50 % de descuento es solo para el primer mes del plan mensual" no cambian.

**Hipótesis.** Si la pantalla marca el anual, más personas que pagan eligen el anual sin que baje la cantidad de personas que pagan.

**Métrica.** Principal: pagos por cohorte (`usuarios_pago_total ÷ cuentas_creadas`). De apoyo: `pagaron_anual` y `tarjeta_anual` contra `pagaron_mensual` y `tarjeta_mensual`, e ingresos del primer cobro por cuenta.

**Cuánto dinero mueve**, con los precios de `src/lib/plans.ts` y el 50 % de `src/lib/trial.ts`, antes de comisión:

| Por cada persona que | Entreno | Entreno + Nutrición |
| --- | ---: | ---: |
| Paga anual en vez del mensual con 50 % (primer cobro) | +$55.00 | +$82.50 |
| Deja de pagar por ver el anual primero (primer cobro) | −$4.99 | −$7.49 |
| Pagaría 12 meses mensuales (primero con 50 %) | $114.88 | $172.38 |
| Paga anual | $59.99 | $89.99 |

El anual cobra todo hoy y no depende de la renovación, que está por medir. Si la persona se quedara 12 meses en mensual, el anual deja $54.89 menos en Entreno y $82.39 menos en Entreno + Nutrición. Por eso la decisión no es solo el primer cobro.

**Tamaño mínimo.** El riesgo es perder pagos, así que la muestra se calcula para ver una caída de 10 puntos (35.2 % a 25.2 %; con los 285 registros de la meta serían unas 28 personas menos de pago): **n = 327 por grupo, 654 cuentas en total**.

**Duración.** A unos 66.5 registros por semana, 654 ÷ 66.5 = 9.8, o sea **10 semanas de entrada** y 9 días de maduración. Noviembre alcanza para empezarla, no para cerrarla. Si Andrés quiere decidir con las cuentas de noviembre (unas 142 por grupo), solo se verá una caída de unos 15 puntos (35.2 % a 20 % pide 132 por grupo), y una caída menor pasaría sin verse.

**Cómo se lee.** `embudo-de-pago.sql` con `nov-anual`, una vez con `= 0` y otra con `= 1`. Pagos con la fórmula de z; ingresos con `rentabilidad-semanal.sql` filtrada igual.

**Qué decide Andrés:**

| Resultado | Decisión |
| --- | --- |
| z de pagos −1.96 o menos (B paga menos) | Se queda el mensual marcado |
| z en medio y más ingresos del primer cobro por cuenta en B | Se marca el anual en la bienvenida y en Mi plan |
| z en medio y sin más ingresos en B | Se queda el mensual marcado: deja la renovación medible y no arriesga pagos hacia la meta de 100 |
| z de pagos 1.96 o más (B paga más) | Se marca el anual |

## Prueba 2: 50 % del primer mes contra solo los 7 días gratis

**Qué cambia.** A: como hoy, guardar la tarjeta antes del primer cobro da 50 % del primer mes mensual ($4.99 en Entreno, $7.49 en Entreno + Nutrición). B: los 7 días gratis sin tarjeta siguen igual, guardar la tarjeta sigue siendo opcional, y el primer cobro es el precio normal ($9.99 o $14.99).

**Condición antes de activarla.** Hoy el 50 % es una promesa pública para todas las cuentas: está en los Términos (`src/app/(marketing)/terminos/page.tsx`), en las preguntas frecuentes (`src/app/(marketing)/content.tsx`), en los precios (`src/components/pricing.tsx`) y en `llms.txt`. Quitársela al grupo B rompería lo que se le prometió. Esta prueba **no puede correr** hasta que Andrés decida sacar el 50 % de las páginas públicas y de los Términos y dejarlo solo como oferta dentro de la app, que solo vea el grupo A. Hay que revisar también los anuncios y correos que lo nombran. Si Andrés no quiere tocar esa promesa, la prueba no se hace y se queda el 50 %.

**Hipótesis.** El 50 % sube tanto las tarjetas guardadas que compensa lo que deja de cobrar en el primer mes.

**Métrica.** Principal: pagos por cohorte (`usuarios_pago_total ÷ cuentas_creadas`). De apoyo: `tarjeta_guardada`, `tasa_pago_pct` y `pagaron_sin_tarjeta`, para ver si en B la gente paga en el muro sin dejar tarjeta.

**Cuánto dinero mueve.** El 50 % deja de cobrar $5.00 por cada pago con tarjeta en Entreno y $7.50 en Entreno + Nutrición. Con los 100 usuarios de pago de la meta, si todos pagaran con tarjeta en mensual, son entre $500.00 y $750.00 del primer cobro. En dos cobros, cada pago con el 50 % deja $14.98 en Entreno y $22.48 en Entreno + Nutrición; sin el 50 %, $19.98 y $29.98. El 50 % solo se paga solo si sin él pagan menos de 75 % de las personas (14.98 ÷ 19.98 y 22.48 ÷ 29.98). Con la meta de 35.2 % en A, esa línea es **26.4 %** en B. Si solo se mira el primer cobro, la línea es 50 % (4.99 ÷ 9.99).

**Tamaño mínimo.** Para ver la diferencia entre 35.2 % y 26.4 %: **n = 429 por grupo, 858 cuentas en total**.

**Duración.** 858 ÷ 66.5 = 12.9, o sea **13 semanas de entrada** y 9 días de maduración. No cabe en noviembre y no puede empezar mientras corre la prueba 1.

**Cómo se lee.** `embudo-de-pago.sql` con `nov-50`, una vez por grupo. Se calcula `r = (xB ÷ nB) ÷ (xA ÷ nA)` y la z de pagos.

**Qué decide Andrés:**

| Resultado | Decisión |
| --- | --- |
| r menor que 0.75 | Se queda el 50 % |
| r de 0.75 o más y z en medio o positiva | Se quita el 50 % para las cuentas nuevas |
| r de 0.75 o más pero z de −1.96 o menos | Deja el mismo dinero con menos personas de pago: Andrés elige entre ingresos y la meta de 100. Recomiendo quedarse con el 50 %, porque la meta cuenta personas |

## Prueba 3: asunto del correo del día 6

**Qué cambia.** El correo del día 6 de `docs/emails/secuencia-prueba.md` ya sale (`TRIAL_SEQUENCE` en `src/lib/email/templates.ts`). A: «Elige cómo quieres seguir», como hoy. B: «Tu año de entreno, con ahorro», la variante del mismo documento. Vista previa, cuerpo y botón iguales.

**Quién lo recibe.** Las cuentas con la fila `prueba_d6` en `notification_log`. Quien tiene un cobro programado recibe ese día el aviso del cobro en vez de esta pieza (`src/lib/trial-sequence.ts`), así que el grupo es casi solo gente sin tarjeta. La fila se escribe al reclamar el envío, antes de saber si Resend lo entregó: cuenta como "se intentó enviar", igual en los dos grupos.

**Hipótesis.** Un asunto que nombra el ahorro del año hace que más personas sin tarjeta abran Mi plan y paguen antes de que termine su prueba.

**Métrica.** Principal: pagos por cohorte entre quienes recibieron la pieza (`usuarios_pago_total ÷ cuentas_creadas`; en este grupo casi nadie tiene tarjeta, así que se usa `usuarios_pago_total` y no `pagaron`). Aperturas y clics de Resend solo como señal, nunca para decidir.

**Cuánto dinero mueve.** Cada pago nuevo de este grupo vale de $4.99 (guarda la tarjeta el día 6 y gana el 50 % en Entreno) a $89.99 (Entreno + Nutrición anual). Un asunto cambia aperturas, no el precio ni la oferta, así que el efecto esperado en pagos es el más pequeño de las tres.

**Tamaño mínimo.** No hay ningún dato de cuánto paga hoy la gente sin tarjeta; dos escenarios de cálculo, que no son datos:

| Si A paga | Y B pagaría | n por grupo |
| ---: | ---: | ---: |
| 10 % | 15 % | 683 |
| 20 % | 25 % | 1,092 |

**Duración.** Si 60 % de los registros llega al día 6 sin tarjeta (la meta de tarjetas es 40 %), son unos 39.9 por semana: 1,366 ÷ 39.9 = 34.2, o sea **35 semanas** en el escenario más barato. Con el volumen de noviembre no se puede decidir por pagos.

**Cómo se lee.** `embudo-de-pago.sql` con `nov-asunto-d6`, una vez por grupo, con una línea más en `cuentas`:

```sql
    and exists (select 1 from public.notification_log n where n.user_id = p.id and n.kind = 'prueba_d6')
```

**Qué decide Andrés:**

| Resultado | Decisión |
| --- | --- |
| z de pagos 1.96 o más | B pasa a ser el asunto |
| z de −1.96 o menos | Se queda A |
| z en medio, o no se llega a `n` | Se queda A y se cierra la prueba. Más aperturas sin más pagos no cambian el asunto |

Como no gasta nada y el correo ya sale, Andrés puede dejarla corriendo junto a la prueba 1 si quiere, sabiendo que lo más probable es que termine sin ganador.

## Orden recomendado

1. **Prueba 1** primero: es la que más dinero mueve por persona, no toca ninguna promesa publicada y se cambia en una línea por pantalla. Desde que Andrés la apruebe y esté en la app, hasta llegar a 654 cuentas.
2. **Prueba 3**, si Andrés quiere, en paralelo con la 1.
3. **Prueba 2** solo después de cerrar la 1, y solo si Andrés decide antes qué hacer con la promesa pública del 50 %.

Lo que hace falta de Andrés: aprobar cada prueba por separado, y el número real de cuentas nuevas por semana desde el 1 de noviembre para recalcular la duración. Ninguna de estas pruebas cuesta dinero en anuncios; el costo es el trabajo de programarlas, que va como issue aparte.
