# Lanzamiento (1 de noviembre) y primer cobro (8 de noviembre): checklist

Qué revisar, a qué hora, quién y qué hacer si algo falla, el domingo 1 de noviembre (termina la beta) y el domingo 8 de
noviembre (primer cobro de las cuentas de la beta que dejaron tarjeta). Cubre la app, el panel admin, ONVO, Tilopay,
`/api/salud` y los avisos. Revisa: Grace.

Las fechas salen del código: `BETA_ENDS_AT` y `BETA_GRACE_UNTIL` en `src/lib/plans.ts`, los crons en `vercel.json`, y
`REMINDER_DAYS_BEFORE`, `RETRY_AFTER_DAYS` y `MAX_ATTEMPTS` en `src/lib/trial.ts`. Las cuida
`src/lib/lanzamiento-y-cobro-qa.test.ts`.

**Es solo un checklist**: no cambia código, campañas ni correos. Nada se publica, se envía ni toca campañas sin aprobación
de Andrés.

## Responsables

| Quién | Qué hace |
| --- | --- |
| Andrés | Corre cada revisión en producción (es el único con acceso a Vercel, Supabase, ONVO, Tilopay y el panel admin) y decide cada acción ante una falla. |
| Grace | Revisa este checklist antes del 1 de noviembre, lee los resultados que anota Andrés y abre un issue por cada falla, con el número de fila. |
| Adrian | Arregla lo que necesite código, siempre con un PR que Andrés aprueba antes de fusionar (main despliega directo a producción). |

## Horas de referencia

Todas las horas son de Costa Rica (UTC−6, sin horario de verano).

| Hora | Qué corre | Fuente |
| --- | --- | --- |
| 00:00 del 1 nov | Termina la beta: las cuentas nuevas entran a la prueba de 7 días. | `BETA_ENDS_AT` |
| 00:00 del 8 nov | Termina la gracia de las cuentas de la beta: vence su primer cobro. | `BETA_GRACE_UNTIL` |
| 00:20 diario | Cron de cobros (`/api/cron/cobros`): solo cobra. | `vercel.json` |
| 07:00 diario | Cron de recordatorios (`/api/cron/recordatorios`): avisos a usuarios, luego cobra lo que quedó. | `vercel.json` |
| 20:00 diario | Cron de avisos (`/api/cron/avisos`): pendientes de Admin > Avisos y resumen del día por correo. | `vercel.json` |

Una visita a la app con un cobro vencido también cobra en el momento (`src/lib/trial-billing.ts`). Nunca cobra dos veces:
cada fila se reclama y cada cobro reserva su llave única (0062).

## Cómo anotar

En la columna Resultado pon `OK` o `Falla: lo que viste`, con la hora. Nunca anotes correos, nombres ni datos de tarjeta:
solo el id de cuenta o de fila. Al terminar el día, Andrés le pasa la tabla a Grace.

## A. Antes del lanzamiento (sábado 31 de octubre)

| # | Hora | Responsable | Dónde | Qué revisar y qué debe pasar | Si falla | Resultado |
|---|------|-------------|-------|------------------------------|----------|-----------|
| A1 | 18:00 | Grace | Este documento | El checklist está revisado y cada fila tiene hora, responsable y acción ante la falla. | Grace lo corrige en un PR antes de las 22:00. | |
| A2 | 20:00 | Andrés | Vercel, Settings, Environment Variables (Production) | Están puestas `CRON_SECRET`, `RESEND_API_KEY`, `ONVO_SECRET_KEY`, `NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY`, `ONVO_WEBHOOK_SECRET`, las cuatro `ONVO_PRICE_*`, y para Tilopay `TILOPAY_API_USER`, `TILOPAY_API_PASSWORD`, `TILOPAY_KEY`, `TILOPAY_ENABLED` y `TILOPAY_STATE_SECRET`. `NEXT_PUBLIC_BETA_ENDS_AT` no está puesta (es solo para pruebas locales). Revisa solo que existan, sin copiar valores. | Si falta una, agrégala y haz Redeploy. Si `NEXT_PUBLIC_BETA_ENDS_AT` está puesta, bórrala y haz Redeploy: movería el fin de la beta. | |
| A3 | 20:15 | Andrés | `/admin/salud`, Integraciones | ONVO, Tilopay y Resend aparecen configurados. | Igual que A2. | |
| A4 | 20:30 | Andrés | Vercel, Settings, Cron Jobs | Los tres crons están habilitados: cobros, recordatorios y avisos. | Habilítalos. Si no aparecen, revisa que el último deploy de producción salga de `main` con `vercel.json`. | |

