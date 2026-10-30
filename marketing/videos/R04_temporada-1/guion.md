# R04: La Temporada 1 empieza el 9 de noviembre

Reel de motion graphics hecho en código. Temas: temporadas y running. Sin música ni voz: el audio en tendencia se pone al publicar.

| Archivo | Qué es |
| --- | --- |
| R04_temporada-1.mp4 | Reel de 21 s, 1080 x 1920, 30 fps, H.264, sin audio |
| R04_temporada-1_15s.mp4 | Versión de 15 s para anuncios, mismas especificaciones |
| R04_temporada-1_portada.png | Portada de 1080 x 1920 (el gancho; se puede recortar a 1080 x 1350, entre y = 285 y y = 1635) |
| R04_temporada-1_hoja-revision.png | Un cuadro por escena con la zona segura (rojo) y el recorte de la portada (verde) marcados. Es para revisar, no se publica |
| proyecto/ | Editable: `escenas.mjs` (guion, textos, tiempos y precios) y `render.mjs` (dibujo y render) |

## Datos en pantalla

Las fechas y los precios salen del issue #13 y coinciden con el código:

| Dato | En el Reel | En el código |
| --- | --- | --- |
| Inicio | 9 de noviembre | `src/lib/seasons.test.ts`: `startsOn` 2026-11-09 |
| Inscripciones | hasta el 22 nov | `seasons.ts`: `enrollUntil` = inicio + 13 días = 2026-11-22 |
| Running | $14.99 | `SEASON_PRICE_MINOR.running` = 1499 |
| Raquetas | $16.99 | `SEASON_PRICE_MINOR.raquetas` = 1699 |
| Cross Training | $18.99 | `SEASON_PRICE_MINOR.cross` = 1899 |
| Plan anual | incluye 1 temporada gratis | `plans.ts`: `ANNUAL_SEASON_NOTE` "Incluye 1 temporada deportiva gratis" |

`src/lib/plans.ts` y `src/lib/offer.ts` no tienen los precios de las temporadas (solo los de los planes y la nota del plan anual). Los precios están en `src/lib/seasons.ts`.

Capturas reales de la app, sin cambiar ningún número: `public/landing/temporadas.webp` y `public/landing/running-hub.webp`, en un marco de teléfono ink de radio 42. Solo se recortan, se acercan y se marca la fecha con un borde banana por encima.

## Reel de 21 s (R04_temporada-1.mp4)

| Tiempo | Pantalla | Texto en pantalla | Palabras |
| --- | --- | --- | --- |
| 0.0 a 2.0 | Fondo banana. Calendario ink, gancho grande; "9 de noviembre" en un bloque ink con letra banana. Completo desde el cuadro 0, con un acercamiento lento del 3 % | La Temporada 1 empieza el 9 de noviembre | 8 |
| 2.0 a 4.0 | Fondo paper. El teléfono con la captura de Temporadas sube desde abajo y se desplaza despacio | Running, Raquetas o Cross Training | 5 |
| 4.0 a 6.0 | Acercamiento a la línea "Temporada 1: del 9 de noviembre al 3 de enero" de la captura, con un borde banana alrededor | 8 semanas con fechas oficiales | 5 |
| 6.0 a 8.0 | Teléfono con la captura de Running (Banana Run) | Tu ritmo por kilómetro, con GPS | 6 |
| 8.0 a 10.0 | Tarjeta ink: Running $14.99 | Precios / Running $14.99 | 3 |
| 10.0 a 12.0 | Running pasa a tarjeta blanca; entra Raquetas $16.99 en ink | Precios / Running $14.99 / Raquetas $16.99 | 5 |
| 12.0 a 14.0 | Entra Cross Training $18.99 en ink | Precios / Running $14.99 / Raquetas $16.99 / Cross Training $18.99 | 8 |
| 14.0 a 16.0 | Fondo ink. Calendario banana y fecha grande | Inscripciones hasta el 22 nov | 5 |
| 16.0 a 18.0 | Fondo banana. Bloque ink con letra banana | El plan anual incluye 1 temporada gratis | 7 |
| 18.0 a 21.0 | Cierre de 3 s, fondo paper. Coach Banana entra (0.0 s), el botón ink entra (0.4 s), el logo entra (0.9 s) y el botón cede a scale(.97) como al tocarlo (1.6 s) | Empieza 7 días gratis en bananaburn.app / BananaBurn | 7 |

