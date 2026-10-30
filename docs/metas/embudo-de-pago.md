# Embudo de pago: dónde se pierde la gente antes de pagar

[embudo-de-pago.sql](embudo-de-pago.sql) muestra, por semana de creación de cuenta, cuántas personas pasan cada paso de **cuenta > registro > primer entreno > tarjeta guardada > pagó > renovó**, la tasa de cada paso y el plan que eligieron (mensual o anual, Entreno o Entreno + Nutrición). Usa solo tablas que ya existen: `profiles`, `funnel_events`, `workouts`, `trial_charges`, `subscriptions`, `comp_grants` y `payment_events`. Las reglas de pago son las de [tablero-diario.sql](tablero-diario.sql), así que los totales cuadran con el tablero.

**Es una consulta de solo lectura**: un único SELECT con CTE. No crea tablas, no escribe datos, no llama servicios externos y no lleva llaves. No cambia campañas, gasto, correos ni la app. Cualquier decisión que salga de leerla la aprueba Andrés.

## 1. Cómo correrla

1. Abre Supabase > SQL Editor con el rol administrativo del proyecto (las tablas tienen RLS; `funnel_events` solo la lee el servidor).
2. Pega el contenido completo de `embudo-de-pago.sql`.
3. Ajusta `desde` y `hasta` en `parametros` si hace falta. Por defecto va del **28 de octubre de 2026** (primer día con `funnel_events`) hasta hoy, hora de Costa Rica (UTC-6). No muevas `desde` antes del 28 de octubre: esas semanas no tienen el evento de registro y la columna `registro` sale NULL (ver la sección 3).
4. Ejecuta y exporta el resultado a CSV con la fecha de ejecución. La consulta mide el estado de **ahora**: el CSV guarda lo que la base no puede reconstruir después.
5. Si quieres comprobar que no escribe nada, córrela dentro de `begin read only;` ... `rollback;`. Así la validan las pruebas.

Cada fila es una **cohorte**: las cuentas creadas de lunes a domingo de esa semana, con lo que han hecho hasta el momento de correrla. Un pago del 8 de noviembre de una cuenta creada el 29 de octubre aparece en la semana del 26 de octubre. La primera semana empieza en `desde_efectivo` (28 de octubre) aunque `semana` diga el lunes 26.

## 2. Cómo leer cuál paso pierde más gente

El embudo es una **cadena**: cada paso cuenta solo a quien hizo también todos los anteriores. Así ninguna tasa pasa de 100 % y la diferencia entre dos pasos es gente que se quedó ahí.

| Paso | Columna | Tasa del paso | Fuente |
| --- | --- | --- | --- |
| Cuenta creada | `cuentas_creadas` | | `profiles.created_at` |
| Registro | `registro` | `tasa_registro_pct` = registro ÷ cuentas | `funnel_events` con `onboarding_done` después de crear la cuenta (bienvenida terminada, el CompleteRegistration de Meta) |
| Primer entreno | `primer_entreno` | `tasa_primer_entreno_pct` = primer entreno ÷ registro | `workouts.finished_at` no nulo; abrir el entreno o hacer una serie no basta |
| Tarjeta guardada | `tarjeta_guardada` | `tasa_tarjeta_pct` = tarjeta ÷ primer entreno | Fila en `trial_charges` (incluye canceladas, como el tablero) |
| Pagó | `pagaron` | `tasa_pago_pct` = pagó ÷ tarjeta | `trial_charges.status = 'succeeded'` o suscripción vigente de ONVO o Tilopay, sin cortesía vigente |
| Renovó | `renovaron` | `tasa_renovacion_pct` = renovó ÷ pagó mensual | `payment_events` procesado de cobro (`subscription.renewal.succeeded`, `payment-intent.succeeded` o `charge.approved`) con periodo que empieza 20 días o más después del primer pago |

Plan elegido:

- `tarjeta_mensual` y `tarjeta_anual`: el plan que quedó en `trial_charges` al guardar la tarjeta.
- `pagaron_mensual`, `pagaron_anual`, `pagaron_entreno` y `pagaron_completo`: el plan del cobro (`trial_charges`) o, si pagó en el muro de planes, el de su suscripción vigente.

Para leerla:

1. Mira `paso_con_mas_perdida`: es el paso donde más **personas** se quedaron (no la tasa más baja), y en empate gana el paso más temprano. Solo cuenta el paso de pago cuando `pago_cerrado` es verdadero y el de renovación cuando `renovacion_cerrada` es verdadero.
2. `pago_cerrado`: a toda la cohorte ya le llegó su primer cobro (7 días de prueba, o el 8 de noviembre para las cuentas de la beta) más el reintento automático de 1 día y un día de margen. Antes de eso, quien no ha pagado todavía puede pagar: no es pérdida.
3. `renovacion_cerrada`: pasó un mes y 3 días de gracia desde el cierre del pago. El anual no renueva hasta dentro de 12 meses, por eso la tasa de renovación solo usa a quien pagó mensual.
4. Compara las tasas de la semana con las metas del [acta](100-usuarios-de-pago.md): 35 % de prueba a pago, que el modelo arma como 40 % de tarjetas × 88 % de cobros. Aquí `tasa_pago_pct` es el paso de tarjeta a cobro (el 88 %); el paso de tarjeta del acta se mide sobre registros y aquí sobre primer entreno, así que no se comparan uno a uno.

