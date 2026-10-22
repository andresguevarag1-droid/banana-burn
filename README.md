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
| `/admin` · `/admin/usuarios` | Panel de staff con KPIs y usuarios (solo roles coach/support/admin/superadmin) |

- `src/lib/engine/` — motor portado del prototipo: calorías (Mifflin-St Jeor), doble progresión con reinicio −10 %, descargas, tendencia de peso, plan semanal anti-aburrimiento. Tests: `npm test`.
- `src/middleware.ts` — protege `/app` y `/admin`.
- `supabase/migrations/0001_init.sql` — esquema completo con RLS, roles y consentimiento de salud (Ley 8968).

**Sin variables de entorno la app corre en modo demo** (datos de Andrés, sin login) para que el deploy funcione desde el día 1.

## Activar cuentas reales (10 min)

1. Crea un proyecto en [Supabase](https://supabase.com) (región `us-east-1` recomendada).
2. SQL Editor → ejecuta en orden `supabase/migrations/0001_init.sql` y `0002_onboarding.sql`.
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
