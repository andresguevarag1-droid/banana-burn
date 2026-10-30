# Correo 8: Oferta del 50 % al dejar la tarjeta

| Campo | Valor |
| --- | --- |
| Asunto | Tu primer mes a mitad de precio si dejas tu tarjeta lista |
| Preheader | Hoy no te cobramos. Entreno queda en $4.99 y Entreno + Nutrición en $7.49 el primer mes. |
| Evento que lo dispara | Inicio de la prueba + 4 días. |
| Hora de envío (Costa Rica, UTC-6) | 6:00 p. m. del día 5 (cuentas de la beta: 5 de noviembre, 6:00 p. m.). |
| Condición para enviarlo | Prueba vigente, sin tarjeta guardada, sin cobro programado y nunca pagó un plan (las condiciones de promoFor en src/lib/trial.ts). |
| Tipo | Ciclo de vida (con enlace de baja) |
| CTA único | Dejar mi tarjeta lista: https://bananaburn.app/app/suscripcion?utm_source=resend&utm_medium=email&utm_campaign=prueba_7_dias&utm_content=c08-oferta-50-tarjeta#tarjeta |
| Métrica que mueve | % de cuentas en prueba con tarjeta guardada antes del primer cobro (y con eso, costo por cliente que paga). |

HTML: [html/08-oferta-50-tarjeta.html](html/08-oferta-50-tarjeta.html)

## Texto plano

```text
Deja tu tarjeta lista y paga 50 % menos tu primer mes.

Si dejas tu tarjeta lista, tu primer mes cuesta 50 % menos. Hoy no te cobramos y cancelas cuando quieras desde Mi plan.

Entreno mensual: $4.99 el primer mes, después $9.99.
Entreno + Nutrición mensual: $7.49 el primer mes, después $14.99.

Tu prueba sigue igual: guardar la tarjeta no la alarga ni la acorta. El primer cobro es el {{fecha_cobro}}, cuando termina tu prueba, y te avisamos 2 días antes.

Si no dejas tu tarjeta, no se cobra nada. Al terminar la prueba eliges si sigues, a precio normal.

El 50 % de descuento aplica solo al primer mes del plan mensual, una vez por cuenta, si guardas tu tarjeta antes de tu primer cobro y nunca pagaste un plan. Desde el segundo mes se cobra el precio normal. El plan anual no tiene este descuento.

Dejar mi tarjeta lista: https://bananaburn.app/app/suscripcion?utm_source=resend&utm_medium=email&utm_campaign=prueba_7_dias&utm_content=c08-oferta-50-tarjeta#tarjeta

"Sigues entrenando igual. Solo dejas listo lo de después."
Coach Banana

-- 
Banana Burn, tu entrenador personal en el celular
Ayuda: hola@bananaburn.app
Recibes este correo porque estás en tu prueba gratis de Banana Burn.
Dejar de recibir estos correos: {{baja_url}}
```
