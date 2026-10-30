# R05 a R08: producción y medición, semana del 9 al 15 de noviembre

Entrega del issue #95: cuatro paquetes editables para Andrés, sin MP4 ni PNG generados. Cada carpeta mantiene guion y proyecto como R04, con las salidas previstas documentadas. No se ha publicado ni enviado material, cambiado campañas ni gastado dinero. La versión corta es un archivo previsto para revisión, no autorización de anuncios.

## Embudo y decisión comercial

| Paquete | Utilidad que lleva a visita y registro | Siguiente paso esperado |
| --- | --- | --- |
| R05_sin-reloj | Correr con el GPS del celular | Registro y primera salida |
| R06_proteina-primero | Registrar comida y revisar proteína | Registro y prueba de Entreno + Nutrición |
| R07_gym-edificio | Empezar un entreno cerca de casa | Registro y primer entreno |
| R08_bascula | Seguir el proceso con más contexto | Registro y consulta de Progreso |

Estos Reels mueven principalmente visita → registro; el CTA propone iniciar prueba. La meta de negocio es 100 usuarios de pago activos con rentabilidad. No afirmar que las vistas producen pagos por sí solas. Si Andrés aprueba publicarlos orgánicamente, registrar por pieza: fecha, alcance, visitas al perfil y clics reportados por la plataforma; después visitas, registros completados, pruebas, primeros pagos y usuarios de pago activos de la cohorte cuando exista atribución verificable.

Para medir por Reel sin desarrollo nuevo, Andrés puede aprobar un enlace en un soporte clicable propio por pieza (por ejemplo, historia asociada):

`https://bananaburn.app/?ref=CODIGO_EXISTENTE_APROBADO&utm_source=instagram&utm_medium=organic_social&utm_campaign=noviembre_2026&utm_content=r05`

Sustituir `CODIGO_EXISTENTE_APROBADO` solo por un código activo existente que Andrés haya autorizado para esta medición. No es una URL lista para publicar. Mantener ese código y cambiar `utm_content=r05` por `r06`, `r07` o `r08`. No crear afiliados ni activar comisiones para medir estos Reels. Para TikTok cambiar fuente a `tiktok`. No crear enlace /r/: esa ruta descarta parámetros. La captura actual guarda UTMs solo con `ref` válido y activo: `/api/ref` responde 404 si no existe o está inactivo y no guarda cookie. No basta inventar un código por Reel. Comprobar una visita y su registro antes de usar el informe. Si no existe un código aprobado sin gasto adicional, usar las métricas de plataforma y atribución agregada disponible; no prometer medición individual hasta pago. El pie de foto conserva el dominio simple: su enlace no es clicable en Instagram. Si se usa una sola URL de biografía para varias piezas, reportar atribución agregada y no adjudicar todos los registros al último Reel.

Fuentes existentes: `ref-capture.tsx` para atribución de visita, CompleteRegistration al terminar /bienvenida para registro y datos existentes de prueba para activación. El guardado del primer entreno se mide con `workout_saved` en funnel_events, no con un evento inventado. No asumir que funnel_events contiene UTMs ni que una identidad permite unir tablas sin verificarlo. Para pagos usar trial_charges con status 'succeeded', deduplicando por usuario; para activos comprobar además suscripción vigente. Meta Subscribe no cuenta el cobro automático al finalizar prueba. Reportar cohortes sin unión comprobable como “sin atribución”, no como conversión cero.

Calcular registro/visita y primer pago/prueba solo con denominadores de la misma cohorte y ventana. Revisar primeros pagos tras terminar los 7 días de prueba y sus reintentos; revisar renovación al siguiente ciclo. Comparar con la meta de prueba a pago del 35 %, que es un objetivo interno, no un resultado. No fijar cifras de rendimiento inventadas.

## Costo y aprobación

No se compran medios, stock ni herramientas, no se llaman servicios de generación y no se consumen créditos. Se reutilizan capturas y arte oficial; los briefs piden grabación propia ya disponible sin contratación. El render posterior es cómputo local y el trabajo humano sí requiere tiempo. Si faltan clips, la alternativa editable de motion graphics evita pagar por ellos. Falta únicamente incorporar la pose oficial de Coach Banana señalando para el cierre: no se autoriza generarla ni reemplazarla.

Andrés debe aprobar por escrito el material final y cualquier publicación, envío, pauta o gasto. La propuesta no activa nada. Si más adelante se propone pauta, calcular costo por usuario de pago e ingresos nuevos semanales frente a gasto semanal antes de solicitar aprobación; este paquete no solicita ni presupone pauta.

## Revisión técnica sin producir medios

CI ejecuta `src/lib/reels-r05-r08.test.ts` con Vitest: comprueba las nueve escenas, tiempos de ambas versiones, palabras con etiquetas, advertencia médica y concordancia de texto y etiqueta “Ejemplo” entre guion y proyecto. No genera medios ni consume créditos.

Desde la raíz, ejecutar los cuatro comandos `node marketing/videos/<carpeta>/proyecto/render.mjs check`. Validan ambas duraciones, cada intervalo, palabras añadidas, advertencia médica de R06/R08 y existencia de captura. No reemplazan la revisión visual del futuro render. Cada carpeta explica cómo producir después los MP4, portada y hoja. El motor actual dibuja motion graphics y capturas; no compone automáticamente clips UGC. Para usar los videos base, Andrés monta los cortes en su editor siguiendo la tabla de cada guion.
