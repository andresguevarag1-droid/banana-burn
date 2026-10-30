# R02 "Bajaste rápido… ¿y tu músculo?"

Reel para quienes bajaron de peso rápido (público GLP-1, issue #14), hecho en código. Sin audio: el audio en tendencia se pone al publicar. **Nada de esto se publica sin la aprobación por escrito de Andrés.**

| Archivo | Qué es |
| --- | --- |
| R02_musculo-glp1.mp4 | Reel de 24 s |
| R02_musculo-glp1_15s.mp4 | Versión de 15 s para anuncios |
| R02_musculo-glp1_portada.png | Portada 1080 x 1920, legible si se recorta a 1080 x 1350 |
| proyecto/ | Proyecto editable: `escenas.mjs` (textos y tiempos), `render.mjs` (dibujo y exportación), `verificar.mjs` (reglas) |

Specs: 1080 x 1920, 30 fps, H.264 (yuv420p), sin audio. Zona segura de 250 px arriba y 350 px abajo: todo el texto, la captura y el botón viven entre y = 250 y y = 1570. Fuente Plus Jakarta Sans (la de `src/app/og/`), colores de `src/app/globals.css`.

## Guion con tiempos (24 s)

| Tiempo | Pantalla | Texto en pantalla | Palabras |
| --- | --- | --- | --- |
| 0.0 a 2.0 | Fondo banana. Gancho completo desde el cuadro 0, acercamiento lento | Bajaste rápido… ¿y tu músculo? | 4 |
| 2.0 a 4.0 | Fondo ink, "músculo." grande en banana | Bajar rápido también se lleva músculo. | 6 |
| 4.0 a 6.0 | Fondo paper, cifra con resaltado banana | Proteína de 1.2 a 1.6 g por kg | 8 |
| 6.0 a 8.0 | Captura real de Nutrición en marco de teléfono ink (radio 42), sube desde abajo | Tu meta de proteína, cada día. | 6 |
| 8.0 a 10.0 | Zoom a la tarjeta "Te quedan" de la misma captura; anillo banana sobre la sugerencia de proteína | Y cuánto te falta hoy. | 5 |
| 10.0 a 12.0 | Fondo ink, "3" gigante en banana | Fuerza al menos 3 veces por semana | 7 |
| 12.0 a 14.0 | Fondo banana, mancuerna que gira | El músculo se cuida entrenando. | 5 |
| 14.0 a 16.0 | Fondo paper, escudo banana | Banana Shield lo arma por ti. | 6 |
| 16.0 a 18.5 | Tres tarjetas que entran en cascada | Más proteína / Fuerza primero / Modo suave | 6 |
| 18.5 a 21.0 | Fondo ink, escudo y tarjeta cream con el aviso (2.5 s) | No sustituye la indicación de tu médico. | 7 |
| 21.0 a 24.0 | Cierre: Coach Banana, botón ink y logo | Empieza 7 días gratis en bananaburn.app + BananaBurn | 7 |

## Versión de 15 s

| Tiempo | Pantalla |
| --- | --- |
| 0.0 a 2.0 | Gancho |
| 2.0 a 4.0 | Proteína de 1.2 a 1.6 g por kg |
| 4.0 a 6.0 | Captura real de Nutrición |
| 6.0 a 8.0 | Fuerza al menos 3 veces por semana |
| 8.0 a 9.5 | Banana Shield lo arma por ti. |
| 9.5 a 12.0 | No sustituye la indicación de tu médico. (2.5 s) |
| 12.0 a 15.0 | Cierre |

## Reglas que cumple

- No nombra ningún medicamento, ni dice "GLP-1", "¿usas GLP-1?" ni "tu tratamiento" en pantalla.
- Números en el texto: solo los del issue (1.2, 1.6 y 3) y los 7 días del cierre estándar. La captura de Nutrición es la real de `public/landing/nutricion.png`, sin tocar: sus cifras son las de la app.
- Banana Shield se describe con lo que dice la app (más proteína, fuerza primero, modo suave), sin prometer resultados.
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

- **Pose "señala" de Coach Banana.** El cierre estándar la pide, pero aquí no se pudo descargar (el kit no está en main). El cierre usa la pose de pie de `public/brand/mascota-sola.webp`. Al llegar el PNG con fondo transparente, se cambia la ruta de `COACH` en `render.mjs` y se vuelve a renderizar.
- **Video base 1 + 4 del kit** (gym y comida). Este corte es solo de motion graphics y captura; si se quiere el video de fondo, se agrega como capa en `render.mjs`.

## Pie de foto sugerido

Bajaste rápido… ¿y tu músculo? Proteína de 1.2 a 1.6 g por kg y fuerza al menos 3 veces por semana. Banana Shield te lo arma en tu plan. Empieza 7 días gratis en bananaburn.app. No sustituye la indicación de tu médico.

#BananaBurn #Recomposicion #Fuerza #Proteina #MasaMuscular
