# App nativa con Capacitor: plan, hallazgos y riesgos

Rama: `feature/app-nativa` (sale de `main` en `dc0c3d2`). Nada de esto llega a `main` sin tu aprobación.
Lo que solo tú puedes hacer está en [`pendientes-andres.md`](pendientes-andres.md).

## 1. Lo que encontré en el repo

**Estructura.** Next.js 15.5 (App Router) con grupos `(marketing)`, `(auth)/entrar`, `(app)/app/*`, `admin/*` y `api/*`.
`src/middleware.ts` protege `/app`, `/admin` y `/bienvenida`, y tapa con el muro de planes (`/app/suscripcion`) lo que
pide plan, usando el RPC `has_app_access`. 56 migraciones en `supabase/migrations`. CI: `tsc`, ESLint, Vitest,
`next build` + revisión del bundle (sin mapas de fuente ni secretos) y migraciones sobre Postgres 16. Hoy `tsc` y
`lint` pasan en verde.

**Dominio.** El canónico es `https://www.bananaburn.app`. `bananaburn.app` redirige con 308 a `www`
(`src/lib/env.ts:22`). `supabase/templates/README.md` dice que el Site URL de Supabase es el dominio sin `www`.

**Login** (`src/app/(auth)/entrar`). Correo y contraseña (por defecto), código por correo (OTP) y Google por OAuth con
redirección de página completa (solo si `NEXT_PUBLIC_GOOGLE_AUTH=1`). No hay Apple. Sesión en cookies con
`@supabase/ssr` (PKCE: el verificador vive en una cookie). Los correos de Supabase traen código y un enlace
`{{ .SiteURL }}/auth/callback?token_hash=…`; el de recuperar contraseña es solo enlace.

**Accesos.** La base no lee `subscriptions` directamente: lee `profiles.plan`, que cada camino de pago mantiene al día
con `syncProfilePlan`. `_has_app_access` da acceso por beta, staff, `profiles.plan` en `entreno|completo|pro`,
`comp_grants` vigente o prueba viva. La prueba de 7 días la controla el servidor (`profiles.created_at` congelado para
la API, sin tarjeta desde 0043). Nutrición solo con `completo`. Retos y Temporadas: `challenge_entitlements`
(fuentes `compra`, `cortesia`, `anual`). El plan anual regala una Temporada (`season_redemptions`).

**Pagos.** ONVO y Tilopay. La app guarda el token de la tarjeta y cobra con su propio cron (`/api/cron/cobros`) y al
abrir la app. 50 % del primer mes si dejas la tarjeta lista. Ninguna tabla guarda hoy canal ni neto, salvo
`affiliate_commissions` (comisión sobre neto: IVA 13 % y comisión del procesador). `subscriptions.provider`,
`affiliate_commissions.provider`, `payment_methods` y `card_fingerprints` solo aceptan `onvo|tilopay`.

**Push y recordatorios.** Web Push (VAPID) con `public/sw.js` y la tabla `push_subscriptions`, que exige un endpoint
`https://` y llaves `p256dh/auth`: un token de FCM o APNs no cabe ahí. Cron diario a las 07:00 CR. Tipos: recordatorio,
racha, semanal, reactivación (3 y 7 días), y además regalos, novedades, soporte, cobros y testers. El permiso ya se
pide con contexto (después de entrenar o en Perfil, Avisos).

**Reproductor** (`app/entreno/player.tsx`, `components/workout/device.ts`). Wake Lock web, `navigator.vibrate`
(no existe en iPhone), pitidos con `AudioContext`, voz con Web Speech y un aviso de fin de descanso con el service
worker que en la app nativa no va a sonar con la pantalla bloqueada.

**GPS** (`components/correr/run-tracker.tsx`). `watchPosition` solo con la app al frente y pantalla encendida, buffer
en IndexedDB, y el servidor recalcula distancia, ritmo y parciales (`/api/carreras`, idempotente por `client_id`).

**Salud.** `/app/conexiones` está apagada (`ABIERTA = false`). Pasos y peso se registran a mano.

**Marca.** No hay un brand book en el repo; los tokens están en `src/app/globals.css` y coinciden con los tuyos. El logo
de la llama con la banana es `public/icons/logo.svg`. No encontré emojis ni rayas largas en el código de la interfaz.
El `viewport` no tiene `viewport-fit=cover`, pero la interfaz ya usa `env(safe-area-inset-*)` en casi todo.

## 2. Decisiones técnicas

1. **Capacitor 8.5** (la estable más reciente; la 7 ya quedó atrás). `ios/` y `android/` en la raíz. App ID
   `app.bananaburn`, nombre `Banana Burn`.
