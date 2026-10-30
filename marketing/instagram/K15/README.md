# K15: "Tu primer 5K con Banana Run" (carrusel, running)

Propuesta para el issue #11. Nada de esto está publicado: Andrés aprueba y publica.

| Lámina | Archivo | Qué dice |
| --- | --- | --- |
| 1 | `png/01-portada.png` | Portada: "Tu primer 5K, semana a semana", con Coach Banana en ropa de correr |
| 2 | `png/02-semanas.png` | Las semanas del plan, con la captura real "Km por semana del plan" (`running-plan`) |
| 3 | `png/03-ritmos-gps.png` | Ritmo por km con GPS en todos los planes, con la captura real de Banana Run (`running-hub`) |
| 4 | `png/04-fuerza.png` | Fuerza 2 veces por semana. **[PENDIENTE]**: falta la captura real (ver abajo) |
| 5 | `png/05-cta.png` | CTA a bananaburn.app/running, con el precio de la Temporada Running |

`caption.txt` es el pie de foto final. `vista-carrusel.png` muestra las 5 láminas en fila.

## Lo que verifiqué en el código antes de decirlo

- **GPS en todos los planes: sí.** `src/lib/plans.ts` y `src/lib/plan-access.ts` no hablan del GPS. La regla está en otro lado: el registro con GPS (`RunTracker` en `/app/correr`) se ve sin la temporada, y guardar una carrera solo pide el plan o la prueba gratis (`src/app/api/carreras/route.ts`, error "Necesitas tu plan o la prueba gratis para guardar carreras"). La FAQ de `/running` lo dice igual: "El GPS, tu historial y tus km de la semana vienen en todos los planes."
- **El plan, los ritmos de entrenamiento y la fuerza no vienen en el plan base**: son de la Temporada Running ($14.99, pago único, incluida en el plan anual; `src/lib/running-server.ts`, `SEASON_PRICE_MINOR`). Por eso las láminas 2 y 4 llevan la etiqueta "Temporada Running" y la 5 da el precio.
- **Fuerza**: el cuestionario de la temporada deja elegir 2, 3 o 4 sesiones de 30, 45 o 60 minutos (`src/lib/seasons.ts`), y `planWeek` nunca pone piernas pesadas el día de un día clave ni el anterior (probado en `seasons.test.ts` y `season-plan.test.ts`).
- **Semanas**: el plan sube el volumen con semanas de descarga y afina 7 días antes de un 5K (`taperDays` en `src/lib/run-plan.ts`).
- Temporada 1: del 9 de noviembre de 2026 al 3 de enero de 2027 (`T1_START` + 8 semanas).

No promete tiempos ni resultados: ninguna lámina ni el pie de foto dicen en cuánto tiempo corres un 5K ni a qué ritmo.

## Capturas: por qué no usé `running-ritmos`

Las capturas de running del repo son de una persona de ejemplo con meta de medio maratón ("Mi primer 21K", meta 1:55:00). La tabla de `running-ritmos` muestra esa meta y su tiempo por km, así que en un carrusel de 5K se leería como una promesa de tiempo. De `running-plan` usé solo la tarjeta "Km por semana del plan" (sin cifras de ritmo) y la rotulé "Plan de ejemplo". Para el ritmo por km usé `running-hub`, que dice cómo mide el GPS. No cambié ningún número; solo recorté.

## A/B de la portada

| Variante | Archivo | Título |
| --- | --- | --- |
| **A (la apuesta)** | `png/01-portada.png` | Tu primer 5K, semana a semana |
| B | `variante-b/01-portada.png` | De 0 a tu primer 5K |

Apuesto por **A**. "De 0" promete más de lo que hace el plan hoy: arma semanas para quien ya trota (nivel "empezando"), pero no tiene una fase de caminar y trotar para quien nunca ha corrido. A dice lo que de verdad entrega. Si la app suma esa fase, B es el gancho más fuerte y se cambia en una línea.

## Fuente editable

`generar.mjs` dibuja las láminas en código, escribe el SVG (`svg/`) y el PNG final (`png/`). Usa las fuentes de `src/app/og`, el icono `src/app/icon.svg`, `public/brand/mascota-sola.webp` y las capturas de `public/landing`. Desde la raíz del repo:

```
npm i --no-save --prefix /tmp/resvg @resvg/resvg-js@2 sharp@0.33
RESVG_DIR=/tmp/resvg node marketing/instagram/K15/generar.mjs
```

`sharp` solo decodifica las capturas WebP, que resvg no abre. Los SVG llevan las imágenes incrustadas.

## Lo que falta de parte de Andrés

1. **Captura real de una sesión de fuerza de la Temporada Running** (pantalla del entreno con los ejercicios), para reemplazar el [PENDIENTE] de la lámina 4. Con una cuenta que tenga la temporada basta una captura vertical como las de `public/landing`.
2. Si quieres la tabla de ritmos en el carrusel: una captura de `running-ritmos` y `running-plan` hecha con una meta de **5K** (mejor sin meta de tiempo, o con "Terminar mi primera carrera"), para que coincida con el tema.
3. Elegir la portada A o B (o decir "la apuesta").
4. Fecha y hora de publicación: el calendario de noviembre aún no tiene a K15; propongo la semana del 9 al 15 nov, cuando abre la Temporada 1.
