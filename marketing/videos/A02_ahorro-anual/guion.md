# A02_ahorro-anual

Issue #153. Producción local sin servicios de pago. Borrador para revisión de Andrés; sin publicación, envío, gasto ni activación de campañas.

## Salidas

`A02_ahorro-anual.mp4` (19 s), `A02_ahorro-anual_15s.mp4` (15 s), `A02_ahorro-anual_portada.png` y `A02_ahorro-anual_hoja-revision.png`. Videos 1080 x 1920, 30 fps, H.264/yuv420p, sin audio. No se requiere voz ni música para entender la pieza.

## Guion toma por toma

Gancho completo en el cuadro 0, sin logo. Máximo ocho palabras añadidas por pantalla, incluida la etiqueta Mensual. El texto propio de la captura real se conserva; no se superponen subtítulos adicionales.

| Reel 19 s | Versión 15 s | Texto en pantalla | Palabras | Visual |
| --- | --- | --- | --- | --- |
| 0 a 2 s | 0 a 1.5 s | ¿Cuánto ahorras con el anual? | 5 | Tarjeta tipográfica; entrada de 300 ms, sin texto adicional. |
| 2 a 4 s | 1.5 a 3 s | Entreno: $9.99 al mes | 4 | Tarjeta tipográfica sin texto adicional. |
| 4 a 6 s | 3 a 4.5 s | Doce mensualidades: $119.88 | 3 | Tarjeta tipográfica; entrada de 300 ms, sin texto adicional. |
| 6 a 8 s | 4.5 a 6 s | Entreno anual: $59.99 | 3 | Tarjeta tipográfica sin texto adicional. |
| 8 a 10 s | 6 a 7.5 s | Ahorras $59.89 frente a doce mensualidades | 6 | Tarjeta tipográfica; entrada de 300 ms, sin texto adicional. |
| 10 a 12 s | 7.5 a 9 s | Entreno + Nutrición: ahorras $89.89 al año | 7 | Tarjeta tipográfica; entrada de 300 ms, sin texto adicional. |
| 12 a 14 s | 9 a 10.5 s | Oferta mensual: primer mes con tarjeta + etiqueta “Mensual” | 7 | Captura real de Mi plan: promoción mensual, no precio anual. Sin alterar cifras. |
| 14 a 16 s | 10.5 a 12 s | Compara doce mensualidades regulares en bananaburn.app/precios | 6 | Tarjeta tipográfica; entrada de 300 ms, sin texto adicional. |
| 16 a 19 s | 12 a 15 s | Empieza 7 días gratis en bananaburn.app | 6 | Coach Banana señalando oficial, botón ink y logo. |

## Brief UGC

Grabar manos propias abriendo /precios en un teléfono, seleccionando Anual y recorriendo las tarjetas, sin completar compras. Vertical 1080 x 1920 a 30 fps, luz natural, tomas de 6 s para seleccionar 2 s o 1.5 s. Sin rostros de terceros, marcas ajenas, datos personales, testimonios ni promesas de resultados. No contratar creadores ni material nuevo en esta entrega. El montaje UGC opcional reemplaza tarjetas tipográficas conservando el texto y los tiempos de la tabla. La captura digital real se mantiene en su escena; el cierre oficial dura 3 s.

Locución opcional: leer únicamente los textos de la tabla, sin añadir cifras ni urgencias. El video entregado es silencioso y autónomo. Para A02, el post conserva la base de comparación y la exclusión de promociones; no presentar el ahorro como comparación con la promoción del primer mes.

## Capturas y marca

Ver assets/README.md. Se reutiliza public/landing/oferta.webp, captura real de Mi plan, con Mensual seleccionado y la promoción del primer mes al guardar tarjeta. La escena la identifica como oferta mensual. Sus $4.99 y $7.49 del primer mes no son precios anuales ni la base del ahorro: después indica $9.99 y $14.99 al mes. No modificar cifras ni ocultar condiciones. Las cifras anuales se muestran en tarjetas tipográficas separadas, tomadas de plans.ts. No aparece GLP-1 en la captura.

No se obtuvo una captura nueva de /precios: el entorno ARM no dispone de navegador compatible y bloquea las descargas de Chromium. No recrear la pantalla. Una futura captura anual real puede sustituir esta referencia mensual tras revisión del guion, sin cambiar sus números.

Paper #FFF8E3, banana #FFD60A, ink #1B1505. Solo Plus Jakarta Sans 600/800; cifras de ancho tabular de la fuente. Marco de teléfono ink de radio 42, escala uniforme. Zona segura x=60 a 1020, y=250 a 1570. Gancho en y=620, legible en recorte central 1080 x 1350. Entradas de 300 ms con cubic-bezier(0.23,1,0.32,1). Cortes cada 2 s (1.5 s en corto). Cierre de 3 s con la pose oficial de marketing/videos/E03_todos-te-miran/assets/coach-banana-senala.png, botón ink exacto y logo public/icons/logo.svg. Pulsación del botón a los 1.5 s del cierre.

## Prompt fijo para Higgsfield, no ejecutar

«Imagen fija de un teléfono sin pantalla visible sobre escritorio paper #FFF8E3 con un cuaderno amarillo #FFD60A, luz natural cálida, encuadre vertical, sin personas, personajes, texto, cifras ni logos». Referencia opcional para futura aprobación; nunca generar video. Esta entrega utiliza código, captura real y personaje existente, sin créditos ni servicios de pago.

## Post propuesto

> Entreno: 12 mensualidades de $9.99 suman $119.88; el anual de $59.99 ahorra $59.89. Entreno + Nutrición: 12 mensualidades de $14.99 suman $179.88; el anual de $89.99 ahorra $89.89. Comparación en USD, IVA incluido, a precio mensual regular, sin promociones ni compras extra. La promoción del primer mes mensual no se acumula con el anual. Compara en bananaburn.app/precios. Empieza 7 días gratis en bananaburn.app, sin tarjeta.
>
> #BananaBurn #PlanAnual #Ahorro #EntrenamientoDeFuerza #PlanesDeEntreno

## Producción y revisión

Desde proyecto/: `npm install`, `npm run check`, `npm run render`. Si hace falta, `chmod +x node_modules/@ffmpeg-installer/*/ffmpeg`. También: `npm run reel`, `npm run anuncio`, `npm run portada`, `npm run hoja`. No requiere servicios externos. No ejecutar el prompt.

Revisar videos completos, lectura móvil de cifras y recorte de portada. El cierre y las capturas deben mantener su identidad y proporciones. No publicar, enviar ni tocar campañas sin aprobación escrita de Andrés.

## Embudo y dinero

Mueve prueba a pago anual; el ángulo de Entreno + Nutrición también permite elegir el plan más alto. Ver [medición y escenarios](../A01-A03_medicion.md). No confundir ingresos cobrados por adelantado con ingresos mensuales recurrentes ni con beneficio.