2. **`server.url = https://www.bananaburn.app`**, no el dominio sin `www`: ese redirige y la app cambiaría de host en
   cada arranque. Una variable `CAP_SERVER_URL` permite apuntar una build de prueba a un preview de Vercel.
3. **Pantalla sin conexión empaquetada** en la app (`server.errorPath`), con la marca. `allowNavigation` solo con
   `www.bananaburn.app`, `bananaburn.app` y el dominio de Supabase; todo lo demás se abre con `@capacitor/browser`.
4. **Un solo helper de plataforma.** En el navegador, `src/lib/platform.ts` usa `Capacitor.isNativePlatform()` y
   `Capacitor.getPlatform()`. En el servidor, la app agrega `BananaBurnApp/<versión> (ios|android)` al user agent
   (`appendUserAgent`), así el HTML ya llega sin precios ni botones de pago, sin parpadeo. Los plugins se cargan con
   import dinámico solo en la app: la web no cambia. El código revisa que cada plugin exista
   (`Capacitor.isPluginAvailable`), porque una app vieja puede cargar una web nueva.
5. **Login en la app.** Google bloquea su OAuth dentro de un WebView (`disallowed_useragent`), así que Google y Apple
   se hacen con el SDK nativo de cada sistema y la sesión se crea con `supabase.auth.signInWithIdToken`. Correo con
   contraseña y código siguen igual. Los enlaces de los correos (`token_hash`) abren la app por Universal Links y
   App Links y funcionan aunque se pidan desde otro aparato.
6. **Deep links solo en `www`** y solo para rutas de la app: `/auth/*`, `/app/*`, `/entrar*`, `/r/*`, `/c/*`. El resto
   (landing, precios, páginas legales) sigue abriendo el navegador.
7. **Push nativo.** Tabla nueva `native_push_tokens` con RLS y envío desde el servidor con FCM HTTP v1 (Android) y APNs
   (iOS) dentro de `sendPush`, así todos los avisos que ya existen llegan también a la app sin duplicar lógica.
8. **Pagos.** RevenueCat; el webhook escribe `subscriptions` y llama a `syncProfilePlan` (lo mismo que ONVO y Tilopay),
   y `challenge_entitlements` para retos y Temporadas. Así la web y la app comparten una sola cuenta y un solo acceso.

## 3. Cosas que no se pueden hacer tal como se pidieron (y la alternativa)

| Pedido | Problema | Propuesta |
|---|---|---|
| `server.url = https://bananaburn.app` | Redirige con 308 a `www` | `https://www.bananaburn.app` |
| `@capacitor/keep-awake` | No existe ese paquete | `@capacitor-community/keep-awake` (el de la comunidad, al día con Capacitor 8) |
| Webhook de RevenueCat "con verificación de firma" | RevenueCat no firma sus webhooks; solo manda un encabezado `Authorization` que tú defines | Validar ese encabezado y, como hace hoy Tilopay, **no confiar en el cuerpo**: con cada evento se consulta a la API de RevenueCat el estado real del usuario y solo eso da o quita acceso |
| Probar en simulador de iOS, emulador de Android y tu Android por USB | Este entorno es Linux en la nube: no hay macOS (sin simulador de iOS), no hay emulador ni USB, y bloquea `dl.google.com` (SDK de Android) | GitHub Actions compila el APK de debug (lo descargas e instalas con `adb`) y la build de iOS en macOS. Las pruebas en aparatos las haces tú con una guía paso a paso; yo reviso los logs que me pases |
| Retos pagados con precio según nivel | Las tiendas usan precios fijos por producto; no hay descuentos por nivel en compras únicas | En la app cada reto tiene un precio fijo de tienda; el descuento por nivel queda solo en la web. Los retos sin producto en la tienda no se venden en la app |
| No mencionar IA | La regla 5.1.2(i) de Apple (nov 2025) exige avisar y pedir permiso antes de mandar datos personales a una IA de terceros (el Coach usa Anthropic) | Fichas de tienda y marketing sin IA. Dentro de la app, un aviso de consentimiento antes de usar el Coach y la política de privacidad nombran al proveedor. Necesito tu visto bueno |

## 4. Riesgos

**Altos**
1. **Cada cambio nativo de la web sale a producción.** La app carga `www.bananaburn.app`, así que el código que habla
   con los plugins vive en la web y llega a la app solo cuando se publica en `main`. Para probar antes, una build de
   debug puede cargar el preview de Vercel de esta rama (si tiene Deployment Protection, con el token de bypass).
   Universal Links, App Links y los archivos `.well-known` solo funcionan en el dominio real.
2. **Revisión de Apple 4.2 y 2.5.2.** Una app que carga una web remota se revisa con lupa. La salen adelante el push,
   HealthKit, GPS en segundo plano, haptics, notificaciones locales, login nativo y la pantalla sin conexión.
