# Campaña de conversión desde el 9 de noviembre (propuesta)

Propuesta de Martín para Andrés: reactivar anuncios de conversión en Costa Rica **solo si** los cobros de la semana del 2 al 8 de noviembre cumplen la regla de [rentabilidad-semanal.md](rentabilidad-semanal.md).

**Es una propuesta, no un gasto.** No crea, edita, pausa ni enciende nada en Meta Ads, no publica ni envía nada y no cambia código. **Nada se activa sin la aprobación de Andrés por escrito**, aunque la regla se cumpla. Las cifras salen de `src/lib/plans.ts` y `src/lib/trial.ts`, y las vigila `src/lib/campana-conversion-noviembre.test.ts`. Lo que no tiene dato dice "por medir"; lo que decide Andrés dice "decisión de Andrés" o "por confirmar con Andrés".

## 1. La condición

El lunes 9 de noviembre se arma el primer reporte de [rentabilidad-semanal.md](rentabilidad-semanal.md) con la **semana del lunes 2 al domingo 8 de noviembre** (hora de Costa Rica). Esa semana tiene el primer cobro de las cuentas de la beta que dejaron su tarjeta (8 de noviembre, `BETA_GRACE_UNTIL` en `src/lib/plans.ts`).

Reactivar anuncios es pasar de no gastar a gastar, así que en la tabla "Cómo se decide" de la regla cuenta como **subir**. La regla se cumple solo si se cumplen las cinco a la vez:

1. Hay pagos nuevos en la semana: **N > 0**.
2. El margen de la semana es positivo o cero: **I − G ≥ 0**, con I = ingresos nuevos netos y G = gasto en Meta Ads de la semana.
3. Andrés confirmó la comisión del procesador (`c` y `f`). Mientras esté por confirmar, la regla dice que la decisión nunca puede ser "subir".
4. El gasto de los 7 días está completo en `gasto_manual` (los días sin gasto, con 0 confirmado) y los ingresos están conciliados con Tilopay y ONVO.
5. El máximo de la semana siguiente es mayor que el gasto de esta semana: **mínimo(I, tope semanal) > G**, con el tope semanal que fije Andrés. Si la semana del 2 al 8 no tuvo gasto (G = 0), basta con que ese máximo sea mayor que cero; si hubo gasto y el máximo queda en G o por debajo, la regla dice "mantener", no "subir".

Si se cumplen, el gasto de la semana del 9 al 15 de noviembre puede llegar como máximo a mínimo(I, tope semanal). **Ese máximo es para todo el gasto en Meta Ads de la semana**: si Andrés aprueba también otra campaña (como [meta-ads-noviembre.md](../../marketing/estrategia/meta-ads-noviembre.md)) o el [boost orgánico](../../marketing/ads/boost-organico.md), todo suma en G y comparte el mismo máximo. Si no cabe todo, primero va esta campaña, porque busca pagos.

Lo que **no** cuenta para la condición:

- Los cobros del reintento del lunes 9 (`RETRY_AFTER_DAYS` = 1 en `src/lib/trial.ts`): entran en la semana del 9 al 15 y se leen el lunes 16.
- Cobros programados para después del 8 de noviembre. La regla no presta contra cobros futuros.
- Tarjetas guardadas, registros o seguidores.

## 2. Qué leer el 9 de noviembre

Andrés corre las tres consultas en Supabase > SQL Editor después de la medianoche del domingo 8 (hora de Costa Rica) y exporta cada resultado a CSV con la fecha. Las tres son de solo lectura.

| Consulta | Parámetros | Qué leer | Para qué |
| --- | --- | --- | --- |
| `rentabilidad-semanal.sql` | `lunes` = `date '2026-11-02'` (ya viene así) | `pagos_nuevos` e `ingresos_brutos_usd` por plan, forma de pago y 50 %, y la fila `total` | N, B e I de la condición; la mezcla de planes para el CAC máximo de la sección 3 |
| `tablero-diario.sql` | `desde` = `date '2026-10-25'`, `hasta` = `date '2026-11-08'`; en `gasto_manual` una fila por día con el gasto de Meta Ads en USD | `gasto_usd` de los días del 2 al 8 de noviembre (suma = G), `cobros_exitosos`, `usuarios_pago`, `total_usuarios_pago` y `costo_cliente_pago_total_usd` | G de la condición y el conteo de usuarios de pago hacia los 100 |
| `embudo-de-pago.sql` | Los de siempre (`desde` = 28 de octubre, `hasta` = hoy) | Por semana: `tarjeta_guardada`, `pagaron`, `tasa_pago_pct` (meta 88 %), `pagaron_mensual`, `pagaron_anual`, `pagaron_entreno`, `pagaron_completo`, `pagaron_sin_tarjeta`, `paso_con_mas_perdida` y `pago_cerrado` | Dónde se pierde la gente si la regla no se cumple, y qué planes pagan |

