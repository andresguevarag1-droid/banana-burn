# Rescate del paso de la tarjeta: T1 y T2

Copy de los correos de #325 (Martín revisa los textos). Los envía `sendCardRescueEmails` (`src/lib/notify-run.ts`) con las reglas de `src/lib/tarjeta-rescate.ts`; el texto vive en `CARD_RESCUE_MAILS`, `CARD_RESCUE_BILLING` y `tarjetaRescate` (`src/lib/email/templates.ts`), y el inglés en `src/lib/i18n/en/email.ts`. Objetivo: que quien armó su plan en la bienvenida y se fue en el paso de la tarjeta vuelva a dejarla. Una sola acción: el botón "Dejar mi tarjeta", que entra sin contraseña y abre directo en el paso de la tarjeta (`/bienvenida?e=tarjeta_rescate_1` o `_2`).

## Cuándo y a quién

| # | Cuándo sale | A quién |
| --- | --- | --- |
| T1 | De 1 h a 24 h después de ver el paso (primer `card_ask_view` "bienvenida"), en la primera corrida fuera de las horas de silencio | Cuentas creadas desde `CARD_REQUIRED_FROM` (23 nov 2026, 00:00 de Costa Rica) que no dejaron la tarjeta |
| T2 | A las 7:00 de su hora local del primer día en que esa hora cae 24 h o más después de ver el paso | Las mismas, si siguen sin tarjeta |

- Una vez por cuenta y por correo (`notification_log`, kind `tarjeta_rescate_1` y `tarjeta_rescate_2`). Máximo uno de los dos por día local.
- Se corta al guardar la tarjeta (tarjeta activa, cobro de la prueba abierto o plan pagado).
- Solo con `email_reminders` activo y fuera de las horas de silencio; el enlace de baja es el de los recordatorios. Las direcciones que rebotaron o marcaron spam (0072) no reciben nada.
- No le llegan al equipo (staff).
- Las horas (1 h y 7:00 locales) dependen de la llamada de cada hora al cron de recordatorios (`.github/workflows/recordatorios-cada-hora.yml`, con el secreto CRON_SECRET en GitHub), igual que el checkout abandonado. Este paso corre en cada llamada, sin importar NOTIFY_CRON_MODE. Sin esa llamada, solo queda la corrida diaria de Vercel (13:00 UTC): T1 saldría hasta esa corrida y T2 solo cuando sus 7:00 locales ya pasaron.
- Se mide con `email_click` (`e=tarjeta_rescate_1/2`) y con `card_saved` "bienvenida" en /admin/embudo, tabla "Pedido de tarjeta".

## T1. Tu plan ya está armado: falta un paso

**Asunto:** Tu plan ya está armado: falta un paso

**Preheader:** Deja tu tarjeta y empiezas tus 7 días gratis.

**Cuerpo:**

Tu plan para bajar grasa ya está armado: 4 entrenos por semana, con tus pesos y tu nivel. (El objetivo y los días son los que eligió. Sin esos datos: "Tu plan ya está armado con tus días, tus pesos y tu nivel.")

Para empezar tu prueba solo falta dejar tu tarjeta. Tu plan te espera en el mismo paso donde lo dejaste.

Hoy no se cobra nada. Tienes 7 días gratis y te avisamos 2 días antes del cobro.

El día 8 se cobra el primer mes de tu plan con 50 % de descuento: $4.99 con Entreno o $7.49 con Entreno + Nutrición. Si eliges el plan anual, se cobra su precio completo.

Cancelas cuando quieras desde Mi plan.

**Botón:** Dejar mi tarjeta

## T2. Tu primer entreno de 12 min te está esperando

**Asunto:** Tu primer entreno de 12 min te está esperando

**Preheader:** Deja tu tarjeta y hazlo hoy, también en casa.

**Cuerpo:** la misma línea del plan, luego:

Tu primer entreno dura 12 minutos y lo puedes hacer en casa. Para abrirlo solo falta dejar tu tarjeta.

Y el mismo resumen del cobro y el mismo botón.

Los 12 minutos en casa solo existen para quien eligió gimnasio o mixto (`offersHomeFirst`). A las demás cuentas les llega:

**Asunto:** Tu primer entreno te está esperando

**Preheader:** Deja tu tarjeta y hazlo hoy.

Tu primer entreno dura hasta 15 minutos, con las indicaciones de cada ejercicio en el celular. Para abrirlo solo falta dejar tu tarjeta.

## En inglés

| | Subject | Preview |
| --- | --- | --- |
| T1 | Your plan is ready: one step left | Add your card and your 7 free days begin. |
| T2 | Your first 12-minute workout is waiting for you | Add your card and do it today, even at home. |
| T2 (sin casa) | Your first workout is waiting for you | Add your card and do it today. |

**Button:** Add my card
