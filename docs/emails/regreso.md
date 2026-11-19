# Regreso: correos que traen de vuelta tras el primer entreno

Secuencia de #320. Reemplaza al correo único del segundo entreno (#286, `segundo-entreno.md`). La envía `sendComebackEmails` (`src/lib/notify-run.ts`) con las reglas de `src/lib/regreso.ts`, dentro del cron de recordatorios (cada hora). El texto vive en `COMEBACK_MAILS`, `COMEBACK_LINES` y `COMEBACK_QUESTION` (`src/lib/email/templates.ts`), y `src/lib/regreso.test.ts` lo compara con este documento. La versión en inglés está en `en.md`.

Paso del embudo: primer entreno → segundo entreno (y tercero). Meta: que el segundo entreno pase de 3.6 % a más de 15 % de los registrados en la semana del 23 nov.

## Calendario

"Día N" cuenta días de calendario en la hora local de la persona desde el día del entreno.

| # | Cuándo | Para quién | Kind |
| --- | --- | --- | --- |
| R1 | Al día siguiente del primer entreno, desde las 7:00 locales | Terminó 1 y no hizo otro | `regreso_r1` |
| R2 | De 48 a 72 h después del primer entreno, fuera de las horas de silencio | Sigue sin el 2.º | `regreso_r2` |
| R3 | Día 4 (o día 5, si el 4 no pudo salir), desde las 7:00 locales | Sigue sin el 2.º | `regreso_r3` |
| R4 | Al día siguiente del 2.º entreno, desde las 7:00 locales | Hizo 2, no ha hecho el 3.º | `regreso_r4` |

R1 sale al día siguiente aunque la persona haya entrenado tarde: quien termina a las 18:00 recibe R1 a las 7:00 del día siguiente (13 h después). El issue proponía de 20 a 34 h, pero con esa ventana nadie que entrene después de las 11:00 recibiría R1.

## Reglas