## B. Día del lanzamiento (domingo 1 de noviembre)

| # | Hora | Responsable | Dónde | Qué revisar y qué debe pasar | Si falla | Resultado |
|---|------|-------------|-------|------------------------------|----------|-----------|
| B1 | 00:05 | Andrés | `https://www.bananaburn.app/api/salud` | Responde 200 con `{"ok":true}`. | Si da 503, abre `/admin/salud` (Estado) para ver qué dependencia está caída: base de datos, Resend, ONVO o Tilopay. Base caída: revisa el estado de Supabase. Proveedor que rechaza la llave: revisa esa variable en Vercel (A2). Si la app no carga, ver "Si algo falla", punto 1. | |
| B2 | 00:10 | Andrés | Navegador en modo incógnito: `/` y `/precios` | Cargan sin pantalla de error. Ofrecen la prueba de 7 días sin tarjeta y ningún texto dice que la beta sigue. | Anota la ruta y el "Código de referencia" si sale pantalla de error, y búscalo en Vercel, Logs. Texto equivocado: issue para Adrian (no bloquea el lanzamiento). | |
| B3 | 00:15 | Andrés | `/entrar?modo=registro` con un correo nuevo tuyo | Se crea la cuenta, llega el correo de confirmación si aplica, termina `/bienvenida` y entra a Hoy. | Registro roto: ver "Si algo falla", punto 1. Correo que no llega: revisa Resend (registros de envío) y `RESEND_API_KEY`. | |
| B4 | 00:20 | Andrés | La cuenta nueva, "Mi plan" (`/app/suscripcion`) | Muestra la prueba de 7 días que termina el 8 de noviembre (7 días desde el registro), no la beta. Guardar tarjeta es opcional y dice el 50 % del primer mes. | Si muestra la beta, revisa A2 (`NEXT_PUBLIC_BETA_ENDS_AT`) y abre issue para Adrian con prioridad alta. | |
| B5 | 00:25 | Andrés | La cuenta nueva, Entreno | Empieza y guarda un entreno corto; aparece en Progreso. | Issue para Adrian con la ruta y el código de referencia. | |
| B6 | 00:30 | Andrés | Una cuenta de la beta (la tuya), "Mi plan" | Sigue gratis hasta el final del 7 de noviembre. Si tiene tarjeta, dice que el primer cobro es el 8 de noviembre. | Si la trata como prueba vencida o pide pagar ya, ver "Si algo falla", punto 2 (cobro antes de tiempo). | |
| B7 | 00:40 | Andrés | `/admin/salud` | Estado en verde, sin errores nuevos en "Errores por ruta (24 h)" y sin webhooks de pago con error. | Abre el detalle del error, búscalo en Vercel, Logs (o Sentry si está configurado) y abre issue para Adrian. | |
| B8 | 00:45 | Andrés | `/admin` (Resumen) y `/admin/usuarios` | La cuenta de B3 aparece como registro nuevo. | Issue para Adrian: el tablero diario de Martín cuenta con estos datos. | |
| B9 | 01:00 | Andrés | `/admin/salud`, Tareas y pagos | El cron de cobros de las 00:20 terminó bien (aunque no cobre a nadie: la beta tiene gracia hasta el 8). | Ver "Si algo falla", punto 3. | |
| B10 | 07:30 | Andrés | `/admin/salud`, Tareas y pagos; Admin > Avisos | El cron de recordatorios de las 07:00 terminó bien y no hay aviso de sistema nuevo en Admin > Avisos. | Ver "Si algo falla", punto 3. | |
| B11 | 09:00 | Andrés | Panel de ONVO y panel de Tilopay | No hay cobros a cuentas de la beta. En ONVO, el webhook sigue activo y sin entregas fallidas. Tilopay sigue activo. | Cobro de la beta antes del 8: ver "Si algo falla", punto 2. Webhook con fallas: revisa `ONVO_WEBHOOK_SECRET` y la URL `/api/pagos/webhook` en ONVO. | |
| B12 | 20:15 | Andrés | Correo del resumen diario (cron de avisos de las 20:00) | Llega el resumen con registros, primeros entrenos, pagos, ingresos y cobros rechazados del día. | Revisa Resend y `/admin/salud`; si el cron falló, ver "Si algo falla", punto 3. | |
| B13 | 21:00 | Grace | Esta tabla | Cada fila tiene `OK` o una falla con issue abierto. | Pide a Andrés las filas vacías. | |

