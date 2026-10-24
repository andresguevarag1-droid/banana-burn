# Monitoreo de Banana Burn

Funciona sin cuentas de terceros. Todo lo que guarda está libre de datos personales.

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
| Salud pública | `GET /api/salud` | 200/503 para monitores externos. |

El `digest` que ve la persona en la pantalla de error ("Código de referencia") es el mismo del log de Vercel y de
`app_errors`: búscalo en Vercel → Logs para ver el detalle del servidor.

## Qué NO se guarda

Usuario, correo, IP (solo un hash para el límite, en `rate_limits`), cuerpo de la petición, query string, cookies,
stack completo, ni el mensaje de errores del servidor. En los mensajes del navegador se reemplazan correos, números de 3+
cifras, ids, JWT y tokens largos, en el navegador, en el servidor y otra vez en la base.

## Opcionales (acción del dueño, no instalados)

- **Vercel Web Analytics y Speed Insights**: Vercel → proyecto → **Analytics** → Enable, y **Speed Insights** → Enable.
  Para que midan hay que agregar los paquetes `@vercel/analytics` y `@vercel/speed-insights` y sus componentes en el
  layout raíz (un PR chico). Sirven su script desde el mismo dominio (`/_vercel/...`), así que la CSP actual alcanza.
  No se agregaron ahora para no cambiar dependencias justo antes del lanzamiento.
- **Sentry** (stack traces y alertas avanzadas): no se instaló (no se puede dejar como no-op sin sumar el SDK y el
  envoltorio del build). Si se quiere: `npx @sentry/wizard@latest -i nextjs`, `SENTRY_DSN` y `SENTRY_AUTH_TOKEN` en
  Vercel, `beforeSend` que quite `request`, `user` y `extra`, `sendDefaultPii: false`, y agregar `*.ingest.sentry.io`
  al `connect-src` de la CSP. Lo de hoy (digest + `app_errors` + logs) alcanza para el lanzamiento.
- **Monitor externo de disponibilidad**: UptimeRobot o Better Stack (gratis) a `https://www.bananaburn.app/api/salud`
  cada 5 min, con aviso por correo o WhatsApp.
- **Log Drain** (Vercel Pro): Vercel → Settings → Log Drains, para guardar los logs más tiempo (Vercel los guarda por poco tiempo; por eso los errores también quedan en `app_errors`).