- Máximo un correo por día. Si hoy ya salió otro correo (el recordatorio, una pieza de la prueba, otro de la secuencia), el de regreso no sale (`regreso_rN_omitido` en las estadísticas del cron). Si sale, ese día no salen el recordatorio, la reactivación, la racha, la pieza de la prueba ni la meta semanal: si choca, gana el de regreso, porque corre primero en el cron.
- El día del correo de recuperación (día 8 o 10 desde el registro, `recuperacion.md`) no sale: ese día es suyo.
- La secuencia se corta apenas la persona entrena: R1, R2 y R3 piden un solo entreno terminado (`workouts.finished_at`); R4, exactamente dos.
- Una vez por cuenta y por correo (`notification_log`, kinds `regreso_r1` a `regreso_r4`), con llave de idempotencia en Resend (`regreso_rN/<cuenta>`). Quien ya recibió `segundo_entreno` (#286) tiene R2 por enviado.
- Solo en los primeros 14 días desde el registro.
- Mismas exclusiones que la secuencia de la prueba (`inTrialAudience` en `src/lib/trial-sequence.ts`): cuentas de la beta, staff, testers, cortesías, regalos, condominios, quien ya pagó o tiene un plan asignado, y cobros cancelados, cobrados o con el aviso del cobro hoy.
- Solo con `email_reminders` activo; el enlace de baja es el de los recordatorios. Nada en horas de silencio.
- Idioma de `profiles.locale` y pesos en kg o lb según `profiles.units` (en libras, redondeado a 2.5 lb).
- Quien rebotó o marcó spam no recibe nada (supresión de 0072 en `sendEmail`).

## Contenido personal (R1, R2 y R4)

- La sesión que le toca hoy con sus minutos (en un día de descanso, la próxima sesión, como en `/app/entreno`).
- Un dato de su último entreno, si hay pesos: el primer ejercicio con peso de la sesión de hoy que hizo esa vez, con la carga que le pone el plan si sube ("hoy toca 22.5 kg"). Si no coincide ninguno, el primer ejercicio con peso de ese entreno, sin la carga de hoy. Sin pesos (en casa, sin equipo), no va la línea.
- Un botón a `/app/entreno?e=regreso_rN`, con el enlace de un toque (`withLoginLinks`).

## Medición

- Al entrar por el botón, `/app/entreno` registra `email_click` en `funnel_events` con `kind` = `regreso_rN` (sin datos personales).
- `/admin/embudo`, tabla "Correos de regreso" (últimas 8 semanas): enviados (`notification_log` con canal de correo), cuentas que tocaron el botón (`email_click`) y envíos tras los que la cuenta terminó un entreno en las 48 h siguientes.
- R3 no tiene botón: se mide por las respuestas que llegan a hola@bananaburn.app.

## Frases que comparten R1, R2 y R4

- Sesión: Hoy te toca {routine}: unos {mins} minutos.
- Sesión sin minutos: Hoy te toca {routine}.
- Dato con la carga de hoy: La vez pasada hiciste {exercise} con {load}; hoy toca {next}.
- Dato sin la carga de hoy: La vez pasada hiciste {exercise} con {load}.
- Cierre: Ábrelo cuando tengas un rato hoy. Coach Banana te dice cada ejercicio, cuántas veces y cuándo descansar.

Orden del cuerpo: la primera frase de cada correo, la sesión, el dato (si hay), el cierre y la firma "Coach Banana".

## R1. Tu entreno 2 está listo

**Asunto:** Tu entreno 2 está listo: unos {mins} min

**Asunto sin minutos:** Tu entreno 2 está listo

**Preheader:** Ayer hiciste el primero. El segundo ya está en tu plan.

**Primera frase:** Ayer terminaste tu primer entreno. El segundo ya está en tu plan, ajustado con lo que anotaste.

**Botón:** Empezar mi entreno 2

Ejemplo (sesión de 25 min, sentadilla con 20 kg):

> Ayer terminaste tu primer entreno. El segundo ya está en tu plan, ajustado con lo que anotaste.
>
> Hoy te toca Fuerza total: piernas, pecho y hombros: unos 25 minutos.
>
> La vez pasada hiciste sentadilla trasera con 20 kg; hoy toca 22.5 kg.
>
> Ábrelo cuando tengas un rato hoy. Coach Banana te dice cada ejercicio, cuántas veces y cuándo descansar.
>
> Coach Banana

## R2. Ayer no pudiste

**Asunto:** Ayer no pudiste. Hoy son {mins} minutos

**Asunto sin minutos:** Ayer no pudiste. Tu entreno 2 sigue listo

**Preheader:** Tu entreno 2 te espera, sin nada que recuperar.

**Primera frase:** Tu entreno 2 sigue en tu plan. No tienes que recuperar nada: haces este y tu plan sigue desde ahí.

**Botón:** Empezar mi entreno 2

## R3. ¿Qué te frenó para volver?

Texto plano, sin diseño ni botón, como un correo escrito a mano.

- Remitente: Andrés de Banana Burn <hola@bananaburn.app>
- Responder a: hola@bananaburn.app. Las respuestas son nuestras entrevistas.

**Asunto:** ¿Qué te frenó para volver?

**Cuerpo:**

Hola, {name}:

Soy Andrés, de Banana Burn. Vi que hace unos días hiciste tu primer entreno y todavía no el segundo.

Te quiero hacer una sola pregunta: ¿qué te frenó para volver?

Respóndeme este correo con lo que sea, aunque sea una línea. Lo leo yo y me sirve para mejorar la app.

Andrés

--
Si no quieres recibir más correos como este: {url}

Sin nombre en el perfil, el saludo es "Hola:".

## R4. Vas 2

**Asunto:** Vas 2. El 3.º es el que hace el hábito

**Preheader:** Ya llevas 2 entrenos. Hoy puedes hacer el tercero.

**Primera frase:** Ya llevas 2 entrenos. El tercero es el que convierte esto en costumbre.

**Botón:** Empezar mi entreno 3

El dato sale del segundo entreno (el último).
