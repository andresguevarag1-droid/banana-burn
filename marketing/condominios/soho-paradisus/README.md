# Soho Paradisus: borradores del piloto

Solo revisión de Andrés. No se publicó ni envió nada. La oferta especial corresponde únicamente a Soho Paradisus; no se modificaron los materiales ni el código de otros condominios.

- `afiche-a4.png` y `afiche-a4.pdf`: A4 vertical, 2480 × 3508 px, página PDF de 210 × 297 mm. Imprimir al 100 %, sin recortar.
- `historia.png`: 1080 × 1920 px; contenido entre y=250 e y=1570. Andrés puede añadir un sticker de enlace al mismo destino al revisarla.
- `qr.png`: enlace exacto `https://www.bananaburn.app/c/soho-paradisus`, margen blanco de cuatro módulos.
- `mensajes.txt`: corta de tres líneas, completa y seguimiento. La completa adapta la estructura de `condoWhatsapp` en `src/lib/condos.ts` a la voz de Andrés como vecino, agregando duración, precios y aviso. No cambia la función compartida.
- `generar.py`: fuente reproducible sin dependencias descargadas; requiere Python 3 e ImageMagick con FreeType y WebP. Ejecutar desde la raíz con `python3 marketing/condominios/soho-paradisus/generar.py`.

## Pendiente visual antes de usar

Falta la escena oficial de Coach Banana con El Nuevo. El repositorio solo contiene al Coach de pie; las escenas de ambos en `src/app/c/[code]/card-landing.tsx` son URLs remotas. Sin internet no se descargaron ni se redibujaron personajes. Estos borradores usan el Coach local y no satisfacen todavía la composición con ambos personajes. Por buscar: copia local aprobada de la escena `SCENE.juntos`, `hf_20261030_053039_48320df7-cb6a-475f-b521-539b0a30f22c.png`. El generador admite `--escena /ruta/escena.png` para reemplazar al Coach en ambas piezas. Revisar la composición tras sustituirla.

El libro de marca externo tampoco se consultó: se usaron los skills montados y los tokens locales. Revisar el QR con un teléfono en la prueba impresa antes de colocar el afiche, y desde otro dispositivo antes de subir la historia.

## Oferta y medición

7 días gratis sin tarjeta. Para continuar gratis hasta el 31 de diciembre de 2026 hay que guardar tarjeta. Primer cobro el 1 de enero de 2027 al precio normal del plan elegido; aviso 2 días antes y cancelación cuando quieras. No se aplica el descuento general de la app.

Paso del embudo: registro desde el enlace del condominio y primer entreno terminado. Revisar `workout_saved` en `funnel_events` durante las primeras 72 h de los nuevos residentes vinculados a Soho; las piezas comparten enlace y no permiten atribuir por separado afiche, grupo e historia. Pagos posteriores: `trial_charges.status = 'succeeded'`. No se añadieron eventos ni promesas de resultados.

## Verificaciones realizadas

Revisión visual de ambos diseños, dimensiones PNG y zona segura de la historia. `python3 marketing/condominios/soho-paradisus/verificar.py` lee los QR de los PNG, recupera el enlace exacto, verifica los 20 síndromes de corrección Reed-Solomon y compara el RGB del PDF con el afiche. También revisa el formato de tres líneas del mensaje corto. Esto no sustituye la prueba del QR con un teléfono y una impresión real. `git diff --check` sin errores.

Los checks de la app se intentaron y quedaron sin ejecutar: `npm test` falla porque no existe Vitest; TypeScript y ESLint tampoco están instalados. `npm ci --offline --ignore-scripts` no pudo completar la instalación por paquetes ausentes en la caché (`ENOTCACHED`). No se intentaron descargas por internet. No se modificó código de la app ni archivos de dependencias.
