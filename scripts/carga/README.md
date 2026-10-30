# Carga sintética, nunca producción

Objetivo: comprobar el paso de Hoy al primer entreno guardado, y guardar GPS,
con 1,000 sesiones concurrentes. k6 HTTP ejecuta landing, Auth con contraseña,
Hoy, abrir entreno, la Server Action real de series y POST /api/carreras.
No ejecuta JavaScript del navegador ni mide renderizado, mapas o hidratación.

## Preparación

1. Instala k6 (https://grafana.com/docs/k6/latest/set-up/install-k6/), Node y `npm ci`.
2. Crea un proyecto Supabase **vacío y desechable**, sin usuarios ni copias de datos reales.
   Aplica las migraciones. No conectes nunca el script ni el preview al proyecto de producción.
   Desactiva envío de correo, webhooks y crons de cobro/recordatorios en este entorno.
3. Configura local o preview para usar exclusivamente ese proyecto (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` y las variables servidor habituales). No uses modo demo.
4. En tu terminal configura `SUPABASE_URL`, `TEST_SUPABASE_URL` (la misma URL),
   `SUPABASE_SERVICE_ROLE_KEY`, `ANON_KEY` y `TEST_PASSWORD` mediante tu gestor de secretos.
   Usa una contraseña aleatoria exclusiva de esta prueba. Nunca las pegues en archivos,
   capturas, commits, logs o comandos guardados en el historial.
5. `CONFIRM_DISPOSABLE=yes USERS=2 node scripts/carga/seed.mjs` crea cuentas
   `carga-0001@example.invalid`, etc., con plan de prueba sintético y onboarding completo.
   La llave service role solo la usa el seeder; k6 usa únicamente la llave pública y sesiones propias.
6. Inicia `npm run dev`. Guarda un entreno manual con una cuenta sintética y consulta en
   DevTools > Network el encabezado `Next-Action` del POST a `/app/entreno`.
   Configura ese identificador como `WORKOUT_ACTION_ID`. Cambia en cada build: usa el del destino.
   No copies cookies ni cuerpos de respuesta. No habilites `--http-debug`.

## Local, dos usuarios

```sh
BASE_URL=http://localhost:3000 VUS=2 k6 run scripts/carga/carga.js
```

La prueba falla ante redirecciones a login, errores de negocio, respuestas demo,
más de 1 % de errores o p95 HTTP mayor de 3 s. Revisa que haya filas de series y
carreras de las cuentas sintéticas en el proyecto desechable. Un 200 de la Server
Action debe incluir `ok:true`; un build con otro ID falla, no simula éxito.

## Preview, 1,000 usuarios (Andrés)

Crea otro proyecto vacío o recrea el anterior y siembra `USERS=1000`. Ajusta en
**ese proyecto** los límites de Auth por IP para admitir 1,000 logins durante la
rampa; registra el ajuste y restaura al terminar. Nunca cambies límites de producción.
El preview debe ser accesible al generador sin redirigir a protección de Vercel.
Comprueba primero dos usuarios y luego 50. Usa el mismo build y proyecto en toda la corrida.

```sh
BASE_URL=https://tu-preview.vercel.app PREVIEW_URL=https://tu-preview.vercel.app \
VUS=1000 RAMP=5m HOLD=10m k6 run scripts/carga/carga.js
```

`PREVIEW_URL` confirma el destino exacto. El script rechaza dominios de producción
personalizados y permite solo localhost o `.vercel.app`; un alias de producción
`.vercel.app` también debe excluirse manualmente: verifica el deployment como preview
antes de confirmar. `TEST_SUPABASE_URL` confirma por separado la base desechable.
No se incluye ninguna URL/llave de producción ni bypass automático.

Cada VU conserva su sesión, guarda dos series y un recorrido generado cerca de
(0,0), sin ubicación de personas. Entre vueltas espera 30 s. Las rampas llegan a
1,000 VU (no significa 1,000 requests/s). Dimensiona el generador, observa CPU/red
y conserva únicamente métricas agregadas. En corridas de más de una hora se
necesita renovar sesión; esta prueba está diseñada para durar menos de una hora.

Al terminar elimina el proyecto desechable y el preview; no se borran cuentas por
patrones sobre una base compartida. La semilla falla si ya existen cuentas: recrea
el proyecto para evitar mezclar resultados. No publiques resultados con identificadores.

## Consultas e índices

Revisión estática: `daily.ts` filtra workouts por usuario/fecha, cubierto desde 0001;
`runs-server.ts` filtra carreras por usuario/fecha, cubierto desde 0049.
`workout_sets` tiene `(user_id, exercise)` desde 0001 y `(workout_id)` desde
0014: cubren historial y las búsquedas del resumen, reintentos, temporadas y
relaciones de Progreso. No se justifica otro índice sin planes medidos; no se
agregan índices, migraciones ni tablas, ni se cambia RLS. Si las mediciones
justifican un índice futuro, 0062 ya está ocupado: verifica los siguientes
números libres contra las ramas pendientes antes de asignar uno.

Sin acceso a métricas remotas no se afirma haber medido consultas lentas.
Durante la corrida revisa Query Performance de Supabase y registra p95, errores,
CPU, conexiones y las consultas de mayor tiempo total antes/después del índice.
En el SQL Editor del proyecto sintético, usa un ID sintético en:

```sql
explain (analyze, buffers)
select exercise, kg, reps from public.workout_sets
where workout_id = '00000000-0000-4000-8000-000000000001';
```

Sustituye el UUID por un entreno existente y ejecuta con la sesión/rol autenticado
para medir también RLS. Usa suficientes filas sintéticas y `ANALYZE` antes de
comparar. En tablas pequeñas un sequential scan puede ser correcto. No agregues
índices especulativos: registra plan y tiempos antes de proponer otra migración,
siempre un índice por migración y una prueba SQL propia.
