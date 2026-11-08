# Segundo entreno: tu segundo entreno está listo

Copy del correo de #286. Lo envía `sendSecondWorkoutEmails` (`src/lib/notify-run.ts`) con las reglas de `src/lib/segundo-entreno.ts`; el texto vive en `SECOND_WORKOUT_MAIL` (`src/lib/email/templates.ts`) y una prueba lo compara con este documento. Objetivo: primer entreno terminado → segundo entreno dentro de los 7 días gratis. Una sola acción: abrir el entreno.

## Cuándo y a quién

| Cuándo sale | A quién |
| --- | --- |
| De 48 a 72 h después de terminar el primer entreno (`workouts.finished_at`), en la primera corrida del cron de recordatorios fuera de las horas de silencio | Cuentas con un solo entreno terminado, dentro de la prueba de 7 días desde el registro |

- Una sola vez por cuenta (`notification_log`, kind `segundo_entreno`). Si la ventana se cierra sin enviarse, ya no sale.
- Mismas exclusiones que la secuencia de la prueba (`inTrialAudience` en `src/lib/trial-sequence.ts`): cuentas de la beta, staff, testers, cortesías, regalos, condominios, quien ya pagó o tiene un plan asignado, y cobros cancelados, cobrados o con el aviso del cobro hoy.
- Solo con `email_reminders` activo; el enlace de baja es el de los recordatorios.
- Si hoy ya recibió otro correo, ese día no sale (queda anotado como `segundo_entreno_omitido`). Si sale, ese día no sale el correo del recordatorio.
- Se mide en /admin/embudo con la columna "Segundo entreno": cuentas con 2 o más entrenos terminados en sus primeros 7 días.

## S1. Tu segundo entreno está listo

**Asunto:** Tu segundo entreno está listo

**Preheader:** Ya hiciste el primero. El segundo se hace igual, paso a paso.

**Cuerpo:**

Hace unos días terminaste tu primer entreno. El segundo ya está en tu plan, ajustado con lo que anotaste esa vez.

Ábrelo cuando tengas un rato hoy. Coach Banana te dice cada ejercicio, cuántas veces y cuándo descansar.

Tu plan funciona entrenando varias veces por semana: el segundo entreno es el que lo pone en marcha.

Coach Banana

**Botón:** Empezar mi segundo entreno

**Destino:** /app/entreno, con el enlace de un toque (`withLoginLinks`).
