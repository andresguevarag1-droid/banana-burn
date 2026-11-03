# Entrega N01-N03: campaña del 9 de noviembre

**Material para revisión. No publicar ni activar pauta.** Los seis MP4 se renderizan localmente, sin audio, en H.264, yuv420p, 1080 × 1920 a 30 fps. No se usaron servicios de generación ni se gastó en anuncios.

| Pieza | Principal | Versión corta | Portada | CTA |
| --- | --- | --- | --- | --- |
| [N01: primer entreno en tu sala](N01_primer-entreno-en-tu-sala/guion.md) | [20 s](N01_primer-entreno-en-tu-sala/N01_primer-entreno-en-tu-sala.mp4) | [15 s](N01_primer-entreno-en-tu-sala/N01_primer-entreno-en-tu-sala_15s.mp4) | [PNG](N01_primer-entreno-en-tu-sala/portada.png) | Empieza 7 días gratis en bananaburn.app |
| [N02: qué hacer en el gym](N02_no-sabes-que-hacer-en-el-gym/guion.md) | [18 s](N02_no-sabes-que-hacer-en-el-gym/N02_no-sabes-que-hacer-en-el-gym.mp4) | [15 s](N02_no-sabes-que-hacer-en-el-gym/N02_no-sabes-que-hacer-en-el-gym_15s.mp4) | [PNG](N02_no-sabes-que-hacer-en-el-gym/portada.png) | Empieza 7 días gratis en bananaburn.app |
| [N03: hispanos EE. UU.](N03_hispanos-eeuu/guion.md) | [20 s](N03_hispanos-eeuu/N03_hispanos-eeuu.mp4) | [15 s](N03_hispanos-eeuu/N03_hispanos-eeuu_15s.mp4) | [PNG](N03_hispanos-eeuu/portada.png) | Empieza 7 días gratis en bananaburn.app |

Cada carpeta incluye proyecto autónomo con `escenas.mjs`, `render.mjs`, dependencias fijadas y hoja de revisión. Gancho desde el cuadro 0, cambios cada 2 a 2.5 s, cierre de 3 s con Coach Banana señalando. Texto añadido de hasta 8 palabras, incluidos los avisos de captura. Zona segura x=60–1020, y=250–1570. Portadas centradas para recorte 1080 × 1350.

## Pendientes antes de publicar

- **N01:** C1-C5 pendientes de captura. No hay pantallas inventadas: los renders muestran tarjetas editoriales «Pendiente de captura». Se adopta la alternativa de 15 minutos o menos de la campaña, evitando prometer 12 minutos al público Sin equipo. Confirmar variante con Andrés.
- **N02:** C6 y C8 pendientes de captura. C7 sí es real, sin modificar cifras y rotulada Ejemplo.
- **N03:** C1 pendiente de captura. C7 real y rotulada Ejemplo. Confirmar conjunto de EE. UU. y cobro con tarjetas estadounidenses en Tilopay. Precio mensual Entreno: US$9.99, IVA incluido.
- La pose señala ya existe en `E03_todos-te-miran/assets/coach-banana-senala.png`; se reutiliza la misma imagen oficial. El documento fuente la daba por faltante.
- Las escenas actuadas se adaptaron a tipografía animada, sin fabricar personas, testimonios ni ejercicios. N01 es un montaje editorial mientras llegan sus capturas.
- Reemplazar tarjetas editoriales por capturas reales y revisar la vista previa móvil antes de publicar. No son anuncios listos para distribución.
- Mantener $0 de pauta hasta 30 % de activación y aprobación de Andrés.

## Embudo

Mueve registro → primer entreno → pago. Medir `workout_saved` dentro de las 72 h de `profiles.created_at` y pagos `succeeded` en `trial_charges`. No hay resultados de campaña todavía. Atribución por anuncio pendiente según el documento fuente.

## Verificación realizada

- `node marketing/videos/N01-N03_verificar.mjs`: seis duraciones exactas (20/15, 18/15, 20/15 s), H.264 yuv420p, 1080 × 1920, 30 fps; decodificación completa sin errores. El script también valida tiempos y máximo de palabras, incluidos los avisos editoriales.
- Revisión visual de las hojas de contacto y portadas; capturas sin cifras alteradas. N01 incluye el Hoy real de ejemplo en ambas versiones; no se presenta como la captura C1 pendiente.
- `npx tsc --noEmit -p .` y `npx eslint src scripts --quiet`: aprobados.
- Suite completa: 251 archivos aprobados, 2,853 pruebas aprobadas y un timeout de 5 s en `activacion.test.ts` durante los renders. Repetición aislada de ese archivo: 9/9 aprobadas.
- Para repetir la verificación de medios: instalar dependencias en los tres proyectos y ejecutar `node marketing/videos/N01-N03_verificar.mjs` desde la raíz.
