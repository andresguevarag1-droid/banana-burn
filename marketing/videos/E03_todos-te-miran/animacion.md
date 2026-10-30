# E03: plan de animación en código

Todo se anima en `proyecto/render.mjs` sobre las imágenes fijas de `proyecto/tomas/`. Los tiempos, las cámaras y los textos están en `proyecto/escenas.mjs`; se cambian ahí, no en el render.

## Reglas comunes

- 1080 x 1920, 30 fps, H.264, sin audio. Cada toma se ajusta a pantalla completa y la cámara nunca deja ver los bordes de la imagen.
- Movimiento de la marca: ease-out `cubic-bezier(0.23, 1, 0.32, 1)` para las entradas y los golpes de cámara; ease-in-out `(0.77, 0, 0.175, 1)` para los paneos lentos. Entradas de 300 ms (suben 48 px y aparecen). Nada aparece desde `scale(0)`.
- Entre tomas, corte seco: el cambio visual es el corte y la entrada del texto.
- Globos y rótulos entran a los 120 ms de cada escena. El gancho no tiene entrada: está completo en el cuadro 0.
- Globo: tarjeta blanca, borde ink de 6 px, radio 40, sombra cálida, Jakarta 800 de 72 px en ink, cola hacia la cabeza de quien habla (`TOMAS[...].personajes`). Rótulo: tarjeta ink, Jakarta 800 de 72 px en cream. Los dos arriba, desde y = 300.

## Por toma

| Toma | Escenas | Cámara | Texto |
| --- | --- | --- | --- |
| T1 | gancho (0 a 2 s) | Toma completa, acercamiento lento de 1 a 1.04 | Tarjeta banana del gancho: "POV:" a 88 px y "sientes que todos te miran" a 116 px, ink. Sin entrada |
| T1 | cara (2 a 4 s) | Golpe de cámara a la cabeza de El Nuevo: de 1.04 a 1.7 en 300 ms y luego casi quieta | Globo de El Nuevo |
| T2 | espejos (4 a 6 s) | Toma completa, acercamiento lento de 1 a 1.05 | Globo de El Nuevo |
| T2 | spoiler (6 a 8 s) | Corte a 1.35 y paneo lento de izquierda a derecha por los reflejos | Rótulo |
| T3 | coach (8 a 10 s) | Se aleja despacio de 1.08 a 1 (alivio) | Globo de Coach Banana |
| T4 | cadaQuien (10 a 12 s) | Toma completa, acercamiento lento de 1 a 1.05 | Globo de Coach Banana |
| T4 | platanita (12 a 14 s) | Golpe de cámara a Coach Platanita: a 1.7 en 300 ms | Rótulo |
| Captura | telefono (14 a 16 s) | Fondo paper. Teléfono ink de radio 42 que sube 120 px en 300 ms; la captura real se desplaza 400 px en 1.2 s y entra un aro banana de 8 px alrededor de "Serie 2 de 3 / 10 a 12 repeticiones con 20 kg". La captura no se toca | Rótulo |
| T5 | serie (16 a 18 s) | Se aleja despacio de 1.12 a 1 | Rótulo |
| T6 | todos (18 a 20 s) | Acercamiento lento de 1 a 1.06 hacia el choque de puños | Globo de Coach Banana |
| Cierre | cierre (20 a 23 s) | Fondo paper. Coach Banana señalando entra a los 0 s; botón ink "Empieza 7 días gratis en bananaburn.app" a los 0.4 s; logo a los 0.9 s; el botón cede a `scale(.97)` a los 1.6 s, como al tocarlo | Botón y logo |

## Lo que el render revisa solo

- Que ninguna pantalla pase de 8 palabras y que todo texto dibujado esté declarado en `escenas.mjs`.
- Que cada escena dure de 1.5 a 2.5 s y el cierre, 3 s exactos.
- Que la primera escena sea el gancho POV.
- Si falta alguna toma, los videos salen con `_animatic` en el nombre y la portada no se genera.
