# Portadas de Reels

7 portadas de 1080 x 1920: las de los 3 Reels de anuncios ya publicados y las de R01 a R04 del kit de noviembre (`marketing/kit-reels-noviembre-2026.md`). Estado: **borrador para revisión de marca. No publicar sin la aprobación por escrito de Andrés.**

| Portada | Archivo | Fondo | Gancho | Origen del gancho |
| --- | --- | --- | --- | --- |
| Anuncio "Cuánto peso" | anuncio_cuanto-peso.png | paper + Coach Banana | ¿No sabes cuánto peso usar? | Propuesta, igual a la portada del carrusel K13. **Confirmar** |
| Anuncio "El Nuevo" | anuncio_el-nuevo.png | banana | POV: tu primer día en el gym | Propuesta, del V02 "POV: tu primer día en el gym (versión monos)". **Confirmar** |
| Anuncio "Gym del condominio" | anuncio_gym-condominio.png | ink | Tu edificio tiene gym. Te falta el plan. | Propuesta, del texto de condominios de `estrategia/meta-ads-noviembre.md`. **Confirmar** |
| R01 | R01_cuanto-peso.png | banana | Cuando no sabes cuánto peso usar | Kit de noviembre, palabra por palabra |
| R02 | R02_musculo-glp1.png | ink | Bajaste rápido… ¿y tu músculo? | Kit de noviembre, palabra por palabra. Lleva "No sustituye la indicación de tu médico." |
| R03 | R03_condominio-gym.png | paper + Coach Banana | Tu condominio tiene gym. ¿Y tu plan? | Kit de noviembre, palabra por palabra |
| R04 | R04_temporada-1.png | banana | La Temporada 1 empieza el 9 de noviembre | Kit de noviembre, palabra por palabra |

Ninguna portada lleva texto [PENDIENTE]: el kit de noviembre ya está en main y trae el gancho de R01.

## Qué hay en la carpeta

| Ruta | Qué es |
| --- | --- |
| `<id>.png` | La portada de 1080 x 1920 para subir con el Reel |
| `recorte/<id>_recorte.png` | Vista del recorte centrado de 1080 x 1350 (de y = 285 a y = 1635), como se ve en el grid |
| `fuentes/<id>.svg` | Fuente editable. Texto vivo en Plus Jakarta Sans; el personaje es un enlace a `marketing/instagram/recursos/` |
| `vista-grid.png` | Los 7 recortes en filas de 3, como quedarían en el perfil (R04 arriba a la izquierda) |
| `generar.mjs` | El generador: ganchos, colores y diseño de las 7 |

## Cómo se comprueba la lectura en el recorte

`generar.mjs` mide cada línea de texto con la fuente real y **falla** si alguna se sale de la franja segura: dentro del recorte de 1080 x 1350 y, además, dentro de la zona segura del Reel (250 px arriba, 350 px abajo), es decir de y = 325 a y = 1570 y entre los márgenes de 96 px. Como el grid de Instagram en 3:4 (1080 x 1440) es más alto que 1080 x 1350, las portadas también se leen completas ahí.

## Reglas que cumplen

- Solo paper, banana, ink, cream y banana-ink; solo Plus Jakarta Sans 500, 700 y 800.
- Sin logo (la portada es el segundo 0 del Reel), sin emojis, sin rayas largas, sin IA, sin contadores ni escasez.
- Coach Banana es el recurso oficial (`recursos/coach-banana-oficial.png`, copia PNG de `public/brand/mascota-sola.webp`), sin retoques. Sale en 2 de las 7 portadas para no repetirlo en todo el grid.
- Los iconos (mancuerna, báscula, edificio, mochila, calendario) son de línea, con el mismo trazo que el calendario de la portada de R04.

## Lo que falta de Andrés

1. **Confirmar los ganchos de los 3 Reels de anuncios.** Su texto en pantalla no está en el repositorio. Si alguno no coincide con el segundo 0 de su Reel, pásame el texto y se cambia en `PORTADAS` de `generar.mjs`.
2. **El Nuevo en PNG con fondo transparente** (sacado del V02), guardado en `marketing/instagram/recursos/el-nuevo.png`. Mientras no esté, su portada va con el icono de la mochila; con el archivo, el generador lo pone solo. No se redibuja.
3. **Qué portada usar para R04.** `marketing/videos/R04_temporada-1/R04_temporada-1_portada.png` ya existe (el mismo gancho, sin eyebrow). Esta versión es igual pero con la etiqueta "Temporada 1" para que el grid se vea como una serie. Mi apuesta: esta.

## Variantes A/B

Para las 2 portadas que van a Meta Ads (R02 y R03 el 5 de noviembre):

| Reel | A (entregada) | B | C |
| --- | --- | --- | --- |
| R02 | Fondo ink, "músculo?" en banana | Fondo banana, "músculo?" en bloque ink | Fondo paper con Coach Banana |
| R03 | Fondo paper con Coach Banana | Fondo banana con el icono del edificio | Fondo ink, "¿Y tu plan?" en banana |

Mi apuesta: **A en las dos**. R02 en ink es la única oscura de la semana del 2 al 8 y destaca en el grid entre R01 (banana) y R03 (paper); R03 con Coach Banana es la cara de la marca justo cuando se habla del gym del edificio. Cada variante se hace cambiando `tema` o `personaje` en `generar.mjs`.

## Volver a generar

```
cd marketing/instagram
npm install
npm run portadas
```
