# Del anuncio al primer entreno | 9 al 15 de noviembre de 2026

**Borradores para aprobación de Andrés.** No se ha publicado, programado ni respondido nada. Este paquete mueve visita al perfil > registro > primer entreno guardado; no modifica anuncios ni presupuesto.

## Entrega y uso

- [Historias y stickers](historias.md): 35 bases 1080 × 1920, 5 por día, más 2 sustituciones solo para Costa Rica. PNG finales en `historias/`.
- [Carruseles y pies](carruseles.md): 3 carruseles de 5 láminas 1080 × 1350, con textos alternativos. PNG finales en `carruseles/`.
- [Banco de respuestas](respuestas.md): comentarios cortos y mensajes privados listos para revisión.
- `revision/`: guías visuales con zona segura y rectángulo de sticker. No subir estas guías. Usar el PNG limpio y añadir el sticker nativo.
- `contenido.json` y `generar.mjs`: originales editables. Para regenerar todo, corre `node marketing/comunidad/semana-9-15-nov/generar.mjs` desde la raíz (usa Playwright, que ya está en el repo).

Historias: dejar libres y=0–249 y y=1570–1919. Texto dentro de x=90–990. Stickers: x=90, y=1160, ancho=900, alto=270. No rasterizar encuestas: se agregan en Instagram/Facebook. Las guías marcan el espacio, las fichas dicen pregunta, opciones y respuesta correcta. Revisar el ajuste real del sticker al cargarlo. **Arte v2 (7 nov):** cada pieza lleva a Coach Banana en grande, con el recurso oficial `public/brand/mascota-sola.webp`, y las piezas sin sticker muestran una captura real de la app dentro de un celular (`public/landing/campana-9nov`, sin cambiar números ni textos). Colores por tipo de historia: encuesta en paper, quiz en banana, caja en ink y enlace en banana con el botón bananaburn.app. Carruseles: portada banana con Coach, láminas paper con la captura y cierre ink con la llamada. Sin cifras de usuarios ni testimonios.

## Calendario propuesto

Todas las horas son de Costa Rica, UTC-6. Historias todos los días a las **08:00, 13:00, 18:00, 20:30 y 21:30**, en ese orden. La separación máxima es 10 h 30 min, de 21:30 a 08:00 del día siguiente. La llamada principal de la noche lleva el registro y el primer entreno. Andrés debe mantener cobertura desde la noche del 8 y la mañana del 16 con los borradores de esos días; este paquete no los sustituye.

| Fecha | Tema | Feed 21:00 UTC-6 | Audiencia |
| --- | --- | --- | --- |
| Lun 9 | Cuánto peso usar | Carrusel `latam` | General LATAM y visitantes de otros países |
| Mar 10 | Primer entreno en casa | Sin pieza nueva | General |
| Mié 11 | Necesito ir al gym | Carrusel `cr` | Carrusel y sustitución `11-01-cr`: solo Costa Rica |
| Jue 12 | Entrenar en español | Sin pieza nueva | Hispanohablantes, énfasis Estados Unidos |
| Vie 13 | Peso y técnica | Carrusel `usa` | Hispanos en Estados Unidos |
| Sáb 14 | Primer entreno en el gym | Sin pieza nueva | General; `14-01-cr` solo Costa Rica |
| Dom 15 | Haz el primero hoy | Sin pieza nueva | General |

Propuesta para reemplazar las historias y el feed de comunidad de [la semana existente](../semana-2026-11-09.md) en estas fechas, no para sumarlos todos. No cambia Business Suite, activación ni K15: Andrés concilia esos horarios al aprobar, evitando repetir CTA o publicar el carrusel viejo de comunidad además de estos tres. No se añaden piezas de Temporada.

Instagram comparte un perfil: un carrusel orgánico no se puede ocultar por país. El de condominios identifica Costa Rica desde la portada y condiciona el mes gratis al convenio; no reutilizarlo como anuncio general ni enviarlo a públicos de otros países. Si Andrés necesita aislamiento estricto, distribuirlo solo a una audiencia de residentes CR ya validada en Facebook o historias; dejar el carrusel de feed como borrador. Las historias CR sustituyen la primera del día únicamente donde Andrés pueda seleccionar una audiencia costarricense verificada; en historias públicas de Instagram usar las generales. No segmentar por una ubicación supuesta.

