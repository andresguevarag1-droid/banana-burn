# R09 a R11: medición y rentabilidad

Semana del 16 al 22 de noviembre de 2026, issue #116. Tres paquetes editables, sin medios generados ni gastos en generación. Los MP4 y PNG son salidas previstas; falta incorporar la pose oficial señalando. No se ha publicado, enviado, comprado ni modificado campañas.

## Qué paso mueve cada pieza

| Pieza | Paso del embudo | Verificación comercial |
| --- | --- | --- |
| R09 | Visita a prueba; después primer pago y compra extra Running | Prueba, primer entreno guardado, pago de plan y compra de temporada confirmada por separado |
| R10 | Administración interesada a reunión y convenio; residentes a activación, mes gratis y pago | Reunión, convenio, activación por /c/<codigo>, primer pago tras los 30 días individuales |
| R11 | Prueba con todo incluido a pago de Entreno + Nutrición | Prueba, primer entreno y primer pago del plan completo; no atribuir condición médica a espectadores |

El cierre general siempre ofrece siete días sin tarjeta. R10 no convierte ese cierre en un mes automático: el mes solo corresponde al enlace exclusivo de un condominio aliado de Costa Rica. La administración nunca paga. No medir el éxito por vistas ni registros solamente: la meta son 100 usuarios de pago activos y rentabilidad.

## Atribución y fuentes

Registrar por pieza y plataforma fecha, alcance, clics y visitas reportadas. Un enlace de bio compartido da atribución agregada, no individual por Reel. El dominio escrito en el post de Instagram no es un enlace clicable.

Si Andrés aprueba un soporte clicable separado, usar una URL como esta, todavía no publicable:

`https://bananaburn.app/?ref=CODIGO_EXISTENTE_APROBADO&utm_source=instagram&utm_medium=organic_social&utm_campaign=noviembre_2026&utm_content=r09`

Cambiar contenido a r10/r11 y fuente a tiktok cuando corresponda. Solo usar un código existente activo aprobado, sin crear afiliados ni comisiones. ref-capture.tsx guarda UTMs únicamente con ref válido; /r/<code> pierde los parámetros. Verificar visita y registro de prueba antes de reportar atribución. Si no existe código autorizado, usar la atribución agregada disponible y declarar la limitación. No inventar códigos ni añadir seguimiento en esta entrega.

CompleteRegistration se emite al terminar /bienvenida. Para primer entreno usar workout_saved en funnel_events; esos eventos no guardan UTMs. Para pagos automáticos usar trial_charges con status 'succeeded', deduplicando usuarios, y comprobar vigencia de suscripción para activos. El píxel de navegador en /pago/exito no cubre por sí solo el cobro automático; billing.ts ya envía Subscribe por la API de Conversiones al confirmar cobros. Usar ese evento como contraste, no como sustituto del registro contable. Otras vías de compra, incluida Running, requieren comprobar su registro de pago confirmado; no asumir que trial_charges contiene compras de temporada. No inventar un evento ni una unión entre fuentes. Donde no haya unión verificable, indicar “sin atribución”. No guardar datos médicos para medir estas piezas.

Medir registro/visita y primer pago/prueba con denominadores de la misma cohorte y ventana. Revisar después de siete días y reintentos; para R10 después de los 30 días desde la activación individual, no desde una fecha global del condominio. Revisar renovación al siguiente ciclo. El 35 % prueba a pago es objetivo interno, no resultado ni pronóstico. Comparar ingresos efectivamente cobrados de la semana con gasto de anuncios de la misma semana; para atribución comercial también observar cohortes maduras.

## Cuánto dinero puede mover, sin pronóstico

Precios USD verificados en src/lib/plans.ts. Escenarios aritméticos condicionales, sin prometer que estas piezas conseguirán esos usuarios. Importes brutos de tarifa, no utilidad: faltan costos, comisiones, devoluciones y descuentos aplicables.

| Plan | Un pago mensual normal | 100 usuarios con ese pago mensual | Un pago anual | 100 pagos anuales |
| --- | --- | --- | --- | --- |
| Entreno | $9.99 | $999.00 | $59.99 | $5,999.00 |
| Entreno + Nutrición | $14.99 | $1,499.00 | $89.99 | $8,999.00 |

Un cambio de Entreno a Entreno + Nutrición mueve $5.00 más por mes a tarifa normal, o $30.00 más por año si se compara tarifa anual; no sumarlos como si ambos fueran ingresos simultáneos. No presentar el cobro anual como ingreso mensual. Una compra Running adicional es $14.99 según src/lib/seasons.ts (SEASON_PRICE_MINOR); no se cobra aparte la temporada incluida en cada año pagado ni se supone incluida en la prueba. Validar precio y disponibilidad del catálogo al producir.

La prueba y el mes de convenio ingresan $0 durante su período gratuito. Guardar tarjeta es opcional; el beneficio del primer mes al 50 % modifica el primer cobro ($4.99 / $7.49 según src/lib/trial.ts), por lo que los escenarios mensuales normales no representan necesariamente el primer cobro real. Usar el importe confirmado por el sistema para medir ingresos. No presupuestar descuentos sobre el mes de convenio sin verificar elegibilidad.

## Producción y controles

Sin API, créditos, stock comprado ni nuevas contrataciones. El trabajo humano y cómputo local requieren recursos; no se afirma costo total cero. Los prompts de imagen fija están archivados sin ejecutar. El render usa capturas reales y requiere el PNG oficial señalando, todavía ausente. No generarlo ni sustituirlo.

Los check locales y src/lib/reels-r09-r11.test.ts verifican tiempos, ocho palabras añadidas con etiqueta, captura existente, concordancia entre guion y proyecto y aviso médico. No reemplazan revisar visualmente el render final. R09 reformula el gancho determinista de lesiones del kit; R11 usa lenguaje educativo sin señalar la condición de la persona y muestra el aviso en tarjeta propia en ambas duraciones y en el post. R10 distingue prueba general y convenio.

Andrés debe aprobar por escrito el material final antes de publicar o enviar. Cualquier gasto o campaña requiere su aprobación; la versión de 15 segundos no autoriza pauta. Si se propone inversión después, informar costo por usuario de pago y cuántos cobros reales recuperan ese gasto, usando datos de conversión y precios vigentes.
