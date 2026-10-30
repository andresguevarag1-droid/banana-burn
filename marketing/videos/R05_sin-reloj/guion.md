# R05: Sales a correr sin reloj

Paquete de producción para el 9 al 15 de noviembre de 2026. Pendiente de producción y aprobación por escrito de Andrés. No se han generado MP4 ni PNG; los nombres siguientes son salidas previstas, no archivos entregados.

Misma organización que R04: `guion.md`, `proyecto/escenas.mjs`, `proyecto/render.mjs`, `proyecto/package.json` y `assets/`. Proyecto editable de motion graphics como alternativa sin clips; para montaje UGC, usar el guion y los videos base indicados.

| Salida prevista | Especificación |
| --- | --- |
| R05_sin-reloj.mp4 | 19 s, 1080 x 1920, 30 fps, H.264, sin audio |
| R05_sin-reloj_15s.mp4 | 15 s, mismas especificaciones; propuesta para anuncios, sin activar campañas |
| R05_sin-reloj_portada.png | 1080 x 1920, gancho dentro del recorte central 1080 x 1350 |
| R05_sin-reloj_hoja-revision.png | Contacto de escenas para revisión interna |

## Guion toma por toma

Textos añadidos de hasta 8 palabras por pantalla. Capturas originales conservan su contenido sin reescritura. Logo solo en cierre. Gancho visible completo desde el cuadro 0. Sin voz ni música; Andrés decide el audio al aprobar la publicación.

| Reel 19 s | Versión 15 s | Texto en pantalla | Palabras | Toma / montaje UGC |
| --- | --- | --- | --- | --- |
| 0 a 2 s | 0 a 1.5 s | Sales a correr sin reloj | 5 | Zapatillas entrando al parque. Gancho desde el cuadro 0. |
| 2 a 4 s | 1.5 a 3 s | Lleva tu celular | 3 | Corredor de espaldas, celular sujeto con seguridad. |
| 4 a 6 s | 3 a 4.5 s | El GPS registra tu recorrido | 5 | Detalle del celular antes de empezar; nunca manipularlo corriendo. |
| 6 a 8 s | 4.5 a 6 s | Consulta tu ritmo por kilómetro + etiqueta “Ejemplo” | 6 | Captura real de Running: ritmos, completa. |
| 8 a 10 s | 6 a 7.5 s | Revisa tus parciales + etiqueta “Ejemplo” | 4 | Acercamiento al bloque de parciales de la misma captura. |
| 10 a 12 s | 7.5 a 9 s | Corre a tu propio ritmo | 5 | Zapatillas a ritmo cómodo, sin promesa de velocidad. |
| 12 a 14 s | 9 a 10.5 s | Sin comprar otro dispositivo | 4 | Celular junto a las zapatillas; sin reloj en cuadro. |
| 14 a 16 s | 10.5 a 12 s | Tu próxima salida empieza aquí + etiqueta “Ejemplo” | 6 | Captura real de ritmos, sin añadir resultados. |
| 16 a 19 s | 12 a 15 s | Empieza 7 días gratis en bananaburn.app | 6 | Coach Banana señalando, botón ink y logo. |

## Video base y brief para grabación propia

Referencia del kit: **video 3 + 5**. Graba tres tomas de 6 s del video base 3: zapatillas, espalda y celular detenido. Añade una toma de 6 s del base 5, celular en manos antes de salir. Parque seguro, luz de mañana, sin caras, marcas ni personas identificables. Captura vertical a 30 fps; si el material existente está a 60 fps, conformar a 30 fps. No simular conexión con reloj.

Grabar vertical 1080 x 1920, 30 fps, tomas limpias de 6 s, sin texto, voz ni música. Seleccionar 2 s por escena (1.5 s en la versión corta), con cortes según tabla. Usar material propio o ya disponible con derechos de uso; sin comprar stock, contratar servicios o generar video. Las escenas de captura reemplazan el plano completo por el teléfono en fondo paper. Las tarjetas de advertencia médica, cuando aparecen, reemplazan todo el plano.

## Captura real

Usar `public/landing/running-ritmos.webp`. Marco ink de radio 42. Mostrar la etiqueta “Ejemplo” fuera de la captura; se cuenta dentro del máximo de 8 palabras añadidas. Solo escala uniforme y recorte; nunca cambiar cifras ni reconstruir la interfaz. En el montaje UGC, el primer plano de captura es completo y el siguiente permite acercamiento al dato indicado tras verificar su posición. El proyecto de motion muestra la captura completa en ambos planos para evitar recortar el dato incorrecto.

La captura local muestra un ejemplo de 21K y meta 1:55:00. Mantener esos valores si se usa; no presentarla como 5K, carrera del creador ni resultado esperado. Si se necesita un 5K, Andrés debe capturarlo realmente.

## Cierre, portada y movimiento

Últimos 3 s con la pose oficial `assets/coach-banana-senala.png`, botón ink con “Empieza 7 días gratis en bananaburn.app” y `public/icons/logo.svg`. Falta la pose local: Andrés debe aportar el PNG oficial ya existente. El render falla si falta; nunca usa otra pose. CTA y coach visibles desde el inicio del cierre; a los 1.5 s el botón cede a escala .97, manteniendo el cierre continuo y el cambio visual.

Paper #FFF8E3, banana #FFD60A e ink #1B1505; solo Plus Jakarta Sans 600/800. Zona segura: contenido entre x = 60 y 1020, y = 250 y 1570. Portada: título entre y = 500 y 1050, legible en recorte y = 285 a 1635. Entradas de 300 ms con curva cubic-bezier(0.23,1,0.32,1); gancho sin entrada y sin logo. Cortes cada 2 s o 1.5 s.

## Post propuesto

> Sales a correr sin reloj. Banana Run registra tu ritmo por kilómetro con el GPS del celular y está incluido en todos los planes. Revisa tus parciales al terminar. Empieza 7 días gratis en bananaburn.app
>
> #BananaBurn #Running #CorrerConCelular #RitmoPorKilometro #Corredores

## Producción y revisión

Desde `proyecto/`: `npm run check` valida los tiempos y palabras sin instalar dependencias ni dibujar imágenes. Para producir después, `npm install`, habilitar el ejecutable de ffmpeg si hace falta (`chmod +x node_modules/@ffmpeg-installer/*/ffmpeg`) y `npm run render`. También existen `npm run reel`, `npm run anuncio`, `npm run portada` y `npm run hoja`. Se renderiza localmente, sin API ni créditos; requiere la pose oficial. No ejecutar generación de pago. No se adjuntan prompts para Higgsfield: se reutilizan capturas y arte oficial existente, sin nuevas imágenes.

Antes de publicar: revisar MP4 completo y versión corta, legibilidad de captura en celular, zona segura, portada recortada, cifras originales, advertencia médica si aplica y pose señalando correcta. La hoja es interna y no se publica. No se publica ni envía nada, ni se tocan campañas o dinero sin aprobación de Andrés.

## Embudo y rentabilidad

Mueve visita → registro → prueba con una utilidad concreta de Running. Objetivo comercial: contribuir a 100 usuarios de pago activos, no acumular vistas. Medición y límites de atribución en [medición compartida](../R05-R08_medicion.md). No añade gasto de medios, servicios de generación, stock ni herramientas; se reutilizan código, capturas y grabación propia disponible. El tiempo humano y cómputo local no se consideran ingresos ni se ocultan como costo cero total.
