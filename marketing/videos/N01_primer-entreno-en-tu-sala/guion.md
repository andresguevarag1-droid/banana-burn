# N01_primer-entreno-en-tu-sala

Render de revisión, no publicar. Sin audio; diseñado para verse sin sonido.

1080 × 1920, 30 fps, H.264. Principal 20 s; recorte 15 s.

## Guion con tiempos

| Tiempo | Texto | Visual |
| --- | --- | --- |
| 0 a 2 s | Tu primer entreno en tu sala | Tipografía animada, sin escenas humanas |
| 2 a 4 s | Sin equipo ni gym | pendiente de captura C1 |
| 4 a 6.5 s | Un ejercicio por pantalla | pendiente de captura C2 |
| 6.5 a 8.5 s | Abre tu entreno | Hoy real de ejemplo, public/landing/hoy2.png |
| 8.5 a 10.5 s | Tocas Hecho | pendiente de captura C3 |
| 10.5 a 12.5 s | Descansas y sigues | pendiente de captura C4 |
| 12.5 a 14.5 s | 15 minutos o menos | Tipografía animada, sin escenas humanas |
| 14.5 a 17 s | Tu primer entreno, hecho | pendiente de captura C5 |
| 17 a 20 s | Empieza 7 días gratis en bananaburn.app | Coach Banana señala, botón y logo |

## Versión de 15 segundos

Escenas del principal (en orden): 1, 2, 4, 5, 6, 8, 9. Las primeras seis duran 2 s cada una; cierre de 3 s.

## Fuentes y pendientes

- Hoy: `public/landing/hoy2.png`, captura completa de ejemplo, sin alterar cifras. No representa C1 ni el primer día.
- Coach: `marketing/videos/E03_todos-te-miran/assets/coach-banana-senala.png`, reutilizado sin redibujar.
- Logo: `public/icons/logo.svg`. Fuentes Plus Jakarta Sans de `src/app/og/`.
- Los bloques «Pendiente de captura» son avisos editoriales, no interfaces inventadas. Reemplazarlos antes de publicar.
- Adaptación a motion graphics: no se fabrican escenas actuadas ni testimonios.
- Capturas faltantes: C1, C2, C3, C4, C5. Véase la tabla C1-C8 en `marketing/anuncios/campana-9-noviembre.md`.

## Reproducir

Desde proyecto/: `npm ci`, dar permiso de ejecución al binario de ffmpeg si hace falta, `npm run check`, `npm run render`. `hoja` genera el contacto de revisión.

## Publicación y medición

No publicar. Pauta en pausa hasta 30 % de activación y aprobación de Andrés. Mueve registro → primer entreno → pago; medir `workout_saved` en 72 h por cohorte y cobros `succeeded` en `trial_charges`. No tomar registros por pagos.

Se usa la alternativa de 15 minutos o menos del documento fuente: no se promete 12 minutos a quien elige Sin equipo. C1 debe ser el Hoy de esa cuenta, no el fallback de Gimnasio. Confirmar esta variante antes de publicar.

Pie sugerido: Regístrate y haz tu primer entreno hoy. Empieza 7 días gratis en bananaburn.app. #BananaBurn #PrimerEntreno #Entrenamiento #EntrenoEnCasa #Gym
