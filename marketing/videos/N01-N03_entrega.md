# Entrega N01-N03: campaña del 9 de noviembre

**Material para revisión. No publicar ni activar pauta.** Los seis MP4 se renderizan localmente, sin audio, en H.264, yuv420p, 1080 × 1920 a 30 fps. No se usaron servicios de generación ni se gastó en anuncios.

| Pieza | Principal | Versión corta | Portada | CTA |
| --- | --- | --- | --- | --- |
| [N01: primer entreno en tu sala](N01_primer-entreno-en-tu-sala/guion.md) | [20 s](N01_primer-entreno-en-tu-sala/N01_primer-entreno-en-tu-sala.mp4) | [15 s](N01_primer-entreno-en-tu-sala/N01_primer-entreno-en-tu-sala_15s.mp4) | [PNG](N01_primer-entreno-en-tu-sala/portada.png) | Empieza 7 días gratis en bananaburn.app |
| [N02: qué hacer en el gym](N02_no-sabes-que-hacer-en-el-gym/guion.md) | [18 s](N02_no-sabes-que-hacer-en-el-gym/N02_no-sabes-que-hacer-en-el-gym.mp4) | [15 s](N02_no-sabes-que-hacer-en-el-gym/N02_no-sabes-que-hacer-en-el-gym_15s.mp4) | [PNG](N02_no-sabes-que-hacer-en-el-gym/portada.png) | Empieza 7 días gratis en bananaburn.app |
| [N03: hispanos EE. UU.](N03_hispanos-eeuu/guion.md) | [20 s](N03_hispanos-eeuu/N03_hispanos-eeuu.mp4) | [15 s](N03_hispanos-eeuu/N03_hispanos-eeuu_15s.mp4) | [PNG](N03_hispanos-eeuu/portada.png) | Empieza 7 días gratis en bananaburn.app |

Cada carpeta incluye proyecto autónomo con `escenas.mjs`, `render.mjs`, dependencias fijadas y hoja de revisión. Gancho desde el cuadro 0, cambios cada 2 a 2.5 s, cierre de 3 s con Coach Banana señalando. Texto añadido de hasta 8 palabras, sin etiquetas Demo ni Ejemplo. Zona segura x=60–1020, y=250–1570. Portadas centradas para recorte 1080 × 1350.

## Revisión de la ronda 3 (4 nov)

- Interfaz a **820 px de ancho (76 % del cuadro)** en marco de 860 px, dentro de x=60–1020 y y=250–1570. C1, C2, C4, C5, C6 y C8 se muestran sin alterar nombres ni cifras. Las capturas altas se recorren verticalmente para mostrar todo su contenido; cada extremo se sostiene 0.35 s. C3 empieza abajo, sostiene el botón 1.2 s y recorre hacia arriba; elimina solo el margen gris externo del archivo (viewport 390 × 844), conserva toda la interfaz y reproduce la grabación real de “Terminé la serie” y su transición al descanso. C7 mantiene el recorte real, sin etiqueta Ejemplo.
- N01 usa **12 minutos**, por decisión de Andrés. C4 conserva “Sigue: Sentadilla con peso corporal”. C5 conserva “Terminaste las series · 6 de 6 series en 9:02”; no se sobrepone “Entreno completado”.
- Capturas sin etiquetas públicas de modo demo. Fuente: `public/landing/campana-9nov/LEEME.md`. No quedan capturas pendientes.
- Cierre con la pose oficial señala, reutilizada de `E03_todos-te-miran/assets/coach-banana-senala.png`. Escenas actuadas adaptadas a tipografía animada.
- Antes de distribuir N03, Andrés debe decidir el conjunto de EE. UU. y confirmar cobro con tarjetas estadounidenses en Tilopay. Precio mensual Entreno: US$9.99, IVA incluido.
- **No publicar. $0 de pauta**, hasta 30 % de activación y aprobación de Andrés. Revisar vista previa móvil antes de una eventual distribución.

## Embudo

Mueve registro → primer entreno → pago. Medir `workout_saved` dentro de las 72 h de `profiles.created_at` y pagos `succeeded` en `trial_charges`. No hay resultados de campaña todavía. Atribución por anuncio pendiente según el documento fuente.

## Verificación realizada

- `node marketing/videos/N01-N03_verificar.mjs`: aprobado. Seis duraciones exactas (20/15, 18/15 y 20/15 s), H.264 yuv420p, 1080 × 1920, 30 fps y decodificación completa sin errores. Comprueba también tiempos y máximo de 8 palabras añadidas.
- Portadas regeneradas: conservan su diseño tipográfico y no contienen etiquetas. Hojas `*_hoja-revision.png` regeneradas; hojas adicionales `*_hoja-recorrido.png` muestran inicio, centro y final de cada pantalla para revisar el contenido completo.
- `npx tsc --noEmit -p .` y `npx eslint src scripts --quiet`: aprobados.
- `npx vitest run`: 256 archivos y 2,903 pruebas aprobadas en esta ronda.

 Para repetir: `npm ci` en cada proyecto, `npm run render` y, desde la raíz, `node marketing/videos/N01-N03_verificar.mjs`.
