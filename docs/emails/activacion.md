# Activación: termina tu primer entreno

Textos para trasladar a `src/lib/email/templates.ts`. Entrega solo documental: no activa envíos ni cambia código. Objetivo: registro → primer entreno terminado en 72 h → pago. Una sola acción comercial por pieza: abrir el entreno. La oferta aparece después de la invitación a entrenar, sin segundo botón ni enlace a pago.

## Cuándo y a quién

Día 0 es el momento del registro (`profiles.created_at`). Revalidar la audiencia inmediatamente antes de enviar, también para push.

| Pieza | Cuándo sale | A quién |
| --- | --- | --- |
| A0 | Registro + 1 h | Cuenta confirmada, sin ningún entreno terminado y con acceso vigente |
| A1 | Registro + 24 h | Mismas condiciones; se detiene si ya terminó su primer entreno |
| A3 | Registro + 72 h | Mismas condiciones; usar la versión sin testimonio mientras no exista evidencia aprobada |
| B2, reemplaza `finBeta` paso 2 | 5 nov 2026, 9:00 a. m. Costa Rica (15:00 UTC) | Cohorte beta elegible según `betaEndEligible`, además sin entreno terminado |
| B3, reemplaza `finBeta` paso 3 | 7 nov 2026, 9:00 a. m. Costa Rica (15:00 UTC) | Misma audiencia que B2, revalidada |

A0/A1/A3: excluir cuentas con acceso especial de testers, staff, regalos o condominios, y quienes ya pagaron. B2/B3: cuentas creadas antes de `BETA_ENDS_AT`, sin tarjeta guardada, sin fila de cobro, sin plan efectivo y con recordatorios habilitados, conforme a `src/lib/beta-fin.ts`. La reescritura no se manda a quien ya entrenó: conserva para esa audiencia la comunicación de fin de acceso que corresponda, sin afirmar actividad que no exista.

En todos los casos: correo solo con preferencias habilitadas y baja firmada de recordatorios; push solo con permiso, suscripción válida y preferencias habilitadas. Respetar zona horaria y horas de silencio. Diferir al próximo horario permitido si sigue vigente la pieza; no acumular mensajes atrasados. Una vez por cuenta y pieza. Máximo una pieza de activación por día local: B2/B3 prevalecen si coinciden con A0/A1/A3, sin reenviar después la omitida.

## A0. Un rato en casa

**Asunto:** Tu primer entreno: 12 minutos en casa

**Preheader:** Puedes hacerlo ahora, sin ir al gimnasio.

**Cuerpo:**

Tu primer entreno dura 12 minutos y lo puedes hacer en casa ahora.

Abre la sesión, sigue las indicaciones de cada ejercicio y avanza a tu ritmo. No tienes que resolver toda la semana hoy: empieza con este entreno.

Al terminar, guarda la sesión para que tu primer paso quede registrado.

Coach Banana

**Botón:** Empezar mi entreno

**Destino:** enlace de un toque al entreno, según el contrato de enlaces de abajo.

**Push:** Tu primer entreno: 12 min en casa

## A1. Lo difícil es empezar

**Asunto:** Lo difícil es empezar

**Preheader:** Hoy empieza con un entreno de 12 minutos.

**Cuerpo:**

A veces cuesta más empezar que encontrar tiempo.

Hoy no necesitas ir al gimnasio ni reservar una hora. Tu primer entreno son 12 minutos en casa, con las indicaciones de cada ejercicio en el celular.

Empieza a tu ritmo. Al terminar, guarda tu sesión: ya tendrás un punto de partida.

Coach Banana

**Botón:** Empezar mi entreno

**Destino:** enlace de un toque al entreno.

**Push:** Empieza hoy con 12 minutos

## A3. Otro comienzo posible

**Estado editorial:** no se encontró un testimonio verificable de la beta en las fuentes revisadas. No usar el dato de una sesión terminada como testimonio ni atribuir frases a esa persona. Esta es la versión final sin prueba social, apta para implementar cuando se valide el destino del entreno.

