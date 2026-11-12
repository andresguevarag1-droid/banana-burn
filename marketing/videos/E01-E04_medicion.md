# Enero: E01 a E04, issue #184

## Embudo y objetivo

Objetivo: contribuir a 100 usuarios de pago activos y cubrir el gasto real. E01 mueve visita a prueba antes del año nuevo, sin fecha límite comercial; E03 acompaña activación y decisión al terminar la prueba; E04 explica funciones y elección del plan completo; E02 presenta pago anual por adelantado. Ninguna pieza promete resultados ni asegura conversión. El cierre común ofrece siete días gratis (desde el 1 de diciembre la tarjeta se deja al registrarse y hoy no se cobra nada; ninguna pieza dice «sin tarjeta»); el post de E02 permite comparar el anual en /precios.

## Valor económico

Fuente: src/lib/plans.ts, revisada el 1 de noviembre de 2026. USD. Neto por cobro = cobro / 1.13 − (cobro × comisión porcentual + $0.35). ONVO 3.9 %; Tilopay 4.25 %. Redondear solo al mostrar; los escenarios de 100 cobros usan valores sin redondeo intermedio. Son netos después de IVA y comisión indicada, antes de otros costos, devoluciones o ajustes del procesador; no equivalen a utilidad ni MRR.

| Plan / cobro regular | Bruto | Neto ONVO | Neto Tilopay | 100 cobros ONVO | 100 cobros Tilopay |
| --- | --- | --- | --- | --- | --- |
| Entreno mensual | $9.99 | $8.10 | $8.07 | $810.11 | $806.61 |
| Completo mensual | $14.99 | $12.33 | $12.28 | $1,233.09 | $1,227.84 |
| Entreno anual | $59.99 | $50.40 | $50.19 | $5,039.89 | $5,018.89 |
| Completo anual | $89.99 | $75.78 | $75.46 | $7,577.76 | $7,546.26 |

Son escenarios aritméticos, no previsiones ni ingresos atribuibles ya obtenidos. El neto incremental de elegir completo en lugar de Entreno anual es $25.38 con ONVO o $25.27 con Tilopay por pago (diferencia bruta $30). Cada año pagado incluye una temporada deportiva gratis; retos Premium aparte, sin asignarles un valor inventado. Un cambio de mensual a anual no crea un usuario nuevo.

Desde el 1 de diciembre la tarjeta se deja al registrarse y todo plan mensual nuevo lleva el primer mes al 50 % ($4.99 o $7.49); no se acumula al anual. Cuando aplique un cobro promocional, calcular el neto con el importe realmente cobrado, no con la tarifa regular de esta tabla. Los precios y condiciones se vuelven a comprobar antes de enero; esta entrega no cambia src/lib/plans.ts.

## Medición sin nueva instrumentación

Tras aprobación escrita, proponer por pieza una URL directa con ref: `https://bananaburn.app/?ref=e01-enero&utm_source=instagram&utm_medium=organic&utm_campaign=enero2027&utm_content=e01`. Reemplazar e01 por e03 o e04; para E02 usar `https://bananaburn.app/precios?ref=e02-enero&utm_source=instagram&utm_medium=organic&utm_campaign=enero2027&utm_content=e02`. TikTok usaría utm_source=tiktok. No se publica ni envía ningún enlace. No usar /r/, que pierde parámetros.

Cohorte: registros en los primeros siete días desde cada publicación autorizada; observar pagos por 30 días desde registro, reportando pendientes y pagos posteriores por separado. Contar visitas y registros atribuibles, primer entreno guardado (workout_saved), pruebas y usuarios únicos con primer pago confirmado. KPI principal: usuarios únicos con primer pago / pruebas atribuidas; para E02, proporción anual entre pagadores; para E04, proporción completo entre pagadores. Informar denominadores, fechas y pagos sin atribución. La retención al segundo cobro requiere seguimiento posterior a 30 días, especialmente en anual: no inferir renovación anual de esa ventana.

RefCapture necesita ref para guardar UTMs. funnel_events guarda rutas sin UTMs; cruzar usuario y referencia realmente persistida, no asumir atribución completa ni causalidad. Validar campos reales antes de consultar. Para cobros de prueba usar trial_charges.status = 'succeeded'; conciliar compras manuales con evidencia confirmada del procesador y suscripción vigente. Deduplicar usuario y transacción, excluir fallidos y descontar devoluciones. Los eventos publicitarios Subscribe y las visitas a /pago/exito no son el libro de ingresos. Mostrar usuarios de pago activos, ingreso bruto confirmado y neto real por procesador; no contar renovaciones como nuevos usuarios.

## Costo y aprobación

Servicios de generación: $0; código local y activos existentes. Sin campañas, contrataciones ni gasto nuevo. No se han ejecutado los prompts fijos. No hay datos de conversión para estimar pagos futuros. Si se considera gasto futuro, Andrés debe aprobarlo: pagos necesarios para cubrirlo = techo(gasto / neto real por pago), con mezcla de planes y descuentos reales, y costo por usuario de pago medido. La rentabilidad también descuenta operación, producción y devoluciones.

## Revisión

Cuatro paquetes independientes, sin modificar E03_todos-te-miran. Cada uno entrega fuente editable, guion con tiempos, brief UGC, prompt fijo no ejecutado, MP4 de 19 s y 15 s, portada y hoja de revisión. Sin música ni voz. Revisar legibilidad en móvil y derechos del UGC si se incorpora. Nada se publica, envía, gasta ni toca campañas sin aprobación escrita de Andrés.
