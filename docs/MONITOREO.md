# Monitoreo de Banana Burn

Lo básico funciona sin cuentas de terceros; Sentry y Vercel Web Analytics se suman con variables de entorno. Todo lo
que se guarda o se manda está libre de datos personales.

## Qué hay

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| Logs JSON | `src/lib/log.ts` (`logError`, `logWarn`, `logInfo`) | Una línea JSON por evento: `level`, `area`, `code`, extras acotados, `release`, `at`. Llaves como `email`, `ip`, `body` se descartan. En Vercel → Logs se filtra por `area` o `code`. |
| Errores no atrapados del servidor | `src/instrumentation.ts` (`onRequestError`) | Route handlers, server actions y páginas: línea JSON con ruta, tipo de ruta, método y `digest`, y una fila en `app_errors`. Nunca el mensaje ni la petición. |
| Errores en el navegador | `src/components/error-reporter.tsx`, `error.tsx`/`global-error.tsx` | `window.onerror`, promesas sin `catch` y pantallas de error mandan un reporte limpio a `POST /api/errores`. Máx. 5 por carga de página, sin repetir, 50 % de muestreo en errores sueltos (100 % en pantallas de error), ruido de extensiones descartado. |
| Tabla `app_errors` | `supabase/migrations/0041_monitoreo.sql` | Escribe solo `app_error_report()` (service_role) con límite por cliente y global; el mismo error en 10 min suma `hits`. Lee solo admin. Se borra a los 30 días (cron). |
| Última corrida del cron | `ops_heartbeats` | El cron registra si terminó bien y cuánto tardó. |
| Panel | `/admin/salud` (admin y superadmin) | Versión y hora del build, base de datos, errores 24 h / 7 d por ruta, detalle, cron, webhooks de ONVO con error e integraciones configuradas. |
| Aviso diario | cron → `runMonitorMaintenance` | Si en 24 h hay ≥ `OPS_ALERT_THRESHOLD` errores (50 por defecto), manda un correo a `OPS_ALERT_EMAIL` (o `FEEDBACK_EMAIL`, o hola@bananaburn.app). Máximo uno por día. Requiere Resend. |
| Salud | `GET /api/salud` | Base de datos, Resend, ONVO y Tilopay. 503 si la base o una integración configurada no responde o rechaza la llave (las que no están configuradas no cuentan). Público: solo `{ ok }`, guardado 60 s. Staff o `Bearer CRON_SECRET`: estado de cada una (`up`/`down`/`off`), tiempo y un código corto. |
| Sentry | `src/instrumentation*.ts`, `src/lib/monitor/sentry*.ts` | Errores con stack legible del navegador, el servidor, el edge y los crons. Mapas de fuente subidos en el build y borrados antes de publicar. En el navegador el SDK se descarga después de cargar la página (+4 kB al inicio, no +34). Botón de prueba en `/admin/salud`. |
| Avisos de sistema | `src/lib/monitor/alerts.ts`, 0063 | Admin > Avisos (push, campanita y correo si está encendido): un cron de cobros, avisos o recordatorios que falla o se corta, y errores en 24 h por encima de `OPS_ALERT_THRESHOLD` (lo revisan los tres crons). Uno por motivo y día. Llegan siempre, aunque se apaguen los otros tipos. |
| Vercel Web Analytics | `src/components/web-analytics.tsx` | Visitas por página, sin query ni ids en la URL. Solo en builds de Vercel. |

El `digest` que ve la persona en la pantalla de error ("Código de referencia") es el mismo del log de Vercel y de
`app_errors`: búscalo en Vercel → Logs para ver el detalle del servidor.

## Qué NO se guarda

Usuario, correo, IP (solo un hash para el límite, en `rate_limits`), cuerpo de la petición, query string, cookies,
stack completo, ni el mensaje de errores del servidor. En los mensajes del navegador se reemplazan correos, números de 3+
cifras, ids, JWT y tokens largos, en el navegador, en el servidor y otra vez en la base.

## Opcionales (acción del dueño, no instalados)

- **Vercel Web Analytics**: el código ya está; falta Vercel → proyecto → **Analytics** → Enable. Sin eso el script
  responde 404 y no mide nada (no rompe la página). Speed Insights no está instalado.
- **Sentry**: variables `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` y `SENTRY_AUTH_TOKEN` en Vercel
  (ver `.env.example`). La CSP agrega sola el host de ingesta del DSN. En Sentry → Project Settings → Security &
  Privacy deja encendidos "Data Scrubber" y "Use Default Scrubbers", y activa "Prevent Storing of IP Addresses".
  Si un build falla por memoria al generar los mapas, quita `SENTRY_AUTH_TOKEN` (el build vuelve a ser el de antes)
  o sube la memoria del build.
- **Monitor externo de disponibilidad**: UptimeRobot o Better Stack (gratis) a `https://www.bananaburn.app/api/salud`
  cada 5 min, con aviso por correo o WhatsApp.
- **Log Drain** (Vercel Pro): Vercel → Settings → Log Drains, para guardar los logs más tiempo (Vercel los guarda por poco tiempo; por eso los errores también quedan en `app_errors`).
