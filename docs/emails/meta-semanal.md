# Meta semanal: todavía llegas a tu meta

Copy del recordatorio de #288 (correo y push). Lo envía `runReminders` (`src/lib/notify-run.ts`, dentro de `processUser`) con las reglas de `src/lib/meta-semanal.ts`; el correo vive en `WEEKLY_GOAL_MAIL` (`src/lib/email/templates.ts`) y el push en `weeklyNudgeCopy`. Objetivo: que entrenar 3 veces por semana sea lo normal. Una sola acción: abrir el entreno de hoy.

## Cuándo y a quién

| Cuándo sale | A quién |
| --- | --- |
| A la hora de su recordatorio, el día en que todavía llega a su meta pero va atrás: le quedan (contando hoy) los días justos que le faltan o uno más. Por ejemplo, el jueves con 0 de 3 | Cuentas que ya entrenaron alguna vez, que hoy no entrenaron y a las que les faltan entrenos para su meta |

- La meta sale de los días de la bienvenida (`profiles.train_days`), con un máximo de 3 en una semana que toca la prueba de 7 días; la semana del registro, como mucho los días que quedaban. La semana va de lunes a domingo en su zona horaria.
- Como máximo uno por semana (`notification_log`, kind `meta_semanal`, desde el lunes local).
- El correo, solo con `email_reminders` y si hoy no salió otro correo. El push, solo con `push_reminders`, con un dispositivo, fuera de las horas de silencio y bajo el tope diario.
- Ese día reemplaza al recordatorio de rutina ("Hoy te toca..."). No sale si hoy toca la reactivación de 3 o 7 días ni si hoy ya salió una pieza de activación, de la prueba, de la recuperación, del primer pago o del cierre de la Temporada 1.
- Se mide con `weekly_goal_view` y `weekly_goal_done` en `funnel_events` y la columna "3 entrenos en la prueba" de /admin/embudo.

## Push

**Título:** Todavía llegas a tu meta

**Texto:** Llevas 0 de 3 entrenos esta semana. Hoy son 12 minutos. Coach Banana te guía paso a paso.

Sin los minutos de la sesión de hoy: "El de hoy te acerca." en lugar de "Hoy son 12 minutos."

## Correo

**Asunto:** Todavía llegas a tu meta de la semana

**Preheader:** Llevas 0 de 3 entrenos. Hoy son 12 minutos.

**Cuerpo:**

Esta semana llevas 0 de 3 entrenos. Todavía te alcanzan los días para cumplir tu meta.

El de hoy son 12 minutos. Coach Banana te dice cada ejercicio, cuántas veces y cuándo descansar.

Si hoy no puedes, no pasa nada: descansar también es parte del plan.

Coach Banana

**Botón:** Empezar mi entreno de hoy

**Destino:** /app/entreno, con el enlace de un toque (`withLoginLinks`).

Las cifras (0, 3 y 12) son de ejemplo: el correo lleva las reales de la semana y los minutos de la sesión de hoy según su plan.