08:00 CR = 09:00 Colombia = 08:00 Guatemala. Estados Unidos tiene varias zonas: en noviembre 08:00 CR equivale a 09:00 Este / 06:00 Pacífico; 21:30 CR a 22:30 Este / 19:30 Pacífico. Son horas de publicación de la cuenta, no una promesa de entrenamiento a una hora local.

## Registro y oferta verificadas

Enlace de sticker: https://bananaburn.app/entrar?modo=registro. En el feed, bananaburn.app y el enlace del perfil. No usar `/registro`. Después de registrarte, entra en Hoy, abre el entreno, consulta cómo se hace cada ejercicio y guarda la sesión al terminar. Si ya tienes cuenta, inicia sesión: no se ofrece otra prueba por volver.

`src/lib/engine/index.ts` define la alternativa en casa de 12 min (`FIRST_HOME_MIN`); el primer entreno de gym puede durar hasta 15 min (`FIRST_MAX_MIN`). Por eso no se promete que todo entreno de gym dure 12 min. `src/lib/plans.ts` y `src/lib/trial.ts` confirman 7 días desde el alta, tarjeta opcional y cobro al final si se dejó programado. Las respuestas aclaran las condiciones. No se usa «sin tarjeta» en el arte, para evitar reutilizaciones fuera de vigencia.

Condominios: solo Costa Rica, mes gratis al sumarse el condominio y activarse con su enlace `/c/<código>` real. No inventar códigos. La landing `/condominios` es para administraciones, no activa el beneficio para residentes. El registro genérico conserva sus 7 días. La administración nunca paga; cada residente decide si sigue con un plan después.

## Coordinación y medición para Andrés

Nota pendiente para Martín, sin mensaje enviado: alinear los Reels «¿Cuánto peso usar?» y «Gym del condominio» con los carruseles `latam` y `cr`. Mantener el último solo en Costa Rica y la prueba de Estados Unidos en español. Los presupuestos del issue son contexto ($5.50 diarios Colombia + Guatemala juntos, $2.50 CR, $2 EE. UU. por 7 días); esta entrega no autoriza ni ejecuta gasto.

Antes de aprobar: verificar acceso real desde los cuatro países y revisar qué medios de pago están habilitados en producción, especialmente EE. UU. No prometer aceptación de todas las tarjetas ni cobro en moneda local. Probar el enlace de perfil con sesión cerrada y el acceso a la alternativa de casa.

Andrés registra por día y país, solo cuando el dato exista: alcance, visitas al perfil, toques al enlace, consultas por objeción, registros y primer entreno guardado dentro de 72 h. Dejar «pendiente» si falta evidencia, sin atribuir un registro a una encuesta. Objetivo operativo: registrados que guardan su primer entreno en 72 h / registrados de la cohorte con 72 h de observación. `funnel_events`: `workout_open`, `workout_first_set`, `workout_saved`, `workout_leave`; usar el primer `workout_saved` por cuenta. Completar registro se verifica al terminar bienvenida; Meta CompleteRegistration no equivale a primer entreno. País solo si se conoce legítimamente; no inferirlo por idioma. El enlace genérico no atribuye por pieza y las UTMs sin `ref` no se guardan: reportar agregado y atribución pendiente.

Seguimiento de pago al madurar la cohorte: primer cobro en `trial_charges` con estado `succeeded` y suscripción vigente, deduplicado por cuenta; no sustituirlo por Meta Subscribe. Sin metas de alcance o ventas inventadas. Revisar oferta y fechas si se reutiliza después de esta semana.

## Control de entrega

Se verificaron las dimensiones de los 89 PNG: 37 bases de historias, sus 37 guías y 15 láminas de carrusel. Comprobación de contenido: cinco historias generales cada día, encuesta/quiz/caja/enlace diarios, tres carruseles de cinco láminas y menciones de condominio limitadas a variantes CR. Revisión visual de una muestra de historias, guías y láminas con la oferta de condominio. Las imágenes se generan sin desbordamiento vertical del texto. La aprobación final incluye revisar todos los PNG y colocar los stickers en la interfaz de cada plataforma.
