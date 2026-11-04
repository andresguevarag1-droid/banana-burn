# N01_primer-entreno-en-tu-sala

Render de revisión, no publicar. Sin audio; diseñado para verse sin sonido.

1080 × 1920, 30 fps, H.264. Principal 20 s; recorte 15 s.

## Guion con tiempos

| Tiempo | Texto | Visual |
| --- | --- | --- |
| 0 a 2 s | Tu primer entreno en casa: 12 minutos | Tipografía animada, sin escenas humanas |
| 2 a 4 s | Sin equipo ni gym | Captura real `public/landing/campana-9nov/c1-hoy-primer-dia.png`, recorrido completo sin alterar nombres ni cifras |
| 4 a 6.5 s | Un ejercicio por pantalla | Captura real `public/landing/campana-9nov/c2-guiado-casa.png`, recorrido completo sin alterar nombres ni cifras |
| 6.5 a 8.5 s | Abre tu entreno | C2 real, recorrido completo sin alterar nombres ni cifras |
| 8.5 a 10.5 s | Tocas Terminé la serie | Captura real `public/landing/campana-9nov/c3-termine-la-serie.mp4`, interfaz completa; se quita solo el margen gris |
| 10.5 a 12.5 s | Descansas y sigues | Captura real `public/landing/campana-9nov/c4-descanso.png`, recorrido completo sin alterar nombres ni cifras |
| 12.5 a 14.5 s | 12 minutos en tu sala | Tipografía animada, sin escenas humanas |
| 14.5 a 17 s | Terminaste las series | Captura real `public/landing/campana-9nov/c5-resumen.png`, recorrido completo sin alterar nombres ni cifras |
| 17 a 20 s | Empieza 7 días gratis en bananaburn.app | Coach Banana señala, botón y logo |

## Versión de 15 segundos

Escenas del principal (en orden): 1, 2, 3, 5, 6, 8, 9. Las primeras seis duran 2 s cada una; cierre de 3 s.

## Fuentes reales

- Capturas del 3 nov: `public/landing/campana-9nov/LEEME.md`. C4 sigue con Sentadilla con peso corporal. C5 conserva “Terminaste las series · 6 de 6 series en 9:02”, sin sobreponer “Entreno completado”. C3 quita únicamente el margen gris externo (viewport 390 × 844) y reproduce la grabación real a 30 fps desde su inicio, sin alterar cifras.
- N01 usa 12 minutos por decisión de Andrés en la ronda 2 de #248, que sustituye la condición anterior del documento fuente.

- Coach: `marketing/videos/E03_todos-te-miran/assets/coach-banana-senala.png`, reutilizado sin redibujar.
- Logo: `public/icons/logo.svg`. Fuentes Plus Jakarta Sans de `src/app/og/`.
- Adaptación a motion graphics: no se fabrican escenas actuadas ni testimonios.

## Reproducir

Desde proyecto/: `npm ci`, dar permiso de ejecución al binario de ffmpeg si hace falta, `npm run check`, `npm run render`. `hoja` genera el contacto de revisión.

## Publicación y medición

No publicar. Pauta en pausa hasta 30 % de activación y aprobación de Andrés. Mueve registro → primer entreno → pago; medir `workout_saved` en 72 h por cohorte y cobros `succeeded` en `trial_charges`. No tomar registros por pagos.


Pie sugerido: Regístrate y haz tu primer entreno hoy. Empieza 7 días gratis en bananaburn.app. #BananaBurn #PrimerEntreno #Entrenamiento #EntrenoEnCasa #Gym

## Ajustes de ronda 3

Sin etiquetas Demo ni Ejemplo en el arte. Interfaz a 820 px de ancho (76 % de 1080), dentro de x=60–1020. Las pantallas altas se recorren verticalmente, con pausas en los extremos, para mostrar todo sin reducir la letra ni alterar datos. C3 sostiene la zona del botón durante 1.2 s y luego recorre hacia arriba. Se conservan los tiempos y el cierre.
