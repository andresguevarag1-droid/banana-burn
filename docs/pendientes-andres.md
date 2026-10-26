# Pendientes de Andrés (app nativa)

Lo que solo tú puedes hacer para publicar Banana Burn en App Store y Google Play. Cada punto dice para qué sirve, los
pasos exactos y qué me tienes que pasar. Las llaves y contraseñas **nunca** van en el chat ni en el repo: van en Vercel
(variables de entorno), en los secretos de GitHub Actions o en tu computadora. Este archivo se actualiza en cada fase.

Estado: `[ ]` es pendiente y `[x]` es listo.

## Ya (para poder avanzar la Fase 1)

### [ ] 1. Decidir cómo compilamos iOS
Para compilar la app de iPhone hace falta una Mac con Xcode (Apple no permite otra cosa). Opciones:
- **Tienes una Mac**: instalas Xcode desde el App Store y te dejo los comandos exactos para abrir el proyecto.
- **No tienes Mac**: compilamos en GitHub Actions con máquinas macOS (incluidas en tu plan de GitHub con un límite de
  minutos) y subimos a TestFlight desde ahí. Para probar en el simulador sin Mac, la alternativa es TestFlight en tu iPhone.

Dime cuál es tu caso.

### [ ] 2. Permitir el SDK de Android en el entorno de Claude (opcional)
El entorno de la nube donde trabajo bloquea `dl.google.com`, y de ahí sale el SDK de Android. Sin eso compilo el APK en
GitHub Actions (funciona igual, solo tarda un poco más). Si prefieres que lo compile aquí:
1. En la sesión de Claude Code, menú del entorno (barra de título) → **Edit**.
2. **Network access** → agrega `dl.google.com` en **Allowed domains** (deja marcada la casilla de package managers).
3. Guarda. Pasos oficiales: https://code.claude.com/docs/en/cloud-environments#network-access

### [ ] 3. Preparar tu Android para instalar el APK de prueba
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

## Cuentas de las tiendas (no bloquean el desarrollo; las necesito antes de la Fase 3)

### [ ] 5. D-U-N-S de Atlas Solutions LLC
Apple y Google piden el número D-U-N-S para cuentas de organización. Pídelo gratis en
https://developer.apple.com/enroll/duns-lookup/ con el nombre legal exacto y la dirección registrada de la LLC.
Tarda de 1 a 5 días hábiles (a veces hasta 2 semanas).

### [ ] 6. Apple Developer Program (organización) a nombre de Atlas Solutions LLC
1. https://developer.apple.com/programs/enroll/ → **Organization**, con el D-U-N-S del punto 5 ($99 al año).
2. Usa un Apple ID con verificación en dos pasos y un correo del dominio (por ejemplo `apps@bananaburn.app`).
3. Cuando esté aprobado, en App Store Connect → **Agreements, Tax, and Banking**: firma el **Paid Apps Agreement**,
   agrega la cuenta bancaria y los formularios de impuestos de la LLC. Sin esto no se pueden vender compras dentro de la app.
4. Aplica al **App Store Small Business Program** (comisión de 15 % en vez de 30 %):
   https://developer.apple.com/app-store/small-business-program/
5. Agrégame como lo necesites más adelante (te digo qué rol y qué llaves cuando lleguemos).

### [ ] 7. Google Play Console (organización) a nombre de Atlas Solutions LLC
1. https://play.google.com/console/signup → **Organización**, con el D-U-N-S ($25, pago único). Las cuentas de
   organización no tienen la regla de "20 testers por 14 días" que sí tienen las personales.
2. Completa la verificación de identidad y el **perfil de pagos** (cuenta bancaria de la LLC) para cobrar compras.
3. Inscríbete en la tarifa de servicio de 15 % (es automática para el primer millón de dólares al año, confirma que esté activa).

### [ ] 8. Licencia de marca y código entre las dos empresas
Atlas Resources SRL (dueña de la marca y del código) debe autorizar por escrito a Atlas Solutions LLC a publicar
"Banana Burn" en las tiendas y cobrar ahí. Apple puede pedir prueba de derechos sobre el nombre. Esto es con tu abogado.

## Precios (los defines tú)

### [ ] 9. Precios de los productos de las tiendas
Lista que necesito (en USD; las tiendas convierten a cada país):
- Entreno: mensual y anual.
- Entreno + Nutrición: mensual y anual.
- Oferta introductoria de 50 % el primer mes (confirma si aplica a los dos planes mensuales).
- Cada Temporada (Running, Raquetas, CrossFit).
- Cada reto pagado que quieras vender en la app (cada uno es un producto aparte en cada tienda).

## Cosas que se agregan a medida que avanzamos

Los pasos de Firebase, llaves de APNs, RevenueCat, "Iniciar sesión con Apple", cliente de Google para iOS y Android,
y los ajustes de dominio en Vercel se agregan aquí, con instrucciones exactas, al llegar a cada fase.
