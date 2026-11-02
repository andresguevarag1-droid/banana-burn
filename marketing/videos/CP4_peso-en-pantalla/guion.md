# CP4_peso-en-pantalla: paquete de producción

Propuesta para el 16 de noviembre de 2026, issue #169. Costa Rica y Colombia, español latino neutro, misma edición para ambos países. No publicado ni enviado. Sin llamadas a generación, créditos, contratación o cambios de campañas. No hay MP4 ni PNG finales: se entregan guion, brief, prompts fijos y motion graphics editables en código, con la estructura de R05 a R16.

## Salidas previstas

- `CP4_peso-en-pantalla.mp4`: 18 s, 1080 x 1920, 30 fps, H.264, sin audio.
- `CP4_peso-en-pantalla_11s.mp4`: 11 s para anuncios, mismas especificaciones.
- `CP4_peso-en-pantalla_portada.png`: 1080 x 1920, título en recorte central 1080 x 1350.
- `CP4_peso-en-pantalla_hoja-revision.png`: contacto interno de siete escenas.

## Guion con tiempos

Gancho completo desde el cuadro 0, sin entrada ni logo. Máximo ocho palabras añadidas por pantalla, contando “Ejemplo”; el texto original de la captura permanece intacto. No añadir subtítulos simultáneos. Cambio visual cada 2.5 s en Reel y 2 s en anuncio. Cierre continuo de 3 s, con pulsación a los 1.5 s para mantener cambio visual sin retirar elementos.

| Reel (s) | Anuncio (s) | Texto añadido | Imagen / montaje UGC |
| --- | --- | --- | --- |
| 0 a 2.5 | 0 a 2 | Cuando no sabes cuánto peso usar | Persona mira el celular junto al banco; corte a prueba visual de la app. |
| 2.5 a 5 | Se omite | Mira tu entreno en Banana Burn | Detalle del espacio y celular; sin pantalla inventada. |
| 5 a 7.5 | 2 a 4 | Revisa la carga indicada + Ejemplo | Captura real completa en teléfono ink. |
| 7.5 a 10 | Se omite | Sigue las repeticiones indicadas + Ejemplo | Captura real completa en teléfono ink. |
| 10 a 12.5 | 4 a 6 | La carga depende de tu nivel + Ejemplo | Captura real completa en teléfono ink. |
| 12.5 a 15 | 6 a 8 | Tu guía está en el celular + Ejemplo | Captura real completa en teléfono ink. |
| 15 a 18 | 8 a 11 | Empieza 7 días gratis en bananaburn.app + Ejemplo | Captura real + Coach Banana señalando + botón y logo. |

## Brief para creador UGC

Persona mira el celular junto al banco; corte a prueba visual de la app.

Escena actuada de duda cotidiana, sin testimonio ni afirmaciones de resultados. Una persona adulta con autorización de imagen y permiso de uso comercial para ambos países; espacio autorizado. No contratar ni reservar nada en esta entrega. Usar material propio con derechos existentes. Comparar contra el anuncio original para garantizar otra persona; no se dispone aquí del original ni se afirma haberlo comprobado.

Grabar vertical 1080 x 1920, 30 fps: seis tomas limpias de 6 s (rack, duda entre mancuernas, abrir entreno, mirar celular, preparar banco y repetición controlada). Sin texto grabado, música, voz, marcas visibles ni terceros reconocibles. No levantar una carga para imitar los 20 kg de la muestra. Verificar técnica con una persona competente; no representar dolor ni sobreesfuerzo. Entregar tomas originales y permisos al editor. No se envían solicitudes en esta tarea.

El editor usa los cortes de la tabla; las escenas de teléfono reemplazan el plano por la captura real. El proyecto en código es una alternativa de tarjetas y capturas, no integra automáticamente los clips UGC. Sustituir sus tarjetas iniciales por las tomas indicadas para producir la variante con persona. No confundir esa alternativa con el anuncio UGC terminado.

