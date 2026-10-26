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

## 5. Fase 1 (cascarón): orden de trabajo

1. Capacitor 8, `capacitor.config.ts`, proyectos `ios/` y `android/`, `native/www` con la pantalla sin conexión.
2. `src/lib/platform.ts` (navegador) y su par del servidor (user agent), con pruebas.
3. Sensación nativa solo en la app: `viewport-fit=cover`, sin zoom con pellizco, sin rebote, sin selección accidental,
   status bar y splash con la marca. En la web nada cambia (el zoom sigue por accesibilidad).
4. Íconos y splash con `@capacitor/assets` desde el logo (llama banana sobre ink).
5. `apple-app-site-association` y `assetlinks.json` desde Next.js y el manejo de deep links (`@capacitor/app`).
6. Login nativo con Google y Apple (`signInWithIdToken`); ocultar LinkApp y Web Push en la app.
7. Borrar cuenta: arreglo de proveedores, aviso de suscripciones de tienda y página pública para Google Play.
8. GitHub Actions: APK de debug como artefacto y build de iOS para simulador.
