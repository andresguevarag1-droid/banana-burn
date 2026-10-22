# 🍌 Banana Burn

Entrenador personal con IA, en español, para LATAM. Next.js 15 (App Router) + Supabase + Tailwind v4, desplegado en Vercel.

## Qué hay

| Ruta | Qué es |
|---|---|
| `/` · `/precios` | Landing de ventas (tema claro, marca Banana) |
| `/entrar` | Login multiusuario: código por correo (OTP) + Google |
| `/bienvenida` | Onboarding de 6 pasos: meta, datos, peso y fecha con ritmo sano, días, equipo, consentimiento → plan calculado |
| `/app` | **Hoy**: racha 🔥, nivel/XP, rutina del día, pesaje rápido, anillos de proteína/kcal/agua/pasos/sueño |
| `/app/entreno` | Reproductor para el gym: animación de técnica, cargas sugeridas, descanso con alarma, récords, resumen |
| `/app/entrenar` · `/nutricion` · `/progreso` · `/coach` | Programa por bloques con selector de día, registro de comidas con base tica (70 alimentos), gráficas de peso y fuerza con ajuste semanal, Coach IA con Claude (streaming) |
| `/app/perfil` | Plan de entreno (días, gym/casa, ritmo), suscripción, descargar datos y borrar cuenta (Ley 8968) |
| `/admin/*` | Panel de staff: resumen, usuarios, pagos, contenido, comunidad y auditoría (ver sección **Admin**) |

- `src/lib/engine/` — motor portado del prototipo: calorías (Mifflin-St Jeor), doble progresión con reinicio −10 %, descargas, tendencia de peso, plan semanal anti-aburrimiento. Tests: `npm test`.
- `src/middleware.ts` — protege `/app` y `/admin`.
- `supabase/migrations/0001_init.sql` — esquema completo con RLS, roles y consentimiento de salud (Ley 8968).

**Sin variables de entorno la app corre en modo demo** (datos de Andrés, sin login) para que el deploy funcione desde el día 1.

## Activar cuentas reales (10 min)