Cómo leerlas el 9:

- **`pago_cerrado` todavía es falso** el 9: la semana del 26 de octubre (las cuentas de la beta) cierra su paso de pago al terminar el martes 10 (cobro del 8, reintento del 9 y un día de margen), y la del 2 de noviembre al terminar el martes 17. La tasa de pago del 9 es provisional; la condición de la sección 1 no la usa, usa el dinero que ya entró.
- `prueba_a_pago_pct` del tablero solo vale para cohortes con la prueba terminada. Las cuentas creadas desde el 2 de noviembre todavía están en su prueba.
- El costo por cliente que paga del tablero es del sitio completo (incluye orgánico y beta): no es el costo de un anuncio.

Datos que no están en Supabase y pasa Andrés:

| Dato | De dónde | Estado |
| --- | --- | --- |
| Gasto de Meta Ads de cada día del 2 al 8 de noviembre | Ads Manager | por medir |
| Comisión `c` y cargo fijo `f` de Tilopay y ONVO | Contratos | por confirmar con Andrés |
| Conciliación de los cobros del 8 de noviembre | Portales de Tilopay y ONVO | por medir |
| Tope semanal | Andrés | por confirmar con Andrés |
| Resultados por anuncio de octubre: gasto, impresiones, reproducciones de 3 s, registros completados y costo por registro | Ads Manager, exportado por anuncio | por medir |

El último hace falta porque **`marketing/plan-ads-octubre-2026.md` no existe en el repositorio** (ni en su historial). Sin ese export, la elección de Reels de la sección 4 se apoya en un solo dato.

## 3. Costo máximo por usuario de pago

Salen de la sección 2 de [rentabilidad-semanal.md](rentabilidad-semanal.md). Son **techos antes de comisión** (`c` y `f` por confirmar con Andrés): el neto real siempre es menor. La columna de prueba iniciada multiplica el techo por **35.2 %**, la meta de registro a pago del [acta](100-usuarios-de-pago.md); es un supuesto, no un dato, y se redondea hacia abajo al centavo.

| Plan y forma de pago | CAC máximo para recuperar en el primer mes | CAC máximo para recuperar en 3 meses si todos renuevan | Costo máximo por prueba iniciada (primer mes, con 35.2 %) | Costo máximo por prueba iniciada (3 meses, con 35.2 %) |
| --- | ---: | ---: | ---: | ---: |
| Entreno, primer mes con 50 % | $4.99 | $24.97 | $1.75 | $8.78 |
| Entreno, mensual sin 50 % | $9.99 | $29.97 | $3.51 | $10.54 |
| Entreno, anual | $59.99 | $59.99 | $21.11 | $21.11 |
| Entreno + Nutrición, primer mes con 50 % | $7.49 | $37.47 | $2.63 | $13.18 |
| Entreno + Nutrición, mensual sin 50 % | $14.99 | $44.97 | $5.27 | $15.82 |
| Entreno + Nutrición, anual | $89.99 | $89.99 | $31.67 | $31.67 |

Cómo se usa:

- **Manda el primer mes.** La renovación de los meses 2 y 3 está por medir (no hay segundos cobros hasta diciembre), así que la columna de 3 meses es una apuesta, no un límite para aprobar gasto.
- **El CAC máximo de esta campaña es el ingreso neto promedio por pago nuevo de la semana del 2 al 8** (I ÷ N): por medir. Si la mezcla real no se conoce o casi todos los pagos son de Entreno con 50 %, se usa el caso más exigente: **$4.99 por usuario de pago y $1.75 por prueba iniciada**.
- La mezcla de la beta puede no parecerse a la de quien llega por un anuncio. Se recalcula con la cohorte de la campaña (sección 7).

## 4. Si la regla se cumple: qué campaña lanzar

Una campaña nueva, separada de la de octubre y de las propuestas de noviembre. Todo lo de esta sección se configura solo después del sí de Andrés.

