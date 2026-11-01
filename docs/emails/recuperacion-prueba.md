# Recuperación al terminar la prueba sin elegir plan

Propuesta para aprobación de Andrés. Entrega de copy: no implementa avisos ni envíos, no publica, no toca campañas ni genera gasto. Mueve **prueba vencida → primer pago**, con el **anual** como primera opción el día 14. Objetivo: contribuir a 100 usuarios de pago activos con ingresos que cubran costos.

## Correo día 8: tu historial sigue guardado

**Asunto:** Tu historial sigue guardado

**Vista previa:** Conservas lo que registraste. Elige un plan para retomar.

**Cuerpo:**

Tu prueba terminó, pero no tienes que empezar desde cero.

En tu cuenta siguen los entrenos, pesos y repeticiones que registraste, junto con tus registros de peso, medidas y fotos de progreso. Vuelve con la misma cuenta para conservar ese historial.

Para retomar el entrenamiento, elige Entreno por $9.99 al mes o Entreno + Nutrición por $14.99 al mes. Solo el segundo incluye el registro de comidas y tus calorías y macros. También puedes comparar las opciones anuales en Mi plan.

Revisa el plan y el total antes de confirmar el pago. Precios en USD, con IVA incluido.

Coach Banana

**Botón:** Elegir mi plan