**Asunto:** Hoy también puedes empezar

**Preheader:** Tu primer entreno sigue siendo un paso pequeño: 12 minutos.

**Cuerpo:**

Si todavía no encontraste el momento, hoy puedes empezar en casa con 12 minutos.

La sesión te muestra qué hacer en cada ejercicio. Sigue las indicaciones, avanza a tu ritmo y guarda el entreno al terminar.

No necesitas recuperar los días que pasaron. Empieza por hoy.

Coach Banana

**Botón:** Empezar mi entreno

**Destino:** enlace de un toque al entreno.

**Push:** Hoy puedes hacer tu primer entreno

Para una futura versión con prueba social: exigir cita literal, fuente fechada de la beta y autorización de uso y atribución. Guardar esa evidencia antes de redactarla. Sin esos datos, mantener esta pieza; no enviar marcadores de posición ni citas creadas por el equipo.

## B2. Fin de beta, 5 de noviembre

**Asunto:** Antes de elegir plan, prueba tu entreno

**Preheader:** Empieza con 12 minutos en casa. Después decides cómo seguir.

**Cuerpo:**

Primero, haz tu entreno de 12 minutos en casa. Sigue las indicaciones de cada ejercicio y guarda la sesión al terminar.

Tu acceso gratis de la beta sigue hasta el final del 7 de noviembre, hora de Costa Rica. No necesitas tarjeta para hacer este entreno.

Después de probarlo, si quieres seguir, puedes guardar tu tarjeta en Mi plan antes de que termine ese acceso. Si nunca pagaste un plan, recibes 50 % de descuento solo en el primer mes del plan mensual, una vez por cuenta. No aplica al anual. Desde el segundo mes se cobra el precio normal.

Si guardas la tarjeta dentro de ese plazo, el primer cobro será el 8 de noviembre. Puedes cancelar sin costo antes del cobro desde Mi plan. Sin tarjeta no hay cobro automático; al terminar el acceso gratis necesitarás un plan para seguir entrenando.

Coach Banana

**Botón:** Hacer mi primer entreno

**Destino:** enlace de un toque al entreno.

**Push:** Prueba tu entreno de 12 minutos

## B3. Fin de beta, 7 de noviembre

**Asunto:** Hoy empieza por tu primer entreno

**Preheader:** Haz tus 12 minutos antes de decidir cómo seguir.

**Cuerpo:**

Hoy empieza por entrenar: 12 minutos en casa, con las indicaciones en tu celular. Guarda la sesión cuando termines.

Tu acceso gratis de la beta termina hoy, 7 de noviembre, a la medianoche de Costa Rica. Puedes hacer este entreno sin tarjeta mientras siga vigente tu acceso.

Después, si quieres continuar, puedes guardar tu tarjeta en Mi plan antes de que termine el día. Si nunca pagaste un plan, recibes 50 % de descuento solo en el primer mes del plan mensual, una vez por cuenta. No aplica al anual. Desde el segundo mes se cobra el precio normal.

Si guardas la tarjeta dentro de ese plazo, el primer cobro será mañana, 8 de noviembre. Puedes cancelar sin costo antes del cobro desde Mi plan. Sin tarjeta no hay cobro automático; desde mañana necesitarás un plan para seguir entrenando.

Coach Banana

**Botón:** Hacer mi primer entreno

**Destino:** enlace de un toque al entreno.

**Push:** Hoy, tu primer entreno de 12 min

## Contrato para desarrollo

