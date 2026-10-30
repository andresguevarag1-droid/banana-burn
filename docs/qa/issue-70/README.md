# Aviso opcional de tarjeta, issue 70

Aviso en Hoy después del entrenamiento y antes de los avisos secundarios; en Mi plan antes del formulario existente. No abre modales. Ambos enlaces tienen 48 px de alto, con foco visible y estilos de marca. El aviso estático no agrega animaciones. La opción Continuar sin tarjeta permanece visible sin desplegar contenido.

Días calculados en intervalos de 24 horas desde el alta: día 5 empieza a las 96 horas y día 7 termina a las 168 horas. La fecha viene del fin real de prueba y se muestra con año y zona horaria del usuario. Se muestran las dos opciones mensuales porque todavía no hay un plan elegido en Hoy. Los montos usan las mismas funciones de cobro que el servidor. El anual no tiene esta promoción; se elige en el formulario existente.

## Descripción para el PR

Mueve el paso prueba → tarjeta guardada → primer pago de la meta de 100 usuarios de pago. Medir tarjetas activas guardadas antes del fin de prueba / cuentas en prueba, con meta de 40 %, y primeros cobros `trial_charges.status = 'succeeded'` / tarjetas guardadas, con meta de 88 %. Usar cohortes por alta y excluir testers, cortesías y equipo. La vista usa `card_banner_view` con `kind: trial-optional`, pantalla y día; los clics usan `trial-card-{hoy|suscripcion}-{guardar|continuar}` en el registro existente de analítica. Estas vistas/clics son diagnósticos; no sustituyen tarjetas ni pagos reales. No se cambian campañas ni se publica nada.

## Capturas pendientes

El sandbox no tiene navegador; Playwright se instaló en /tmp pero la descarga de Chromium devolvió HTTP 403 por restricción de salida. No se produjeron capturas ni se completó la revisión visual. En un entorno con Playwright y Chromium, levantar `npm run dev` sin credenciales Supabase y ejecutar `node scripts/capturar-aviso-tarjeta.mjs` (instalar Playwright sin modificar package.json si hace falta).

El script produce 16 capturas: Hoy y Mi plan × día 5, 6, 7, tarjeta guardada × 390 y 1280 px. Verificar que el entrenamiento conserva prioridad, que no hay desbordes, que se lee toda la fecha y que ambas opciones son visibles. Probar los enlaces, teclado y la vuelta desde el formulario con tarjeta guardada. El formulario conserva sus estados existentes de carga, error y éxito; el aviso no hace solicitudes ni guarda tarjetas.

Landing: actualizar `public/landing/hoy2.png` con una captura real de Hoy a 390 px tras aprobar la revisión visual. No insertar una captura demo de cobro en la landing como si fuera una cuenta real. Mi plan no tiene una captura existente en `public/landing`; si se agrega una vista de planes, usar la captura aprobada de esa pantalla.

## Validación ejecutada

`npx tsc --noEmit -p .`, `npx eslint src scripts --quiet`, `npx vitest run` y `git diff --check` pasan. Vitest: 143 archivos, 1,764 pruebas; 11 pruebas nuevas cubren límites, fecha compartida con el programador del cobro, ambos montos, exclusiones y estados demo.
