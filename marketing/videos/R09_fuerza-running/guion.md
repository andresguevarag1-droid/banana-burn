# R09: Fuerza para complementar el running

Paquete de producción para el 16 al 22 de noviembre de 2026, issue #116. Pendiente de producción y aprobación por escrito de Andrés. No se han generado MP4 ni PNG. Mantiene la estructura de R05 a R08: guion, proyecto editable y assets.

| Salida prevista, no entregada | Especificación |
| --- | --- |
| R09_fuerza-running.mp4 | 19 s, 1080 x 1920, 30 fps, H.264, sin audio |
| R09_fuerza-running_15s.mp4 | 15 s, mismas especificaciones, propuesta sin activar anuncios |
| R09_fuerza-running_portada.png | 1080 x 1920, gancho legible en recorte central 1080 x 1350 |
| R09_fuerza-running_hoja-revision.png | Contacto interno de nueve escenas |

## Guion toma por toma

Gancho visible desde cuadro 0, sin logo al inicio. Máximo ocho palabras añadidas por pantalla, incluida “Ejemplo”; la captura conserva sus textos y números originales. Sin voz ni música. No añadir subtítulos ni rótulos simultáneos fuera de esta tabla.

| Reel 19 s | Versión 15 s | Texto en pantalla | Palabras | Toma / montaje UGC |
| --- | --- | --- | --- | --- |
| 0 a 2 s | 0 a 1.5 s | Correr también requiere fuerza | 4 | Zapatillas y mancuernas en plano; gancho educativo. |
| 2 a 4 s | 1.5 a 3 s | Sin fuerza no significa lesión segura | 6 | Tarjeta que evita la equivalencia absoluta del kit. |
| 4 a 6 s | 3 a 4.5 s | Combina carrera y fuerza | 4 | Tomas propias alternadas de carrera cómoda y fuerza controlada. |
| 6 a 8 s | 4.5 a 6 s | Revisa tu plan de carrera + etiqueta “Ejemplo” | 6 | Captura real completa de running-plan. |
| 8 a 10 s | 6 a 7.5 s | Organiza tus sesiones + etiqueta “Ejemplo” | 4 | Misma captura completa; entrada nueva sin cambiar cifras. |
| 10 a 12 s | 7.5 a 9 s | Conoce la Temporada de Running | 5 | Tarjeta de descubrimiento de la temporada, sin prometer inclusión. |
| 12 a 14 s | 9 a 10.5 s | Compra aparte; incluida con plan anual | 6 | Tarjeta de condiciones: una temporada incluida por año pagado. |
| 14 a 16 s | 10.5 a 12 s | Empieza con un plan + etiqueta “Ejemplo” | 5 | Regreso al ejemplo real de running-plan. |
| 16 a 19 s | 12 a 15 s | Empieza 7 días gratis en bananaburn.app | 6 | Coach Banana señalando + botón ink + logo oficial. |

## Video base y brief para grabación propia

Videos base 1 y 3: grabar carrera cómoda de espaldas y ejercicios de fuerza controlados con equipo disponible. Sin representar lesiones, diagnósticos ni rehabilitación. No prometer prevención de lesiones. La fórmula del título del kit «Corredor sin fuerza = corredor lesionado» se conserva solo como referencia editorial: no se publica como afirmación causal.

Grabar vertical a 1080 x 1920 y 30 fps, tomas de 6 s con luz natural, sin voz, música, texto ni logos de terceros. Elegir 2 s por escena o 1.5 s en el corto. Solo material propio ya disponible con derechos de uso, sin contratar, comprar stock ni generar video. Las tarjetas y capturas reemplazan el plano completo. El proyecto local usa motion graphics y captura; no compone clips automáticamente. El montaje UGC sigue la misma tabla en un editor.

## Captura real

Usar `public/landing/running-plan.webp`, completa, en marco de teléfono ink radio 42, con etiqueta “Ejemplo” exterior. Escala uniforme; no reconstruir la interfaz ni alterar números. La captura es un ejemplo 21K con meta 1:55:00, no un plan 5K ni un resultado del usuario. Se muestra completa, sin cambiar distancia, tiempos o cifras. No prometer que la Temporada viene con la prueba: es una compra aparte de $14.99, salvo la temporada incluida en cada año pagado. Verificar fechas y disponibilidad antes de publicar.

## Cierre, portada y movimiento

Últimos 3 s: Coach Banana señalando oficial, botón ink “Empieza 7 días gratis en bananaburn.app” y logo de public/icons/logo.svg. Falta `assets/coach-banana-senala.png`: se requiere el PNG oficial existente. Nunca sustituir por otra pose. El proyecto se detiene si falta.

Paper #FFF8E3, banana #FFD60A, ink #1B1505; solo Plus Jakarta Sans 600/800. Contenido entre x = 60 y 1020, y = 250 y 1570. Gancho de portada entre y = 620 y 1120, dentro del recorte central y = 285 a 1635. Entradas de 300 ms, cubic-bezier(0.23,1,0.32,1), sin entrada para el gancho. Cortes cada 2 s o 1.5 s; cierre continuo con cambio de escala del botón a los 1.5 s, sin ocultar CTA, coach o logo.

## Prompts de imagen fija para Higgsfield, no ejecutar

Prompt opcional archivado para una futura autorización específica: «Imagen fija vertical de zapatillas de running junto a mancuernas en un parque, luz cálida, sin personas, personajes, texto ni logos. Escena ilustrativa». No es un prompt de video. No se necesita para este paquete: reutilizar material existente. No llamar servicios, gastar créditos ni generar imágenes. Coach Banana se toma únicamente del PNG oficial, no de este prompt.

## Post propuesto

> La fuerza complementa la preparación para correr; no garantiza evitar lesiones. Revisa el plan de carrera y conoce la Temporada de Running: $14.99 como compra aparte; cada año pagado incluye una temporada deportiva. Empieza 7 días gratis en bananaburn.app. La prueba no incluye la compra de una temporada.
>
> #BananaBurn #Running #EntrenamientoDeFuerza #PlanDeCarrera #Temporadas

## Producción y revisión

Desde `proyecto/`: `npm run check` valida sin instalar dependencias ni producir medios. Para producción local posterior: `npm install`, `chmod +x node_modules/@ffmpeg-installer/*/ffmpeg` si hace falta y `npm run render`; también `npm run reel`, `npm run anuncio`, `npm run portada` y `npm run hoja`. Requiere la pose oficial. Ningún comando llama servicios externos de generación.

Revisar ambos MP4 completos, portada recortada, números originales, captura legible en celular, zona segura, pose y texto exacto del cierre. En R11 revisar además aviso médico en ambas versiones y post, sin atribuir condiciones personales ni dar indicaciones clínicas. La advertencia ocupa una tarjeta propia de siete palabras para conservar el límite, no se superpone a otras pantallas. Sin publicación, envío, gasto ni cambios de campañas sin aprobación escrita de Andrés. La hoja es interna.

## Embudo y rentabilidad

Mueve visita → prueba de siete días → primer pago; el objetivo es contribuir a 100 usuarios de pago activos con ingresos que cubran gasto. R09 también propone compra extra de Running; R10 abre una conversación B2B que convierte residentes después de su mes; R11 orienta a Entreno + Nutrición sin prometerlo al precio de Entreno. Ver [medición y escenarios](../R09-R11_medicion.md). No se asignan conversiones o ingresos esperados sin datos. No hay gasto nuevo autorizado.
