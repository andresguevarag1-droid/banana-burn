# R03: 3 ganchos para el Reel del gym del condominio

Tres versiones de 15 s del anuncio de condominios para probar en Meta cuál gancho trae registros más baratos. Las tres son iguales del segundo 3 al 15 (mismo cuerpo, mismo cierre y misma pista de audio); solo cambian los primeros 3 s. Motion graphics hechos en código. Estado: **borrador para revisión de marca. No se sube a Meta ni se publica sin la aprobación por escrito de Andrés.**

## Los ganchos

| Versión | Archivo | Gancho | Pantalla 1 (0.0 a 1.5 s) | Pantalla 2 (1.5 a 3.0 s) |
| --- | --- | --- | --- | --- |
| R03a | R03a_condominio-tu-plan.mp4 | Tu condominio tiene gym. ¿Y tu plan? | Fondo paper: "Tu condominio tiene gym." y "¿Y tu plan?" en bloque ink, con el gym dibujado abajo (7 palabras) | Fondo banana: el gym grande y "¿Y tu plan?" (3) |
| R03b | R03b_condominio-mantenimiento.mp4 | Lo pagas en el mantenimiento y no lo usas | Fondo banana: "Lo pagas en" y "el mantenimiento" en bloque ink (5) | Fondo paper: tarjeta "Mantenimiento" con Agua y Seguridad marcados y Gimnasio sin marcar; abajo "y no lo usas" (8) |
| R03c | R03c_condominio-gym-vacio.mp4 | POV: el gym del edificio siempre está vacío | Fondo paper: píldora "POV:", la frase completa y el gym vacío dibujado (8) | Fondo ink, como con la luz apagada: el gym vacío y "siempre está vacío" en banana (3) |

El gancho de R03b tiene 9 palabras y la marca permite 8 por pantalla, así que se parte en las dos pantallas: "Lo pagas en el mantenimiento" está desde el cuadro 0 y "y no lo usas" llega a los 1.5 s. El texto del issue no cambia.

## Archivos

| Archivo | Qué es |
| --- | --- |
| R03a/b/c_*.mp4 | 15 s, 1080 x 1920, 30 fps (450 cuadros), H.264 High + audio AAC estéreo 48 kHz |
| R03a/b/c_*_portada.png | Portada de 1080 x 1920 (el cuadro 0 de cada gancho; se puede recortar a 1080 x 1350, entre y = 285 y y = 1635) |
| R03_hoja-revision.png | Un cuadro por pantalla: arriba los 3 ganchos, abajo el cuerpo común. Zona segura en rojo y recorte de portada en verde. Es para revisar, no se publica |
| proyecto/ | Editable: `escenas.mjs` (guion, textos y tiempos), `render.mjs` (dibujo y render) y `audio.mjs` (pista de audio) |

## Cuerpo común (3.0 a 15.0 s)

El Reel original R03 no está en el repositorio (el kit lo planeaba con los videos base 2 y 5, que tampoco están), así que el cuerpo se construyó en código con capturas reales de la app.

| Tiempo | Pantalla | Texto en pantalla | Palabras |
| --- | --- | --- | --- |
| 3.0 a 5.0 | Teléfono con la captura de Hoy (`public/landing/hoy2.png`); aro banana alrededor de "Cuerpo completo B, 6 ejercicios, unos 38 minutos" | Tu rutina de hoy, lista | 5 |
| 5.0 a 7.0 | Captura del entreno (`public/landing/entreno.png`); el teléfono se acerca a "10 a 12 repeticiones con 20 kg" y lo marca | Cuánto peso y cuántas repeticiones | 5 |
| 7.0 a 9.0 | La misma captura desde arriba; aro alrededor del botón "Ver cómo se hace" | Y cómo hacer cada movimiento | 5 |
| 9.0 a 10.5 | Fondo ink, mancuerna banana | Con el equipo de tu gym | 6 |
| 10.5 a 12.0 | Fondo banana, "sin tarjeta" en bloque ink | 7 días gratis, sin tarjeta | 5 |
| 12.0 a 15.0 | Cierre de 3 s, fondo paper: Coach Banana entra (0.0 s), el botón ink entra (0.4 s), el logo entra (0.9 s) y el botón cede a scale(.97) como al tocarlo (1.6 s) | Empieza 7 días gratis en bananaburn.app / BananaBurn | 7 |

Datos: "con el equipo de tu gym" es lo que dice la oferta de condominios (skill de Harvey: "una rutina con el equipo que ya tienen"); "7 días gratis, sin tarjeta" es la prueba de la app y el texto del anuncio de condominios en `marketing/estrategia/meta-ads-noviembre.md`. Los anuncios de condominios van a residentes y a la portada (/), así que el Reel no menciona el mes gratis del condominio aliado, que depende de un acuerdo con la administración. Las capturas se ponen tal cual en un marco de teléfono ink de radio 42; solo se recortan, se acercan y se marca el dato con un aro por encima, sin cambiar ningún número.

