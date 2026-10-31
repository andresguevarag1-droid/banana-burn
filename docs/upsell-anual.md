# Invitación al anual

Mueve el paso mensual a anual del embudo. En Hoy, después de los primeros pasos y el resumen semanal, ofrece el anual del mismo plan. Abre la intención existente en Mi plan; la persona todavía debe confirmar el pago. El nuevo plan reemplaza al anterior al confirmarse el pago, sin prorrateo.

Solo aplica a una suscripción mensual activa con al menos 20 días desde la creación de la suscripción o el final de la prueba de la cuenta, lo que ocurra después. La renovación mensual no reinicia la antigüedad. No cuenta desde el registro ni desde el inicio de una prueba. Excluye beta, prueba vigente, cortesías vigentes incluso si coincide una suscripción, anual, cancelación y pagos pendientes o fallidos. Si faltan datos no se muestra.

Ahora no guarda una fecha de silencio de 30 días por usuario en este navegador. Durante la lectura no aparece contenido para evitar parpadeos; sin almacenamiento disponible se omite el aviso. Si falla guardar al cerrar, muestra un error con reintento. El silencio no se sincroniza entre dispositivos y se pierde si se borran los datos del navegador. No requiere nuevas tablas ni cambios de cobro.

## Dinero y medición

Precios de src/lib/plans.ts, USD e IVA incluido. El anual cobra 12 meses por adelantado e incluye una temporada deportiva gratis.

| Plan | Mensual | 12 mensualidades | Anual adelantado | Ahorro anual | Adelanto frente a una mensualidad |
| --- | ---: | ---: | ---: | ---: | ---: |
| Entreno | $9.99 | $119.88 | $59.99 | $59.89 | $50.00 |
| Entreno + Nutrición | $14.99 | $179.88 | $89.99 | $89.89 | $75.00 |

Por cada 10 conversiones, el cobro anual suma $599.90 o $899.90 frente a $99.90 o $149.90 de una mensualidad: adelanta $500.00 o $750.00. Es un escenario, no una proyección de demanda. No representa ingreso incremental anual: si todos permanecieran pagando los 12 meses, el anual recaudaría menos por su descuento. Tampoco descuenta comisiones, impuestos, devoluciones ni costos de la temporada.

El compromiso de 12 meses busca retener mejor y reducir las decisiones mensuales de cancelación; no hay evidencia aquí para afirmar un aumento medido de retención. Medir conversiones confirmadas de mensual a anual por plan en suscripciones y pagos aprobados, caja neta, permanencia a 12 meses y renovación anual. Comparar con una cohorte mensual equivalente. Los clics no son pagos. Sin instrumentación de exposición nueva no puede atribuirse causalmente el cambio al aviso.

## Revisión visual

Revisar 390 y 1280 px: ambos planes, aviso visible, cierre y recarga antes/después de 30 días, almacenamiento bloqueado y fallo al guardar. Los estados de carga, error y éxito del pago siguen perteneciendo a Mi plan. Tokens existentes, controles de al menos 44 px y sin desplazamiento animado con movimiento reducido.

Capturas de landing a actualizar: Hoy con el aviso de Entreno y Hoy con el aviso de Entreno + Nutrición; Mi plan con la intención anual existente si se muestra ese recorrido comercial. No sustituir las capturas del entrenamiento por este aviso.

No se pudieron generar las capturas de Playwright en este entorno: la descarga de Chromium devuelve HTTP 403. Quedan pendientes las revisiones visuales de esos estados en ambos anchos.
