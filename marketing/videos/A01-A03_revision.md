# Revisión de entrega #153

Tres ángulos en A01_un-ano-un-pago, A02_ahorro-anual y A03_temporada-incluida. Cada carpeta incluye MP4 de 19 s y 15 s, portada PNG, hoja de nueve escenas, guion, brief UGC, prompt fijo sin ejecutar y proyecto editable con dependencias fijadas. Sin audio, publicación, envío ni gasto en generación o campañas.

## Verificación realizada

- Se revisaron las tres hojas de escenas: gancho desde cuadro 0, captura conservada, cierre con personaje oficial, botón y logo, y composición dentro de la zona segura. Portadas con título en el recorte central 1080 x 1350.
- FFmpeg comprobó y decodificó completos los seis videos sin errores: H.264, yuv420p, 1080 x 1920, 30 fps, duración exacta 19.00 o 15.00 s.
- Los checks de proyecto validan nueve escenas, hasta ocho palabras añadidas por pantalla, cortes de 2 s o 1.5 s y cierre de 3 s. La captura incluye texto original que se conserva sin reescribirlo.
- src/lib/reels-anuales.test.ts contrasta los guiones, los tiempos, los precios y escenarios con src/lib/plans.ts. TypeScript y ESLint se ejecutaron desde la raíz.

## Decisión editorial que revisar

La captura real disponible es public/landing/oferta.webp: Mi plan, Mensual seleccionado, promoción de primer mes con tarjeta. Se muestra completa con texto que la identifica como mensual, en una escena separada de las tarjetas anuales. No se obtuvo captura nueva de /precios: navegador ausente, binario npm incompatible con ARM y descarga de Chromium bloqueada. No se recreó la interfaz ni se cambiaron números. Revisar que esta referencia mensual no distraiga del anual antes de aprobar publicación; si se prefiere una captura anual, debe ser una captura real y requiere ajustar texto y render de esa escena.

Las piezas usan el recurso transparente oficial señalando que ya existe en marketing/videos/E03_todos-te-miran/assets/coach-banana-senala.png. No se encargaron poses ni imágenes nuevas. El prompt de Higgsfield es solo un documento de referencia.

Antes de publicar, Andrés debe revisar reproducción completa en móvil, legibilidad de la captura y pies de foto. Ver A01-A03_medicion.md para el paso del embudo, atribución propuesta y escenarios de ingresos brutos por pagos anuales confirmados. La aprobación de esta entrega no activa campañas ni envía mensajes.

## Reproducir

En cada proyecto/: `npm ci`, luego `npm run check` y `npm run render`. Si el binario no es ejecutable: `chmod +x node_modules/@ffmpeg-installer/*/ffmpeg`. El render limita FFmpeg a dos hilos para reducir memoria. Ejecutar un proyecto a la vez en entornos limitados. No necesita credenciales, APIs ni servicios de generación. En raíz: `npx tsc --noEmit -p .`, `npx eslint src scripts --quiet`, `npx vitest run --maxWorkers=2`.
