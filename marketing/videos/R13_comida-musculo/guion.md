# R13_comida-musculo: Lo que como para cuidar músculo

Paquete editable para el 23 al 29 de noviembre de 2026, issue #135. Sin publicación ni gasto. MP4 y PNG pendientes de producción local y revisión: falta la pose oficial señalando.

## Salidas previstas

- R13_comida-musculo.mp4: 19 s, 1080 x 1920, 30 fps, H.264, sin audio.
- R13_comida-musculo_15s.mp4: 15 s, mismas especificaciones; no autoriza activar anuncios.
- R13_comida-musculo_portada.png: 1080 x 1920, gancho legible en recorte central 1080 x 1350.
- R13_comida-musculo_hoja-revision.png: contacto interno de nueve escenas.

## Guion toma por toma

Gancho visible desde cuadro 0, sin logo inicial. Máximo ocho palabras añadidas por pantalla, incluida “Ejemplo”; los textos originales de la captura se conservan. No añadir otros subtítulos.

| Reel 19 s | Versión 15 s | Texto en pantalla | Palabras | Toma / montaje UGC |
| --- | --- | --- | --- | --- |
| 0 a 2 s | 0 a 1.5 s | Lo que como para cuidar músculo | 6 | Menú ilustrativo; no testimonio ni garantía. |
| 2 a 4 s | 1.5 a 3 s | Desayuno: huevos con pan | 4 | Grabar preparación propia, sin cantidades prescritas. |
| 4 a 6 s | 3 a 4.5 s | Almuerzo: pollo, arroz y frijoles | 5 | Plano cenital de comida propia. |
| 6 a 8 s | 4.5 a 6 s | Merienda: yogur con banana | 4 | Sin prometer un menú universal. |
| 8 a 10 s | 6 a 7.5 s | Cena: lentejas y verduras | 4 | Alternativa ilustrativa, adaptar porciones individualmente. |
| 10 a 12 s | 7.5 a 9 s | Registra lo que comes + etiqueta “Ejemplo” | 5 | Captura real, sin modificar cifras. |
| 12 a 14 s | 9 a 10.5 s | Entreno + Nutrición + etiqueta “Ejemplo” | 4 | Captura real, sin modificar cifras. |
| 14 a 16 s | 10.5 a 12 s | Combina comida y fuerza | 4 | Sin prometer evitar toda pérdida muscular. |
| 16 a 19 s | 12 a 15 s | Empieza 7 días gratis en bananaburn.app | 6 | Coach Banana señalando oficial, botón ink y logo. |

## Video base y brief UGC

Video base 4. Grabar huevos, pollo con arroz y frijoles, yogur con banana y lentejas. Es un ejemplo ilustrativo, no un día real de un cliente ni una prescripción. No asignar calorías o gramos a los platos. No se menciona GLP-1; si se añade después, requiere revisión clínica/editorial y el aviso exacto «No sustituye la indicación de tu médico.» en ambas versiones y post.

Grabar tomas propias de 6 s, vertical 1080 x 1920, 30 fps, luz natural, sin caras reconocibles, marcas, voz ni música. Seleccionar 2 s por toma o 1.5 s en el corto. Solo material existente con derechos o grabación propia sin nuevas contrataciones. El proyecto renderiza tarjetas y capturas reales; el montaje UGC se realiza manualmente siguiendo la tabla, reemplazando tarjetas, sin superponer textos adicionales. No generar videos.

## Captura real

public/landing/nutricion.png completa: modo normal con 2,500 kcal y 185 g; son cifras del ejemplo de la app, no objetivos para toda persona ni cantidades del menú ilustrativo. No presentarla como Banana Shield.

Escala uniforme, marco de teléfono ink de radio 42. No cambiar números, recrear interfaz ni presentar las cifras como resultados o prescripción personal.

## Marca, cierre y portada

Paper #FFF8E3, banana #FFD60A, ink #1B1505, solo Plus Jakarta Sans 600/800. Zona segura x=60 a 1020, y=250 a 1570. Portada con gancho en y=620 a 1120, legible en recorte central. Entradas de 300 ms, cubic-bezier(0.23,1,0.32,1); gancho sin entrada. Cambio cada 2 s o 1.5 s; cierre de 3 s con pulsación del botón a mitad, manteniendo coach, CTA y logo visibles.

Cierre exacto: Coach Banana señalando + botón ink “Empieza 7 días gratis en bananaburn.app” + public/icons/logo.svg. Falta assets/coach-banana-senala.png oficial. No sustituir por la pose de pie ni crear otra. El render se detiene si falta.

## Prompt de imagen fija para Higgsfield, no ejecutar

«Imagen fija vertical de platos de huevos, pollo con arroz y frijoles, yogur con banana y lentejas, luz natural cálida, sin personas, personajes, texto ni logos. Escena ilustrativa». Solo referencia opcional para futura autorización específica, nunca video. No llamar servicios ni gastar créditos. No se necesita para producir este paquete; usar material propio y capturas existentes.

## Post propuesto

> Un menú ilustrativo para recordar que comida y fuerza van juntas. Adapta las porciones a tus necesidades; ningún menú garantiza conservar todo el músculo. Registra tus comidas con Entreno + Nutrición, $14.99/mes después de la prueba. Empieza 7 días gratis en bananaburn.app, sin tarjeta.
>
> #BananaBurn #Proteina #ComidaReal #EntrenamientoDeFuerza #Nutricion

## Producción y revisión

Desde proyecto/: `npm run check` funciona sin instalar dependencias y no genera medios. Producción local posterior: `npm install`, `chmod +x node_modules/@ffmpeg-installer/*/ffmpeg` si hace falta, `npm run render`. También disponibles reel, anuncio, portada y hoja como scripts npm. Instalar paquetes no genera contenido de pago. Revisar ambos videos completos, recorte central de portada, legibilidad móvil, captura sin alteraciones y pose oficial. No se han generado imágenes ni videos en esta entrega.

Nada se publica, envía, gasta ni toca campañas sin aprobación escrita de Andrés. La revisión visual final sigue pendiente del render con la pose oficial.

## Embudo y rentabilidad

Mueve visita a prueba de siete días sin tarjeta y primer pago; R13 también orienta al plan más alto, Entreno + Nutrición. Ver [medición y escenarios](../R13-R16_medicion.md). No atribuir ingresos sin cobros confirmados ni conversiones sin datos.
