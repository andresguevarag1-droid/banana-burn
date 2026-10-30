# Correo R2: Canceló la prueba

| Campo | Valor |
| --- | --- |
| Asunto | {{nombre}}, tu progreso sigue guardado |
| Preheader | No se te cobró nada. Si cambias de idea antes de que termine tu prueba, vuelves con un toque. |
| Evento que lo dispara | Cobro de la prueba cancelado: trial_charges pasa a status = canceled (cancelTrial en src/lib/trial-billing.ts, botón "Cancelar sin costo" de Mi plan), en un cobro de kind prueba o beta. |
| Hora de envío (Costa Rica, UTC-6) | 10:00 a. m. del primer día en que ya pasaron 24 horas desde canceled_at. Cohorte de la beta: quien cancela el 5 de noviembre lo recibe el 6 a las 10:00 a. m. |
| Condición para enviarlo | Al momento de enviar: el cobro sigue cancelado, la prueba sigue vigente (trial_ends_at todavía no llega), sin plan pagado y sin baja de estos correos. Si la prueba ya terminó, no se envía. Una sola vez por cobro. |
| Tipo | Ciclo de vida (con enlace de baja) |
| CTA único | Ver mi plan: https://bananaburn.app/app/suscripcion?utm_source=resend&utm_medium=email&utm_campaign=recuperacion&utm_content=r02-cancelo-prueba |
| Métrica que mueve | % de cancelaciones que vuelven a programar el cobro antes del fin de la prueba (reanudar), y con eso la conversión de prueba a pago (meta 35 %). Las respuestas al correo dan las razones de cancelación. |

HTML: [html/02-cancelo-la-prueba.html](html/02-cancelo-la-prueba.html)

## Cuerpo

Eyebrow: Tu plan. Título: "{{nombre}}, tu progreso sigue guardado". Tabla con el plan, hasta cuándo tiene acceso, la fecha y el monto si vuelve; tres pasos para volver; una pregunta abierta para que responda; botón ink y una línea de Coach Banana.

## Texto plano

```text
{{nombre}}, cancelaste tu plan y no se te cobró nada. Tus entrenos, tus pesajes y tu plan quedan guardados.

Plan que tenías: {{plan}}
Sigues con acceso hasta: {{fin_prueba}}
Si vuelves, se cobra el: {{fecha_cobro}}
Monto: {{monto}}

Si cambias de idea
1. Abre Mi plan, con el enlace de abajo o en la app desde el menú.
2. Toca Cambié de opinión. Si quitaste tu tarjeta, la agregas de nuevo ahí mismo.
3. Hoy no se cobra nada: tu plan vuelve a su fecha y a su monto de siempre. Puedes cancelar de nuevo antes de esa fecha.

Esto solo se puede hacer antes del {{fin_prueba}}. Después, eliges tu plan en Mi plan y se cobra al confirmar.

¿Qué no te funcionó? Responde este correo con una línea. Lo leemos todo y nos ayuda a mejorar.

Ver mi plan: https://bananaburn.app/app/suscripcion?utm_source=resend&utm_medium=email&utm_campaign=recuperacion&utm_content=r02-cancelo-prueba

"Cuando quieras volver, tus récords te esperan donde los dejaste."
Coach Banana

-- 
Banana Burn, tu entrenador personal en el celular
Ayuda: hola@bananaburn.app
Recibes este correo porque cancelaste tu plan durante la prueba gratis de Banana Burn.
Dejar de recibir estos correos: {{baja_url}}
```

## Sin descuentos nuevos

{{monto}} es trial_charges.amount_minor del mismo cobro, sin cambios. Al reanudar (resumeTrial) o al volver a guardar la tarjeta antes del fin de la prueba, el cobro conserva su fecha, su plan y su promo (src/lib/trial-billing.ts toma row.promo). Si esa persona ya tenía el 50 % del primer mes, {{monto}} lo muestra ($4.99 o $7.49); si no, el precio normal. El correo no nombra el 50 % ni ofrece nada que la persona no tuviera antes de cancelar.

## Por qué así

- "Cancelar" solo existe para quien guardó tarjeta: una prueba sin tarjeta no se cancela, termina sola. Por eso el evento es el cobro cancelado.
- Los pasos usan los textos reales de Mi plan (src/app/(app)/app/suscripcion/card-panel.tsx): "Cambié de opinión: seguir con mi plan" si dejó la tarjeta, y "Cambié de opinión: volver a mi plan" con "Guardar tarjeta y seguir" si la quitó. Esos botones solo aparecen mientras la prueba sigue vigente; por eso la condición de envío.
- 24 horas después y no en el momento: la confirmación ya la manda la app, y un segundo correo inmediato se leería como presión.

## Relación con lo que la app ya envía

**Se cruza con `cobroCancelado`** (src/lib/email/templates.ts, enviado por sendChargeCanceled al cancelar). Ese es la confirmación transaccional inmediata ("Cancelaste tu plan: no se te cobrará", botón "Ver mi plan"). R2 no la reemplaza: sale un día después, solo si la prueba sigue vigente, y su objetivo es explicar cómo volver y pedir la razón. Los dos llevan el mismo enlace a Mi plan.

No se cruza con `suscripcionCancelada`: ese es para quien cancela una suscripción ya pagada o pierde la renovación (src/lib/tilopay-billing.ts), no para quien cancela en la prueba.