3. **Cobros dobles.** Quien dejó la tarjeta en la web durante la prueba se cobra el día 7 con nuestro cron. Si en ese
   lapso compra en la app, hay que cancelar ese cobro programado. Y si ya paga en un canal, el otro no debe ofrecerle
   comprar: la app muestra "Ya tienes tu plan" y la web no deja pagar encima de una suscripción de tienda.
4. **Ocultar todo pago web en la app.** Son unas 30 piezas: `/precios`, la sección de precios de la landing, `/pago/*`,
   `/app/suscripcion` (formulario de tarjeta, selector de plan, muro, banners de tarjeta y prueba), el selector de plan
   y la tarjeta del onboarding, botones de compra de retos y Temporadas, y unos 15 enlaces de "Mejorar". Se resuelve
   con el helper de plataforma en el servidor y con el middleware, que en la app manda las rutas de pago al paywall de
   la tienda.
5. **Esquema de pagos.** Para las compras de tienda hay que ampliar los `check` de `provider` (hoy solo
   `onvo|tilopay`) y agregar canal y neto. Es un cambio aditivo (sin reescribir datos), pero toca el esquema de pagos de
   la web: te lo voy a pedir antes de la Fase 3.

**Medios**
6. **Dominio de los correos.** Si el Site URL de Supabase es `bananaburn.app` (sin `www`), los enlaces de confirmación
   y de recuperar contraseña no abren la app (Apple no sigue redirecciones para Universal Links). Hay que cambiar el
   Site URL a `www` en Supabase (producción, lo haces tú) o servir los `.well-known` también sin `www` (ajuste de dominio
   en Vercel).
7. **Meta Pixel dentro de la app.** Rastrear entre apps y sitios en iPhone obliga a pedir permiso de rastreo (ATT) y a
   declararlo en la ficha. Propongo apagar el Pixel y la API de conversiones dentro de la app nativa.
8. **Códigos de condominio y canjes.** Apple prohíbe desbloquear contenido con códigos propios dentro de la app.
   El canje (`/c/[code]`) se hace en la web; el acceso que da se respeta en la app (regla de servicios multiplataforma).
9. **Borrar cuenta.** Hoy `deleteAccountData` (`src/lib/admin-account.ts:21`) manda a ONVO la cancelación de toda
   suscripción, sin mirar si es de Tilopay, y si ONVO responde algo distinto de 404 la cuenta no se borra. Tampoco quita
   el token de Tilopay. Lo corrijo en la Fase 1. Las suscripciones de Apple no se pueden cancelar desde el servidor: la
   app debe explicarlo y llevar a Ajustes. Con "Iniciar sesión con Apple" hay que revocar el token de Apple al borrar.
10. **Permisos sensibles.** GPS en segundo plano (declaración de servicio en primer plano y video en Google Play;
    justificación en Apple), Health Connect (formulario de acceso en Google Play) y HealthKit. Pueden demorar la
    aprobación.
11. **Pantallas de instalar la LinkApp y Web Push.** Dentro de la app aparecerían "Instala tu LinkApp", "abre en
    Safari" y los avisos del navegador. Se ocultan en la app nativa.
12. **"Beta" en la interfaz.** Apple rechaza apps marcadas como beta o prueba (regla 2.2). En la app nativa no debe
    aparecer esa palabra.

## 5. Fase 1 (cascarón): lo que quedó hecho

| Pieza | Dónde |
|---|---|
| Capacitor 8.5, proyectos `ios/` (Swift Package Manager, solo iPhone) y `android/` | `capacitor.config.ts`, `ios/`, `android/` |
| Pantalla sin conexión empaquetada (logo, fuente, botón de reintentar) | `native/www/offline.html`, `scripts/native-prepare.mjs` |
| Helper único de plataforma (navegador, servidor y React) | `src/lib/platform.ts`, `src/lib/platform-server.ts`, `src/lib/platform-ua.ts`, `src/components/platform-provider.tsx` |
| Sensación nativa: sin zoom, sin rebote, sin selección accidental, notch y barra de estado, splash, botón Atrás, links externos | `src/lib/native/boot.ts`, `src/components/native-shell.tsx`, `src/app/globals.css` (`html[data-native]`) |
| Íconos y splash (llama banana sobre ink) en todos los tamaños | `npm run native:icons` (`scripts/native-icons.mjs` + `@capacitor/assets`) |
| Universal Links y App Links (`/app`, `/entrar`, `/bienvenida`, `/auth/*`) | `src/app/.well-known/*`, `src/lib/native/app-links.ts`, `ios/App/App/App.entitlements`, `AndroidManifest.xml` |
| Login con Google y Apple nativos (`signInWithIdToken` con nonce) | `src/lib/native/auth.ts`, `src/lib/native/auth-options.ts`, `src/app/(auth)/entrar/login-form.tsx` |
| Sin LinkApp, service worker ni Web Push dentro de la app | `src/lib/install-env.ts`, `src/components/install/*`, `src/components/notifications/enable-push.tsx` |
| Meta Pixel y API de conversiones apagados dentro de la app (sin permiso de rastreo) | `src/components/meta-pixel.tsx`, `src/app/api/track/route.ts` |
| Borrar cuenta según el procesador (arreglo para Tilopay) y página pública `/eliminar-cuenta` | `src/lib/admin-account.ts`, `src/app/(marketing)/eliminar-cuenta/page.tsx` |
| "Descargar mis datos" en la app: guarda el JSON y abre Compartir | `src/lib/native/files.ts`, `src/app/(app)/app/perfil/settings.tsx` |
| APK de debug en cada cambio y build de iOS para simulador a pedido | `.github/workflows/native.yml` |