## Versión de 15 s para anuncios (R04_temporada-1_15s.mp4)

El mismo mensaje con un cambio cada 1.5 s. Se quita el acercamiento a la fecha, porque el gancho ya la dice.

| Tiempo | Pantalla | Palabras |
| --- | --- | --- |
| 0.0 a 1.5 | Gancho: La Temporada 1 empieza el 9 de noviembre | 8 |
| 1.5 a 3.0 | Captura de Temporadas: Running, Raquetas o Cross Training | 5 |
| 3.0 a 4.5 | Captura de Running: Tu ritmo por kilómetro, con GPS | 6 |
| 4.5 a 6.0 | Precios: Running $14.99 | 3 |
| 6.0 a 7.5 | + Raquetas $16.99 | 5 |
| 7.5 a 9.0 | + Cross Training $18.99 | 8 |
| 9.0 a 10.5 | Inscripciones hasta el 22 nov | 5 |
| 10.5 a 12.0 | El plan anual incluye 1 temporada gratis | 7 |
| 12.0 a 15.0 | Cierre: Coach Banana + Empieza 7 días gratis en bananaburn.app + logo | 7 |

## Revisión

- Gancho completo en el cuadro 0, sin logo al inicio.
- Ninguna pantalla pasa de 8 palabras: `render.mjs` cuenta el texto de cada escena, falla si alguna pasa de 8 y falla si se dibuja un texto que la escena no declaró. Las capturas de la app no cuentan: son la prueba, no texto agregado.
- Cambio visual cada 2 s (Reel) o cada 1.5 s (anuncio), y el render falla si una escena dura menos de 1.5 s o más de 2.5 s. El cierre dura 3 s.
- Todo el texto y las capturas están entre y = 250 y y = 1570 (zona segura de 250 px arriba y 350 px abajo).
- Solo la paleta de la marca (banana, ink, paper, cream, line, banana-ink, ember-ink) y Plus Jakarta Sans 600 y 800. Movimiento: ease-out cubic-bezier(0.23, 1, 0.32, 1), entradas de 300 ms, nada aparece desde scale(0).
- Sin emojis, sin IA, sin contadores ni escasez, sin testimonios.

## Pie de foto propuesto

Pendiente de aprobación por escrito de Andrés, igual que el video:

> La Temporada 1 empieza el 9 de noviembre: 8 semanas de Running, Raquetas o Cross Training con fechas oficiales. Inscripciones hasta el 22 de noviembre. Empieza 7 días gratis en bananaburn.app
>
> #BananaBurn #Running #Padel #CrossTraining #EntrenamientoDeFuerza

## Pendiente

- **Pose de Coach Banana señalando.** El cierre usa la pose de pie de `public/brand/mascota-sola.webp`, porque la pose "señala" (Higgsfield, `COACH_POSE.senala` en `src/lib/aprende.ts`) vive en un CDN al que no se llegó al hacer el render. Para cambiarla: guarda el PNG con fondo transparente en `assets/coach-banana-senala.png` y vuelve a hacer el render; el cierre la usa sola.
- La captura de Running es la de Banana Run (`running-hub.webp`), que está en todos los planes. Si se prefiere una pantalla de la temporada de Running por dentro, hace falta esa captura.

## Cómo volver a hacer el render

```bash
cd marketing/videos/R04_temporada-1/proyecto
npm install
chmod +x node_modules/@ffmpeg-installer/*/ffmpeg   # si npm no corrió el postinstall del binario
npm run render        # los dos MP4, la portada y la hoja de revisión
```

Textos, tiempos y precios se cambian en `escenas.mjs`; el dibujo de cada pantalla está en `render.mjs`. Para usar otro ffmpeg, pon su ruta en la variable `FFMPEG`.