| Campo | Propuesta |
| --- | --- |
| Nombre | `BB Conv CR Nov26` (campaña), `BB Conv CR Nov26 Todos` (conjunto) |
| País | Solo Costa Rica |
| Objetivo y evento | Ventas, conversión en el sitio web. Evento: **prueba iniciada** (`CompleteRegistration`) para empezar; **Subscribe** cuando haya volumen (ver abajo). Decisión de Andrés |
| Público | Todo Costa Rica, 18 a 55 años, Advantage+ audience sin intereses: el gancho del Reel hace el filtro. Un solo conjunto, para no partir un presupuesto chico |
| Exclusiones | BB registrados (`CompleteRegistration`, 180 días) y BB suscriptores (`Subscribe`, 180 días), los mismos públicos de [meta-ads-noviembre.md](../../marketing/estrategia/meta-ads-noviembre.md); se crean si no existen |
| Ubicaciones | Instagram Reels, Stories y Explorar; Facebook Reels y Stories. Nada fuera de 9:16 |
| Llegada | La portada (`/`), con el botón "Empieza 7 días gratis" |
| Fechas | De lunes a domingo, una semana por aprobación. La primera, del lunes 9 (o el día que Andrés apruebe) al domingo 15 de noviembre. No se renueva sola |
| Presupuesto | Uno de los 3 niveles de la sección 6, nunca más que el máximo de la regla. Límite total y fecha de fin configurados en Meta |

### Por qué prueba iniciada y no Subscribe al principio

- La prueba de 7 días empieza al crear la cuenta, sin tarjeta (`TRIAL_DAYS` en `src/lib/plans.ts`), y Meta la ve como `CompleteRegistration` al terminar la bienvenida. Llega el mismo día del clic.
- `Subscribe` llega 7 días después o más, y el del cobro automático sale desde el servidor (`sendChargeSubscribe` en `src/lib/meta-capi.ts`) como evento del sistema, solo con el id de la persona con hash: sin cookies de Meta es probable que Meta no lo una al anuncio. Además ese mismo evento sale en las renovaciones.
- La guía de Meta habla de unas 50 conversiones por semana por conjunto para salir de la fase de aprendizaje. Con un presupuesto de la sección 6 no se llega a eso con pagos.
- **Se propone cambiar a Subscribe** cuando Events Manager muestre `Subscribe` atribuidos a la campaña en una semana completa: cuántos, por medir. El cambio lo aprueba Andrés.

El evento de optimización no cambia lo que se mide: **la campaña se juzga por costo por usuario de pago**, contado en `trial_charges`, no por costo por prueba ni por los `Subscribe` de Meta.

### Reels

El issue pide los Reels que mejor funcionaron en octubre según `marketing/plan-ads-octubre-2026.md`, y ese archivo no existe. El único dato por anuncio de octubre que hay en el repositorio está en [embudo-noviembre.md](../../marketing/estrategia/embudo-noviembre.md): el Reel **"Cuánto peso"** costó $0.64 por registro completado contra unos $1.01 del promedio de la campaña, el 28 de octubre (cifras que pasó Andrés desde Ads Manager, de un solo día).

| Anuncio | Creatividad | Por qué | Estado |
| --- | --- | --- | --- |
| A | Reel "Cuánto peso" de la campaña de octubre, el mismo video | Menor costo por registro conocido ($0.64 el 28 oct) | Se usa si el export de octubre lo confirma como el mejor |
| B | El segundo anuncio de octubre por costo por registro completado, con al menos $15 gastados | Comparar contra A con un gancho distinto | por medir: sale del export por anuncio de octubre |

- Si el export de todo octubre muestra otro orden, manda el export, no el dato del 28.
- Si "Cuánto peso" de octubre es el mismo video que R01 del [kit de Reels](../../marketing/kit-reels-noviembre-2026.md) ("Cuando no sabes cuánto peso usar"): por confirmar con Andrés.
- El costo por registro no dice qué anuncio trae pagos (la app no guarda los UTM de los anuncios, ver la sección 7). Es la mejor señal que existe, no la buena.
- Si el anuncio B resulta ser de GLP-1, su texto lleva "No sustituye la indicación de tu médico." y va a `/glp1`, como en [meta-ads-noviembre.md](../../marketing/estrategia/meta-ads-noviembre.md).

