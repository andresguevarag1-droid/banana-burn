# Secuencia durante la prueba de 7 días

Propuesta para revisión de Andrés. No activa envíos, automatizaciones, campañas ni cobros. Las tres piezas complementan los correos transaccionales existentes. Objetivo: mover **prueba → pago** para acercarse a 100 usuarios de pago con un negocio rentable.

## Día 2: tu primer resultado y el entreno de hoy

**Asunto:** Tu primer resultado empieza por registrar

**Vista previa:** Mira lo que ya guardaste y abre el entreno de hoy.

**Cuerpo:**

Tu primer resultado puede ser una sesión registrada, no un cambio en la báscula. Si ya entrenaste, revisa en Progreso lo que guardaste: ese es tu punto de partida para comparar más adelante.

Si todavía no empezaste, hoy puedes dar ese primer paso. Abre tu rutina, sigue la técnica de cada ejercicio y registra el peso y las repeticiones que hagas.

Consulta lo que te toca hoy y respeta los días de descanso de tu plan. No necesitas demostrar nada en dos días: necesitas un comienzo que puedas repetir.

Coach Banana

**Botón:** Ver mi entreno

**Ruta:** `/app/entrenar` (https://bananaburn.app/app/entrenar).

Nota editorial: no afirma que ya entrenó ni promete cambios físicos en dos días; no necesita insertar datos personales ni resultados calculados.

## Día 4: lo que puedes construir si sigues

**Asunto:** Más que completar el entreno de hoy

**Vista previa:** Progreso, comida y carrera: elige qué quieres sostener.

**Cuerpo:**

Seguir te permite comparar tu fuerza, peso, medidas y fotos en Progreso. No todo el avance se ve en la báscula.

Con Entreno + Nutrición también puedes registrar tus comidas y consultar tus calorías y macros. La nutrición está incluida durante tu prueba; después depende del plan que elijas.

¿También corres? Banana Run registra tus carreras con GPS. Para un plan de carrera guiado, explora la Temporada Running. Las temporadas se adquieren aparte; cada año pagado de un plan anual incluye una temporada deportiva gratis.

Revisa qué quieres mantener en tu rutina y qué plan lo incluye.

Coach Banana

**Botón:** Ver qué incluye mi plan

**Ruta:** `/app/incluye` (https://bananaburn.app/app/incluye).

Referencias para revisión, sin agregar botones al correo: Progreso `/app/progreso`, Comida `/app/nutricion`, Banana Run en Correr `/app/correr`, Temporadas `/app/temporadas`. No se presenta el plan guiado de Running como parte de cualquier suscripción ni se promete que los retos Premium estén incluidos.

## Día 6: elige cómo seguir

**Asunto:** Elige cómo quieres seguir

**Vista previa:** Compara el ahorro anual y las opciones mensuales en Mi plan.

**Cuerpo:**

Revisa qué opción se adapta a ti.

Anual: Entreno cuesta $59.99 al año; ahorras $59.89 frente a 12 mensualidades. Entreno + Nutrición cuesta $89.99 al año; ahorras $89.89. Cada año pagado incluye una temporada deportiva gratis.

Mensual: Entreno cuesta $9.99 al mes y Entreno + Nutrición, $14.99 al mes. Nutrición está incluida solo en Entreno + Nutrición.

Estos son precios regulares en USD, con IVA incluido. El ahorro anual compara 12 meses a precio regular, sin promociones.

En Mi plan puedes revisar tu elección y las condiciones que aplican a tu cuenta antes de confirmar cualquier cambio.

Coach Banana

**Botón:** Revisar mi plan

**Ruta:** `/app/suscripcion` (https://bananaburn.app/app/suscripcion). Abre la pantalla actual; no preselecciona el anual ni ejecuta un pago.

Fuente de precios: `src/lib/plans.ts`, `PLANS`, `annualSaving` y `ANNUAL_SEASON_NOTE`. Cálculo: $9.99 × 12 − $59.99 = $59.89; $14.99 × 12 − $89.99 = $89.89. No comparar el anual con el primer mes promocional ni anunciar un equivalente mensual como monto a cobrar. Si cambian los precios, actualizar esta pieza antes de aprobarla.

## Convivencia con los correos actuales

- `pruebaIniciada` se envía al guardar tarjeta y confirma monto, fecha y cancelación. Se conserva sin cambios. El día 2 trabaja la activación; no vuelve a confirmar la tarjeta.
- `recordatorioCobro` avisa dos días antes del cobro programado. Se conserva sin cambios, con prioridad sobre cualquier correo comercial. El día 6 compara opciones; no reemplaza el aviso, no anuncia una fecha de cobro ni pide volver a pagar a quien ya tiene un cobro programado.
- La bienvenida también se conserva. Al implementar, estas piezas deben sustituir el correo de recordatorio diario de entrenamiento para ese usuario en los días 2, 4 y 6, si le correspondía uno; no se suman a él. Los avisos transaccionales nunca se suprimen para acomodar esta secuencia.

## Condiciones para una futura implementación

Este archivo contiene copy, no un sistema de envío. Propuesta: día 2 a las 24 horas del registro, día 4 a las 72 y día 6 a las 120. Usar `profiles.created_at` y verificar que siga vigente la prueba normal de siete días con las reglas de `src/lib/entitlements.ts` y `src/lib/trial.ts`. Excluir beta, testers, cortesías y mes gratis de condominios, porque sus fechas y ofertas difieren.

Antes de cada envío: excluir cuentas que ya pagaron, con baja de correos comerciales o que cancelaron su cobro programado. Respetar preferencias existentes, agregar baja firmada con el mecanismo de `src/lib/email/send.ts` y evitar duplicados por usuario y día. Si coincide con un aviso de cobro, omitir la pieza comercial. No recuperar piezas atrasadas en bloque.

Maquetación futura: paper #FFF8E3, banana #FFD60A, ink #1B1505 y Plus Jakarta Sans; botón banana para entrenar y botón ink para las otras acciones. Sin emojis, testimonios ni resultados inventados. Versión de texto plano con el mismo contenido. Cada cuerpo anterior tiene menos de 120 palabras y cada asunto menos de 45 caracteres.

## Variante A/B propuesta

Para el día 6, A usa el asunto principal «Elige cómo quieres seguir»; B usa «Tu año de entreno, con ahorro». Apostaría primero por A: invita a revisar una decisión sin asumir que el anual es adecuado para todas las personas. Mantener vista previa, cuerpo y botón idénticos. Si Andrés aprueba probarlas, asignar una variante por usuario y elegir por conversión a pago en cohortes maduras, con clics como señal secundaria; no declarar una ganadora por unas pocas aperturas.

## Medición y rentabilidad

La entrega documental no agrega costo: no compra tráfico, no contrata herramientas ni realiza envíos. Una activación posterior reutilizaría Resend y sustituiría recordatorios existentes donde coincidan. No se presupone que enviar más correos sea gratis: Andrés debe aprobar la activación y comprobar el volumen disponible y su costo antes de enviar. No se toca ninguna campaña ni dinero con esta entrega.

Propuesta de reporte semanal por cohorte de inicio de prueba y pieza (`prueba_d2`, `prueba_d4`, `prueba_d6`):

| Métrica | Cálculo y fuente propuesta |
| --- | --- |
| Aperturas únicas | Destinatarios con apertura / correos entregados, por pieza, desde Resend si el seguimiento está habilitado. Señal orientativa por las precargas y protecciones de privacidad. |
| Clics únicos en el botón | Destinatarios con clic en el CTA / correos entregados, por pieza, desde Resend si está habilitado. Separar clics de baja y posibles escáneres. |
| Pruebas que pasan a pago | Usuarios únicos de la cohorte con primer cobro confirmado dentro de los 14 días desde el registro / usuarios que iniciaron la prueba normal en esa cohorte. Esperar a que madure la ventana antes de comparar. |
| Pago entre destinatarios | Destinatarios únicos con primer pago en esa ventana / destinatarios únicos de la secuencia. Desglosar mensual/anual y con/sin tarjeta al inicio; no sumar una persona por cada correo recibido. |
| Usuarios de pago activos | Usuarios únicos con pago confirmado y suscripción vigente; seguimiento hacia la meta de 100. No contar una tarjeta guardada como pago. |

Para cobros de fin de prueba, usar `trial_charges.status = 'succeeded'`. Conciliar pagos directos con los registros de pago y suscripción del proveedor; una visita a `/pago/exito` o el evento Meta Subscribe no acredita por sí sola todos los cobros. Deduplicar por usuario y primer pago, sin sumar renovaciones como conversiones nuevas.

`sendEmail` admite tags y devuelve el ID del proveedor. La futura integración debe conservar la relación entre ID, usuario, cohorte y pieza para enlazar el reporte de Resend con pagos, sin datos personales en URLs. Este documento no implementa ese registro ni la captura de aperturas y clics; verificar su disponibilidad antes de prometer el reporte. No depender de UTMs guardadas en la app para atribuir estos enlaces.

Comparar la conversión de cohortes maduras con y sin secuencia; si se aprueba un grupo de control contemporáneo, ambos conservan los avisos transaccionales. Reportar la diferencia en puntos porcentuales, ingresos efectivamente cobrados y costo incremental por nuevo usuario de pago. La atribución por clic describe asociación, no demuestra incremento. Sin datos todavía no se afirma una mejora ni retorno. La decisión de escalar se toma por pagos y margen después de costos, no por aperturas.
