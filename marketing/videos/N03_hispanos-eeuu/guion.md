# N03_hispanos-eeuu

Render de revisión, no publicar. Sin audio; diseñado para verse sin sonido.

1080 × 1920, 30 fps, H.264. Principal 20 s; recorte 15 s.

## Guion con tiempos

| Tiempo | Texto | Visual |
| --- | --- | --- |
| 0 a 2 s | Sales del turno. ¿Qué haces en el gym? | Tipografía animada, sin escenas humanas |
| 2 a 4 s | Coach Banana te dice qué hacer | Captura real C7, recorte sin alterar números |
| 4 a 6.5 s | Con cuánto peso | Captura real C7, recorte sin alterar números |
| 6.5 a 8.5 s | Y cuántas repeticiones | Captura real C7, recorte sin alterar números |
| 8.5 a 10.5 s | Sabes cuánto te falta | Captura real C7, recorte sin alterar números |
| 10.5 a 12.5 s | Entras, entrenas y te vas | Tipografía animada, sin escenas humanas |
| 12.5 a 14.5 s | Hoy entrenas en casa | Captura real `public/landing/campana-9nov/c1-hoy-primer-dia.png`, recorrido completo sin alterar nombres ni cifras |
| 14.5 a 17 s | US$9.99 al mes. Cancela cuando quieras | Tipografía animada, sin escenas humanas |
| 17 a 20 s | Empieza 7 días gratis en bananaburn.app | Coach Banana señala, botón y logo |

## Versión de 15 segundos

Escenas del principal (en orden): 1, 2, 3, 4, 7, 8, 9. Las primeras seis duran 2 s cada una; cierre de 3 s.

## Fuentes reales

- Capturas demo completas del 3 nov: `public/landing/campana-9nov/LEEME.md`, sin alterar nombres ni cifras.


- C7: `public/landing/entreno.png`, recorte x=0, y=870, 780×610 (progreso: y=110, 780×105); no se alteran cifras.
- Coach: `marketing/videos/E03_todos-te-miran/assets/coach-banana-senala.png`, reutilizado sin redibujar.
- Logo: `public/icons/logo.svg`. Fuentes Plus Jakarta Sans de `src/app/og/`.
- Adaptación a motion graphics: no se fabrican escenas actuadas ni testimonios.

## Reproducir

Desde proyecto/: `npm ci`, dar permiso de ejecución al binario de ffmpeg si hace falta, `npm run check`, `npm run render`. `hoja` genera el contacto de revisión.

## Publicación y medición

No publicar. Pauta en pausa hasta 30 % de activación y aprobación de Andrés. Mueve registro → primer entreno → pago; medir `workout_saved` en 72 h por cohorte y cobros `succeeded` en `trial_charges`. No tomar registros por pagos.

Estados Unidos: conjunto e idioma español pendientes de decisión de Andrés. Confirmar Tilopay con tarjetas de EE. UU. antes de publicar. US$9.99 es el mensual Entreno, IVA incluido; no incluye ofertas de condominios.

Pie sugerido: Regístrate y haz tu primer entreno hoy. Empieza 7 días gratis en bananaburn.app. #BananaBurn #PrimerEntreno #Entrenamiento #EntrenoEnCasa #Gym

## Ajustes de ronda 3

Sin etiquetas Demo ni Ejemplo en el arte. Interfaz a 820 px de ancho (76 % de 1080), dentro de x=60–1020. Las pantallas altas se recorren verticalmente, con pausas en los extremos, para mostrar todo sin reducir la letra ni alterar datos. C3 sostiene la zona del botón durante 1.2 s y luego recorre hacia arriba. Se conservan los tiempos y el cierre.
