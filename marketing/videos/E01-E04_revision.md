# Revisión de entrega #184

Producción local del 1 de noviembre de 2026. Cuatro Reels de 19 s y cuatro cortos de 15 s; cuatro portadas y cuatro hojas de nueve escenas. Todos incluyen captura real sin modificar cifras y cierre con la pose oficial compartida de Coach Banana señalando, botón y logo. Sin audio. Los prompts fijos no se ejecutaron; no se usaron servicios de generación de pago.

## Comprobado

- `npm run check` en los cuatro proyectos: gancho desde 0, ocho palabras añadidas como máximo, cambios cada 2 s o 1.5 s, cierre de 3 s y captura existente.
- Decodificación completa con ffmpeg de los ocho MP4: H.264, 1080 x 1920, 30 fps; 570 cuadros en cada Reel y 450 en cada corto; sin errores de decodificación.
- Inspección visual de las cuatro hojas: texto, capturas y cierre dentro de zona segura, sin recortes del CTA; gancho dentro del recorte central de portada. Las hojas son contactos internos: sus líneas punteadas y tiempos no aparecen en el video.
- Suite completa: `npx vitest run --maxWorkers=2`, 217 archivos y 2,437 pruebas aprobadas. El primer intento con concurrencia predeterminada tuvo cuatro tiempos de espera; la repetición completa con dos trabajadores pasó sin cambios de código.
- TypeScript y ESLint del repositorio sin errores. La prueba `src/lib/reels-enero.test.ts` comprueba precios, netos, recursos y correspondencia entre guion y proyecto.

## Revisión editorial antes de publicar

Ver ambos videos de cada paquete a tamaño móvil, confirmar legibilidad de las capturas y revalidar precios y condiciones para enero. UGC es un brief alternativo, no metraje entregado. La semana de E03 es organización adaptable, no siete sesiones obligatorias; el regalo de E02 no es una tarjeta transferible. No asignar resultados ni cifras de las capturas a quien mira el anuncio.

E03_todos-te-miran permanece intacto; E03_primera-semana-del-ano es otro paquete. El cierre usa el PNG oficial compartido, sin redibujar personajes. Gasto de servicios y campañas de esta entrega: $0. Nada publicado, enviado ni activado. Requiere aprobación escrita de Andrés antes de publicar, enviar, gastar o tocar campañas.

## Revalidación de la entrega existente

La rama ya contenía los cuatro paquetes al iniciar esta revisión. Se conservaron los videos y sus fuentes: no hizo falta regenerar medios ni ejecutar prompts.

Se volvieron a ejecutar los cuatro controles locales con `node proyecto/render.mjs check` desde cada paquete. Se decodificaron íntegramente los ocho MP4 con ffmpeg local: H.264, 1080 x 1920, 30 fps, 570 cuadros para 19 s y 450 para 15 s, sin errores. Se inspeccionaron las cuatro hojas de escenas, incluidos gancho, captura y cierre. TypeScript (`npx tsc --noEmit -p .`) y ESLint (`npx eslint src scripts --quiet`) pasaron.

Para repetir la revisión de precios, netos y correspondencia entre guiones y código: `npx vitest run src/lib/reels-enero.test.ts`. Para comprobar el repositorio completo: `npx vitest run --maxWorkers=2` después de `npm ci --ignore-scripts`.

Resultado de esta revalidación completa: 217 archivos y 2,437 pruebas aprobadas, incluidas las cinco de `reels-enero.test.ts`. Sin gasto en generación, publicación ni cambios de campañas.
