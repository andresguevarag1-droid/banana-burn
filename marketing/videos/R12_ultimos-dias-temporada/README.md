# R12: Últimos días para la Temporada 1

Entrega para revisión de Andrés, sin publicar, enviar ni activar campañas. Motion graphics tipográficos, sin audio, sin tomas generadas ni capturas simuladas. La versión corta queda disponible para una posible adaptación a anuncios; Temporadas está fuera del plan actual de Meta Ads y requiere aprobación de Andrés.

## Entregables y edición

- `R12_ultimos-dias-temporada.mp4`: 21 s, 630 cuadros.
- `R12_ultimos-dias-temporada_15s.mp4`: 15 s, 450 cuadros.
- `R12_ultimos-dias-temporada_portada.png`: 1080 × 1920; gancho centrado para recorte a 1080 × 1350.
- `R12_ultimos-dias-temporada_hoja-revision.png`: una muestra por escena; líneas de zona segura y recorte.
- `proyecto/escenas.mjs`: textos y tiempos editables. `render.mjs`: animación y composición.
- `assets/coach-banana-senala.png`: pose existente de E03; fondo blanco exterior eliminado por conectividad al borde, sin redibujar el personaje.

Desde `proyecto/`: `npm ci`, `chmod +x node_modules/@ffmpeg-installer/*/ffmpeg`, `npm run render`, `npm run verificar`. Requiere Node.js 22 o posterior. Las fuentes y logo se leen del repositorio, sin descargas externas. El render falla si una escena supera ocho palabras o incumple tiempos. No modifica datos de la app.

H.264, yuv420p, 1080 × 1920, 30 fps, sin pista de audio. Gancho completo en cuadro 0; cambios cada 2 s (21 s) o 1.5 s (15 s). Cierre de 3 s con Coach señalando, botón y logo. Contenido dentro de y=250 a 1570; fondos a sangre. No hay contadores ni cupos limitados. La fecha es el cierre real de inscripciones, no el fin de la temporada.

## Guion con tiempos

| 21 s | 15 s | Texto completo en pantalla | Visual |
| --- | --- | --- | --- |
| 0 a 2 | 0 a 1.5 | Últimos días para la Temporada 1 | Banana, calendario, gancho inmediato |
| 2 a 4 | 1.5 a 3 | Inscripciones hasta el 22 de noviembre | Ink, fecha grande |
| 4 a 6 | 3 a 4.5 | Elige Running | Paper, tipografía |
| 6 a 8 | 4.5 a 6 | O Raquetas | Paper, cambio de texto |
| 8 a 10 | 6 a 7.5 | O Cross Training | Paper, cambio de texto |
| 10 a 12 | 7.5 a 9 | Temporada hasta el 3 de enero | Ink, fecha de fin |
| 12 a 14 | 9 a 10.5 | Consulta los detalles en bananaburn.app/temporadas | Paper, destino |
| 14 a 16 | 10.5 a 12 | Cierre de inscripciones: 22 de noviembre | Banana, recordatorio |
| 16 a 18 | Se omite | Elige tu deporte para esta temporada | Paper |
| 18 a 21 | 12 a 15 | Empieza 7 días gratis en bananaburn.app + BananaBurn | Coach señalando, botón ink, logo |

Fuentes: `src/lib/seasons.ts` (`T1_START=2026-11-09`, inscripción hasta inicio + 13 días, fin inicio + 55 días) y kit de noviembre. Cierre: 22 de noviembre de 2026. Fin: 3 de enero de 2027. El CTA invita a probar la app, no promete temporada gratis.

## Pie de foto propuesto

Las inscripciones a la Temporada 1 cierran el 22 de noviembre de 2026. Elige Running, Raquetas o Cross Training. La temporada termina el 3 de enero de 2027.

Consulta modalidades y precios en bananaburn.app/temporadas. Puedes probar la app 7 días gratis, sin tarjeta. Las temporadas se compran por separado; el plan anual incluye 1 temporada gratis.

#BananaBurn #Temporada1 #Running #Raquetas #CrossTraining

Usar solo del 16 al 22 de noviembre de 2026, mientras las inscripciones estén abiertas. No programar después del cierre; Andrés confirma la vigencia antes de publicar.

## Brief UGC opcional

Graba vertical, 1080 × 1920, 30 fps, luz natural, sin música ni logos ajenos. Habla de la elección del deporte y la fecha real, sin afirmar ser cliente o haber logrado resultados. No cambies el texto del cierre ni añadas una oferta. Tomas de zapatillas y material deportivo, 2 s cada una, sin rostros reconocibles. Mantén libres 250 px arriba y 350 px abajo. Si se muestra la app, usar una captura real, sin cambiar números, y revisar el total de palabras visibles. Esta entrega ya funciona sin UGC.

## Prompt opcional para Higgsfield

Solo imagen fija; no se necesita para renderizar esta entrega. No generar video.

> Vertical 9:16 still photograph, warm natural morning light, ordinary running shoes beside a tennis racket and a pair of dumbbells on a clean cream gym floor. Restrained banana yellow accents, no people, no animals, no characters, no text, no logos, no watermark, no numbers. Objects centered within the middle 1080x1320 safe area. Calm background, realistic proportions. This is an illustrative still, not a customer testimonial.

Si se incorpora después, rotular como escena ilustrativa y volver a comprobar ocho palabras y zona segura.
