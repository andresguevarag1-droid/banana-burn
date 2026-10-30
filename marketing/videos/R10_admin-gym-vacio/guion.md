# R10: Administrador: el gym del condominio está vacío

Paquete de producción para el 16 al 22 de noviembre de 2026, issue #116. Pendiente de producción y aprobación por escrito de Andrés. No se han generado MP4 ni PNG. Mantiene la estructura de R05 a R08: guion, proyecto editable y assets.

| Salida prevista, no entregada | Especificación |
| --- | --- |
| R10_admin-gym-vacio.mp4 | 19 s, 1080 x 1920, 30 fps, H.264, sin audio |
| R10_admin-gym-vacio_15s.mp4 | 15 s, mismas especificaciones, propuesta sin activar anuncios |
| R10_admin-gym-vacio_portada.png | 1080 x 1920, gancho legible en recorte central 1080 x 1350 |
| R10_admin-gym-vacio_hoja-revision.png | Contacto interno de nueve escenas |

## Guion toma por toma

Gancho visible desde cuadro 0, sin logo al inicio. Máximo ocho palabras añadidas por pantalla, incluida “Ejemplo”; la captura conserva sus textos y números originales. Sin voz ni música. No añadir subtítulos ni rótulos simultáneos fuera de esta tabla.

| Reel 19 s | Versión 15 s | Texto en pantalla | Palabras | Toma / montaje UGC |
| --- | --- | --- | --- | --- |
| 0 a 2 s | 0 a 1.5 s | Administrador: el gym del condominio está vacío | 7 | Plano propio de gimnasio vacío, sin atribuirlo a un cliente real. |
| 2 a 4 s | 1.5 a 3 s | Ofrece un plan para empezar | 5 | Detalle de equipo disponible en el gimnasio. |
| 4 a 6 s | 3 a 4.5 s | Rutinas con el equipo disponible + etiqueta “Ejemplo” | 6 | Captura real completa de Hoy. |
| 6 a 8 s | 4.5 a 6 s | Costa Rica: condominios aliados | 4 | Tarjeta que delimita el alcance territorial y el convenio. |
| 8 a 10 s | 6 a 7.5 s | Primer mes gratis para residentes | 5 | Oferta condicionada por la tarjeta anterior; todos los residentes. |
| 10 a 12 s | 7.5 a 9 s | La administración nunca paga | 4 | Tarjeta sin prometer acceso a un panel. |
| 12 a 14 s | 9 a 10.5 s | Después, cada residente decide y paga | 6 | Plano propio de equipo, sin simular testimonios. |
| 14 a 16 s | 10.5 a 12 s | Prueba general: siete días gratis | 5 | Se distingue el cierre general del beneficio por convenio. |
| 16 a 19 s | 12 a 15 s | Empieza 7 días gratis en bananaburn.app | 6 | Coach Banana señalando + botón ink + logo oficial. |

## Video base y brief para grabación propia

Video base 2: grabar puerta, plano amplio del gimnasio vacío y manos preparando equipo. Usar instalaciones propias o material autorizado sin contratar servicios. No mostrar residentes identificables ni afirmar que el gimnasio de un cliente está vacío. La escena es ilustrativa, no un caso de éxito.

Grabar vertical a 1080 x 1920 y 30 fps, tomas de 6 s con luz natural, sin voz, música, texto ni logos de terceros. Elegir 2 s por escena o 1.5 s en el corto. Solo material propio ya disponible con derechos de uso, sin contratar, comprar stock ni generar video. Las tarjetas y capturas reemplazan el plano completo. El proyecto local usa motion graphics y captura; no compone clips automáticamente. El montaje UGC sigue la misma tabla en un editor.

## Captura real

Usar `public/landing/hoy2.png`, completa, en marco de teléfono ink radio 42, con etiqueta “Ejemplo” exterior. Escala uniforme; no reconstruir la interfaz ni alterar números. La captura de Hoy es un ejemplo individual, no un panel para administraciones. La administración no tiene acceso a la app ni a datos personales; el equipo comparte solo conteos agregados. La oferta del mes aplica a condominios aliados de Costa Rica y se activa por /c/<codigo>, no desde el CTA general. /condominios es para administraciones y reunión de 30 minutos.

## Cierre, portada y movimiento

Últimos 3 s: Coach Banana señalando oficial, botón ink “Empieza 7 días gratis en bananaburn.app” y logo de public/icons/logo.svg. Falta `assets/coach-banana-senala.png`: se requiere el PNG oficial existente. Nunca sustituir por otra pose. El proyecto se detiene si falta.

Paper #FFF8E3, banana #FFD60A, ink #1B1505; solo Plus Jakarta Sans 600/800. Contenido entre x = 60 y 1020, y = 250 y 1570. Gancho de portada entre y = 620 y 1120, dentro del recorte central y = 285 a 1635. Entradas de 300 ms, cubic-bezier(0.23,1,0.32,1), sin entrada para el gancho. Cortes cada 2 s o 1.5 s; cierre continuo con cambio de escala del botón a los 1.5 s, sin ocultar CTA, coach o logo.

## Prompts de imagen fija para Higgsfield, no ejecutar

Prompt opcional archivado para una futura autorización específica: «Imagen fija vertical de gimnasio residencial vacío con banco y mancuernas, luz natural cálida, sin personas, personajes, texto ni logos. Escena ilustrativa». No es un prompt de video. No se necesita para este paquete: reutilizar material existente. No llamar servicios, gastar créditos ni generar imágenes. Coach Banana se toma únicamente del PNG oficial, no de este prompt.

## Post propuesto

> Una rutina puede facilitar el primer paso en el gimnasio del edificio. Propuesta para administraciones de Costa Rica: al sumarse el condominio, todos sus residentes reciben el primer mes gratis, con entreno y nutrición, sin tarjeta. La administración nunca paga; después cada residente decide si sigue y paga su plan. Reunión virtual de 30 minutos en bananaburn.app/condominios. Para conocer la app por cuenta propia: empieza 7 días gratis en bananaburn.app. El mes del convenio se activa con el enlace exclusivo del condominio, no con la prueba general. Escena ilustrativa.
>
> #BananaBurn #Condominios #AdministracionDeCondominios #GimnasioResidencial #Entrenamiento

## Producción y revisión

Desde `proyecto/`: `npm run check` valida sin instalar dependencias ni producir medios. Para producción local posterior: `npm install`, `chmod +x node_modules/@ffmpeg-installer/*/ffmpeg` si hace falta y `npm run render`; también `npm run reel`, `npm run anuncio`, `npm run portada` y `npm run hoja`. Requiere la pose oficial. Ningún comando llama servicios externos de generación.

Revisar ambos MP4 completos, portada recortada, números originales, captura legible en celular, zona segura, pose y texto exacto del cierre. En R11 revisar además aviso médico en ambas versiones y post, sin atribuir condiciones personales ni dar indicaciones clínicas. La advertencia ocupa una tarjeta propia de siete palabras para conservar el límite, no se superpone a otras pantallas. Sin publicación, envío, gasto ni cambios de campañas sin aprobación escrita de Andrés. La hoja es interna.

## Embudo y rentabilidad

Mueve visita → prueba de siete días → primer pago; el objetivo es contribuir a 100 usuarios de pago activos con ingresos que cubran gasto. R09 también propone compra extra de Running; R10 abre una conversación B2B que convierte residentes después de su mes; R11 orienta a Entreno + Nutrición sin prometerlo al precio de Entreno. Ver [medición y escenarios](../R09-R11_medicion.md). No se asignan conversiones o ingresos esperados sin datos. No hay gasto nuevo autorizado.
