# Novedades: cómo contar cada actualización

Cada vez que sale una versión con cambios que la persona nota, Banana Burn le muestra **"Lo nuevo en Banana Burn"** al entrar a Hoy: todo lo que cambió desde su última visita (si se perdió varias versiones, las ve juntas, la más nueva arriba), filtrado por su plan, con el beneficio de cada cambio y un enlace para probarlo. El historial completo queda en `/app/novedades`.

## Para cada versión con cambios visibles

1. Abre `src/lib/novedades.ts` y agrega una entrada **arriba** de `NOVEDADES`:

   ```ts
   {
     id: "2026-11-05-menu-flash",          // fecha del deploy + tema. Único y para siempre: nunca lo cambies.
     date: "2026-11-05",
     title: "Menú flash más rápido",
     intro: "Una o dos frases: qué trae esta versión para ti.",
     items: [
       {
         title: "Qué cambió, en pocas palabras",
         benefit: "Cómo mejora TU experiencia, concreto: qué puedes hacer ahora, cuánto tiempo te ahorra, qué ya no tienes que hacer.",
         icon: "bowl",                     // nombre de BrandIcon (src/components/icons/named.tsx)
         href: "/app/nutricion",           // dónde se prueba (ruta real de la app)
         cta: "Probar",                    // opcional
         audience: "completo",             // opcional: todos | entreno | completo | con-programa | staff
         image: { reto: "agua-21" },       // opcional: portada de reto, { nivel: 1-8 } o { src: "/brand/..." }
       },
     ],
   },
   ```

2. Escribe para la persona, no para el equipo:
   - **Beneficio, no función.** "Hidratado se marca solo cuando registras tu agua" es mejor que "Integración de retos con daily_logs".
   - **Solo lo que existe.** Revisa en el código que cada frase sea verdad para quien la lee. Si algo depende del plan, usa `audience` (Banana Shield y la nutrición del programa son de Entreno + Nutrición; para Entreno, cuéntalo como lo que trae ese plan).
   - **Casa:** español neutro de Latinoamérica, de tú, "banana" (no "banano"), números es-419, sin emojis, sin rayas largas, sin cadenas con "·" y nunca "IA" ni "inteligencia artificial".
   - Arreglos internos, refactors y cambios del panel que la persona no nota no van (para el equipo, usa `audience: "staff"`).

3. Corre `npx vitest run src/lib/novedades.test.ts`. Revisa ids únicos, orden por fecha, beneficio en cada item, rutas que existen, íconos e imágenes válidos y las reglas de texto.

4. Mira el diálogo en demo: `/app?novedades=1` (solo en modo demo; no marca nada como visto).

## Cómo decide la app

| Regla | Dónde |
|---|---|
| Se abre solo en Hoy, una vez por versión, después de 0,9 s | `src/components/novedades/news-dialog.tsx` |
| Persona nueva: lo publicado antes de crear su cuenta no es novedad; esa visita es de la guía | `unseenReleases` en `src/lib/novedades.ts` |
| Nunca en la misma visita que la guía, un regalo, la bienvenida de tester u otro diálogo abierto; nunca con el muro de planes | `NewsLauncher` |
| Se marca como visto al abrirse (servidor: `profiles.news_seen`, 0036; demo o sin 0036: este dispositivo) | `rememberSeen`, `src/app/actions/novedades.ts` |
| Punto "Nuevo" en Más y en el menú lateral mientras haya versiones sin ver | `useNewsDot` |
| Aviso "Hay novedades en Banana Burn" (push y campanita) una vez por versión, entre el día 3 y el 14, a quien no la vio; respeta el push apagado y las horas de silencio | `nudgeUnseenNews` en `src/lib/novedades-server.ts`, cron diario |

La base solo guarda el id de la última versión vista y la hora del servidor (`news_seen`, `news_seen_at`). Cada persona marca solo la suya (`news_mark_seen`, `auth.uid()`), y nunca baja a una versión de una fecha anterior.
