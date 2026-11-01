# Anuales: A01 a A03, issue #153

Objetivo: mover prueba a pago anual y contribuir a 100 usuarios de pago activos con ingresos que cubran gasto real. A01 vende el pago único; A02 compara el costo de doce mensualidades regulares; A03 muestra la temporada incluida por cada año pagado. Sin fecha límite, testimonios ni urgencia inventada.

## Fuente única y valor económico

Valores USD de src/lib/plans.ts, comprobados al 1 de noviembre de 2026. Ahorro = 12 × mensualidad regular menos anual, redondeado al centavo; comparación sin promociones. La promoción del primer mes mensual no se suma al anual.

| Plan | Mensual | Doce mensualidades | Anual | Ahorro anual | 100 pagos anuales |
| --- | --- | --- | --- | --- | --- |
| Entreno | $9.99 | $119.88 | $59.99 | $59.89 | $5,999.00 |
| Entreno + Nutrición | $14.99 | $179.88 | $89.99 | $89.89 | $8,999.00 |

Un pago anual confirmado mueve $59.99 o $89.99 de ingreso bruto cobrado por adelantado. Diez pagos anuales: $599.90 o $899.90. La diferencia entre planes anuales es $30.00 por usuario. Son escenarios aritméticos, no pronósticos. No son beneficio, MRR ni ingresos adicionales garantizados: comparar con la cohorte sin pieza y descontar devoluciones, comisiones y costos reales antes de evaluar rentabilidad. Un usuario que ya pagaba mensual no cuenta como usuario nuevo por migrar.

Cada año pagado incluye una temporada deportiva gratis (ANNUAL_SEASON_NOTE). No asignar valor monetario inventado a la temporada. Los retos Premium se compran aparte, incluso con anual. El pago anual cubre doce meses; no prometer permanencia de por vida ni que no se renueve.

## Medición propuesta, sin cambiar instrumentación

Después de aprobación escrita de Andrés, usar enlaces separados para A01, A02 y A03 hacia /precios con ?ref=a01-anual&utm_source=instagram&utm_medium=organic&utm_campaign=anual&utm_content=a01 (sustituir a01 por a02 o a03). No usar /r/: pierde parámetros. El cierre lleva a la prueba; la publicación propuesta permite comparar en /precios. No se ha publicado ni enviado ningún enlace.

Registrar por pieza: visitas atribuidas, registros completados, pruebas, usuarios con primer pago anual confirmado y usuarios de pago activos. KPI principal: usuarios únicos con pago anual exitoso / pruebas atribuidas, junto con ingreso anual bruto confirmado. Secundario: proporción del plan completo entre pagos anuales. Informar denominador, ventana y pagos sin atribución, sin inventar tasas.

Usar una cohorte de registros durante los primeros siete días desde la publicación autorizada y observar sus pagos por 30 días desde el registro; reportar también pendientes, cobros posteriores y reembolsos. Cruzar referencia/UTM realmente guardada con usuario y suscripción vigente y evidencia del pago. Revisar las tablas/campos reales al ejecutar la consulta; no asumir que funnel_events guarda UTMs (guarda ruta sin ellas). RefCapture requiere ref para guardar UTMs. El píxel del navegador manda Subscribe desde /pago/exito; los cobros automáticos también pueden enviarlo por CAPI si está configurada (src/lib/meta-capi.ts). No usar eventos publicitarios como libro de ingresos ni sumar renovaciones como usuarios nuevos. Para cobros de prueba, trial_charges.status = 'succeeded'; para compras manuales, conciliar con la evidencia confirmada del procesador y suscripción vigente, sin tratar un intento o una visita como pago. Deduplicar por usuario y pago, excluir fallidos y revisar devoluciones.

Costo de generación con servicios de imágenes/video: $0. Producción local con código y recursos existentes. Gasto de campañas autorizado para esta entrega: $0. No hay datos para estimar conversión ni beneficio. Si se propone gasto futuro, requiere autorización de Andrés y recuperar al menos gasto / ingreso neto real por pago (redondeado hacia arriba); medir costo por usuario de pago, no por clic. Nada se publica, envía, gasta ni toca campañas sin aprobación escrita de Andrés.

## Revisión

Revisar tres MP4 de 19 s, tres cortos de 15 s, portadas y hojas. Captura real existente de Mi plan en modo Mensual, rotulada como oferta mensual, sin cambiar cifras; pose oficial compartida. Guiones y proyectos mantienen ocho palabras añadidas como máximo, gancho en cuadro 0 y cierre de tres segundos. Los prompts fijos son documentos y no se ejecutan.
