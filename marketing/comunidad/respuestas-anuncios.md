# Respuestas a anuncios de Cuánto peso

Borradores para Facebook e Instagram, comentarios y mensajes privados. Costa Rica y Colombia. Nada se responde, publica, envía, gasta ni cambia en campañas sin aprobación de Andrés. Cada texto de la tabla tiene menos de 40 palabras, incluido el enlace. Revisado contra el código el 1 de noviembre de 2026.

Si se adapta a una pieza visual: paper #FFF8E3, banana #FFD60A, ink #1B1505 y Plus Jakarta Sans. Español de tú, sin modismos, emojis ni promesas de resultados.

## Banco listo para revisión

| Caso | Respuesta |
| --- | --- |
| ¿Cuánto cuesta? | Entreno cuesta US$9.99/mes; Entreno + Nutrición, US$14.99/mes. Los anuales cuestan US$59.99 y US$89.99, respectivamente, en un solo cobro. Empieza con 7 días gratis sin tarjeta: https://bananaburn.app/registro |
| ¿Es gratis? | Tienes 7 días gratis desde el registro, sin tarjeta. Después necesitas un plan para seguir entrenando. Si guardas tarjeta, se programa el cobro al terminar la prueba. Empieza aquí: https://bananaburn.app/registro |
| ¿Me cobran si cancelo? | Si cancelas el cobro programado antes de terminar la prueba, no se cobra y conservas esos días. Hazlo en Mi plan. Si ya pagaste, cancelas la próxima renovación y conservas el período pagado: https://bananaburn.app/app/suscripcion |
| ¿Sirve si nunca he ido al gym? | Sí. Elige Principiante al crear tu plan: la app ajusta ejercicios, series y descansos a tu nivel. También puedes indicar que entrenas en casa. Prueba 7 días sin tarjeta: https://bananaburn.app/registro |
| ¿Funciona en mi país? Costa Rica | Sí, puedes usar Banana Burn en Costa Rica. Los planes se cobran en dólares. Empieza con 7 días gratis sin tarjeta y revisa las opciones de pago dentro de la app: https://bananaburn.app/registro |
| ¿Funciona en mi país? Colombia | Puedes probarla desde Colombia durante 7 días sin tarjeta. Los precios son en dólares; para continuar, revisa las opciones de pago disponibles en la app. No podemos garantizar que tu tarjeta sea aceptada: https://bananaburn.app/registro |
| ¿Es una app o un entrenador real? | Es una app que organiza tu rutina según tu nivel, tiempo y equipo, con animaciones de técnica. No es una sesión con un entrenador humano en vivo. Pruébala 7 días sin tarjeta: https://bananaburn.app/registro |
| Comentario negativo: «Eso no sirve» | Entendemos la duda. No prometemos resultados iguales para todos. Si quieres conocer cómo organiza tu rutina, puedes probarla 7 días sin tarjeta: https://bananaburn.app/registro |
| Spam | Sin respuesta. |

La fila de spam es una decisión de moderación, no un mensaje para copiar. Preparar para Andrés la revisión de enlaces sospechosos, suplantación o mensajes repetidos; no abrir enlaces, discutir ni ejecutar acciones de moderación en esta tarea. Una crítica legítima no es spam. Ante un reclamo concreto, no usar el CTA comercial: preparar revisión de soporte con hola@bananaburn.app, sin prometer reembolsos ni plazos.

Nunca pedir datos de tarjeta, salud ni documentos por comentario o DM. No pedir capturas que puedan contenerlos. La tarjeta se gestiona únicamente en el flujo de pago de la app. Si llegan datos sensibles espontáneamente, no copiarlos al registro de comunidad; preparar el caso para revisión de Andrés sin reproducirlos.

## Reglas verificadas y límites

