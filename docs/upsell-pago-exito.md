# Después del pago: entrenar, anual y referidos

La pantalla confirmada de `/pago/exito` mantiene el entreno de hoy como acción principal. Mueve el tramo primer pago → uso → renovación; las opciones secundarias llevan a revisar el anual, Temporada 1 y el enlace personal en `/app/referidos`. No inicia cobros. No cambia la confirmación ni la actualización automática del pago.

El anual se ofrece solo con periodicidad mensual conocida. Sin el parámetro de suscripción se lee la periodicidad de los permisos de la cuenta. Si no se conoce, no se supone mensual. La comparación usa `annualSaving` de `src/lib/plans.ts`: Entreno ahorra $59.89 ($119.88 frente a $59.99); Entreno + Nutrición ahorra $89.89 ($179.88 frente a $89.99). Es una comparación con 12 mensualidades regulares, no con descuentos del primer mes. Cada año pagado incluye 1 temporada deportiva. El cambio empieza al confirmar el pago y reemplaza el plan actual sin prorrateo: no se promete crédito por el mensual recién pagado.

Temporada 1 usa `SEASONS_T1`, `canEnroll` y las fechas de `src/lib/seasons.ts`, con la fecha local de la persona como la tienda de temporadas: del 9 de noviembre de 2026 al 3 de enero de 2027, inscripciones hasta el 22 de noviembre inclusive. Desde el 23 no se muestra esa sección. La tienda verifica disponibilidad, propiedad y canje; la pantalla de éxito no promete un segundo canje al anual que ya lo usó.

Referidos usa las constantes de `src/lib/referrals.ts`: 3 amigos calificados dan 1 mes; si uno del grupo compra anual confirmado, son 3 meses en total. Deben crear una cuenta nueva con el enlace, terminar bienvenida y completar un entreno o registrar agua, pasos o sueño dentro de sus primeros 7 días. Cuentas propias o repetidas no cuentan; las sospechosas requieren revisión. Máximo 12 recompensas en 365 días. El enlace personal y el detalle de las reglas se consultan en `/app/referidos`.

## Dinero neto por cobro

USD. Fórmula solicitada: cobro ÷ 1.13 − (cobro × comisión porcentual + $0.35). ONVO: 3.9 %; Tilopay: 4.25 %. Se calcula sin redondeos intermedios y se presenta a dos decimales. Fuentes: `src/lib/plans.ts` y `SEASON_PRICE_MINOR` en `src/lib/seasons.ts`.

| Cobro | Precio con IVA | Neto ONVO | Neto Tilopay |
| --- | ---: | ---: | ---: |
| Entreno mensual | $9.99 | $8.10 | $8.07 |
| Entreno anual | $59.99 | $50.40 | $50.19 |
| Entreno + Nutrición mensual | $14.99 | $12.33 | $12.28 |
| Entreno + Nutrición anual | $89.99 | $75.78 | $75.46 |
| Running | $14.99 | $12.33 | $12.28 |
| Raquetas | $16.99 | $14.02 | $13.96 |
| Cross Training | $18.99 | $15.71 | $15.65 |

Escenarios, no pronósticos: 10 compras anuales adicionales de Entreno mueven $503.99 netos con ONVO o $501.89 con Tilopay; 10 de Entreno + Nutrición, $757.78 o $754.63. Diez compras adicionales de Running mueven $123.31 o $122.78. Se multiplica el neto sin redondear de cada cobro y se redondea el total. Una temporada canjeada no genera cobro adicional.

Estos montos son caja neta del cobro según la fórmula, no utilidad ni ingreso incremental garantizado: faltan costos operativos, devoluciones y pagos futuros desplazados. El mensual recién pagado es ingreso previo y no se vuelve a sumar como resultado de esta pantalla. Un anual puede sustituir renovaciones: 12 cobros mensuales regulares de Entreno dejan $97.21 / $96.79 frente a $50.40 / $50.19 del anual (ONVO / Tilopay); el valor del cambio depende de la retención real. Los meses regalados por referidos pueden desplazar renovaciones, por lo que se reportan por separado, sin tratarlos como ingresos.

## Medición y revisión

`purchase_success` conserva el plan y la periodicidad. El listener existente registra `cta_click` con `exito-entreno`, `exito-anual`, `exito-temporadas` y `exito-referidos` en `funnel_events`. Medir usuarios únicos que hacen clic por usuarios únicos que ven la pantalla, segmentando por plan y periodicidad. La tasa del anual debe usar solo vistas mensuales conocidas; la de Temporada 1 solo vistas dentro de la ventana abierta. Los clics no son ventas.

Para retención, comparar usuarios con entreno guardado (`workout_saved`) después de la vista y segundo cobro confirmado. Para monetización, contar compras anuales y de temporada confirmadas por el servidor y sumar sus netos por proveedor; deduplicar por cobro. Para referidos, seguir calificados, compras confirmadas y meses otorgados. Validar usuarios de pago activos con suscripciones vigentes y `trial_charges` con estado `succeeded`; el evento de éxito por sí solo no acredita un pago nuevo. Comparar cohortes antes y después, con la misma ventana de seguimiento; sin asignación experimental no atribuir causalidad a esta pantalla.

La pantalla no agrega imágenes ni dependencias. Revisión visual pendiente en 390 px y 1280 px; captura real a actualizar: `/pago/exito` con pago mensual confirmado y anual confirmado. No se publica ni se cambia ninguna campaña con esta entrega.
