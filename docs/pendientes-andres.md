# Pendientes de Andrés (app nativa)

Lo que solo tú puedes hacer para publicar Banana Burn en App Store y Google Play. Cada punto dice para qué sirve, los
pasos exactos y qué me tienes que pasar. Las llaves y contraseñas **nunca** van en el chat ni en el repo: van en Vercel
(variables de entorno), en los secretos de GitHub Actions o en tu computadora. Este archivo se actualiza en cada fase.

Estado: `[ ]` es pendiente y `[x]` es listo.

## Ya (para poder avanzar la Fase 1)

### [x] 1. Decidir cómo compilamos iOS
Para compilar la app de iPhone hace falta una Mac con Xcode (Apple no permite otra cosa). Opciones:
- **Tienes una Mac**: instalas Xcode desde el App Store y te dejo los comandos exactos para abrir el proyecto.
- **No tienes Mac**: compilamos en GitHub Actions con máquinas macOS (incluidas en tu plan de GitHub con un límite de
  minutos) y subimos a TestFlight desde ahí. Para probar en el simulador sin Mac, la alternativa es TestFlight en tu iPhone.

Respuesta: tienes Mac. iOS se compila y se prueba en tu Mac (pasos en `app-nativa.md`, "Cómo se prueba").

### [ ] 2. Permitir el SDK de Android en el entorno de Claude (opcional)
El entorno de la nube donde trabajo bloquea `dl.google.com`, y de ahí sale el SDK de Android. Sin eso compilo el APK en
GitHub Actions (funciona igual, solo tarda un poco más). Si prefieres que lo compile aquí:
1. En la sesión de Claude Code, menú del entorno (barra de título) → **Edit**.
2. **Network access** → agrega `dl.google.com` en **Allowed domains** (deja marcada la casilla de package managers).
3. Guarda. Pasos oficiales: https://code.claude.com/docs/en/cloud-environments#network-access