1. Crea un proyecto en [Supabase](https://supabase.com) (región `us-east-1` recomendada).
2. SQL Editor → ejecuta en orden todas las migraciones de `supabase/migrations/` (`0001_init.sql`, `0002_onboarding.sql`, … `0005_admin.sql`).
3. Authentication → Email: activa *Email OTP*. En **Email Templates → Magic Link** incluye `{{ .Token }}` para que llegue el código de 6 dígitos.
4. Authentication → URL Configuration: Site URL = tu dominio de Vercel; Redirect URLs = `https://TU-DOMINIO/auth/callback` y `http://localhost:3000/auth/callback`.
5. (Opcional) Authentication → Providers → Google con tu Client ID/Secret.
6. (Coach IA) agrega `ANTHROPIC_API_KEY` en Vercel. Para que "Borrar mi cuenta" funcione agrega también `SUPABASE_SERVICE_ROLE_KEY` (solo servidor).
7. Copia `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` a Vercel → Settings → Environment Variables y redepliega.
8. Regístrate en `/entrar` y hazte superadmin en el SQL Editor:
   ```sql
   update public.profiles set role = 'superadmin'
   where id = (select id from auth.users where email = 'TU_CORREO');
   ```

## Pagos (ONVO)

Suscripciones en USD con [ONVO Pay](https://docs.onvopay.com). Flujo: `/precios` → `POST /api/pagos/checkout` crea el cliente y una suscripción pendiente en ONVO (`paymentBehavior: "allow_incomplete"`) → `/pago/checkout` muestra el SDK web de ONVO, que cobra sin que la tarjeta pase por nuestro servidor → ONVO llama al **webhook**, que es lo **único** que activa el plan (`subscriptions` + `profiles.plan`). Los precios salen de `src/lib/plans.ts`; el navegador solo envía `plan` y `billing`.

| Ruta | Qué hace |
|---|---|
| `POST /api/pagos/checkout` | `{ plan: "entreno"\|"completo", billing: "mes"\|"anual" }` → `{ url }` (requiere sesión) |
| `POST /api/pagos/webhook` | Eventos de ONVO. Verifica `X-Webhook-Secret`, idempotente (`payment_events`) |
| `POST /api/pagos/cancelar` | Corta la renovación; el acceso sigue hasta el fin del periodo pagado |
| `/app/suscripcion` | Plan, estado, renovación, cambio de plan, cancelación con oferta de retención, historial de pagos |
| `/pago/checkout` · `/pago/exito` · `/pago/cancelado` | Pago con el SDK, confirmación y "no se cobró" |

**Configuración (modo prueba primero):**

1. SQL Editor → ejecuta `supabase/migrations/0004_payments.sql`. Requiere `SUPABASE_SERVICE_ROLE_KEY` en Vercel.
2. Dashboard de ONVO en **modo prueba** → Desarrolladores: copia la llave secreta (`onvo_test_secret_key_…`) a `ONVO_SECRET_KEY` y la publicable (`onvo_test_publishable_key_…`) a `NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY`.
3. Crea 2 productos ("Entreno" y "Entreno + Nutrición") y 4 **precios recurrentes en USD** con los montos exactos de `plans.ts`:
   `ONVO_PRICE_ENTRENO_MES` 9.99/mes · `ONVO_PRICE_ENTRENO_ANUAL` 59.99/año · `ONVO_PRICE_COMPLETO_MES` 14.99/mes · `ONVO_PRICE_COMPLETO_ANUAL` 89.99/año. Copia cada ID a su variable. Si un monto no coincide, el webhook lo anota en `payment_events.note`.
4. Webhooks → agrega `https://<dominio>/api/pagos/webhook` con los eventos `subscription.renewal.succeeded`, `subscription.renewal.failed` y `payment-intent.succeeded` (los demás se registran y se ignoran). Copia el secreto (`webhook_secret_…`) a `ONVO_WEBHOOK_SECRET`.
5. Redepliega y prueba con la tarjeta `4242 4242 4242 4242` (aprobada), `4000 0000 0000 0002` (rechazada) o `4000 0000 0000 3220` (3DS). Revisa `public.payment_events` y que `profiles.plan` cambie.
6. Para producción repite 2–4 con las llaves `onvo_live_…` y precios en modo live (los IDs de prueba no sirven en live).

Sin estas variables la app compila y funciona igual: los botones de pago quedan desactivados y en modo demo se muestra un aviso.

## Comunicaciones

Correo (Resend), Web Push (VAPID), avisos in-app (campanita) y un cron de recordatorios. **Todo es no-op sin variables de entorno**: el build y el modo demo funcionan igual.

| Pieza | Dónde |
|---|---|
| Lógica de decisión (quién recibe qué, a qué hora local, silencio, tope de 2 push/día) | `src/lib/notify.ts` · tests `src/lib/notify.test.ts` |
| Plantillas de correo (HTML + texto, marca banana, español) | `src/lib/email/templates.ts` |
| Envío Resend + funciones transaccionales para auth/onboarding/pagos | `src/lib/email/send.ts`, `src/lib/email/index.ts` |
| Baja con un clic (token HMAC) | `GET/POST /api/email/baja?token=…` · `src/lib/email/token.ts` |
| Web Push | `public/sw.js` (solo push, **sin caché offline**), `src/lib/push.ts`, `POST/DELETE /api/push/subscribe` |
| Cron | `GET /api/cron/recordatorios` (`Authorization: Bearer $CRON_SECRET`) · `src/lib/notify-run.ts` |
| UI | `src/components/notifications/{settings,bell,enable-push}.tsx` · server actions `src/app/actions/notifications.ts` |
| Esquema | `supabase/migrations/0006_notifications.sql` (prefs, push_subscriptions, notification_log, notifications + RLS) |

**Qué se manda** (hora local del usuario, zona por defecto `America/Costa_Rica`):
- A su `reminder_time`, día de entreno y sin entreno → "Hoy te toca {rutina} 💪" (push + correo según preferencias).
- 3 y 7 días sin actividad → reactivación (reemplaza al recordatorio ese día).
- 20:00, sin actividad hoy y racha ≥ 2 → racha en peligro.
- Lunes 07:00 → resumen semanal por correo (ese día el recordatorio va solo por push: un correo a la vez).
- Máximo 2 push por día, nunca en horas de silencio (por defecto 22:00–07:00). Cada tipo una vez por día (`notification_log`).

### Activar

1. **Supabase**: ejecuta `supabase/migrations/0006_notifications.sql`. Requiere `SUPABASE_SERVICE_ROLE_KEY` en Vercel (el cron y los webhooks usan service_role).
2. **Resend + dominio `bananaburn.app`**: Resend → Domains → Add domain `bananaburn.app` (región us-east-1). Copia en tu DNS los registros que te da: **MX y TXT (SPF) del subdominio `send`**, el **TXT DKIM `resend._domainkey`** y, recomendado, un **TXT DMARC** en `_dmarc` (`v=DMARC1; p=none; rua=mailto:hola@bananaburn.app`). Espera a que salga *Verified* y crea una API key con permiso *Sending*. Variables: `RESEND_API_KEY`, `EMAIL_FROM="Banana Burn <hola@bananaburn.app>"`.
3. **Enlaces de baja**: `EMAIL_UNSUB_SECRET=$(openssl rand -hex 32)`. Si lo cambias, los enlaces viejos dejan de funcionar.
4. **Web Push (VAPID)**:
   ```bash
   npx web-push generate-vapid-keys
   ```
   Pon la pública en `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (y opcionalmente `VAPID_PUBLIC_KEY`), la privada en `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT=mailto:hola@bananaburn.app`. **No las rotes**: cambiar las llaves invalida todas las suscripciones. En iPhone el push solo funciona con la app instalada en inicio (iOS 16.4+); la UI lo explica.
5. **Cron**: `CRON_SECRET=$(openssl rand -hex 32)` en Vercel. Vercel lo manda solo como `Authorization: Bearer …`. `vercel.json` lo programa **cada hora** (`0 * * * *`), lo que requiere **Vercel Pro**.
   - **Vercel Hobby solo permite crons diarios** (y un deploy con un cron horario falla). Fallback: cambia el schedule a `"0 13 * * *"` (07:00 Costa Rica) y pon `NOTIFY_CRON_MODE=daily`. En ese modo el recordatorio, la reactivación y el semanal de los lunes salen en esa corrida (ignorando `reminder_time`) y el aviso de racha de las 20:00 se omite. Pro desbloquea el horario por usuario y la racha.
   - Probar a mano: `curl -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO/api/cron/recordatorios` (es idempotente: repetirlo no duplica envíos).

## Admin

Panel en `/admin` (en español, pensado para escritorio y usable en móvil). Sin Supabase muestra datos de demo y permite **simular rol** desde la barra lateral para revisar permisos.

| Ruta | Qué hace |
|---|---|
| `/admin` | KPIs: usuarios, nuevos 7/30 d, activos hoy/7 d, entrenos/día, conversión, MRR, churn 30 d, cohortes D1/D7/D30 |
| `/admin/usuarios` · `/[id]` | Búsqueda (nombre, correo, ID) con filtros y paginación · ficha con cambio de rol, cortesías y reinicio de bienvenida |
| `/admin/pagos` | Suscripciones, MRR por plan, renovaciones y pagos fallidos (tolera columnas faltantes en `subscriptions`) |
| `/admin/contenido` | Overrides de ejercicios, alimentos (CRUD + verificado), retos y anuncios |
| `/admin/comunidad` | Cola de moderación sobre `reports` (resolver, ocultar, descartar) |
| `/admin/auditoria` | Visor de `audit_log` con filtros |

**Permisos** (`src/lib/admin-perms.ts`, repetidos en RLS y en funciones SECURITY DEFINER de `0005_admin.sql`):

| | coach | support | admin | superadmin |
|---|:-:|:-:|:-:|:-:|
| Resumen (sin ingresos) · usuarios (cuenta) · moderación | ✅ | ✅ | ✅ | ✅ |
| Peso, meta, actividad del usuario | ✅ | — | ✅ | ✅ |
| Facturación, pagos, cortesías, reiniciar bienvenida | — | ✅ | ✅ | ✅ |
| Ejercicios, alimentos, retos | ✅ | — | ✅ | ✅ |
| Ingresos (MRR/churn), anuncios, auditoría, cambiar roles | — | — | ✅ | ✅ |
| Otorgar/quitar admin o superadmin | — | — | — | ✅ |

Toda mutación es una server action que valida rol y entrada en el servidor y escribe `public.audit_log`. Cortesías vencidas: programa `select public.expire_comp_grants();` a diario (pg_cron o un cron con service_role).

**Para la app:** `src/lib/admin-content.ts` → `getLiveAnnouncements()`, `getChallengeCatalog()`, `getExerciseOverrides()`; componente `<AnnouncementBanner />` en `src/components/admin/announcement-banner.tsx`. Comunidad: insertar en `reports` y filtrar con `public.is_hidden(tipo, id)`.

## Desarrollo

```bash
cp .env.example .env.local   # opcional
npm install
npm run dev     # http://localhost:3000
npm test        # motor de entrenamiento
npm run build
```

## Roadmap
Fase 1 (2–22 nov): reproductor de entreno + registro de series, onboarding, coach IA (Claude), PWA.
Fase 2 (23 nov–6 dic): pagos ONVO (tarjeta, SINPE Móvil, Apple Pay), admin v1 completo.
Fase 3 (7–20 dic): beta cerrada CR. Fase 4 (ene 2027): lanzamiento LATAM.