## Audio

La misma pista en las tres: 15 s, 120 bpm (un compás cada 2 s, que cae con los cambios de pantalla), bombo, palmas, hi-hat y un bajo; en el cierre se queda el bajo y suena una campana cuando el botón cede (13.6 s). Está **sintetizada en código** (`proyecto/audio.mjs`), sin muestras ni música de terceros, así que no tiene problemas de derechos en anuncios. Volumen medio -16 dB, pico -1.2 dB.

El kit pide los Reels sin audio para poner el audio en tendencia al publicar; el issue pide la misma pista en las tres para que la prueba sea limpia. Si Andrés prefiere un audio de la biblioteca de Meta, se puede cambiar al subir, pero tiene que ser el mismo en las tres versiones.

## Cómo se garantiza que solo cambia el gancho

El cuerpo (s 3 a 15) y el audio se codifican una sola vez y se pegan sin recodificar (`-c copy`) detrás de cada gancho. Comprobado con ffmpeg sobre los MP4 entregados:

- Los 3 tienen 450 cuadros de video (15.0 s). El contenedor marca 15.02 s por el relleno inicial del códec AAC.
- Cuadros 90 a 449 (3.0 a 15.0 s): los 360 son idénticos en las tres versiones (`-f framemd5`).
- Cuadros 0 a 89: los 90 son distintos entre versiones.
- Audio: mismo MD5 en las tres, tanto los bytes del flujo AAC como el audio decodificado.

## Revisión

- Gancho completo en el cuadro 0, sin logo al inicio. En R03b, la primera mitad (ver arriba).
- Ninguna pantalla pasa de 8 palabras: `render.mjs` cuenta el texto de cada escena, falla si alguna pasa de 8 y falla si se dibuja un texto que la escena no declaró. Las capturas de la app no cuentan: son la prueba, no texto agregado.
- Un cambio visual cada 1.5 a 2 s; el render falla si una escena dura menos de 1.5 s o más de 2.5 s. El cierre dura 3 s.
- Todo el texto y las capturas quedan entre y = 250 y y = 1570 (zona segura).
- Solo la paleta de la marca (banana, banana-soft, ink, paper, cream, card, line, banana-ink, ember-ink) y Plus Jakarta Sans 600 y 800. Movimiento: ease-out cubic-bezier(0.23, 1, 0.32, 1), entradas de 300 ms, nada aparece desde scale(0).
- Sin emojis, sin IA, sin contadores ni escasez, sin testimonios, sin personas. El gym es un dibujo de línea, no un condominio real.

## Para la prueba en Meta (propuesta, no se subió nada)

- Mismo conjunto, mismo texto del anuncio y mismo presupuesto para las tres; solo cambia el video. Texto de `meta-ads-noviembre.md`: "Tu edificio tiene gym. Te falta el plan. Banana Burn te da la rutina de hoy, el peso y las repeticiones. 7 días gratis, sin tarjeta."
- `utm_content` por versión, siguiendo la tabla de UTMs: `cr-condo-r03a-15s`, `cr-condo-r03b-15s`, `cr-condo-r03c-15s` (y lo mismo con `gt-` y `co-`).
- Ganador por costo por registro, con el mismo mínimo de gasto por anuncio que ya pide la estrategia.

## Pendiente

- **Pose de Coach Banana señalando.** El cierre usa la pose de pie de `public/brand/mascota-sola.webp` porque la pose "señala" no está en el repositorio (lo mismo que en R04). Para cambiarla: guarda el PNG con fondo transparente en `assets/coach-banana-senala.png` y vuelve a hacer el render.
- **Video real del gym del condominio.** Si llegan los videos base 2 (gym de condominio) y 5 (celular con pantalla verde) del kit, el cuerpo se puede rehacer con video real; los ganchos no cambian.

## Cómo volver a hacer el render

```bash
cd marketing/videos/R03_condominio-ganchos/proyecto
npm install
chmod +x node_modules/@ffmpeg-installer/*/ffmpeg   # si npm no corrió el postinstall del binario
npm run render        # los 3 MP4, las 3 portadas y la hoja de revisión
```

Textos y tiempos se cambian en `escenas.mjs`; el dibujo de cada pantalla está en `render.mjs` y la pista en `audio.mjs`. Para usar otro ffmpeg, pon su ruta en la variable `FFMPEG`. Los archivos intermedios quedan en `proyecto/.tmp/` (ignorado por git).