**En la web no cambia nada.** Todo lo nativo depende de `isNativeApp()` o del user agent de la app; Capacitor y los
plugins se cargan con `import()` dinámico solo dentro de la app (revisado en el build: ningún trozo con Capacitor está
en lo que la web descarga al entrar). Lo único que cambia para todos es un arreglo: borrar la cuenta ya no falla para
quien paga con Tilopay.

### Cómo se prueba

La app carga la web de producción. Lo que vive en la web (login nativo, sin zoom, sin LinkApp) se ve en la app cuando
esta rama llega a `main`; antes de eso, el APK puede cargar un preview de Vercel (Actions, "App nativa", Run workflow,
con la URL del preview en `server_url`).

**Android (tu teléfono, por USB):**
1. GitHub, pestaña Actions, workflow "App nativa", el último run de `feature/app-nativa`, sección Artifacts:
   descarga `banana-burn-debug-apk` y descomprímelo (`app-debug.apk`).
2. Con el teléfono preparado (ver `pendientes-andres.md`, punto 3): `adb install -r app-debug.apk`.
3. Revisa: splash ink con la llama, abre en Hoy (o en Entrar), entrar con correo y contraseña o con código, Perfil,
   Atrás de Android (cierra hojas y vuelve), modo avión al abrir (pantalla "Estás sin conexión" y vuelve sola al
   reconectar), un enlace externo (se abre dentro de la app con botón de cerrar).
4. Si algo falla: `adb logcat | grep -i -E "capacitor|chromium|bananaburn"` y me pasas lo que salga.

**iPhone (tu Mac):**
1. Instala Xcode desde el App Store y ábrelo una vez para que termine de instalar sus componentes.
2. En la terminal:
   ```bash
   git clone https://github.com/andresguevarag1-droid/banana-burn.git && cd banana-burn
   git switch feature/app-nativa
   npm ci
   npm run native:ios        # sincroniza y abre Xcode
   ```
3. En Xcode, arriba elige un simulador (por ejemplo iPhone 17) y toca Run (el triángulo). Para el simulador no hace
   falta cuenta de Apple.
4. En un iPhone físico hace falta la cuenta de Apple Developer pagada: "Asociar dominios" y "Continuar con Apple" no
   funcionan con una cuenta gratis.

### Qué queda para cerrar la Fase 1

- Merge de esta rama a `main` (aprobado: cambios que en la web no se notan), para que la app vea su parte web.
- Las llaves y cuentas de `pendientes-andres.md` para el login con Google y Apple y para los App Links.
- Tu prueba del APK en tu Android.

## 6. Notas para las fases siguientes

- **Reproductor (Fase 2):** con el descanso en pantalla ink, la barra de estado debe pasar a texto claro (hoy queda
  oscura). `navigator.vibrate` y la alarma del service worker se reemplazan por `@capacitor/haptics` y notificaciones
  locales.
- **Push (Fase 2):** la tarjeta de avisos hoy no aparece en la app; vuelve con push nativo y la tabla de tokens.
- **Revocar "Continuar con Apple" al borrar la cuenta:** Apple lo exige; necesita la llave de Sign in with Apple (`.p8`).
  Va cuando exista la cuenta de Apple.
- **Aviso de IA (regla 5.1.2(i) de Apple):** consentimiento antes del primer uso del Coach dentro de la app, nombrando al
  proveedor. Antes de enviar a revisión.
- **Política de privacidad:** hoy dice que el GPS nunca corre en segundo plano; cambia con el GPS de la Fase 2.
- **Textos de borrar cuenta:** cuando existan compras de tienda (Fase 3), el aviso de "cancelamos tu suscripción" debe
  explicar que las de App Store y Google Play se cancelan en la tienda.