## C. Antes del primer cobro (2 al 7 de noviembre)

El simulacro de cobros (`docs/simulacro-cobros.md`) se corre dos veces antes del 8: una con tiempo para arreglar y otra
la víspera. No cobra ni escribe nada en la base.

| # | Hora | Responsable | Dónde | Qué revisar y qué debe pasar | Si falla | Resultado |
|---|------|-------------|-------|------------------------------|----------|-----------|
| C1 | Lun 2 nov, 10:00 | Andrés | Supabase, SQL editor | La migración `0062_llaves_cobro.sql` está aplicada (existe la tabla `charge_keys`). | Aplícala. Sin ella el cron no cobra (falla cerrado) y el simulacro marca `sin_llaves_0062`. | |
| C2 | Mar 3 nov, 10:00 | Andrés | Tu computadora: simulacro, primera corrida | Corre el simulacro con `--fecha 2026-11-08T06:20:00Z` (la fecha por defecto) siguiendo `docs/simulacro-cobros.md`. Termina sin error: las dos corridas coinciden, sin duplicados y sin barridos fallidos. | Pásale a Adrian solo el resumen de la consola y las filas con problema (ids, nunca correos) y abre issue. El arreglo tiene que estar en main antes del viernes 6. | |
| C3 | Mar 3 nov, 10:30 | Andrés y Grace | El CSV del simulacro | Ninguna fila con `monto_no_coincide`, `llave_ocupada` ni `sin_llaves_0062`. Los primeros meses con 50 % son $4.99 (Entreno) y $7.49 (Completo). Los testers y los condominios salen como `omitir`. | `monto_no_coincide`: revisa las `ONVO_PRICE_*` en Vercel contra `src/lib/plans.ts`. `llave_ocupada`: revisa esa llave en `charge_keys` con Adrian antes de liberarla. Otro motivo raro: issue para Adrian. | |
| C4 | Mar 3 nov, 11:00 | Andrés | `/admin/usuarios` y `/admin/pagos` | Tres filas del CSV al azar (busca por `userId`) coinciden en plan, procesador y monto con lo que muestra el panel. | Issue para Adrian con los ids. | |
| C5 | Jue 5 nov, 18:00 | Andrés | Correo de la oferta del 50 % (`marketing/estrategia/correos/08-oferta-50-tarjeta.md`) | Solo si Andrés lo aprobó: sale a las cuentas de la beta sin tarjeta. | Si no se aprobó, no sale; no bloquea el cobro. | |
| C6 | Vie 6 nov, 07:30 | Andrés | Correo de tu cuenta de la beta con tarjeta; Admin > Avisos | Llega el aviso de 48 horas antes del cobro (cron de recordatorios de las 07:00) con el monto y la fecha del 8 de noviembre. | Revisa `/admin/salud` (cron de recordatorios) y Resend. Si el cron falló, ver "Si algo falla", punto 3. | |
| C7 | Sáb 7 nov, 18:00 | Andrés | Tu computadora: simulacro, segunda corrida | Igual que C2 y C3. Anota el total a cobrar y cuántos cobros van a ONVO y cuántos a Tilopay: son la referencia del 8. | Si sale algo nuevo que no se arregla antes de medianoche, ver "Si algo falla", punto 4 (frenar los cobros). | |
| C8 | Sáb 7 nov, 21:00 | Andrés | `/api/salud` y `/admin/salud` | 200 con `{"ok":true}`; ONVO y Tilopay arriba; sin webhooks con error. | Igual que B1. Si ONVO o Tilopay están caídos a esta hora, ver "Si algo falla", punto 4. | |

