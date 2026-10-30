# Correos de recuperación (Resend)

Tres correos para recuperar a quien se queda en el camino entre el registro y el primer pago del 8 de noviembre: quien no entrenó en sus primeras 48 horas, quien canceló la prueba y quien tuvo el primer cobro rechazado. Métrica principal del lote: costo por cliente que paga. Cada uno lleva además su métrica propia.

Solo son documentos: no se envía nada ni se conecta nada a Resend. Todo envío necesita la aprobación de Andrés.

## Tabla resumen

Horas en hora de Costa Rica (UTC-6, sin horario de verano). Las fechas de ejemplo son de la cohorte de la beta (cobro del 8 de noviembre).

| # | Correo | Evento que lo dispara | Hora de envío | Ejemplo | CTA (un solo enlace) | Se cruza con lo que la app ya envía | Métrica que mueve |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | [48 horas sin entrenar](01-48h-sin-entrenar.md) | Registro + 48 h y cero entrenos | 5:00 p. m. | Registro el 1 nov, envío el 3 o 4 nov | Empezar mis 10 minutos (/app/entreno?expres=10) | En parte: `primerEntreno` diario de la primera semana | Primer entreno antes de 72 h |
| R2 | [Canceló la prueba](02-cancelo-la-prueba.md) | trial_charges a canceled + 24 h, con la prueba vigente | 10:00 a. m. | Cancela el 5 nov, envío el 6 nov | Ver mi plan (/app/suscripcion) | Sí: `cobroCancelado` (confirmación inmediata) | Cancelaciones que reanudan antes del fin de la prueba |
| R3 | [Pago fallido](03-pago-fallido.md) | trial_charges a failed (falló el reintento) + 48 h | 12:00 p. m. | Rechazo el 8 y el 9 nov, envío el 11 nov | Cambiar mi tarjeta (/app/suscripcion#tarjeta) | Sí: `pagoFallido` (en cada intento rechazado) | Cobros fallidos pagados antes de 7 días |

## Qué ya manda la app y cómo no duplicarlo

| Correo de la app (src/lib/email/templates.ts) | Quién lo manda y cuándo | Relación con estos correos |
| --- | --- | --- |
| `primerEntreno` (vía `recordatorio`, `first: true`) | src/lib/notify-run.ts, cada día de la primera semana sin entrenos, a la hora de recordatorio (7:00 a. m. por defecto). Solo perfiles con onboarded = true. | R1 se cruza. El día de R1, que `primerEntreno` salga solo por push y en la app. R1 también llega a quien no terminó el registro, que hoy no recibe nada. |
| `cobroCancelado` | sendChargeCanceled, en el momento de cancelar (cancelTrial en src/lib/trial-billing.ts). | R2 se cruza en tema, no en momento: la app confirma al instante; R2 sale 24 h después, solo si aún se puede volver. |
| `pagoFallido` (`paused: true`) | notifyDecline en src/lib/trial-billing.ts, uno por intento rechazado: el 8 nov (anuncia el reintento del 9) y el 9 nov si vuelve a fallar. | R3 se cruza en tema. No repite el aviso: sale 48 h después del último intento y solo si sigue sin pagar. |
| `suscripcionCancelada`, `pagoFallido` de renovación | src/lib/tilopay-billing.ts, para suscripciones ya pagadas. | No aplica: estos tres correos son solo para la prueba y el primer cobro. |

src/lib/tilopay.ts solo habla con la pasarela (tokenizar, cobrar, consultar) y no manda correos.

## Descuentos

Ninguno ofrece un descuento nuevo. El único vigente es el 50 % del primer mes (PROMO_TERMS en src/lib/trial.ts), y ninguno de los tres lo nombra. {{monto}} en R2 y R3 es trial_charges.amount_minor del mismo cobro: si la persona ya había ganado el 50 % al guardar su tarjeta, se mantiene; si no, es el precio normal de src/lib/plans.ts.

## Enlaces y UTM

Cada correo tiene un solo enlace a bananaburn.app, el botón:

`https://bananaburn.app/<ruta>?utm_source=resend&utm_medium=email&utm_campaign=recuperacion&utm_content=r<NN>-<pieza>`

Si la ruta lleva ancla (#tarjeta), va después de los UTM. El pie solo lleva el correo de ayuda (mailto) y el enlace de baja, que no es un CTA.

## Variables

Las mismas de la secuencia de la prueba (ver la tabla de variables en [../README.md](../README.md)): {{nombre}}, {{plan}}, {{monto}}, {{fecha_cobro}}, {{fin_prueba}} y {{baja_url}}. En R2 y R3, {{monto}} sale de trial_charges.amount_minor y {{fecha_cobro}} de trial_charges.charge_at.

## Reglas que cumple cada correo

De tú, sin emojis, sin rayas largas, sin mencionar IA, sin testimonios, sin contadores ni escasez. Las únicas fechas límite son reales (fin de la prueba en R2). R3 dice que no habrá más intentos automáticos y que no se cobra nada si la persona no hace nada.