**Destino:** `/app/suscripcion` (https://bananaburn.app/app/suscripcion).

## Correo día 14: vuelve, con el anual primero

**Asunto:** Vuelve con un año de entreno

**Vista previa:** Compara el anual primero y retoma con tu historial guardado.

**Cuerpo:**

Tu historial sigue en tu cuenta: los entrenos, pesos, repeticiones, medidas y fotos que guardaste.

Si quieres volver, compara primero el anual: Entreno cuesta $59.99 al año y Entreno + Nutrición, $89.99 al año. Cada año pagado incluye una temporada deportiva gratis. Solo Entreno + Nutrición incluye comidas, calorías y macros.

¿Prefieres pagar mes a mes? Entreno cuesta $9.99 al mes y Entreno + Nutrición, $14.99 al mes.

Entra con la misma cuenta y elige cómo seguir. Precios en USD, con IVA incluido; el anual se paga completo, no en cuotas mensuales.

Coach Banana

**Botón:** Comparar mi plan anual

**Destino:** `/app/suscripcion` (https://bananaburn.app/app/suscripcion).

## Aviso dentro de la app: desde el día 8

**Asunto / título:** Tu historial sigue aquí

**Vista previa / apoyo:** Elige un plan para retomar tu entrenamiento.

**Cuerpo:**

Tu prueba terminó. Los entrenos, pesos, repeticiones, medidas y fotos que registraste siguen en tu cuenta. Elige un plan en Mi plan para retomar. Si también quieres registrar comidas y consultar calorías y macros, elige Entreno + Nutrición.

**Botón:** Elegir mi plan

**Destino:** `/app/suscripcion`.

Propuesta: un aviso descartable al primer acceso elegible desde el día 8; no repetir por cada visita. Retirarlo al pagar o al dejar de cumplir las condiciones. Título y apoyo son los equivalentes del asunto y vista previa; no son un correo adicional.

## Qué conserva y qué significa «historial guardado»

El asunto del día 8 habla de los registros que conserva en su cuenta, no de una suscripción reservada o de acceso gratis. No afirmar que ya eligió un plan de pago. No prometer una rutina congelada, récords nuevos, rachas intactas ni datos que nunca registró. Usar siempre la misma cuenta; no garantizar conservación perpetua ni recuperación después de eliminarla.

Fuentes revisadas: `src/lib/account-export.ts` enumera `workouts`, `workout_sets`, `weights`, `measurements`, `progress_photos`, `meals` y `daily_logs`; `src/lib/entitlements.ts` calcula el acceso por prueba/suscripción y puede bajar el perfil a `free`, sin borrar ese historial. Conservar comidas guardadas no significa tener acceso a nutrición con Entreno: para usarla al volver se necesita Entreno + Nutrición. Las piezas solo prometen registros existentes, sin afirmar que toda persona ya tiene fotos o entrenos.

## Fechas, audiencia y convivencia

Día 8 significa 7 días completos desde el registro: coincide con el fin normal de la prueba. Día 14 significa 13 días completos desde el registro, no 14 días después del vencimiento. Usar `trialEndFor` de `src/lib/trial.ts` para validar el vencimiento; no enviar por una resta de fechas sin comprobar acceso.

Audiencia: prueba normal vencida, sin elección de plan, sin pagos previos y sin acceso pagado vigente. Excluir beta y su gracia, testers, cortesías y condominios con mes gratis. Excluir también cobros programados, en curso, por confirmar, fallidos o con reintento: requieren su comunicación específica de cobro, no una invitación genérica a elegir plan. Revalidar inmediatamente antes de cada envío o aviso; detener la secuencia tras el primer pago. No mandar piezas atrasadas en bloque.

`reactivacion` en `src/lib/email/templates.ts` se activa a los 3 o 7 días de inactividad desde `src/lib/notify.ts`; propone una sesión corta o descanso y dirige a `/app/entreno` o `/app`. Esta secuencia se activa por vencimiento sin compra, aunque la persona siga entrando; su acción es elegir y pagar en Mi plan. Al implementarla, sustituir el correo `reactivacion` o recordatorio diario que coincida para ese destinatario y fecha; no sumar ambos. La supresión por audiencia vencida debe acordarse en la futura integración, pues no la implementa este documento. Conservar bienvenida, `pruebaIniciada`, `recordatorioCobro` y avisos transaccionales, con prioridad sobre el comercial. Complementa `docs/emails/secuencia-prueba.md`, que cubre los días 2, 4 y 6 durante la prueba.

Respetar preferencias de correo y baja firmada del sistema existente; registrar una sola pieza por usuario e hito. Agregar el pie existente con motivo del correo y enlace de baja. Ninguna pieza ofrece descuento: `promoFor` en `src/lib/trial.ts` no concede el primer mes al 50 % a un alta de tarjeta posterior al fin de la prueba (`inmediato`). No prometer otra prueba ni cobro diferido.

Maquetación futura: paper #FFF8E3, banana #FFD60A, ink #1B1505, Plus Jakarta Sans y botón principal ink; texto plano equivalente. Cada cuerpo tiene menos de 120 palabras. El enlace abre Mi plan; no preselecciona el anual ni cobra al hacer clic. «Anual primero» describe el orden editorial del día 14.

## Variantes A/B propuestas

Mantener cuerpo, vista previa y botón idénticos. Día 8: A «Tu historial sigue guardado»; B «Retoma con tu historial guardado». Ambas variantes nombran el historial, sin sugerir una suscripción reservada. Día 14: A «Vuelve con un año de entreno»; B «Compara tu plan anual y vuelve». Apostaría por A por su invitación directa. Son alternativas a los dos correos, no envíos extra. Andrés debe aprobar cualquier prueba; asignar variante estable por usuario y decidir por pagos con ventana completa, no por aperturas.

## Medición: pagos por correo enviado

Propuesta para una futura integración, todavía no instrumentada: guardar relación entre usuario, pieza (`recuperacion_d8` o `recuperacion_d14`), variante, fecha de envío e ID devuelto por Resend, con idempotencia por usuario/hito. No poner datos personales en URLs ni depender de UTMs: su persistencia actual requiere `?ref=`.

Por cada pieza y variante, reportar semanalmente cohortes con **7 días completos desde cada envío**:

- **Tasa principal:** destinatarios únicos con primer pago confirmado dentro de los 7 días posteriores al envío / correos enviados de esa pieza. Mostrar numerador, denominador y porcentaje; incluir rebotes en enviados y reportarlos aparte. No usar entregados como denominador sin cambiar el nombre de la métrica.
- **Atribución sin duplicados:** si recibió ambas piezas antes de pagar, asignar el pago al último correo anterior dentro de la ventana. Un primer pago cuenta una sola vez en el total de la secuencia. Reportar aparte receptores que pagaron fuera de ventana, sin atribuirlos.
- **Dinero:** suma efectivamente cobrada atribuida / correos enviados, más total cobrado y desglose por plan y periodo. Conservar el importe real, no reemplazarlo por precio de lista. Conciliar devoluciones y costos para informar ingreso neto y margen.
- **Anual:** primeros pagos anuales atribuidos / primeros pagos atribuidos; usuarios de pago activos: pagadores únicos con suscripción vigente. Aperturas y clics son secundarios.

Confirmar cobros con `trial_charges.status = 'succeeded'` cuando corresponda; conciliar pagos directos con `payment_events`, suscripción y proveedor. Deduplicar por usuario y primer pago; tarjeta guardada, clic, `/pago/exito` o Meta Subscribe por sí solos no acreditan pago. Registrar aparte exposición/clic del aviso y pagos en 7 días por usuario expuesto; si se atribuye también al correo, no sumar ambos como ingresos nuevos.

La atribución describe asociación. Para estimar incremento, proponer un grupo de control contemporáneo sin estas piezas, conservando transaccionales, y comparar primeros pagos e ingresos por usuario elegible con ventanas maduras. No hay línea base ni volumen verificado para proyectar conversiones. Antes de activar, Andrés debe aprobar envíos y costo incremental; rentabilidad requiere ingresos nuevos superiores al gasto, incluido cualquier costo de envío.

## Cuánto dinero puede mover

Precios regulares USD de `PLANS` en `src/lib/plans.ts`, sin promociones. Son importes brutos por compra, no pronóstico ni beneficio:

| Pago recuperado | Mensual, primer periodo | Anual, cobro completo |
| --- | ---: | ---: |
| Entreno | $9.99 | $59.99 |
| Entreno + Nutrición | $14.99 | $89.99 |

Ingreso bruto potencial = $9.99 × pagos Entreno mensuales + $14.99 × pagos completos mensuales + $59.99 × pagos Entreno anuales + $89.99 × pagos completos anuales. Cambiar de Entreno a Entreno + Nutrición añade $5.00 por mes o $30.00 por año a precio regular. No comparar el cobro anual inicial con un mes como si fuera margen o ingreso mensual recurrente.

Como referencia aritmética de la meta, 100 pagos del mismo plan aportarían $999.00 o $1,499.00 por periodo mensual; 100 compras anuales aportarían $5,999.00 o $8,999.00 cobrados por año. No se afirma que estos correos generen 100 pagos ni que esos importes cubran costos desconocidos. Actualizar precios antes de aprobar si cambia `plans.ts`.
