# R13 a R16: medición y rentabilidad

Semana del 23 al 29 de noviembre de 2026. Cuatro paquetes editables; medios finales pendientes de pose oficial y revisión. Sin gasto, publicación, envío ni cambios de campañas.

| Pieza | Paso del embudo | Medición |
| --- | --- | --- |
| R13 | Prueba a primer pago; plan más alto | Pruebas y pagos confirmados de Entreno + Nutrición; diferencia de tarifa frente a Entreno |
| R14 | Visita a prueba y primer pago | Pruebas, workout_saved y usuarios con primer cobro confirmado |
| R15 | Visita a prueba y primer pago | Misma cohorte de pruebas y pagos; no vender inscripciones cerradas |
| R16 | Residente a prueba general y primer pago | Pruebas y pagos de residentes; no mezclar con activaciones de convenio |

Meta: contribuir a 100 usuarios de pago activos con ingresos que cubran el gasto. No hay pronóstico de conversiones por Reel.

## Atribución y fuentes

Registrar por pieza y plataforma fecha, alcance, clics y visitas reportadas. Un enlace de bio compartido da atribución agregada, no individual por Reel. El dominio escrito en el post de Instagram no es un enlace clicable.

Si Andrés aprueba un soporte clicable separado, usar una URL como esta, todavía no publicable:

`https://bananaburn.app/?ref=CODIGO_EXISTENTE_APROBADO&utm_source=instagram&utm_medium=organic_social&utm_campaign=noviembre_2026&utm_content=r13`

Cambiar contenido a r14/r15/r16 y fuente a tiktok cuando corresponda. Solo usar un código existente activo aprobado, sin crear afiliados ni comisiones. ref-capture.tsx guarda UTMs únicamente con ref válido; /r/<code> pierde los parámetros. Verificar visita y registro de prueba antes de reportar atribución. Si no existe código autorizado, usar la atribución agregada disponible y declarar la limitación. No inventar códigos ni añadir seguimiento en esta entrega.

CompleteRegistration se emite al terminar /bienvenida. Para primer entreno usar workout_saved en funnel_events; esos eventos no guardan UTMs. Para pagos automáticos usar trial_charges con status 'succeeded', deduplicando usuarios, y comprobar vigencia de suscripción para activos. El píxel de navegador en /pago/exito no cubre por sí solo el cobro automático; billing.ts ya envía Subscribe por la API de Conversiones al confirmar cobros. Usar ese evento como contraste, no como sustituto del registro contable. Otras vías de compra, incluida Running, requieren comprobar su registro de pago confirmado; no asumir que trial_charges contiene compras de temporada. No inventar un evento ni una unión entre fuentes. Donde no haya unión verificable, indicar “sin atribución”. No guardar datos médicos para medir estas piezas.

Medir registro/visita y primer pago/prueba con denominadores de la misma cohorte y ventana. Revisar después de siete días y reintentos. Revisar renovación al siguiente ciclo. El 35 % prueba a pago es objetivo interno, no resultado ni pronóstico. Comparar ingresos efectivamente cobrados de la semana con gasto de anuncios de la misma semana; para atribución comercial también observar cohortes maduras.

## Cuánto dinero puede mover, sin pronóstico

Precios USD verificados en src/lib/plans.ts. Escenarios aritméticos condicionales, sin prometer que estas piezas conseguirán esos usuarios. Importes brutos de tarifa, no utilidad: faltan costos, comisiones, devoluciones y descuentos aplicables.

| Plan | Un pago mensual normal | 100 usuarios con ese pago mensual | Un pago anual | 100 pagos anuales |
| --- | --- | --- | --- | --- |
| Entreno | $9.99 | $999.00 | $59.99 | $5,999.00 |
| Entreno + Nutrición | $14.99 | $1,499.00 | $89.99 | $8,999.00 |

Un cambio de Entreno a Entreno + Nutrición mueve $5.00 más por mes a tarifa normal, o $30.00 más por año si se compara tarifa anual; no sumarlos como si ambos fueran ingresos simultáneos. No presentar el cobro anual como ingreso mensual. R15 no vende Temporada 1: sus inscripciones cierran antes de esta semana. No atribuir compras extra a estos guiones.

La prueba y el mes de convenio ingresan $0 durante su período gratuito. Guardar tarjeta es opcional; el beneficio del primer mes al 50 % modifica el primer cobro ($4.99 / $7.49 según src/lib/trial.ts), por lo que los escenarios mensuales normales no representan necesariamente el primer cobro real. Usar el importe confirmado por el sistema para medir ingresos. R16 ofrece la prueba general, no el mes de convenio.

## Producción y controles

Sin API de generación, créditos, stock comprado ni nuevas contrataciones. No se afirma costo total cero: el trabajo humano y cómputo local requieren recursos. Prompts de imágenes fijas archivados sin ejecutar. MP4, portadas y hojas pendientes; falta el PNG oficial señalando, no sustituirlo.

Los checks locales validan tiempos, palabras y existencia de capturas. R15 recorta la tarjeta real del gráfico semanal para excluir ritmos de la muestra 21K; no afirma mostrar un plan 5K. R13 usa un menú ilustrativo sin GLP-1 ni metas nutricionales universales. R14 evita prometer que tres días bastan para todos. R16 muestra Comunidad general, no un grupo privado ni entrenador presencial.

Andrés debe aprobar por escrito los medios finales antes de publicar o enviar. Cualquier gasto o campaña requiere su aprobación. Antes de proponer inversión, informar costo por usuario de pago y cuántos cobros confirmados recuperan el gasto.
