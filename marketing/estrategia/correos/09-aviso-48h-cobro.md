# Correo 9: Aviso 48 horas antes del cobro

| Campo | Valor |
| --- | --- |
| Asunto | En 2 días se cobra tu plan de {{monto}} |
| Preheader | {{linea_aviso}} |
| Evento que lo dispara | Cobro programado (trial_charges.status = scheduled, kind prueba o beta): charge_at menos 48 horas. Es la misma condición de reminderDue en src/lib/trial.ts. |
| Hora de envío (Costa Rica, UTC-6) | 7:00 a. m. del día en que se cumplen las 48 horas (la corrida diaria de /api/cron/recordatorios). Cobro del 8 de noviembre: 6 de noviembre, 7:00 a. m. |
| Condición para enviarlo | Cobro programado sin aviso enviado (reminder_sent_at vacío). Transaccional: se envía aunque la persona se haya dado de baja de los correos de la prueba. |
| Tipo | Transaccional (sin enlace de baja) |
| CTA único | Ver o cancelar mi plan: https://bananaburn.app/app/suscripcion?utm_source=resend&utm_medium=email&utm_campaign=prueba_7_dias&utm_content=c09-aviso-48h-cobro |
| Métrica que mueve | Contracargos y reclamos por cobro inesperado (meta: 0); cancelaciones antes del cobro como dato honesto de intención. |

HTML: [html/09-aviso-48h-cobro.html](html/09-aviso-48h-cobro.html)

## Texto plano

```text
{{nombre}}, {{linea_aviso}}

Plan: {{plan}}
Se cobra el: {{fecha_cobro}}
Monto de este cobro: {{monto}}
Desde el segundo periodo: {{monto_normal}}
Tarjeta: {{tarjeta}}

Si quieres seguir, no tienes que hacer nada.

Cómo cancelar sin costo
1. Abre Mi plan, con el enlace de abajo o en la app desde el menú.
2. Toca Cancelar sin costo y confirma. No se cobra nada.
3. Sigues con acceso hasta el final de tu prueba, y tu progreso queda guardado.

Cancela antes del {{fecha_cobro}}. ¿Dudas? Escríbenos a hola@bananaburn.app.

Ver o cancelar mi plan: https://bananaburn.app/app/suscripcion?utm_source=resend&utm_medium=email&utm_campaign=prueba_7_dias&utm_content=c09-aviso-48h-cobro

-- 
Banana Burn, tu entrenador personal en el celular
Ayuda: hola@bananaburn.app
Recibes este aviso porque tienes un cobro programado en Banana Burn.
```

## Montos según el plan (src/lib/plans.ts y src/lib/trial.ts)

{{monto}} y {{linea_aviso}} los pone el servidor con firstChargeMinor y reminderLine. Para el cobro del 8 de noviembre quedan así:

| Plan que se cobra | Tarjeta guardada antes del cobro | {{monto}} | {{monto_normal}} | {{linea_aviso}} |
| --- | --- | --- | --- | --- |
| Entreno, mensual | Sí (50 %) | $4.99 | $9.99 al mes | En 2 días se cobra tu primer mes con 50 % de descuento: $4.99, el 8 de noviembre de 2026. Puedes cancelar sin costo antes de esa fecha. |
| Entreno + Nutrición, mensual | Sí (50 %) | $7.49 | $14.99 al mes | En 2 días se cobra tu primer mes con 50 % de descuento: $7.49, el 8 de noviembre de 2026. Puedes cancelar sin costo antes de esa fecha. |
| Entreno, mensual | Sin promoción (ya pagó antes) | $9.99 | $9.99 al mes | En 2 días se cobra tu plan de $9.99, el 8 de noviembre de 2026. Puedes cancelar sin costo antes de esa fecha. |
| Entreno + Nutrición, mensual | Sin promoción (ya pagó antes) | $14.99 | $14.99 al mes | En 2 días se cobra tu plan de $14.99, el 8 de noviembre de 2026. Puedes cancelar sin costo antes de esa fecha. |
| Entreno, anual | No aplica el 50 % | $59.99 | $59.99 al año | En 2 días se cobra tu plan de $59.99, el 8 de noviembre de 2026. Puedes cancelar sin costo antes de esa fecha. |
| Entreno + Nutrición, anual | No aplica el 50 % | $89.99 | $89.99 al año | En 2 días se cobra tu plan de $89.99, el 8 de noviembre de 2026. Puedes cancelar sin costo antes de esa fecha. |

Cuentas nuevas (no de la beta) sin la promoción: reminderLine dice "En 2 días se cobra tu plan de $9.99. Puedes cancelar sin costo hasta el día 7." Se recomienda usar siempre la versión con fecha.

Cómo sale el 50 %: discountedMinor redondea hacia abajo al centavo. $9.99 por 50 % = $4.995, se cobra $4.99. $14.99 por 50 % = $7.495, se cobra $7.49. Coincide con lo que promete la web; la diferencia de medio centavo queda a favor de la persona.

## Relación con el correo que la app ya envía

La app ya manda este aviso como `recordatorioCobro` (src/lib/email/templates.ts), una sola vez por cobro (reminder_sent_at). Esta pieza usa la misma frase (reminderLine) y el mismo enlace, y agrega el monto normal y los pasos para cancelar. Debe salir uno solo: o se actualiza `recordatorioCobro` con este texto, o se apaga allí antes de mandar este desde Resend. Nunca los dos.
