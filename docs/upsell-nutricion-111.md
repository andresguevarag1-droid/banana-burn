# Mejora de Entreno a Entreno + Nutrición

Paso del embudo: plan más alto, con opción anual. No aumenta por sí mismo el número de usuarios que pagan; aumenta el ingreso por usuario existente.

Fuente de precios: `src/lib/plans.ts`. Entreno cuesta US$9.99/mes o US$59.99/año; Entreno + Nutrición cuesta US$14.99/mes o US$89.99/año. Una mejora con la misma periodicidad aumenta el precio recurrente en US$5.00/mes o US$30.00/año. Para N mejoras, el incremento nominal es N × US$5.00/mes o N × US$30.00/año. No es una previsión de conversiones ni de ingreso neto. El flujo actual reemplaza el plan sin prorrateo; no se presenta la diferencia como el importe a cobrar hoy.

Medición: comparar usuarios con suscripción vigente Entreno que pasan a completo y pagos confirmados por el proveedor, separando mensual y anual. Los enlaces llevan `data-cta="nutricion-mejorar"` y `data-cta="entreno-nutricion-mejorar"` para identificarlos en los eventos `cta_click` del listener existente de `FunnelTracker`; esos clics no atribuyen ingresos por sí solos. No se agregaron eventos nuevos ni lógica de cobro. La exposición reutiliza `page_view` con `screen=nutrition_upsell` y `placement=nutrition|workout`. Medir clics / exposiciones por ubicación y mejoras confirmadas / usuarios expuestos. Para atribuir ingresos, relacionar por usuario los eventos previos con el cambio confirmado y su pago; no inferirlos de visitas a Mi plan.

La invitación posterior aparece solo tras guardar un entreno completo sin repetición. Se guarda una marca local por cuenta antes de mostrarla; se espera un intervalo móvil de siete días. Si el almacenamiento falla, se omite. Limitación: borrar los datos del navegador o usar otro dispositivo reinicia ese límite; no hay frecuencia global entre dispositivos sin persistencia de servidor.

La pantalla bloqueada adapta su mensaje al objetivo del perfil. Bajar de peso o usar GLP-1 prioriza proteína y muestra el aviso médico. No lee comidas ni calcula metas de nutrición para Entreno. Beta, prueba, nutrición, cortesías y accesos no pagados quedan fuera de la invitación.

Capturas para revisión y landing: Comida bloqueada (objetivo de pérdida de peso/GLP-1 y fuerza), cierre del entreno con tarjeta, cierre sin tarjeta por frecuencia y Mi plan al seguir el enlace. Revisar a 390 px y 1280 px. La captura actual de Comida con acceso completo no debe reemplazarse por el candado.

Verificación visual pendiente: se intentó instalar Chromium con Playwright, pero el CDN devolvió HTTP 403 por la restricción de red del sandbox. No se produjeron capturas ni se afirma validación visual a 390/1280 px.

## Comprobaciones

- `npx tsc --noEmit -p .`: correcto.
- `npx eslint src scripts --quiet`: correcto.
- `npx vitest run --maxWorkers=2`: 177 archivos y 2,020 pruebas correctas. La primera ejecución sin limitar workers tuvo dos timeouts en el escaneo de formatos numéricos; la repetición completa pasó.
- `SENTRY_AUTH_TOKEN= NODE_OPTIONS=--max-old-space-size=1536 npx next build`: correcto, sin mapas ni subida a Sentry en esta ejecución local. Los intentos anteriores terminaron por memoria del sandbox (4 GB). El build muestra tres advertencias de lint preexistentes en archivos ajenos a este cambio.
