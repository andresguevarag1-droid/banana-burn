# R02 "Bajaste rápido… ¿y tu músculo?"

Reel para quienes bajaron de peso rápido (público GLP-1, issue #14), hecho en código. Sin audio: el audio en tendencia se pone al publicar. **Nada de esto se publica sin la aprobación por escrito de Andrés.**

| Archivo | Qué es |
| --- | --- |
| R02_musculo-glp1.mp4 | Reel de 22 s |
| R02_musculo-glp1_15s.mp4 | Versión de 15 s para anuncios |
| R02_musculo-glp1_portada.png | Portada 1080 x 1920, legible si se recorta a 1080 x 1350 |
| proyecto/ | Proyecto editable: `escenas.mjs` (textos y tiempos), `render.mjs` (dibujo y exportación), `verificar.mjs` (reglas) |

Specs: 1080 x 1920, 30 fps, H.264 (yuv420p), sin audio. Zona segura de 250 px arriba y 350 px abajo: todo el texto, la captura y el botón viven entre y = 250 y y = 1570. Fuente Plus Jakarta Sans (la de `src/app/og/`), colores de `src/app/globals.css`.

Cambio del 2 nov 2026 (#215): se quitaron los gramos por kilo y la frecuencia exacta de fuerza de la pantalla y del pie de foto; los dos MP4 están renderizados de nuevo.

## Versión 2 (11 nov 2026, pedido de Andrés)

Mismo gancho y nueva historia: primero la app te ayuda a entrenar poco y constante, después cómo lo hace (capturas reales), la fuerza para reconstruir el cuerpo, la nutrición y al final el plan completo con Banana Shield. Coach Banana aparece en casi todas las escenas: entra con rebote, aterriza, respira, se balancea y señala lo que importa (pose oficial «señala» de E03). Más ritmo: golpes de texto con rebote, sacudida de cámara en el gancho y en «reconstruir», franjas y rayos en movimiento, cortinillas diagonales entre escenas (el aviso médico nunca se tapa).

## Guion con tiempos (22 s)

| Tiempo | Pantalla | Texto en pantalla |
| --- | --- | --- |
| 0.0 a 2.0 | Fondo banana con franjas, golpe de cámara; Coach Banana sube desde abajo | Bajaste rápido… ¿y tu músculo? |
| 2.0 a 4.0 | Fondo ink | Bajar rápido también se lleva músculo. |
| 4.0 a 6.0 | Tarjeta real «Tu primer entreno» (hasta «Empezar en casa · unos 12 min»); Coach señala | Entrena poco, pero constante. |
| 6.0 a 8.5 | Teléfono que cambia de pantalla con cada línea: peso sugerido, cómo se hace, descanso | Qué hacer, con cuánto peso y cuándo descansar. |
| 8.5 a 10.5 | Fondo ink, mancuernas que caen, Coach sube | Fuerza para reconstruir tu cuerpo. |
| 10.5 a 12.5 | Captura real de Nutrición; Coach señala | Y no olvida tu nutrición. |
| 12.5 a 14.5 | Zoom a «Te quedan» de la misma captura | Y cuánto te falta hoy. |
| 14.5 a 16.5 | Coach detrás del escudo que aparece con destello | Plan completo con Banana Shield si bajas rápido. |
| 16.5 a 19.0 | Fondo ink, escudo y tarjeta cream (2.5 s) | No sustituye la indicación de tu médico. |
| 19.0 a 22.0 | Cierre: rayos, Coach «señala» el botón que late, logo | Empieza 7 días gratis en bananaburn.app |

## Versión de 15 s (anuncios)

| Tiempo | Pantalla |
| --- | --- |
| 0.0 a 2.0 | Gancho |
| 2.0 a 3.5 | Entrena poco, pero constante. |
| 3.5 a 6.0 | Qué hacer, con cuánto peso y cuándo descansar. |
| 6.0 a 8.0 | Y no olvida tu nutrición. |
| 8.0 a 9.5 | Plan completo con Banana Shield si bajas rápido. |
| 9.5 a 12.0 | No sustituye la indicación de tu médico. (2.5 s) |
| 12.0 a 15.0 | Cierre |

En pantalla no se nombra GLP-1 ni ningún medicamento (regla de R02 y reglas de Meta sobre atributos de salud). El público GLP-1 se nombra en el texto del anuncio, con el aviso médico.

## Reglas que cumple

- No nombra ningún medicamento, ni dice "GLP-1", "¿usas GLP-1?" ni "tu tratamiento" en pantalla.
- Sin gramos por kilo ni frecuencias exactas (#215): la meta de proteína y de entreno la acuerda cada persona con su médico. El único número en pantalla son los 7 días del cierre estándar. La captura de Nutrición es la real de `public/landing/nutricion.png`, sin tocar: sus cifras son las de la app.
- Banana Shield aparece como el plan completo para quien baja rápido, sin prometer resultados.
- Los 12 min se ven en la tarjeta real de Hoy («Empezar en casa · unos 12 min»), recortada antes del botón de gym («unos 15 min»): siempre 12 min.
- Sin emojis, sin guiones largos, sin exclamaciones, sin IA, sin testimonios ni antes/después.

## Cómo editar y volver a renderizar

```bash
cd marketing/videos/R02_musculo-glp1/proyecto
npm install
npm run render      # portada y los 2 MP4 en la carpeta de arriba (unos 30 s)
npm run verificar   # palabras por pantalla, números, textos prohibidos, tiempos, aviso, specs del MP4
node render.mjs cuadro R02_musculo-glp1 9.5   # un cuadro suelto en PNG para revisar
```

Los textos y tiempos están en `escenas.mjs`; el dibujo de cada escena en `DIBUJO` dentro de `render.mjs`. `@ffmpeg-installer/ffmpeg` trae un ffmpeg con libx264; para usar otro, `FFMPEG=/ruta/ffmpeg npm run render`.

## Pendiente

- **Video base 1 + 4 del kit** (gym y comida). Este corte es solo de motion graphics y captura; si se quiere el video de fondo, se agrega como capa en `render.mjs`.

## Pie de foto sugerido

Bajaste rápido… ¿y tu músculo? Banana Burn te ayuda a entrenar poco y constante: te dice qué hacer, con cuánto peso y cuándo descansar. Y no olvida tu nutrición: si bajas rápido, Banana Shield arma tu plan completo. Tu primer entreno dura 12 min, también en casa: 7 días gratis en bananaburn.app. No sustituye la indicación de tu médico.

#BananaBurn #Recomposicion #Fuerza #Proteina #MasaMuscular
