# K13: ¿No sabes cuánto peso usar?

Carrusel de 6 láminas (1080 x 1350) para aprovechar el Reel R01 "Cuando no sabes cuánto peso usar". Tema: entreno para principiantes. Estado: **borrador para revisión de marca. No publicar sin la aprobación por escrito de Andrés.**

| Lámina | Archivo | Fondo | Contenido |
| --- | --- | --- | --- |
| 1 | 01_portada.png | paper | Gancho "¿No sabes cuánto peso usar?" + Coach Banana |
| 2 | 02_error-adivinar.png | banana | Error 1: adivinar |
| 3 | 03_error-copiar.png | paper | Error 2: copiar al de al lado |
| 4 | 04_error-no-subir.png | ink | Error 3: no subir nunca |
| 5 | 05_captura-peso-sugerido.png | paper | Captura real del peso sugerido ("10 a 12 repeticiones con 20 kg") en marco de teléfono ink |
| 6 | 06_cta.png | banana | Botón ink "Empieza 7 días gratis en bananaburn.app" + logo |

Pie de foto: `caption.txt` (gancho en los primeros 114 caracteres, CTA, #BananaBurn + 4).

## Fuentes

- Captura: `public/landing/entreno.png`, la misma pantalla real del reproductor que usa la landing. Se pone tal cual; el único agregado es un aro ink por fuera del dato, sin tocar ningún número.
- Coach Banana: `public/brand/mascota-sola.webp`, el recurso oficial del repositorio. resvg no lee WebP, así que se usa su copia PNG sin pérdida en `../recursos/coach-banana-oficial.png` (sin retoques).
- Los consejos salen de lo que la app hace de verdad (`src/lib/aprende.ts`: calibración con 2 repeticiones en reserva y doble progresión).

## Volver a generar

```
cd marketing/instagram
npm install
npm run k13
```

## Variantes A/B de la portada

| | Gancho | Por qué |
| --- | --- | --- |
| A (entregada) | ¿No sabes cuánto peso usar? | Igual al Reel R01: quien vio el Reel la reconoce y el carrusel lo completa. |
| B | Deja de adivinar el peso en el gym | Más directa, en tono de orden; buena para anuncio. |
| C | 3 errores con el peso que frenan tu progreso | Promete una lista, que suele subir los guardados. |

Mi apuesta: **A** para el orgánico, porque continúa el Reel que más registros trae. Para Meta Ads probaría A contra C.
