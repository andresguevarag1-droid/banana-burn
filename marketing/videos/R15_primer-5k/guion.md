# R15_primer-5k: De 0 a tu primer 5K

Paquete editable para el 23 al 29 de noviembre de 2026, issue #135. Sin publicación ni gasto. MP4 y PNG pendientes de producción local y revisión: falta la pose oficial señalando.

## Salidas previstas

- R15_primer-5k.mp4: 19 s, 1080 x 1920, 30 fps, H.264, sin audio.
- R15_primer-5k_15s.mp4: 15 s, mismas especificaciones; no autoriza activar anuncios.
- R15_primer-5k_portada.png: 1080 x 1920, gancho legible en recorte central 1080 x 1350.
- R15_primer-5k_hoja-revision.png: contacto interno de nueve escenas.

## Guion toma por toma

Gancho visible desde cuadro 0, sin logo inicial. Máximo ocho palabras añadidas por pantalla, incluida “Ejemplo”; los textos originales de la captura se conservan. No añadir otros subtítulos.

| Reel 19 s | Versión 15 s | Texto en pantalla | Palabras | Toma / montaje UGC |
| --- | --- | --- | --- | --- |
| 0 a 2 s | 0 a 1.5 s | De 0 a tu primer 5K | 6 | Zapatillas propias, sin promesa de plazo. |
| 2 a 4 s | 1.5 a 3 s | Empieza caminando si lo necesitas | 5 | UGC: caminata cómoda. |
| 4 a 6 s | 3 a 4.5 s | Alterna caminar y correr | 4 | UGC: trote cómodo, sin prescribir intervalos. |
| 6 a 8 s | 4.5 a 6 s | Avanza según tu nivel | 4 | Tarjeta de texto. |
| 8 a 10 s | 6 a 7.5 s | Conoce el plan de carrera + etiqueta “Ejemplo” | 6 | Captura real, sin modificar cifras. |
| 10 a 12 s | 7.5 a 9 s | Aumenta poco a poco + etiqueta “Ejemplo” | 5 | Captura real, sin modificar cifras. |
| 12 a 14 s | 9 a 10.5 s | Deja espacio para recuperarte | 4 | UGC: descanso. |
| 14 a 16 s | 10.5 a 12 s | Tu primer 5K, a tu ritmo | 6 | No prometer llegar en la prueba. |
| 16 a 19 s | 12 a 15 s | Empieza 7 días gratis en bananaburn.app | 6 | Coach Banana señalando oficial, botón ink y logo. |

## Video base y brief UGC

Video base 3. Grabar zapatillas, caminata y trote de espaldas. No dar plazo para completar 5K ni prometer que siete días bastan. No vender inscripciones de Temporada 1: cerraron el 22 de noviembre.

Grabar tomas propias de 6 s, vertical 1080 x 1920, 30 fps, luz natural, sin caras reconocibles, marcas, voz ni música. Seleccionar 2 s por toma o 1.5 s en el corto. Solo material existente con derechos o grabación propia sin nuevas contrataciones. El proyecto renderiza tarjetas y capturas reales; el montaje UGC se realiza manualmente siguiendo la tabla, reemplazando tarjetas, sin superponer textos adicionales. No generar videos.

## Captura real

Recorte real de public/landing/running-plan.webp: x=32, y=138, ancho=716, alto=475, solo tarjeta “Km por semana del plan”. Excluye ritmos de la muestra 21K; no se presenta como un plan 5K. Etiqueta “Ejemplo”. No alterar barras ni reconstruir cifras. El recorte se hace en memoria, sin generar una imagen nueva de pago.

Escala uniforme, marco de teléfono ink de radio 42. No cambiar números, recrear interfaz ni presentar las cifras como resultados o prescripción personal.

## Marca, cierre y portada

Paper #FFF8E3, banana #FFD60A, ink #1B1505, solo Plus Jakarta Sans 600/800. Zona segura x=60 a 1020, y=250 a 1570. Portada con gancho en y=620 a 1120, legible en recorte central. Entradas de 300 ms, cubic-bezier(0.23,1,0.32,1); gancho sin entrada. Cambio cada 2 s o 1.5 s; cierre de 3 s con pulsación del botón a mitad, manteniendo coach, CTA y logo visibles.

Cierre exacto: Coach Banana señalando + botón ink “Empieza 7 días gratis en bananaburn.app” + public/icons/logo.svg. Falta assets/coach-banana-senala.png oficial. No sustituir por la pose de pie ni crear otra. El render se detiene si falta.

## Prompt de imagen fija para Higgsfield, no ejecutar

«Imagen fija vertical de zapatillas en un parque con luz cálida, luz natural cálida, sin personas, personajes, texto ni logos. Escena ilustrativa». Solo referencia opcional para futura autorización específica, nunca video. No llamar servicios ni gastar créditos. No se necesita para producir este paquete; usar material propio y capturas existentes.

## Post propuesto

> Camina, alterna con trote y avanza según tu nivel, sin prometer una fecha para llegar a 5K. La captura muestra un recorte ilustrativo de la app, no un plan 5K personalizado. Empieza 7 días gratis en bananaburn.app, sin tarjeta. Entreno: $9.99/mes después de la prueba.
>
> #BananaBurn #Primer5K #Running #CaminarYCorrer #Principiantes

## Producción y revisión

Desde proyecto/: `npm run check` funciona sin instalar dependencias y no genera medios. Producción local posterior: `npm install`, `chmod +x node_modules/@ffmpeg-installer/*/ffmpeg` si hace falta, `npm run render`. También disponibles reel, anuncio, portada y hoja como scripts npm. Instalar paquetes no genera contenido de pago. Revisar ambos videos completos, recorte central de portada, legibilidad móvil, captura sin alteraciones y pose oficial. No se han generado imágenes ni videos en esta entrega.

Nada se publica, envía, gasta ni toca campañas sin aprobación escrita de Andrés. La revisión visual final sigue pendiente del render con la pose oficial.

## Embudo y rentabilidad

Mueve visita a prueba de siete días sin tarjeta y primer pago; R13 también orienta al plan más alto, Entreno + Nutrición. Ver [medición y escenarios](../R13-R16_medicion.md). No atribuir ingresos sin cobros confirmados ni conversiones sin datos.