- Ruta existente: `https://bananaburn.app/app/entrenar`. Para correo HTML y texto plano, pasar la pieza por `withLoginLinks` de `src/lib/email/login-link.ts`, con el usuario correcto. Reutiliza el acceso firmado de `/auth/correo` y conserva el destino; no pegar tokens reales en este documento. Comprobar que esté configurado, porque sin usuario o secreto el helper deja el enlace normal.
- **Condición previa al envío de las cinco piezas:** verificar que ese destino abra realmente una sesión inicial de 12 minutos para casa, sin requerir equipo de gimnasio ni navegar por el catálogo. No se encontró esa sesión identificada en el código revisado; la ruta genérica por sí sola no acredita la promesa. Si necesita una ruta específica, desarrollo debe resolverla y conservarla en el enlace de un toque antes de activar la secuencia. No prometer 12 minutos si se abre una rutina personalizada de otra duración.
- Push usa la ruta interna de esa misma sesión con la sesión de usuario habitual, sin token de correo. Los cinco textos push son una línea, cada uno de 40 caracteres o menos; usar “Banana Burn” como título si el proveedor lo exige.
- Confirmar primer entreno con el registro persistido de sesión completada; `workout_saved` sirve para contrastar el embudo, no basta un clic, `workout_open` ni `workout_first_set`. No contar sesiones incompletas como terminadas.
- A0/A1/A3 sustituyen el `recordatorio` diario de primer entreno en sus días, tanto correo como push. Mantener `bienvenida` y `planListo` inmediatos; no duplicar sus mensajes con nuevos envíos inmediatos. Si se implementa `docs/emails/secuencia-prueba.md`, su día 2 (+24 h) y día 4 (+72 h) ceden ante A1/A3 para quienes aún no entrenaron.
- B2/B3 sustituyen el contenido comercial de `finBeta` pasos 2 y 3 solo en la audiencia indicada. No añaden otro correo encima de `beta_fin_2`/`beta_fin_3`. Los push de beta son propuesta nueva, no capacidad de envío que esta documentación implemente.
- Conservar `pruebaIniciada`, `recordatorioCobro`, comprobantes y demás avisos transaccionales. Si coinciden con una pieza comercial, omitir la comercial. La comprobación de elegibilidad de la promoción sigue en el servidor (`promoFor` y `PROMO_TERMS`, `src/lib/trial.ts`); nunca mostrar esta oferta a quien no califique.
- No se incluyen importes para evitar distraer de la activación. Si se agregan después, usar precios vigentes de `PLANS`, `usd2`, punto decimal e indicar USD e IVA incluido. No confundir el descuento mensual con un descuento anual.
- Maquetar con Plus Jakarta Sans, paper, ink y botón banana. Un solo botón comercial; sin enlaces comerciales en logo, firma u oferta. Conservar el enlace funcional de baja en el pie y la misma copia en texto plano.

## Medición y asuntos A/B

Medir usuarios registrados que terminan su primer entreno dentro de las 72 h / usuarios registrados de la misma cohorte con 72 h de observación. Referencia del issue al 1 nov: aproximadamente 3 %; objetivo 30 %. No tratarlo como resultado de esta entrega. A3 sale al cierre de la ventana: su efecto posterior debe medirse aparte, por ejemplo hasta el día 7, sin sumarlo al indicador de 72 h.

Relacionar cuenta, pieza y envío con `notification_log`; comparar con sesiones terminadas y, después, primeros cobros reales (`trial_charges.status = 'succeeded'`). Reportar tarjetas guardadas por separado de pagos. Sin gasto publicitario nuevo; antes de escalar, contrastar costo incremental de mensajes e ingresos cobrados, sin atribuir rentabilidad a clics.

Variantes opcionales del asunto de A0, manteniendo cuerpo, preheader y botón iguales:

| Variante | Asunto |
| --- | --- |
| A, principal | Tu primer entreno: 12 minutos en casa |
| B | Empieza en casa con 12 minutos |
| C | Hoy puedes terminar tu primer entreno |

Apostaría por A: concreta duración y lugar. Con la cohorte pequeña actual, priorizar una versión y observar sesiones terminadas; si se prueba A/B, asignar una variante estable por cuenta y evaluar activación, sin declarar ganador por aperturas.
