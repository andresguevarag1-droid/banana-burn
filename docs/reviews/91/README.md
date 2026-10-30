# Elegir plan dentro de la app (#91)

Mueve **prueba → pago**: reduce el recorrido hasta activar un plan y explica el ahorro anual en dólares, sin confundirlo con el descuento del primer mes mensual. El acceso al plan y al seguimiento se pausa al terminar la prueba; no se borran los datos ni se inventa una racha.

Medición con señales existentes: comparar clics `cta_click` con `cta=pricing-<plan>-anual|mes` frente a `plan_wall_view`, y la conversión de quienes terminan su prueba a primer cobro confirmado. Contar usuarios únicos con `trial_charges.status='succeeded'` y suscripción vigente; para checkout directo, usar los pagos confirmados de `payment_events` sin duplicar intentos. Separar anual y mensual, mantener la misma ventana de observación antes/después y no atribuir causalidad sin experimento. Meta final: 100 usuarios de pago activos rentables.

No agrega servicios, llamadas de red, campañas ni costos operativos. Se conservan el hook de checkout, sus parámetros y ONVO/Tilopay. No se ejecutaron cobros ni se publicó nada.

## Revisión visual pendiente

Diseño compacto para 390 px, con revisión requerida a 375 × 667, 390 × 844 y 1280 × 900. El botón precede al detalle desplegable de prestaciones; el anual sigue primero y seleccionado. Comprobar también zoom, teclado y el resumen expandido.

No se pudieron obtener capturas de Playwright: el sandbox no tiene navegador, Chromium de npm no ejecuta por arquitectura y la descarga de Playwright devuelve HTTP 403. No hay capturas simuladas. Revisar con el marco completo de la app, incluidos navegación y avisos, que el primer CTA se vea sin desplazar a 375 px.

Estados que capturar: prueba (7, 2 y 1 días, con/sin tarjeta y cancelada), muro sin actividad, muro con progreso real, mensual, detalles abiertos, error de checkout, tarjeta rechazada, cobro en curso y vuelta de pago exitoso. El éxito y el procesamiento conservan sus flujos existentes.

Capturas para actualizar en la landing: selector de planes dentro de la app y aviso de días restantes si se muestran en el recorrido. No sustituir las imágenes de entreno o nutrición, que no cambiaron.

## Validación

- `npx tsc --noEmit -p .`: correcto.
- `npx eslint src scripts --quiet`: correcto.
- `npx vitest run`: 156 archivos y 1,828 pruebas correctas. La ejecución final se hizo sin el build en paralelo; dos intentos anteriores agotaron el tiempo de pruebas existentes al competir por recursos.
- `npx next build`: correcto, con advertencias existentes de lint.
- No se modificaron package.json, migraciones ni .github.
