# Correo R1: 48 horas sin entrenar

| Campo | Valor |
| --- | --- |
| Asunto | {{nombre}}, tu primer entreno puede durar 10 minutos |
| Preheader | Sin equipo y donde estés. Te digo qué hacer en cada serie. |
| Evento que lo dispara | Registro (profiles.created_at) + 48 horas, sin ninguna fila en workouts para esa persona. |
| Hora de envío (Costa Rica, UTC-6) | 5:00 p. m. del primer día en que ya se cumplieron las 48 horas. Ejemplo: registro el 1 de noviembre a las 9:00 p. m., envío el 4 de noviembre a las 5:00 p. m. |
| Condición para enviarlo | Al momento de enviar: cero entrenos, sin plan pagado, avisos por correo encendidos (notification_prefs.email_reminders) y sin baja de estos correos. Una sola vez por cuenta. |
| Tipo | Ciclo de vida (con enlace de baja) |
| CTA único | Empezar mis 10 minutos: https://bananaburn.app/app/entreno?expres=10&utm_source=resend&utm_medium=email&utm_campaign=recuperacion&utm_content=r01-48h-sin-entrenar |
| Métrica que mueve | Activación: % de registros con primer entreno antes de 72 horas. Quien entrena en la prueba es quien paga el 8 de noviembre. |

HTML: [html/01-48h-sin-entrenar.html](html/01-48h-sin-entrenar.html)

## Cuerpo

Eyebrow: Tu primer entreno. Título: "{{nombre}}, empieza con 10 minutos". Tres pasos (abrir el exprés, mirar la técnica, marcar cada serie), una línea para quien tiene más tiempo, el botón banana (es la acción de entreno) y una línea de Coach Banana.

## Texto plano

```text
{{nombre}}, tu plan está listo desde que te registraste. Si todavía no entrenas, que no sea por tiempo ni por equipo: hay un entreno de 10 minutos que haces en casa.

Cómo empezar hoy
1. Toca el enlace de abajo: abre el entreno exprés de 10 minutos. Si aún no armas tu plan, primero respondes unas preguntas.
2. En cada ejercicio, toca el nombre para ver la animación del movimiento.
3. Al terminar cada serie, márcala. El descanso corre solo.

¿Tienes más tiempo? En Entrenar también está tu sesión completa, con las cargas calculadas para ti.

Empezar mis 10 minutos: https://bananaburn.app/app/entreno?expres=10&utm_source=resend&utm_medium=email&utm_campaign=recuperacion&utm_content=r01-48h-sin-entrenar

"Lo difícil es empezar. Diez minutos hoy valen más que una hora que nunca llega."
Coach Banana

-- 
Banana Burn, tu entrenador personal en el celular
Ayuda: hola@bananaburn.app
Recibes este correo porque estás en tu prueba gratis de Banana Burn.
Dejar de recibir estos correos: {{baja_url}}
```

## Por qué así

- El enlace abre directo el exprés de 10 minutos sin equipo (`/app/entreno?expres=10`, el mismo atajo de la tarjeta Exprés en Entrenar). Quita las dos razones más comunes para no empezar: falta de tiempo y no tener gimnasio.
- Quien no terminó el registro (profiles.onboarded = false) también lo recibe: /app lo manda a /bienvenida a armar su plan. A esa persona la app hoy no le manda nada, porque el cron de recordatorios solo lee perfiles con onboarded = true.

## Relación con lo que la app ya envía

**Se cruza en parte con `primerEntreno`** (src/lib/email/templates.ts, vía `recordatorio` con `first: true`). src/lib/notify-run.ts lo manda por correo, push y en la app todos los días de la primera semana a quien tiene el registro completo y aún no entrena, a su hora de recordatorio (7:00 a. m. por defecto). El día en que sale R1, esa persona ya recibió `primerEntreno` en la mañana.

- Diferencia: `primerEntreno` presenta la sesión del día; R1 ataca el bloqueo (tiempo y equipo) con el exprés de 10 minutos, y además llega a quien no terminó el registro.
- Recomendación: el día de R1, que `primerEntreno` salga solo por push y en la app, sin correo. Si no se puede apagar por persona, mandar R1 solo a quien tiene onboarded = false.
- También coincide con la secuencia de la prueba: para una cuenta nueva, R1 cae el día 3, el mismo día del correo 3 (comida, 11:00 a. m.). Para quien no tiene entrenos, R1 reemplaza el correo 3 ese día: registrar comida sin haber entrenado no mueve la conversión.