## D. Día del primer cobro (domingo 8 de noviembre)

| # | Hora | Responsable | Dónde | Qué revisar y qué debe pasar | Si falla | Resultado |
|---|------|-------------|-------|------------------------------|----------|-----------|
| D1 | 00:35 | Andrés | `/admin/salud`, Tareas y pagos | El cron de cobros de las 00:20 terminó bien, con intentados, enviados y errores. Enviados se acerca al total de C7. Errores en 0. | Cron que no corrió o falló: ver "Si algo falla", punto 3. Errores mayores que 0: abre el detalle y sigue con D3. | |
| D2 | 00:40 | Andrés | Admin > Avisos | No hay aviso de sistema del cron de cobros ni de errores sobre el umbral. | Ver "Si algo falla", punto 3. | |
| D3 | 00:45 | Andrés | `/admin/salud`, Errores por ruta | Sin `pagos/llave-ocupada`, `pagos/llave-error`, `pagos/cobro-por-confirmar` ni `pagos/renovacion-por-confirmar`. | `pagos/llave-ocupada`: no la liberes a mano; Adrian revisa con Andrés en ONVO o Tilopay si el cobro existe. `por-confirmar`: espera a la corrida de las 07:00, que consulta al procesador; si sigue, issue para Adrian. | |
| D4 | 01:00 | Andrés | Panel de ONVO | Los cobros del día (primer mes con 50 % como cobro único) suman lo que dijo C7 para ONVO. Ningún cliente tiene dos cobros del mismo periodo. El webhook entrega sin fallas. | Cobro doble: ver "Si algo falla", punto 5. Webhook con fallas: la persona pagó pero no ve su plan; revisa `ONVO_WEBHOOK_SECRET` y las entregas fallidas en ONVO, y abre issue para Adrian. | |
| D5 | 01:10 | Andrés | Panel de Tilopay | Las órdenes aprobadas del día suman lo que dijo C7 para Tilopay, sin órdenes duplicadas. | Igual que D4. | |
| D6 | 01:20 | Andrés | `/admin/pagos` | Los cobros aparecen en Ingresos. Los rechazos aparecen en "Pagos fallidos". | Si faltan cobros que ONVO o Tilopay sí muestran, issue para Adrian (webhook o activación). | |
| D7 | 01:30 | Andrés | Tu cuenta de la beta con tarjeta, "Mi plan" | Si se cobró: plan activo. Si se rechazó: correo, push y campanita de pago rechazado, y "Mi plan" ofrece cobrar de nuevo o cambiar la tarjeta. | Plan cobrado sin activar: igual que D4 (webhook). Sin aviso de rechazo: issue para Adrian. | |
| D8 | 07:30 | Andrés | `/admin/salud`, Tareas y pagos | El cron de recordatorios de las 07:00 terminó bien y cobró lo que faltaba. Los "por confirmar" de D3 se resolvieron. | Ver "Si algo falla", punto 3. | |
| D9 | 10:00 | Andrés | Tablero diario (`docs/metas/tablero-diario.md`) | Corre el conteo: cobros con `status = 'succeeded'` en `trial_charges`. Es el primer número real de usuarios de pago. | Si no coincide con ONVO más Tilopay, issue para Adrian con los ids de las filas. | |
| D10 | 12:00 | Andrés | Vercel, Logs (filtra `area` `cron:cobros`) y Sentry si está configurado | Sin errores nuevos de pagos. | Issue para Adrian con el `code` del log. | |
| D11 | 20:15 | Andrés | Correo del resumen diario | Pagos, ingresos y cobros rechazados coinciden con D4, D5 y D6. | Si no coinciden, la fuente de verdad es `trial_charges` (D9); issue para Adrian. | |
| D12 | 21:00 | Grace | Esta tabla | Cada fila tiene `OK` o una falla con issue abierto. Resume para el PR o issue del lunes: cobros intentados, cobrados y rechazados. | Pide a Andrés las filas vacías. | |

