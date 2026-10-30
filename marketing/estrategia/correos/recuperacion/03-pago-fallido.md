# Correo R3: Pago fallido del 8 de noviembre

| Campo | Valor |
| --- | --- |
| Asunto | {{nombre}}, tu plan sigue en pausa: así se arregla |
| Preheader | El cobro de tu plan no pasó. Con otra tarjeta vuelves hoy y tu progreso sigue guardado. |
| Evento que lo dispara | Primer cobro rechazado sin más reintentos: trial_charges pasa a status = failed (afterDecline en src/lib/trial.ts, después de que falla el reintento automático del día siguiente), en un cobro de kind prueba o beta. |
| Hora de envío (Costa Rica, UTC-6) | 12:00 p. m. del primer día en que ya pasaron 48 horas desde last_attempt_at. Cobro del 8 de noviembre con reintento fallido el 9: 11 de noviembre, 12:00 p. m. |
| Condición para enviarlo | Al momento de enviar: el cobro sigue en failed, attempts menor que MAX_ATTEMPTS (6), sin plan pagado, sin cancelación y sin baja de estos correos. Una sola vez por cobro. |
| Tipo | Ciclo de vida (con enlace de baja) |
| CTA único | Cambiar mi tarjeta: https://bananaburn.app/app/suscripcion?utm_source=resend&utm_medium=email&utm_campaign=recuperacion&utm_content=r03-pago-fallido#tarjeta |
| Métrica que mueve | Recuperación de cobros fallidos: % de cobros en failed que se pagan antes de 7 días. Cada uno recuperado es un cliente que paga sin costo de anuncio, y baja el costo por cliente que paga. |

HTML: [html/03-pago-fallido.html](html/03-pago-fallido.html)

## Cuerpo

Eyebrow: Pago pendiente. Título: "Tu acceso está en pausa, tu progreso no". Qué pasó (monto, plan, desde cuándo, sin más intentos), por qué suele pasar, tres pasos para arreglarlo, qué pasa si no quiere seguir, botón ink y una línea de Coach Banana.

## Texto plano

```text
{{nombre}}, intentamos cobrar {{monto}} de tu plan {{plan}} desde el {{fecha_cobro}} y el banco no lo aprobó. No haremos más intentos automáticos. Tu acceso está en pausa, tu progreso no.

Por qué pasa
- Tu banco bloquea compras en línea o en dólares. Se activa desde su app o con una llamada.
- La tarjeta venció o cambió de número.
- No tenía saldo o límite disponible ese día.

Cómo arreglarlo
1. Abre Mi plan, con el enlace de abajo o en la app desde el menú.
2. Toca Cambiar tarjeta y pagar. Usa otra tarjeta de crédito o débito, o la misma después de hablar con tu banco.
3. Se cobra el mismo monto, {{monto}}, en ese momento. Tu plan y tu progreso siguen donde los dejaste.

Si prefieres no seguir, no tienes que hacer nada: no se te cobrará nada más.

¿Dudas con el cobro? Escríbenos a hola@bananaburn.app.

Cambiar mi tarjeta: https://bananaburn.app/app/suscripcion?utm_source=resend&utm_medium=email&utm_campaign=recuperacion&utm_content=r03-pago-fallido#tarjeta

"Tus récords no se mueven de aquí. Cuando vuelvas, seguimos donde ibas."
Coach Banana

-- 
Banana Burn, tu entrenador personal en el celular
Ayuda: hola@bananaburn.app
Recibes este correo porque el primer cobro de tu plan en Banana Burn no se pudo hacer.
Dejar de recibir estos correos: {{baja_url}}
```

## Sin descuentos nuevos

{{monto}} es trial_charges.amount_minor del cobro rechazado. Al guardar otra tarjeta, onCardSaved da charge_now y el cobro sale con el mismo monto y la misma promo de la fila (row.promo en src/lib/trial-billing.ts). Si la persona había ganado el 50 % del primer mes, se mantiene porque guardó su tarjeta antes del cobro (PROMO_TERMS); el correo no lo nombra ni ofrece nada distinto.

## Por qué así

- "Cambiar tarjeta y pagar" es el texto real del botón (src/app/(app)/app/suscripcion/past-due-card.tsx). El enlace va a #tarjeta, la sección de Mi plan donde está.
- Las razones del rechazo son las mismas que ya da `pagoFallido` (vencida, límite, bloqueo de compras en línea), más el aviso de compras en dólares, porque el cobro sale en USD y algunos bancos, sobre todo fuera de Costa Rica, lo tratan como compra internacional.
- Dice que no habrá más intentos y que no se cobrará nada si no hace nada. Eso baja reclamos y contracargos, y es cierto: con status = failed no hay reintento automático.

## Relación con lo que la app ya envía

**Se cruza con `pagoFallido`** (src/lib/email/templates.ts, con `paused: true`). trial-billing.ts (notifyDecline) lo manda por correo, push y en la app en cada intento rechazado: el 8 de noviembre ("Lo volveremos a intentar una vez el 9 de noviembre") y el 9 si el reintento también falla ("No haremos más intentos automáticos"). R3 no repite ese aviso: sale 48 horas después del último intento, solo si sigue sin pagar, y suma por qué pasa, cómo pedirle al banco que lo apruebe y qué pasa si no quiere seguir.

- No se manda R3 después del primer rechazo (status retry_scheduled): ese día ya hay `pagoFallido` y el reintento del día siguiente.
- La renovación fallida de una suscripción ya pagada (src/lib/tilopay-billing.ts) también usa `pagoFallido`; R3 no aplica ahí, solo al primer cobro de la prueba o de la beta.