- `src/lib/plans.ts`: precios en USD, `TRIAL_DAYS = 7`, Entreno y Entreno + Nutrición. La prueba de cuentas nuevas empieza al crear la cuenta, no al guardar tarjeta. Las cuentas de beta tienen una gracia distinta: no ofrecerles otros 7 días por volver a entrar.
- `src/lib/trial.ts`: `trialEndFor`, `canCancel`, `promoFor`, `promoPrice`; `src/app/api/pagos/prueba/route.ts` y `src/lib/trial-billing.ts`: cancelar el cobro programado conserva el acceso hasta el fin de la prueba. Sin tarjeta no hay cobro automático; al terminar se muestra el muro de planes.
- Promoción opcional, solo si preguntan por ella: «Si nunca pagaste y guardas tu tarjeta en la app antes del primer cobro, el primer mes tiene 50 % de descuento: Entreno US$4.99 o Entreno + Nutrición US$7.49. No aplica al anual.» No presentar estos importes como precio mensual permanente.
- `src/lib/billing.ts`, `cancelAtPeriodEndFor`: cancelar una suscripción detiene la próxima renovación y mantiene el período pagado. No equivale a devolver cobros anteriores. Si hay un cobro en curso, preparar revisión de soporte; no garantizar que pueda detenerse.
- `src/app/bienvenida/wizard.tsx`: nivel Principiante para quien nunca o casi nunca entrenó con pesas; ajusta ejercicios, series y descansos. `src/lib/plans.ts`: rutina según nivel, tiempo y equipo y animaciones de técnica. No prometer supervisión humana ni resultados físicos específicos.
- `src/lib/pay-provider.ts`, `src/lib/tilopay.ts` y `src/app/api/pagos/tilopay/route.ts`: Costa Rica usa ONVO por defecto; otros países usan Tilopay si está configurado y ofrecido al usuario. El código no prueba que esté habilitado en producción. Andrés debe verificar el flujo para Colombia antes de aprobar afirmaciones de disponibilidad de pago. No convertir precios a colones o pesos ni prometer aceptación bancaria.

## Paso del embudo, medición y dinero

Estas respuestas buscan mover consulta del anuncio > registro > prueba > primer pago, aclarando precio y cobro antes de que la persona abandone. No se atribuyen ventas a una respuesta sin evidencia.

Tras la aprobación, registrar por semana y país: caso del banco, cantidad de consultas y respuestas aprobadas usadas, clics si la plataforma los ofrece, registros identificables y primeros pagos verificables. Usar agregados, sin contenido sensible de los mensajes. Medir prueba a primer pago como cuentas de la cohorte con primer cobro confirmado / cuentas nuevas de esa cohorte cuya prueba terminó; informar también el tamaño de cohorte y la ventana observada. Para contribución de este banco, usar solo la cohorte atribuible; si no existe vínculo verificable entre respuesta y registro, marcar atribución pendiente. El enlace genérico no atribuye por sí solo.

`trial_charges.status = 'succeeded'` confirma el primer cobro de prueba; contrastar suscripciones vigentes para usuarios de pago activos, deduplicando por usuario. No usar Meta Subscribe como sustituto: no se dispara en el cobro automático al terminar la prueba. No añadir UTMs como si resolvieran la atribución: `ref-capture.tsx` solo guarda UTMs cuando hay `?ref=`. Este borrador no cambia instrumentación.

Neto por cobro = cobro / 1.13 − (cobro × comisión porcentual + US$0.35). ONVO: 3.9 %; Tilopay: 4.25 %. Importes calculados con precios de `src/lib/plans.ts` y promoción de `src/lib/trial.ts`, redondeados al centavo al final. Es neto tras IVA y procesador, antes de otros gastos.

| Plan y cobro | Cobro USD | Neto ONVO USD | Neto Tilopay USD |
| --- | --- | --- | --- |
| Entreno, primer mes con promoción | $4.99 | $3.87 | $3.85 |
| Entreno + Nutrición, primer mes con promoción | $7.49 | $5.99 | $5.96 |
| Entreno, mensual regular | $9.99 | $8.10 | $8.07 |
| Entreno + Nutrición, mensual regular | $14.99 | $12.33 | $12.28 |
| Entreno, anual en un cobro | $59.99 | $50.40 | $50.19 |
| Entreno + Nutrición, anual en un cobro | $89.99 | $75.78 | $75.46 |

Cada pago adicional verificable puede mover el neto de su fila; no hay estimación de volumen ni de mejora de conversión sin datos. Para el aporte real, sumar el neto de cada cobro confirmado sin redondeos intermedios y restar el gasto atribuible aprobado. Un anual es ingreso de un cobro, no ingreso mensual recurrente. La meta de 100 usuarios de pago no demuestra rentabilidad por sí sola: comparar ingresos netos y gastos reales.