Textos, iguales a los aprobados para principiantes en [meta-ads-noviembre.md](../../marketing/estrategia/meta-ads-noviembre.md):

- Texto principal: "Si no sabes cuánto peso usar, empieza aquí. Rutina a tu nivel y técnica de cada ejercicio. 7 días gratis, sin tarjeta."
- Título: "Empieza 7 días gratis". Descripción: "Sin tarjeta. Cancelas cuando quieras." Botón: Registrarte.
- Nada de urgencia, contadores, testimonios ni antes y después. La oferta de condominios no aparece: es otra pieza.

UTMs (minúsculas, sin acentos):

| Anuncio | utm_campaign | utm_content | URL final |
| --- | --- | --- | --- |
| A | bb-conv-cr-nov26 | cr-conv-a-15s | https://www.bananaburn.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=bb-conv-cr-nov26&utm_content=cr-conv-a-15s |
| B | bb-conv-cr-nov26 | cr-conv-b-15s | https://www.bananaburn.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=bb-conv-cr-nov26&utm_content=cr-conv-b-15s |

### Reglas mientras corre

Todo se le propone a Andrés; nada se pausa ni se sube solo.

- **Revisión a las 48 y 72 horas** con gasto, pruebas iniciadas, costo por prueba iniciada y hook rate (3 s ÷ impresiones).
- **Pausar un anuncio** (se propone): si gastó $15 o más y su costo por prueba iniciada pasa de $3.50, el doble del caso más exigente de la sección 3 ($1.75).
- **Pausar la campaña** (se propone): si el reporte del lunes siguiente da "pausar".
- **Nunca** subir el presupuesto a mitad de semana ni recuperar días perdidos.

## 5. Si la regla no se cumple

El gasto de la semana del 9 al 15 es **$0.00**. No se reactiva nada, ni con un presupuesto menor.

| Lo que muestra el 9 de noviembre | Decisión de la regla | Qué se propone, sin gastar |
| --- | --- | --- |
| N = 0, con o sin gasto | Pausar | Leer `paso_con_mas_perdida` y `tasa_pago_pct` de `embudo-de-pago.sql`. Si el problema es el cobro, esperar el reintento del 9 y los correos de pago fallido ya existentes; si es la tarjeta, el siguiente issue es sobre la oferta del 50 % o el muro de planes, no sobre anuncios |
| I < G | Pausar | Lo mismo, y anotar en el reporte cuántos pagos faltaron: (G − I) ÷ ingreso neto promedio por pago |
| Falta un dato: gasto de algún día, `c` y `f`, o la conciliación | Mantener en $0.00 | Completar el dato y volver a correr las consultas de la misma semana. La decisión se toma con los datos completos, no antes |
| La regla se cumple pero el máximo semanal es menor que el nivel 1 de la sección 6 | Subir solo hasta el máximo | Proponer el máximo dividido entre 7 por día, si Meta lo acepta como presupuesto diario (mínimo por validar en la cuenta); si no lo acepta, $0.00 |

En todos los casos:

- **La siguiente lectura es el lunes 16 de noviembre**, con `lunes` = `date '2026-11-09'`. Esa semana suma los cobros del reintento y los primeros pagos de las cuentas creadas del 2 al 8 de noviembre, que terminan su prueba entre el 9 y el 15.
- El trabajo sigue en lo que cobra sin gastar: los correos de prueba y de recuperación ya aprobados, el muro de planes, la Temporada 1 (inscripciones hasta el 22 de noviembre) y condominios con Harvey.
- **No se reemplaza la conversión con boost orgánico ni con otro gasto.** Si no hay pagos, no hay presupuesto para ninguna línea.

## 6. Presupuesto en 3 niveles: decisión de Andrés

Alternativas para la semana del 9 al 15 de noviembre, en USD, solo para Costa Rica. **Cada nivel solo vale si cabe en el máximo de la regla**; no se suman niveles. Los pagos necesarios son para recuperar la semana con primeros pagos, antes de comisión (con comisión hacen falta más).

| Nivel | Por día | Por semana (7 días) | Pagos de Entreno con 50 % ($4.99) | Pagos de Entreno + Nutrición con 50 % ($7.49) | Pagos de Entreno mensual ($9.99) | Pagos de Entreno + Nutrición mensual ($14.99) | Requisito |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | $5.00 | $35.00 | 8 | 5 | 4 | 3 | Máximo de la regla de $35.00 o más |
| 2 | $10.00 | $70.00 | 15 | 10 | 8 | 5 | Máximo de la regla de $70.00 o más |
| 3 | $20.00 | $140.00 | 29 | 19 | 15 | 10 | Máximo de la regla de $140.00 o más |

