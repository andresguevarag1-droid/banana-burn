# Tablero diario hacia 100 usuarios de pago

Andrés corre [tablero-diario.sql](tablero-diario.sql) cada mañana en Supabase > SQL Editor, con el rol administrativo del proyecto. Es una única consulta SELECT con CTE: no crea tablas, no escribe datos ni llama servicios externos. No necesita llaves en el archivo. Exporta el resultado a CSV con la fecha de ejecución para conservar cada revisión.

1. Ajusta `desde` y `hasta` en `parametros`. Por defecto incluye del 25 de octubre hasta hoy, hora de Costa Rica (UTC-6), incluyendo días sin cuentas. Para la cohorte del embudo usa `hasta = date '2026-10-31'`; los pagos posteriores siguen contando al ejecutar en noviembre.
2. En `gasto_manual`, reemplaza la fila NULL por una fila por fecha: `values (date '2026-10-25', 12.34::numeric), (date '2026-10-26', 0::numeric)`. Copia el importe gastado de Meta Ads en USD, con fechas en Costa Rica. Incluye ceros confirmados para días sin gasto. No inventes datos faltantes: quedan NULL, y el costo total queda pendiente hasta completar todos los días.
3. Ejecuta y revisa registros, primer entreno, tarjeta y pagos. Compara los cobros con Tilopay y ONVO como indica la etapa 6 del [embudo](../../marketing/estrategia/embudo-noviembre.md). Ninguna lectura autoriza cambios de campaña, gasto, envíos ni publicaciones; Andrés los aprueba.

Cada fila es una **cohorte por fecha de creación de cuenta**, con avance observado ahora; no son eventos ocurridos ese día ni una reconstrucción histórica del saldo. Por ejemplo, un pago del 8 de noviembre de una cuenta creada el 28 de octubre aparece en la fila del 28. El gasto corresponde al día de adquisición, no al día del cobro. Cambiar el rango cambia los totales; para la meta global amplíalo hasta incluir todas las cuentas que se quieran medir.

| Columna | Definición y relación con el embudo |
| --- | --- |
| `cuentas_creadas` | `profiles.created_at`, etapa 4a, todos los orígenes. |
| `registros_observados` | Personas distintas con `onboarding_done` después de crear su cuenta; etapa 4b, bienvenida terminada, equivalente a CompleteRegistration. Repetir el evento no duplica. |
| `registros_completos` | Igual al observado desde el 28 oct. Antes es NULL: `funnel_events` no existía, cero sería engañoso. Consulta Meta para completar la revisión de esas fechas por separado. No se sustituyen por cuentas creadas. |
| `primer_entreno` | Cuentas con al menos un `workouts.finished_at` no nulo. Cuenta una persona aunque guarde varios entrenos; abrir o iniciar una serie no basta. Es una medida adicional de activación: el embudo no fija una tasa para ella. |
| `tarjeta_guardada` | Existencia de una fila en `trial_charges`, etapa 5; incluye canceladas, como la consulta de referencia. No es el evento `card_saved`, que incluye rechazos y demos, ni el número de tarjetas vigentes. |
| `cobros_exitosos` | Personas con `trial_charges.status = 'succeeded'`, etapa 6. No usa `charge_at` como fecha real de pago. |
| `pagos_suscripcion_sin_duplicar` | Personas con suscripción `active`, proveedor ONVO/Tilopay y `current_period_end > now()`, sin cobro succeeded. La vigencia hace más estricta la consulta 6b del embudo. |
| `usuarios_pago` | Unión de ambas fuentes, una persona una vez. Excluye cuentas con cortesía vigente en `comp_grants`, incluidos testers; la cortesía sola nunca acredita pago. |
| `registros_que_pagan` | Usuarios de pago con bienvenida terminada; numerador compatible con registros completos. |
| `prueba_a_pago_pct` | 100 × registros que pagan ÷ registros completos de esa cohorte. NULL sin denominador conocido o con cero registros. Las cohortes con pruebas sin terminar aún no tienen conversión final. |
| `costo_cliente_pago_usd` | Gasto de Meta del día de adquisición ÷ usuarios que pagan de esa cohorte. NULL si falta gasto o no hay pagos. Total del sitio, incluye orgánico: no representa atribución por anuncio. |

Los totales se repiten en cada fila: no los sumes. El costo total usa sumas, nunca el promedio de costos diarios. El total de registros queda NULL si el rango incluye días sin cobertura. Para obtener conversión global de un rango con cobertura completa, divide la suma de `registros_que_pagan` por la suma de `registros_completos` y multiplica por 100.

Metas del [acta](100-usuarios-de-pago.md): **100 usuarios de pago**, **285 registros completos**, **35 % de prueba a pago**, **US$14.98 o menos por cliente que paga**. El modelo del embudo es 40 % de tarjetas × 88 % de cobros = 35.2 %; no redondear a 35 % para recalcular los 285. Antes del 8 de noviembre los pagos beta pendientes no cuentan como éxitos.

Límites: `trial_charges` conserva el estado actual, no un historial de éxitos; `subscriptions` tampoco prueba aquí cada renovación ni su importe. Un succeeded acredita el primer cobro según el acta aunque su plan haya vencido; por eso el total no debe presentarse como suscriptores activos retenidos. Las cortesías se excluyen según su vigencia actual, no para siempre. El CSV diario conserva las observaciones que la consulta no puede reconstruir. No hay atribución UTM completa ni costo por anuncio en Supabase. Los precios y el techo no descuentan comisiones ni impuestos.

Texto para la descripción del PR: mueve la medición de registro > primer entreno > tarjeta > primer pago. Se mide con bienvenidas terminadas, cuentas con entreno guardado, filas de trial_charges, usuarios únicos de pago y gasto manual dividido por clientes que pagan; permite detectar la fuga hacia la meta de 100 sin modificar campañas.

Validación de entrega: ejecutada con datos sintéticos en PostgreSQL embebido (PGlite), dentro de `BEGIN READ ONLY`, con días vacíos, frontera UTC-6, eventos repetidos, pago presente en ambas fuentes, cortesía vigente, suscripción vencida y gasto cero/pendiente. Pendiente ejecutar en el proyecto real de Supabase y conciliar sus cifras con los procesadores; no se consultaron datos de producción.