## Captura y cierre que prueba el producto

Fuente: `public/landing/entreno.png`, revisada visualmente: “Puente de glúteo con barra”, “Serie 2 de 3”, “10 a 12 repeticiones con 20 kg”. Es un ejemplo de una sesión concreta, no la carga inicial recomendada para todas las personas. No afirmar que esos 20 kg son adecuados para quien ve el anuncio. La app guía según el entreno; no sustituye revisión de técnica presencial.

Mostrar captura completa, escala uniforme y marco ink radio 42; no cambiar números ni reconstruir interfaz. En el cierre final la captura permanece a la izquierda con “Ejemplo”; Coach Banana oficial señalando a la derecha, botón ink debajo con “Empieza 7 días gratis en bananaburn.app” y logo `public/icons/logo.svg`. Hay siete palabras añadidas en total. El cierre conserva así la evidencia real del peso indicado, además del CTA.

Falta `assets/coach-banana-senala.png` oficial. El render falla antes de crear medios si falta; no sustituir por la pose de pie. Confirmar que la pose oficial apunta hacia captura/botón sin modificar el arte. Revisar legibilidad móvil del peso en el cierre; si no resulta legible, ajustar escala o encuadre de la captura original sin alterar cifras y revisar de nuevo antes de aprobar.

## Marca y movimiento

Paper #FFF8E3, banana #FFD60A, ink #1B1505. Solo Plus Jakarta Sans 600/800. Zona segura x=60 a 1020, y=250 a 1570. Gancho en y=620, dentro del recorte central de portada. Entradas de 300 ms cubic-bezier(0.23,1,0.32,1), nunca desde escala cero; gancho y cierre visibles completos desde su inicio. Sin otros personajes ni testimonios.

## Prompt de imagen fija para Higgsfield, archivado sin ejecutar

«Fotografía fija vertical de un gimnasio de condominio latinoamericano, rack de mancuernas y banco, luz natural cálida, sin personas, personajes, logos, textos ni pantallas. Composición con espacio central libre. Escena ilustrativa». Referencia opcional de ambiente, no captura de producto ni sustituto de grabación real. Nunca pedir video. No se necesita para producir el paquete y no autoriza gastar créditos.

## Post propuesto para ambos países

> Cuando no sabes cuánto peso usar, abre tu entreno y revisa la carga y las repeticiones indicadas. La pantalla muestra un ejemplo; tu carga depende de tu nivel y del ejercicio. Empieza 7 días gratis en bananaburn.app, sin tarjeta. Después eliges tu plan: Entreno desde $9.99 al mes. Precios en USD, IVA incluido.
>
> #BananaBurn #EntrenamientoDeFuerza #GymDelCondominio #RutinaDeGym #Entrenamiento

No ofrecer el mes de convenio: esta pieza lleva a la prueba general en ambos países, no a /c/<código>.

## Producción y aprobación

Desde `proyecto/`: `npm run check` valida sin dependencias ni render. Producción local posterior: `npm install`, habilitar ffmpeg si hace falta con `chmod +x node_modules/@ffmpeg-installer/*/ffmpeg`, y `npm run render`. También disponibles reel, anuncio, portada y hoja. Sin servicios externos de generación. El check no certifica permisos, técnica, pose ni legibilidad final.

Antes de aprobar: cotejar persona con original; verificar permisos CR/CO, gancho en primer segundo, cambios visuales, duración 18/11 s, captura intacta, carga legible, cierre exacto de 3 s con pose oficial, ocho palabras máximo y portada recortada. Revisar completos ambos MP4 en celular. Medios finales y revisión visual pendientes. Nada se publica, envía, gasta ni toca campañas sin aprobación escrita de Andrés.

## Embudo y dinero

Mueve visita → registro → primer entreno → primer pago. Ver [medición compartida y netos](../CP2-CP4_medicion.md). Sin pronósticos de registros ni pagos por creativo; se elige por costo por usuario de pago y neto cobrado, no solo por registro barato.
