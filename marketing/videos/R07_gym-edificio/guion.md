# R07: 30 minutos en el gym del edificio

Paquete de producción para el 9 al 15 de noviembre de 2026. Pendiente de producción y aprobación por escrito de Andrés. No se han generado MP4 ni PNG; los nombres siguientes son salidas previstas, no archivos entregados.

Misma organización que R04: `guion.md`, `proyecto/escenas.mjs`, `proyecto/render.mjs`, `proyecto/package.json` y `assets/`. Proyecto editable de motion graphics como alternativa sin clips; para montaje UGC, usar el guion y los videos base indicados.

| Salida prevista | Especificación |
| --- | --- |
| R07_gym-edificio.mp4 | 19 s, 1080 x 1920, 30 fps, H.264, sin audio |
| R07_gym-edificio_15s.mp4 | 15 s, mismas especificaciones; propuesta para anuncios, sin activar campañas |
| R07_gym-edificio_portada.png | 1080 x 1920, gancho dentro del recorte central 1080 x 1350 |
| R07_gym-edificio_hoja-revision.png | Contacto de escenas para revisión interna |

## Guion toma por toma

Textos añadidos de hasta 8 palabras por pantalla. Capturas originales conservan su contenido sin reescritura. Logo solo en cierre. Gancho visible completo desde el cuadro 0. Sin voz ni música; Andrés decide el audio al aprobar la publicación.

| Reel 19 s | Versión 15 s | Texto en pantalla | Palabras | Toma / montaje UGC |
| --- | --- | --- | --- | --- |
| 0 a 2 s | 0 a 1.5 s | 30 minutos en el gym del edificio | 7 | Mano abre la puerta del gimnasio. |
| 2 a 4 s | 1.5 a 3 s | Empieza cerca de casa | 4 | Plano amplio del gimnasio del edificio. |
| 4 a 6 s | 3 a 4.5 s | Abre tu entreno de hoy + etiqueta “Ejemplo” | 6 | Captura real de Entreno, completa. |
| 6 a 8 s | 4.5 a 6 s | Revisa el ejercicio y las repeticiones + etiqueta “Ejemplo” | 7 | Acercamiento al ejercicio real en la captura. |
| 8 a 10 s | 6 a 7.5 s | Prepara el equipo disponible | 4 | Manos tomando una mancuerna ligera. |
| 10 a 12 s | 7.5 a 9 s | Haz cada repetición con control | 5 | Residente en banco, técnica revisada por alguien competente. |
| 12 a 14 s | 9 a 10.5 s | Registra tu sesión + etiqueta “Ejemplo” | 4 | Regreso a captura de Entreno, sin simular guardado. |
| 14 a 16 s | 10.5 a 12 s | Haz espacio para volver | 4 | Celular junto al banco, gimnasio tranquilo. |
| 16 a 19 s | 12 a 15 s | Empieza 7 días gratis en bananaburn.app | 6 | Coach Banana señalando, botón ink y logo. |

## Video base y brief para grabación propia

Referencia del kit: **video 2**. Graba tres tomas de 6 s del video base 2: acceso autorizado al gym, plano amplio y residente en banco. Agrega detalle de mancuerna. Gym residencial real, luz de mañana, sin logos, tarjetas legibles ni caras. Autorización del espacio y del participante; no contratar creador ni reservar locación de pago.

Grabar vertical 1080 x 1920, 30 fps, tomas limpias de 6 s, sin texto, voz ni música. Seleccionar 2 s por escena (1.5 s en la versión corta), con cortes según tabla. Usar material propio o ya disponible con derechos de uso; sin comprar stock, contratar servicios o generar video. Las escenas de captura reemplazan el plano completo por el teléfono en fondo paper. Las tarjetas de advertencia médica, cuando aparecen, reemplazan todo el plano.

## Captura real

Usar `public/landing/entreno.png`. Marco ink de radio 42. Mostrar la etiqueta “Ejemplo” fuera de la captura; se cuenta dentro del máximo de 8 palabras añadidas. Solo escala uniforme y recorte; nunca cambiar cifras ni reconstruir la interfaz. En el montaje UGC, el primer plano de captura es completo y el siguiente permite acercamiento al dato indicado tras verificar su posición. El proyecto de motion muestra la captura completa en ambos planos para evitar recortar el dato incorrecto.

30 minutos es una propuesta de tiempo disponible, no un temporizador de la app ni duración garantizada. No mostrar una sesión falsa de 30 min. No ofrecer el mes gratis de condominios: esta pieza lleva al registro general, no al enlace /c/<código>.

## Cierre, portada y movimiento

Últimos 3 s con la pose oficial `assets/coach-banana-senala.png`, botón ink con “Empieza 7 días gratis en bananaburn.app” y `public/icons/logo.svg`. Falta la pose local: Andrés debe aportar el PNG oficial ya existente. El render falla si falta; nunca usa otra pose. CTA y coach visibles desde el inicio del cierre; a los 1.5 s el botón cede a escala .97, manteniendo el cierre continuo y el cambio visual.

Paper #FFF8E3, banana #FFD60A e ink #1B1505; solo Plus Jakarta Sans 600/800. Zona segura: contenido entre x = 60 y 1020, y = 250 y 1570. Portada: título entre y = 500 y 1050, legible en recorte y = 285 a 1635. Entradas de 300 ms con curva cubic-bezier(0.23,1,0.32,1); gancho sin entrada y sin logo. Cortes cada 2 s o 1.5 s.

## Post propuesto

> Tu gym puede estar a unos pasos. Reserva 30 minutos para empezar y adapta la sesión a tu nivel, tus descansos y el equipo disponible; la duración real puede variar. Abre tu entreno, revisa los ejercicios y registra tu sesión. Empieza 7 días gratis en bananaburn.app
>
> #BananaBurn #GymDelEdificio #Condominios #EntrenamientoDeFuerza #HabitosSaludables

## Producción y revisión

Desde `proyecto/`: `npm run check` valida los tiempos y palabras sin instalar dependencias ni dibujar imágenes. Para producir después, `npm install`, habilitar el ejecutable de ffmpeg si hace falta (`chmod +x node_modules/@ffmpeg-installer/*/ffmpeg`) y `npm run render`. También existen `npm run reel`, `npm run anuncio`, `npm run portada` y `npm run hoja`. Se renderiza localmente, sin API ni créditos; requiere la pose oficial. No ejecutar generación de pago. No se adjuntan prompts para Higgsfield: se reutilizan capturas y arte oficial existente, sin nuevas imágenes.

Antes de publicar: revisar MP4 completo y versión corta, legibilidad de captura en celular, zona segura, portada recortada, cifras originales, advertencia médica si aplica y pose señalando correcta. La hoja es interna y no se publica. No se publica ni envía nada, ni se tocan campañas o dinero sin aprobación de Andrés.

## Embudo y rentabilidad

Mueve visita → registro → prueba con una utilidad concreta de Condominios. Objetivo comercial: contribuir a 100 usuarios de pago activos, no acumular vistas. Medición y límites de atribución en [medición compartida](../R05-R08_medicion.md). No añade gasto de medios, servicios de generación, stock ni herramientas; se reutilizan código, capturas y grabación propia disponible. El tiempo humano y cómputo local no se consideran ingresos ni se ocultan como costo cero total.