Columnas de apoyo, fuera de la cadena:

- `usuarios_pago_total`: todos los que pagan de la cohorte, como `usuarios_pago` del tablero, hayan hecho o no los pasos anteriores.
- `pagaron_sin_tarjeta`: pagaron en el muro de planes sin dejar tarjeta en la prueba. La cadena los cuenta como perdidos en el paso de tarjeta, pero sí pagaron: réstalos de esa pérdida antes de decidir que el problema es la tarjeta.
- `vieron_oferta_tarjeta` (`card_banner_view`), `vieron_muro_planes` (`plan_wall_view`) y `abrieron_pago` (`checkout_view`): personas que vieron la oferta del 50 % con tarjeta, el muro de planes o la página de pago. Si mucha gente entrena pero pocos ven la oferta, falta mostrarla; si la ven y no guardan tarjeta, falta convencer.

## 3. Lo que hoy no se puede medir

La consulta devuelve estas columnas con el texto "sin evento" y el evento que faltaría. No se rellenan con estimaciones.

| Qué falta saber | Columna | Estado | Evento que faltaría |
| --- | --- | --- | --- |
| Cuántas visitas a bananaburn.app terminan en cuenta | `visita_a_cuenta` | sin evento | `visit_id` compartido por `page_view` y la creación de la cuenta: hoy `page_view` llega sin persona y la cuenta no sabe qué visita la trajo |
| Quién intentó guardar la tarjeta, con qué plan, y por qué falló | `tarjeta_que_fallo` | sin evento | `card_error` con plan, billing y motivo: `card_saved` solo sale cuando la tarjeta quedó guardada |
| Qué plan miró en el muro quien no pagó | `plan_mirado_sin_pagar` | sin evento | `plan_select` con plan y billing: `plan_wall_view` no dice qué plan miró |

Otros límites:

- **Registro antes del 28 de octubre**: `funnel_events` no existía. Si el rango incluye esas fechas, `registro` y `tasa_registro_pct` salen NULL y la cadena salta ese paso para esas cuentas (primer entreno se mide sobre cuentas creadas).
- `trial_charges` guarda el estado actual del primer cobro, no su historial; `subscriptions` solo guarda la suscripción, no cada cobro. Por eso la renovación sale de `payment_events`, que guarda un registro por cobro procesado. Una cuenta borrada deja sus `payment_events` sin persona y sale del conteo.
- La renovación anual no tiene dato hasta noviembre de 2027.
- Las cortesías se excluyen según su vigencia de hoy, igual que en el tablero.
- No hay atribución por anuncio ni UTM completa en Supabase (ver [tablero-diario.md](tablero-diario.md)).

## 4. Qué paso del embudo mueve y cuánto dinero puede mover

Esta consulta no cobra nada por sí sola: **mueve la medición de prueba a pago y de renovación**, para que Andrés decida dónde poner el siguiente esfuerzo (correo, oferta de tarjeta, muro de planes) con datos y no a ciegas. Se mide con las columnas de la sección 2, semana por semana; la meta es 35 % de prueba a pago y 100 usuarios de pago.

Lo que vale cada persona que se recupera en cada paso, con los precios de `src/lib/plans.ts` y el 50 % del primer mes de `src/lib/trial.ts`, antes de comisión del procesador:

| Paso recuperado | Entreno | Entreno + Nutrición |
| --- | ---: | ---: |
| Pagó con tarjeta guardada, primer mes con 50 % | $4.99 | $7.49 |
| Pagó mensual sin 50 % (muro de planes) | $9.99 | $14.99 |
| Pagó anual | $59.99 | $89.99 |
| Cada renovación mensual | $9.99 | $14.99 |

- **Plan más alto:** pasar de Entreno a Entreno + Nutrición suma $5.00 por mes completo.
- **Anual:** un pago anual de Entreno deja $55.00 más en el primer cobro que el primer mes con 50 % ($59.99 contra $4.99); en Entreno + Nutrición, $82.50 más ($89.99 contra $7.49).
- **Renovación:** con el primer mes al 50 %, el segundo mes vale el doble que el primero ($9.99 contra $4.99), así que la renovación pesa tanto como el primer pago.
- **Con 100 usuarios de pago**, los primeros cobros suman entre $499.00 (todos Entreno con 50 %) y $8,999.00 (todos Entreno + Nutrición anual), y cada mes de renovación entre $999.00 y $1,499.00 si los 100 son mensuales y renuevan. Son techos de precio, no proyecciones: la mezcla real de planes y la renovación salen de esta consulta y quedan por medir.

Comisiones del procesador e impuestos: por confirmar con Andrés, como en [rentabilidad-semanal.md](rentabilidad-semanal.md).

## 5. Validación

Las pruebas de `src/lib/embudo-de-pago-qa.test.ts` corren la consulta en PostgreSQL embebido (PGlite) dentro de `begin read only`, con datos sintéticos: semanas vacías, frontera de medianoche de Costa Rica, eventos repetidos, la cadena de pasos, el plan elegido, cortesías, cobros fallidos, renovación, pasos cerrados y abiertos, y las columnas "sin evento". También revisan que este documento cite los precios del código. Pendiente correrla en el proyecto real de Supabase; no se consultaron datos de producción.