## E. Día después (lunes 9 de noviembre)

| # | Hora | Responsable | Dónde | Qué revisar y qué debe pasar | Si falla | Resultado |
|---|------|-------------|-------|------------------------------|----------|-----------|
| E1 | 07:30 | Andrés | `/admin/salud` y `/admin/pagos` | Corrió el reintento automático de los rechazos del 8 (vence 1 día después del rechazo, así que lo toma la corrida de las 07:00 o la de las 00:20 si ya venció). Es el único reintento automático; después, la persona puede cobrar de nuevo desde "Mi plan" hasta 6 intentos. | Ver "Si algo falla", punto 3. | |
| E2 | 10:00 | Andrés | Tablero diario | Nuevo conteo de usuarios de pago. | Igual que D9. | |

## Si algo falla

1. **La app no carga o no deja registrarse.** En Vercel, Deployments, elige el último deploy de producción que
   funcionaba y usa Instant Rollback. Después revisa `/api/salud`. Avisa a Adrian con la hora, la ruta y el código de
   referencia; el arreglo vuelve por PR. No hace falta tocar la base.
2. **Se cobró a una cuenta de la beta antes del 8.** Reembolsa en el panel del procesador (ONVO o Tilopay; los reembolsos
   no se hacen desde el panel admin) y sigue el punto 4 para frenar los cobros hasta saber la causa. El correo a la
   persona lo escribe y manda Andrés.
3. **Un cron no corrió o falló.** En Vercel, Settings, Cron Jobs, toca Run en ese cron para correrlo a mano. Si vuelve a
   fallar, mira Vercel, Logs (filtra `cron:cobros`, `cron:recordatorios` o `cron:avisos`) y abre issue para Adrian. Si se
   cortó por tiempo (60 s), lo que faltó lo toma la corrida siguiente: no se cobra dos veces.
4. **Hay que frenar los cobros.** No hay un interruptor: deshabilitar los crons en Vercel, Settings, Cron Jobs frena los
   barridos, pero una persona que abre la app con el cobro vencido igual se cobra. Para frenarlo del todo, Adrian prepara
   un PR y Andrés lo aprueba. Vuelve a habilitar los crons cuando el arreglo esté en producción y el simulacro salga
   limpio.
5. **Cobro doble.** Reembolsa el segundo cobro en el panel del procesador. No liberes llaves en `charge_keys` a mano.
   Adrian revisa con el id de la fila por qué no lo frenó la llave única (0062).
6. **ONVO o Tilopay caídos.** Un primer cobro rechazado por la caída tiene un solo reintento automático, al día siguiente. Si sigue caído más de
   un día, pausa los crons (punto 4) para no gastar intentos de nadie y avisa a Adrian.
7. **Errores sobre el umbral (`OPS_ALERT_THRESHOLD`).** Llega un aviso de sistema a Admin > Avisos y por correo. Abre
   `/admin/salud`, ve la ruta con más errores y abre issue para Adrian.
