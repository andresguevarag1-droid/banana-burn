# Límites de frecuencia y caché

## Límites

Todos los números viven en `src/lib/security/limits.ts` (reglas con nombre) y se cuentan con `hitLimit`: primero en
memoria por instancia y, en las reglas `db: true`, en Postgres (`rate_hit`, compartido entre instancias).

| Entrada | Regla | Respuesta al pasarse |
| --- | --- | --- |
| Entrar (`confirmAndCheck`) | `auth:entrar:ip` y `auth:entrar:correo` | mensaje "Demasiados intentos" (server action) |
| Registro (`signUpConfirmed`) | `auth:registro:ip` y `auth:registro:correo` | mensaje "Demasiados intentos" (server action) |
| `/auth/correo` GET y POST | `auth:correo:ver`, `auth:correo:entrar` | 429 en texto |
| `/api/track` | `track` | 429 JSON |
| `/api/coach` | `coach:chat` (más el cupo por plan) | 429 en texto |
| `/api/pagos/webhook` | `pagos:webhook` (600 por minuto por IP, solo memoria) | 429 JSON; ONVO reintenta más tarde |
| `/api/avisos/despachar` | `avisos:despachar` (un contador global) | 429 JSON |
| Panel: acciones | `admin` y las pesadas (`authorize` en `src/lib/admin-auth.ts`) | mensaje en el panel |
| Panel: exportaciones CSV | `admin:masivo` | 429 en texto |

Pruebas: `src/lib/security/limits-rutas.test.ts` llama cada ruta hasta pasar su regla y espera el 429.
No hay webhook de Tilopay: los cobros de Tilopay se confirman consultando a Tilopay (`tilopay-billing.ts`).

## Caché

- Las páginas de `src/app/(marketing)` (landing, `/running`, `/temporadas`, `/precios`, `/glp1` y las legales) declaran
  `export const revalidate = 3600`: ISR, la CDN de Vercel las sirve y las regenera cada hora. No leen cookies ni sesión,
  y el middleware no las toca (su matcher no las incluye). Lo revisa `src/lib/cache-publica.test.ts`.
- La biblioteca de ejercicios (`/app/ejercicios`) no se cachea: está detrás de la sesión y depende de la persona (el
  filtro "mi equipo", la rutina de hoy). Sus datos ya son un JSON del bundle, sin consulta a la base.
- Animaciones de técnica: las hojas de fotogramas vienen del CDN de Higgsfield y se sirven por `/_next/image`. Su
  `Cache-Control` lo pone Next con `images.minimumCacheTTL` (31 días) de `next.config.ts`; ni una ruta ni el middleware
  pueden cambiar las cabeceras de `/_next/image`, así que se dejan como están. Las imágenes de `public/` (`/brand`,
  `/landing`, `/icons`, `/email`) también tienen su caché en `next.config.ts`. La animación del héroe es código
  (`motion.ts`) dentro de `/_next/static`, que ya es `immutable`.

### Cómo verificar `x-vercel-cache: HIT` en el preview

1. Abre la URL del preview del PR (con la protección de despliegues de Vercel, usa el enlace de "Visit" con tu sesión
   o un token de bypass).
2. Pide la misma página dos veces y mira las cabeceras:

   ```sh
   curl -sI https://<preview>.vercel.app/ | grep -i -E 'x-vercel-cache|cache-control|age'
   curl -sI https://<preview>.vercel.app/running | grep -i -E 'x-vercel-cache|cache-control|age'
   ```

   La primera puede decir `MISS` o `PRERENDER`; la segunda debe decir `x-vercel-cache: HIT` (o `STALE` mientras se
   regenera después de una hora), con `cache-control: s-maxage=3600, stale-while-revalidate=...`.
3. Una página privada debe seguir sin caché: `curl -sI https://<preview>.vercel.app/app` muestra
   `cache-control: private, no-store...` y nunca `HIT`.
4. Una animación: copia de la pestaña Network una URL `/_next/image?url=https%3A%2F%2Fd8j0ntlcm91z4...` y pídela dos
   veces; la segunda debe traer `x-vercel-cache: HIT` y `cache-control: public, max-age=2678400...`.
