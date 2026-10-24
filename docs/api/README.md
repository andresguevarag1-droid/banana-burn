# API de Banana Burn

La especificación completa está en [`openapi.yaml`](./openapi.yaml) (OpenAPI 3.1; se puede abrir en
https://editor.swagger.io o con `npx @redocly/cli preview-docs docs/api/openapi.yaml`).

## Reglas comunes (todas las rutas de `src/app/api`)

| Tema | Regla |
| --- | --- |
| Formato de error | JSON `{ "ok": false, "error": "mensaje en español" }`. Excepciones a propósito: el coach responde texto plano en streaming; `/api/track` y `/api/errores` responden sin cuerpo (204); `/api/cuenta/exportar` y `/api/email/baja` se abren como enlace, así que sus errores son texto o HTML para la persona. |
| Códigos | 400 cuerpo inválido, 401 sin sesión, 402 sin plan (coach), 403 otro origen o sin permiso, 405 método no soportado, 409 modo demo, 413 cuerpo grande, 429 límite de frecuencia (con `Retry-After` cuando aplica), 502 falla del procesador de pagos, 503 integración sin configurar o caída. |
| Métodos | Cada ruta exporta solo sus métodos; Next responde **405** al resto (verificado con `next start`). |
| Caché | `Cache-Control: no-store` en todo `/api/*` (next.config.ts), además de en cada respuesta con datos. |
| CSRF | Todo lo que cambia datos exige mismo origen (`isSameOrigin`: `Origin` y `Sec-Fetch-Site`). |
| Validación | El cuerpo nunca se usa tal cual: cada ruta acepta solo campos conocidos, con tipo y largo acotados (plan/periodo con lista cerrada, slugs con regex, endpoints de push con lista de servicios reales). |
| Límites | En memoria por instancia y, donde cuesta dinero o escribe en la base, en Postgres (`rate_hit`, compartido entre instancias). |
| Logs | Una línea JSON por error (`src/lib/log.ts`): área, código, estado; nunca correos, nombres, cuerpos ni mensajes crudos. |

### Auditoría previa al lanzamiento (23 oct 2026)

| Ruta | Estado | Nota |
| --- | --- | --- |
| `/api/salud`, `/api/version` | Bien | Salud ahora hace ida y vuelta a Postgres (`health_ping`, 0041) con respaldo a Auth; versión con commit y hora del build. |
| `/api/pagos/webhook` | Bien | Secreto en tiempo constante, idempotente, 2xx solo si se procesó. Logs pasados a JSON. |
| `/api/pagos/*`, `/api/retos/comprar` | Bien | Mismo origen, sesión, lista cerrada de planes, límite en memoria y en base, `singleFlight` contra doble clic. |
| `/api/cron/recordatorios` | Bien | Bearer en tiempo constante, presupuesto de tiempo bajo `maxDuration`, idempotente. |
| `/api/cuenta/*` | Bien | Exportar: límite 6/h; borrar: confirmación `BORRAR` y mismo origen. |
| `/api/push/subscribe` | Bien | Solo servicios de push reales (evita SSRF desde el cron). |
| `/api/coach*` | Bien | Cupo en la base por plan, tope de 64 KB, urgencias siempre responden. |
| `/api/track`, `/api/errores` | Bien | Públicos con tope por IP, cuerpo ≤ 2 o 4 KB, limpieza de datos personales. |
| `/api/email/baja` (GET) | Revisar | La baja ocurre al abrir el enlace (GET). Algunos filtros de correo corporativo (p. ej. Outlook Safe Links) abren los enlaces solos y podrían dar de baja a alguien sin querer. Propuesta: que el GET muestre un botón "Confirmar baja" (POST); el one-click de Gmail/Yahoo sigue funcionando por `List-Unsubscribe-Post`. Es un cambio de producto: decide el dueño. |

## Cómo se conecta una integración (sin API pública de datos)

Banana Burn **no** tiene una API pública de datos con llaves, a propósito: los datos son de salud y de pago. Para
integrar algo:

1. **Datos de una persona, con su permiso** (p. ej. una app compañera): Supabase directo con el JWT de esa persona
   (`supabase-js` con la llave `anon` + login de la persona). La RLS de Postgres ya limita cada tabla a lo suyo; es la
   misma regla que usa la app y está probada en `supabase/tests/multiusuario.sql`. Nunca con la llave `service_role`.
2. **Eventos hacia afuera** (pagos, altas): webhooks de los proveedores (ONVO → `/api/pagos/webhook`). Para mandar
   eventos de Banana Burn a otro sistema, lo recomendado es un **Database Webhook de Supabase** (Database → Webhooks)
   sobre la tabla que interese, apuntando al sistema destino con un secreto en la cabecera.
3. **Reportes del negocio**: el panel `/admin` (con roles) y sus exportaciones CSV. Para un BI externo, un usuario de
   Postgres de solo lectura sobre vistas sin datos personales (lo crea el dueño en Supabase).
4. **Monitores de disponibilidad** (UptimeRobot, Better Stack, Vercel): `GET /api/salud` (público, 200/503). Con
   `Authorization: Bearer $CRON_SECRET` devuelve el detalle de integraciones.

### Propuesta para el dueño (no implementada)

Si en el futuro un socio necesita datos agregados (p. ej. un gimnasio aliado), crear una ruta `/api/v1/...` con llave
por socio guardada como hash, alcance de solo lectura sobre vistas agregadas (sin datos de personas), límite por llave
con `rate_hit` y auditoría en `admin_audit`. No antes de tener un caso real: cada API pública es superficie de ataque.