- **Recomendación: nivel 1** la primera semana. Con lo que dé la cohorte del 9 al 15 se propone mantener, subir o pausar, siempre con la regla.
- Con el anual: nivel 1, 1 pago de $59.99 o de $89.99; nivel 2, 2 pagos de $59.99 o 1 de $89.99; nivel 3, 3 pagos de $59.99 o 2 de $89.99.
- Aprobación de Andrés: **pendiente**. Nivel elegido: decisión de Andrés. Tope semanal: por confirmar con Andrés.

## 7. Cómo se mide

| Qué | Cómo | Cuándo |
| --- | --- | --- |
| Costo por prueba iniciada | Ads Manager: gasto ÷ `CompleteRegistration` | A las 48 y 72 horas |
| Hook rate | Ads Manager: reproducciones de 3 s ÷ impresiones | A las 48 y 72 horas |
| Costo por usuario de pago de la cohorte | `tablero-diario.sql` con `desde` = `date '2026-11-09'`, `hasta` = `date '2026-11-15'` y el gasto de cada día en `gasto_manual`: `costo_cliente_pago_total_usd` | Provisional el lunes 23 de noviembre; cerrado el miércoles 25, cuando `pago_cerrado` de esa semana es verdadero en `embudo-de-pago.sql` |
| Margen de la semana | Reporte de [rentabilidad-semanal.md](rentabilidad-semanal.md): I − G | Cada lunes |
| Renovación | `tasa_renovacion_pct` de `embudo-de-pago.sql` | por medir: no hay segundos cobros hasta diciembre |

Límites que hay que tener presentes:

- **La app no guarda los UTM de los anuncios**: solo los guarda cuando la visita trae `?ref=` (`src/components/ref-capture.tsx`). El costo por usuario de pago se calcula con todas las cuentas nuevas de la semana, orgánicas incluidas, así que sale **mejor de lo que es**. Para tener una base, se compara con una semana sin gasto: por medir.
- Los `Subscribe` de Meta no cuentan los pagos reales; los pagos se cuentan en `trial_charges` con `status = 'succeeded'` y suscripciones vigentes, como el tablero.
- Con este presupuesto, la comparación entre los anuncios A y B es direccional, no estadísticamente firme.

## 8. Qué paso del embudo mueve y cuánto dinero puede mover

- **Paso: prueba a pago** de cuentas nuevas de Costa Rica. La campaña trae pruebas iniciadas; el resultado que cuenta es el primer pago de esas pruebas, y después la renovación.
- **Cómo se mide:** costo por usuario de pago de la cohorte (gasto ÷ usuarios de pago, `tablero-diario.sql`) y margen semanal (I − G, `rentabilidad-semanal.sql`). Meta de prueba a pago: 35 %, la meta redondeada de la oficina; la sección 3 usa 35.2 % porque es la cifra exacta del acta (40 % deja la tarjeta × 88 % se cobra bien) y con ella se calculan los techos.
- **Cuánto dinero puede mover**, con los precios de `src/lib/plans.ts` y `src/lib/trial.ts`, antes de comisión: cada usuario de pago deja en su primer cobro entre $4.99 (Entreno con 50 %) y $89.99 (Entreno + Nutrición anual), y cada renovación mensual $9.99 o $14.99. Cuántos usuarios de pago trae la campaña: por medir. Lo que sí se fija es el mínimo para no perder: 8, 15 o 29 pagos de $4.99 según el nivel.
- **Riesgo de dinero:** como máximo el nivel aprobado por una semana, y nunca más que lo que cobramos la semana anterior.

## 9. Lista para aprobar

- [ ] Correr las tres consultas el 9 de noviembre y pasar el gasto diario del 2 al 8 de noviembre.
- [ ] Confirmar `c`, `f` y el tope semanal.
- [ ] Exportar los resultados por anuncio de octubre de Ads Manager para elegir los anuncios A y B.
- [ ] Si la regla se cumple: aprobar la campaña de la sección 4, el evento de optimización y uno de los 3 niveles.
- [ ] Si no se cumple: confirmar $0.00 para la semana del 9 al 15 y la lectura del lunes 16.
