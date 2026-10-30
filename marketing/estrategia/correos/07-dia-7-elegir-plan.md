# Correo 7: Día 7: último día, elegir plan

| Campo | Valor |
| --- | --- |
| Asunto | Día 7: hoy es el último día de tu prueba gratis |
| Preheader | Elige tu plan para seguir mañana con tu rutina, tu racha y tu progreso. |
| Evento que lo dispara | Inicio de la prueba + 6 días. |
| Hora de envío (Costa Rica, UTC-6) | 6:00 a. m. del día 7. Cuentas de la beta: 7 de noviembre, 6:00 a. m. |
| Condición para enviarlo | Prueba vigente y sin plan pagado. Si tiene un cobro programado (tarjeta lista), va la versión con tarjeta. |
| Tipo | Ciclo de vida (con enlace de baja) |
| CTA único | Elegir mi plan: https://bananaburn.app/app/suscripcion?utm_source=resend&utm_medium=email&utm_campaign=prueba_7_dias&utm_content=c07-dia-7-elegir-plan |
| Métrica que mueve | Conversión de prueba a pago (meta 35 %): % que elige plan o deja tarjeta antes del fin de la prueba. |

HTML: [html/07-dia-7-elegir-plan.html](html/07-dia-7-elegir-plan.html)

## Texto plano

```text
Día 7 de 7: hoy cierras tu primera semana.

Tu prueba gratis termina el {{fin_prueba}}. Tu progreso queda guardado, con o sin plan.

Tu acción de hoy
1. Mira tu semana en Progreso: entrenos, peso y medidas de estos 7 días.
2. Elige tu plan en Mi plan: Entreno o Entreno + Nutrición, mensual o anual.

Entreno: $9.99 al mes o $59.99 al año.
Entreno + Nutrición: $14.99 al mes o $89.99 al año.

Si dejas tu tarjeta lista antes de que termine tu prueba, tu primer mes del plan mensual cuesta 50 % menos: $4.99 o $7.49. El plan anual incluye 1 temporada deportiva gratis.

Si no eliges plan, no se cobra nada. Al terminar la prueba la app te pide elegir uno para seguir.

Elegir mi plan: https://bananaburn.app/app/suscripcion?utm_source=resend&utm_medium=email&utm_campaign=prueba_7_dias&utm_content=c07-dia-7-elegir-plan

"Una semana entrenando ya cuenta. Sigamos."
Coach Banana

-- 
Banana Burn, tu entrenador personal en el celular
Ayuda: hola@bananaburn.app
Recibes este correo porque estás en tu prueba gratis de Banana Burn.
Dejar de recibir estos correos: {{baja_url}}
```

## Versión con tarjeta lista (cobro programado)

Quien ya dejó su tarjeta no necesita elegir nada. Cambian estas piezas:

- Asunto: Día 7: tu primera semana, completa
- Preheader: Tu tarjeta está lista: el {{fecha_cobro}} se cobra {{monto}}. Si quieres seguir, no tienes que hacer nada.
- Paso 2: "Revisa tu plan en Mi plan" / "El {{fecha_cobro}} se cobra {{monto}} ({{plan}}). Puedes cancelar sin costo antes de esa fecha."
- Sin la tabla de precios ni el párrafo del 50 %.
- CTA: "Ver mi plan" (mismo enlace, utm_content=c07-dia-7-con-tarjeta).
