# Correo 1: Bienvenida (día 1)

| Campo | Valor |
| --- | --- |
| Asunto | Tu prueba de 7 días empieza hoy |
| Preheader | Hoy toca una sola cosa: arma tu plan y haz tu primer entreno. |
| Evento que lo dispara | Cuenta creada (profiles.created_at). Cuentas nuevas desde el 1 de noviembre: al registrarse. Cuentas de la beta: el 1 de noviembre, al terminar la beta. |
| Hora de envío (Costa Rica, UTC-6) | Cuentas nuevas: inmediato, al registrarse. Cuentas de la beta: 1 de noviembre, 7:00 a. m. |
| Condición para enviarlo | Prueba vigente y sin plan pagado. |
| Tipo | Ciclo de vida (con enlace de baja) |
| CTA único | Empezar mi día 1: https://bananaburn.app/app?utm_source=resend&utm_medium=email&utm_campaign=prueba_7_dias&utm_content=c01-bienvenida-dia-1 |
| Métrica que mueve | Activación: % que termina el plan (/bienvenida) y hace su primer entreno en 24 horas. |

HTML: [html/01-bienvenida-dia-1.html](html/01-bienvenida-dia-1.html)

## Texto plano

```text
Hola, {{nombre}}. Hoy empieza tu prueba.

Tienes 7 días con todo incluido, sin tarjeta, hasta el {{fin_prueba}}.

Día 1: tu acción de hoy
1. Arma tu plan: meta, días y equipo. Te toma 2 minutos.
2. Haz tu primer entreno: abre Hoy y toca tu entreno. Te guiamos serie por serie, con descanso y técnica.

Cada día de tu prueba te escribo con una sola acción. Ninguna toma más que tu entreno.

Empezar mi día 1: https://bananaburn.app/app?utm_source=resend&utm_medium=email&utm_campaign=prueba_7_dias&utm_content=c01-bienvenida-dia-1

"Hoy no tienes que hacerlo perfecto. Solo empieza."
Coach Banana

-- 
Banana Burn, tu entrenador personal en el celular
Ayuda: hola@bananaburn.app
Recibes este correo porque estás en tu prueba gratis de Banana Burn.
Dejar de recibir estos correos: {{baja_url}}
```

## Versión para cuentas de la beta (envío del 1 de noviembre)

Estas cuentas ya armaron su plan. Cambian solo estas piezas; lo demás queda igual:

- Asunto: Tu cuenta sigue gratis hasta el 7 de noviembre
- Preheader: Desde hoy la app se paga, pero tú sigues con todo incluido 7 días más.
- Título: Hola, {{nombre}}. Tienes 7 días más con todo
- Bajada: Gracias por usar Banana Burn durante la beta. Tu cuenta sigue con todo incluido y gratis hasta el final del 7 de noviembre. No se te cobra nada si no dejas tu tarjeta.
- Paso 1: "Abre Hoy" / "Tu plan ya está listo. Revisa el entreno que te toca."
- Paso 2: "Haz tu entreno de hoy" / "Te guiamos serie por serie, con descanso y técnica."
- CTA: igual ("Empezar mi día 1", /app).

## Relación con el correo que la app ya envía

La app manda hoy `bienvenida` (src/lib/email/templates.ts) al registrarse, con el mismo enfoque ("Arma tu plan", 3 pasos). Si esta secuencia se activa en Resend, este correo 1 lo reemplaza; enviar los dos sería un correo duplicado el mismo minuto.
