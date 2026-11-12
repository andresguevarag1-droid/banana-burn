# R02 "Bajaste rápido… ¿y tu músculo?"

Reel para quienes bajaron de peso rápido (público GLP-1, issue #14), hecho en código. Sin audio: el audio en tendencia se pone al publicar. **Nada de esto se publica sin la aprobación por escrito de Andrés.**

| Archivo | Qué es |
| --- | --- |
| R02_musculo-glp1.mp4 | Reel de 35 s, con voz |
| R02_musculo-glp1_anuncio.mp4 | Versión de 19 s para el anuncio, con voz |
| audio/voz-reel.mp3, audio/voz-anuncio.mp3 | Voz de Higgsfield (voz Julian, ElevenLabs v4) con el guion de Andrés del 11 nov |
| R02_musculo-glp1_portada.png | Portada 1080 x 1920, legible si se recorta a 1080 x 1350 |
| proyecto/ | Proyecto editable: `escenas.mjs` (textos y tiempos), `render.mjs` (dibujo y exportación), `verificar.mjs` (reglas) |

Specs: 1080 x 1920, 30 fps, H.264 (yuv420p), sin audio. Zona segura de 250 px arriba y 350 px abajo: todo el texto, la captura y el botón viven entre y = 250 y y = 1570. Fuente Plus Jakarta Sans (la de `src/app/og/`), colores de `src/app/globals.css`.

Cambio del 2 nov 2026 (#215): se quitaron los gramos por kilo y la frecuencia exacta de fuerza de la pantalla y del pie de foto; los dos MP4 están renderizados de nuevo.

## Versión 3 (11 nov 2026): con voz

Guion de Andrés, con tres ajustes para cumplir las reglas de Meta y de la oficina: «la app que no tienes que descargar» (no «la primera»), «cuida tu músculo mientras bajas» (no «así bajas más rápido») y «cada entreno te ayuda a reconstruir tu cuerpo»; más el aviso médico. La voz suena de corrido desde el cuadro 0 y las escenas siguen sus tiempos: cada frase de la voz es un cambio visual (los `pasos` de `escenas.mjs`). Un whoosh suave marca cada cambio de escena. La música no va en el archivo: se agrega al publicar, desde la biblioteca de Meta.

Coach Banana aparece en casi todas las escenas: entra con rebote, aterriza, respira, se balancea y señala lo que importa (pose oficial «señala» de E03). Más ritmo: golpes de texto con rebote, sacudidas de cámara, franjas y rayos en movimiento, cortinillas diagonales entre escenas (el aviso médico nunca se tapa).

## Reel (35 s)

| Tiempo | Voz | Pantalla |
| --- | --- | --- |
| 0.0 a 3.3 | Bajaste rápido… pero, ¿y tu músculo? | Gancho completo desde el cuadro 0; golpe en «¿y tu músculo?» |
| 3.3 a 6.0 | Bajar rápido también se lleva el músculo. | Fondo ink, «el músculo.» de golpe |
| 6.0 a 10.3 | Así que empieza a entrenar poco, pero de manera constante, con Banana Burn: | Una línea por frase y la tarjeta real «Tu primer entreno» (hasta «unos 12 min») |
| 10.3 a 13.0 | la app que no tienes que descargar para usarla. | Barra de dirección que escribe bananaburn.app |
| 13.0 a 16.7 | Te indica qué hacer, con cuánto peso y cuánto descansar. | Capturas reales: ejercicio, peso sugerido marcado, descanso |
| 16.7 a 19.5 | Cada entreno te ayuda a reconstruir tu cuerpo. | Fondo ink, mancuernas, «a reconstruir» de golpe |
| 19.5 a 21.5 | Y además te ayudamos con tu nutrición: | Captura real de Nutrición |
| 21.5 a 24.9 | sabemos cuánta proteína te falta hoy para llegar a tu meta. | Zoom a «Te quedan» y anillo |
| 24.9 a 27.1 | Obtén el plan completo con Banana Shield | Coach detrás del escudo |
| 27.1 a 29.3 | y cuida tu músculo mientras bajas. | Coach al centro con su escudo |
| 29.3 a 31.9 | No sustituye la indicación de tu médico. | Aviso (2.6 s) |
| 31.9 a 35.1 | Empieza siete días gratis en bananaburn punto app. | Cierre |

## Anuncio (19 s)

| Tiempo | Voz |
| --- | --- |
| 0.0 a 3.3 | Bajaste rápido… pero, ¿y tu músculo? |
| 3.3 a 6.5 | Entrena poco, pero constante, con Banana Burn. |
| 6.5 a 10.0 | Te dice qué hacer, con cuánto peso y cuánto descansar. |
| 10.0 a 13.6 | Y para tu nutrición, el plan completo: Banana Shield. |
| 13.6 a 16.1 | No sustituye la indicación de tu médico. |
| 16.1 a 19.2 | Empieza siete días gratis en bananaburn punto app. |

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
npm run render      # portada, los 2 MP4 y la voz (render.mjs y después audio.mjs)
npm run verificar   # palabras por pantalla, números, textos prohibidos, tiempos, aviso, specs del MP4
node render.mjs cuadro R02_musculo-glp1 9.5   # un cuadro suelto en PNG para revisar
```

Los textos y tiempos están en `escenas.mjs`; el dibujo de cada escena en `DIBUJO` dentro de `render.mjs`. `@ffmpeg-installer/ffmpeg` trae un ffmpeg con libx264; para usar otro, `FFMPEG=/ruta/ffmpeg npm run render`.

## Pendiente

- **Video base 1 + 4 del kit** (gym y comida). Este corte es solo de motion graphics y captura; si se quiere el video de fondo, se agrega como capa en `render.mjs`.

## Pie de foto sugerido

Bajaste rápido… ¿y tu músculo? Entrena poco, pero constante, con Banana Burn: te dice qué hacer, con cuánto peso y cuánto descansar, sin descargar nada. Y para tu nutrición, el plan completo con Banana Shield, para cuidar tu músculo mientras bajas. Tu primer entreno dura 12 min, también en casa: 7 días gratis en bananaburn.app. No sustituye la indicación de tu médico.

#BananaBurn #Recomposicion #Fuerza #Proteina #MasaMuscular