### [x] 3. Preparar tu Android para instalar el APK de prueba
1. Ajustes → Acerca del teléfono → toca 7 veces **Número de compilación** (se activan las Opciones de desarrollador).
2. Ajustes → Sistema → Opciones de desarrollador → activa **Depuración por USB**.
3. En tu computadora instala **Android Platform Tools** (https://developer.android.com/tools/releases/platform-tools).
4. Conecta el teléfono por USB, acepta "Permitir depuración" y corre `adb devices`: debe salir tu equipo.
5. Instalar el APK que te mando: `adb install -r banana-burn-debug.apk`.

### [ ] 4. Revisar el Site URL de Supabase (no cambies nada todavía)
Los enlaces de los correos (confirmar cuenta, recuperar contraseña) usan este valor. Para que abran la app tiene que
ser `https://www.bananaburn.app`, con `www`.
1. Supabase → tu proyecto de producción → **Authentication** → **URL Configuration**.
2. Dime qué dice **Site URL** y qué hay en **Redirect URLs**. Si hay que cambiarlo te aviso antes, porque toca producción.

## Login nativo y enlaces (Fase 1)

Sin esto la app funciona con correo y contraseña o código; con esto aparecen Google y Apple dentro de la app y los
enlaces de los correos abren la app.

### [ ] 5. Llave de debug fija para el APK de prueba
Así el APK de cada run se firma con la misma llave y Google y los App Links la reconocen.
1. En tu Mac, en la terminal:
   ```bash
   keytool -genkeypair -v -keystore bananaburn-debug.keystore -alias androiddebugkey \
     -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 \
     -dname "CN=Android Debug,O=Android,C=US"
   base64 -i bananaburn-debug.keystore | pbcopy
   ```
   (`keytool` viene con Java; si no lo tienes: `brew install --cask temurin`.)
2. GitHub, repo `banana-burn`, Settings, Secrets and variables, Actions, **New repository secret**: nombre
   `ANDROID_DEBUG_KEYSTORE_B64`, valor: pega (Cmd+V). Guarda el archivo `.keystore` en un lugar seguro, fuera del repo.
3. Actions, "App nativa", **Run workflow** en `feature/app-nativa`. En el resumen del run salen dos huellas: SHA-256 y SHA-1.

### [ ] 6. Google: clientes OAuth para la app
En Google Cloud Console, **el mismo proyecto** del proveedor Google de Supabase, APIs y servicios, Credenciales:
1. **Crear credenciales, ID de cliente de OAuth, Android**: paquete `app.bananaburn`, huella **SHA-1** del punto 5.
   (Más adelante agregas otro igual con la SHA-1 de Google Play.)
2. **Crear credenciales, ID de cliente de OAuth, iOS**: ID del paquete `app.bananaburn`.
3. Copia el ID del cliente **Aplicación web** que ya usa Supabase y el del cliente **iOS**.
4. Supabase, Authentication, Providers, Google: en **Client IDs** (autorizados) deja el web y agrega el de iOS,
   separados por coma. Guarda. (Esto toca producción: solo agrega, no cambies lo que ya está.)
5. Vercel, proyecto banana-burn, Settings, Environment Variables (Production y Preview):
   `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` y `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID`. Redeploy.
6. Pásame el ID del cliente **iOS** (no es secreto): agrego su esquema de URL en la app de iPhone.

### [ ] 7. App Links de Android
Vercel, Environment Variables (Production): `ANDROID_CERT_SHA256` = la huella **SHA-256** del punto 5. Redeploy.
Después revisa que https://www.bananaburn.app/.well-known/assetlinks.json muestre la huella.

### [ ] 8. "Continuar con Apple" y Universal Links (cuando exista la cuenta de Apple, punto 10)
1. developer.apple.com, Certificates, Identifiers & Profiles, Identifiers: el App ID `app.bananaburn` con
   **Sign in with Apple** y **Associated Domains** activados.
2. Supabase, Authentication, Providers, Apple: actívalo y en **Client IDs** pon `app.bananaburn`.
3. Vercel (Production): `APPLE_TEAM_ID` = tu Team ID (Membership, 10 caracteres) y `NEXT_PUBLIC_NATIVE_APPLE_AUTH=1`.
   Redeploy. Revisa https://www.bananaburn.app/.well-known/apple-app-site-association.
4. Apple, Services, Sign in with Apple for Email Communication: registra `bananaburn.app` y `hola@bananaburn.app`, para
   que los correos lleguen a quien oculta su correo con Apple.
5. Para revocar el acceso de Apple al borrar una cuenta (Apple lo exige) necesito una llave de Sign in with Apple
   (`.p8`): Keys, crear, marcar Sign in with Apple. Te digo dónde guardarla cuando lleguemos.

## Cuentas de las tiendas (no bloquean el desarrollo; las necesito antes de la Fase 3)

### [ ] 9. D-U-N-S de Atlas Solutions LLC
Apple y Google piden el número D-U-N-S para cuentas de organización. Pídelo gratis en
https://developer.apple.com/enroll/duns-lookup/ con el nombre legal exacto y la dirección registrada de la LLC.
Tarda de 1 a 5 días hábiles (a veces hasta 2 semanas).

### [ ] 10. Apple Developer Program (organización) a nombre de Atlas Solutions LLC
1. https://developer.apple.com/programs/enroll/ → **Organization**, con el D-U-N-S del punto 9 ($99 al año).
2. Usa un Apple ID con verificación en dos pasos y un correo del dominio (por ejemplo `apps@bananaburn.app`).
3. Cuando esté aprobado, en App Store Connect → **Agreements, Tax, and Banking**: firma el **Paid Apps Agreement**,
   agrega la cuenta bancaria y los formularios de impuestos de la LLC. Sin esto no se pueden vender compras dentro de la app.
4. Aplica al **App Store Small Business Program** (comisión de 15 % en vez de 30 %):
   https://developer.apple.com/app-store/small-business-program/
5. Agrégame como lo necesites más adelante (te digo qué rol y qué llaves cuando lleguemos).

### [ ] 11. Google Play Console (organización) a nombre de Atlas Solutions LLC
1. https://play.google.com/console/signup → **Organización**, con el D-U-N-S ($25, pago único). Las cuentas de
   organización no tienen la regla de "20 testers por 14 días" que sí tienen las personales.
2. Completa la verificación de identidad y el **perfil de pagos** (cuenta bancaria de la LLC) para cobrar compras.
3. Inscríbete en la tarifa de servicio de 15 % (es automática para el primer millón de dólares al año, confirma que esté activa).

### [ ] 12. Licencia de marca y código entre las dos empresas
Atlas Resources SRL (dueña de la marca y del código) debe autorizar por escrito a Atlas Solutions LLC a publicar
"Banana Burn" en las tiendas y cobrar ahí. Apple puede pedir prueba de derechos sobre el nombre. Esto es con tu abogado.

## Precios (los defines tú)

### [ ] 13. Precios de los productos de las tiendas
Lista que necesito (en USD; las tiendas convierten a cada país):
- Entreno: mensual y anual.
- Entreno + Nutrición: mensual y anual.
- Oferta introductoria de 50 % el primer mes (confirma si aplica a los dos planes mensuales).
- Cada Temporada (Running, Raquetas, CrossFit).
- Cada reto pagado que quieras vender en la app (cada uno es un producto aparte en cada tienda).

## Fase 2: avisos, Salud y GPS

### [ ] 14. Aplicar las migraciones 0057 y 0058 en Supabase (producción)
0057 crea la tabla de teléfonos para los avisos de la app y 0058 agrega la energía activa al registro diario. Las dos
solo agregan (no cambian ni borran nada) y el código funciona sin ellas, pero sin 0057 no hay avisos en la app y sin
0058 Salud guarda solo los pasos.
1. Supabase, proyecto de producción, **SQL Editor**, **New query**.
2. Abre `supabase/migrations/0057_push_nativo.sql` en GitHub (rama `feature/app-nativa` o `main` después del merge),
   copia todo, pégalo y toca **Run**. Debe decir "Success".
3. Lo mismo con `supabase/migrations/0058_salud.sql`.
4. Para confirmar: pega `supabase/revisar_migraciones.sql` completo y toca **Run**. Las filas `0057_push_nativo.sql` y
   `0058_salud.sql` deben decir "Ya está".

### [ ] 15. Firebase para los avisos en Android
1. https://console.firebase.google.com, **Agregar proyecto**, nombre "Banana Burn" (Google Analytics: no hace falta).
2. En el proyecto, **Agregar app**, Android: paquete `app.bananaburn`, apodo "Banana Burn Android". Descarga
   `google-services.json` (lo demás del asistente, como agregar el SDK, ya está hecho).
3. En tu Mac: `base64 -i google-services.json | pbcopy`. GitHub, repo `banana-burn`, Settings, Secrets and variables,
   Actions, **New repository secret**: nombre `GOOGLE_SERVICES_JSON_B64`, valor: pega.
4. Firebase, engrane, **Configuración del proyecto**, **Cuentas de servicio**, **Generar nueva clave privada**. Se
   descarga un JSON: es una llave, no la compartas.
5. Vercel, proyecto `banana-burn`, Settings, Environment Variables: nombre `FCM_SERVICE_ACCOUNT_JSON`, valor: el
   contenido completo de ese JSON, entorno **Production** (y Preview si quieres probar en previews), marcado como
   **Sensitive**.
6. Actions, "App nativa", **Run workflow** en `feature/app-nativa`: el APK nuevo ya trae Firebase. Instálalo.
7. Vercel: `NEXT_PUBLIC_NATIVE_PUSH` = `1` y **Redeploy** de producción. Desde ahí la app ofrece "Activar avisos".
   Importante: solo cuando el APK que usan las personas trae Firebase (hoy solo tú lo tienes); un APK sin Firebase se
   cierra al activar avisos.

### [ ] 16. Llave de APNs para los avisos en iPhone (cuando exista la cuenta de Apple, punto 10)
1. https://developer.apple.com/account, Certificates, Identifiers & Profiles, **Keys**, botón **+**.
2. Nombre "Banana Burn APNs", marca **Apple Push Notifications service (APNs)**, Continue, Register.
3. Descarga el `.p8` (solo se puede una vez; guárdalo fuera del repo) y anota el **Key ID** (10 caracteres) y tu
   **Team ID** (arriba a la derecha en la cuenta).
4. Vercel, Environment Variables (Production, Sensitive): `APNS_KEY_ID` = Key ID, `APNS_TEAM_ID` = Team ID,
   `APNS_PRIVATE_KEY` = el contenido completo del `.p8` (abre el archivo con TextEdit y copia todo), `APNS_ENV` = `auto`.
5. En Identifiers, el App ID `app.bananaburn` debe tener marcadas **Push Notifications**, **HealthKit**, **Associated
   Domains** y **Sign In with Apple** (Xcode lo hace solo con firma automática).

### [ ] 17. Declaraciones de Google Play (antes de publicar, Fase 4)
Google revisa a mano dos permisos de la app. Lo preparo yo con textos listos en `docs/tiendas.md`; tú los envías:
1. **Health Connect:** Play Console, Contenido de la app, **Permisos de salud**: pasos, peso y calorías activas
   quemadas, solo lectura, para el registro diario y el progreso.
2. **Servicio en primer plano de ubicación:** Play Console, Contenido de la app, **Permisos de servicios en primer
   plano**: "Medir una carrera con la pantalla apagada", con un video corto (30 s) de empezar una carrera, bloquear el
   teléfono y ver el aviso fijo.

## Cosas que se agregan a medida que avanzamos

RevenueCat y los productos de las tiendas (Fase 3), el cliente de Google para iOS y los ajustes de dominio en Vercel
se agregan aquí, con instrucciones exactas, al llegar a cada fase.
