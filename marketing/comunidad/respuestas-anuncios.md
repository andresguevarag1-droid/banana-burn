# Respuestas a anuncios «Cuánto peso»

Borradores para Facebook e Instagram, comentarios y mensajes directos. Costa Rica y Colombia. Andrés debe aprobarlos antes de publicar o responder. No se modifica ninguna campaña ni se autoriza gasto.

Usar la respuesta correspondiente sin sumar varios bloques. Cada cita tiene menos de 40 palabras, incluido el enlace. Español de tú, sin modismos, emojis ni promesas de resultados. Para adaptar a arte: paper #FFF8E3, banana #FFD60A, ink #1B1505 y Plus Jakarta Sans.

## Banco para copiar

### ¿Cuánto cuesta? (ambos países)

> Entreno cuesta US$9.99 al mes; Entreno + Nutrición, US$14.99 al mes. También hay planes anuales. Empieza con 7 días gratis, sin tarjeta: https://bananaburn.app

### ¿Y el anual? (ambos países)

> Entreno cuesta US$59.99 al año; Entreno + Nutrición, US$89.99 al año. Se paga el año completo. Prueba 7 días gratis, sin tarjeta: https://bananaburn.app

### ¿Es gratis? (ambos países)

> Tienes 7 días gratis con todo incluido, sin tarjeta, desde tu registro. Después necesitas un plan para seguir entrenando. Si guardas tarjeta, programas el cobro al terminar la prueba. Empieza aquí: https://bananaburn.app

### ¿Me cobran si cancelo? (durante la prueba)

> Cancelar el cobro programado antes de que se procese no tiene costo. Hazlo desde Mi plan; conservas el acceso hasta terminar la prueba. Puedes empezar 7 días gratis sin tarjeta: https://bananaburn.app

### ¿Y si ya pagué?

> Cancela la renovación desde Mi plan. Conservas el acceso hasta terminar el periodo pagado. Si tienes dudas sobre un cobro, escribe a hola@bananaburn.app sin enviar datos de tarjeta, salud ni documentos.

### ¿Sirve si nunca he ido al gym? (ambos países)

> Sí. La rutina se adapta a tu nivel, tiempo y equipo, con animaciones de técnica y progresión de cargas. Puedes empezar como principiante. Prueba 7 días gratis sin tarjeta: https://bananaburn.app

### ¿Funciona en Costa Rica?

> Sí, puedes usar Banana Burn en Costa Rica. Los precios están en dólares y el pago se realiza dentro de la app. Empieza con 7 días gratis, sin tarjeta: https://bananaburn.app

### ¿Funciona en Colombia?

> Puedes probar la app desde Colombia durante 7 días gratis, sin tarjeta. Para continuar con un plan, revisa las opciones de pago disponibles en Mi plan; no podemos garantizar la aceptación de tu tarjeta: https://bananaburn.app

### ¿Es una app o un entrenador real? (ambos países)

> Es una app con rutinas adaptadas a tu nivel, animaciones de técnica y progresión de cargas. No es una sesión en vivo con un entrenador humano. Prueba 7 días gratis sin tarjeta: https://bananaburn.app

### Comentario negativo: «Eso no sirve»

> Entiendo la duda. Puedes revisar cómo funciona antes de decidir, sin promesas de resultados. Si quieres probarla, tienes 7 días gratis sin tarjeta: https://bananaburn.app

### Spam

No responder ni llevar a la prueba. Propuesta para aprobación de Andrés: ocultar o reportar publicidad ajena, enlaces fraudulentos y spam repetido. No abrir enlaces. Una crítica legítima no se trata como spam.

Si hace falta explicar la regla a alguien que pregunta, usar solo este texto:

> Este espacio es para dudas sobre Banana Burn. Evita publicidad ajena y enlaces repetidos. Gracias por cuidar la conversación.

## Reglas para quien ejecute

- Nunca pedir datos de tarjeta, salud ni documentos por comentarios, mensajes ni correo. No pedir capturas de pagos o pantallas que puedan contenerlos. La tarjeta se ingresa únicamente en el flujo de pago de la app.
- Si alguien los comparte espontáneamente, no copiarlos al registro de seguimiento; señalar a Andrés el caso para proteger la información. No diagnosticar ni recomendar pesos a partir de una condición médica por mensaje.
- Cobro en disputa, problema técnico o queja concreta: atender el problema antes de ofrecer la prueba. No confirmar cancelaciones ni reembolsos desde una conversación. Remitir a Mi plan o a hola@bananaburn.app sin solicitar información sensible.
- Las respuestas sobre la prueba son para cuentas nuevas desde el lanzamiento. No ofrecer otra prueba a cuentas existentes: las cuentas de beta tienen la fecha propia que muestra Mi plan.
- Colombia: antes de aprobar una respuesta que prometa pago internacional, Andrés debe verificar que Tilopay esté configurado y habilitado para clientes, no solo para personal. No prometer cobro en pesos ni aceptación universal de tarjetas. Costa Rica tampoco implica aprobación bancaria garantizada.
- Ante consultas médicas, orientar a su médico sin evaluar el caso por mensaje. No pedir antecedentes, diagnósticos, peso ni fotos. Toda respuesta que trate de GLP-1 debe incluir: «No sustituye la indicación de tu médico.»
- No ofrecer el descuento sin explicar sus condiciones. Si se necesita una respuesta específica, preparar otro borrador: 50 % solo el primer mes mensual, una vez por cuenta, nunca haber pagado y guardar tarjeta antes del primer cobro. Anual excluido; segundo mes a precio normal. No pedir la tarjeta por mensaje.

## Fuentes del código

Revisión: 1 de noviembre de 2026. Volver a comprobar antes de aprobar si cambia el producto.

| Hecho | Fuente |
| --- | --- |
| Precios en USD, dos planes, nivel/equipo, técnica, progresión, prueba de 7 días | `src/lib/plans.ts`: PLANS, TRIAL_DAYS |
| Prueba desde el registro, tarjeta opcional, cobro al final, promoción y beta | `src/lib/trial.ts`: trialEndFor, scheduleFor, promoFor, PROMO_TERMS; `src/lib/trial-billing.ts` |
| Cancelar cobro programado sin costo y conservar prueba | `src/lib/trial.ts`: canCancel; `src/lib/trial-billing.ts`: cancelTrial |
| Detener renovación y conservar periodo pagado | `src/lib/billing.ts`: cancelAtPeriodEndFor |
| País y disponibilidad condicional del pago internacional | `src/lib/pay-provider.ts`: providerFor; `src/lib/tilopay.ts`: tilopayOfferedTo; `src/app/api/pagos/tilopay/route.ts` |
| Etiqueta Mi plan | `src/components/app-nav.tsx` |

## Paso del embudo y medición

Estas respuestas buscan mover duda en comentario/DM → visita → registro y prueba → primer pago; explicar cobro y cancelación ayuda a decidir con información. No hay conversiones observadas ni ingreso incremental atribuible a este banco todavía.

Después de aprobación, llevar un registro semanal agregado por país y tipo de pregunta: conversaciones atendidas, enlaces compartidos y visitas/registros/pagos que puedan atribuirse con evidencia. No guardar nombres, usuarios, texto privado ni información sensible en el repo. Una respuesta enviada no cuenta como registro ni pago.

`CompleteRegistration` se dispara al terminar la bienvenida, no al crear la cuenta. Contar primeros cobros reales en `trial_charges` con status `succeeded`, deduplicados por usuario; para la meta de 100 usuarios de pago, comprobar también suscripción vigente. Revisar segundo mes por separado. No usar Meta `Subscribe` como total de pagos: no registra el autocobro de fin de prueba.

Los enlaces del banco son directos. No hay atribución automática de esos pagos a comentarios/DMs. Un desglose semanal es observacional, no prueba de causalidad. Si se aprueban enlaces medibles, preparar antes la configuración: las UTMs solas no se guardan en Supabase; `ref-capture.tsx` requiere `?ref=` y `/api/ref` valida el código. No inventar códigos ni usar `/r/` para preservar UTMs. No cambiar enlaces de campañas sin aprobación.

Métrica principal propuesta: primeros usuarios de pago atribuibles / registros atribuibles, separada por país y cohorte con tiempo suficiente para terminar la prueba. Sin atribución verificada, marcar «no disponible». Ingreso neto incremental: suma del neto de cobros atribuibles confirmados; costo por usuario de pago: gasto aprobado atribuible / primeros usuarios de pago atribuibles, solo si ambos existen. Este entregable no añade gasto.

## Dinero que puede mover

Escenarios por cobro aprobado, no pronóstico de ventas. USD. Fórmula solicitada: neto = cobro ÷ 1.13 − (cobro × tasa + US$0.35). ONVO: 3.9 %; Tilopay: 4.25 %. Son netos tras IVA y comisión bajo esta fórmula, antes de otros gastos, devoluciones y diferencias cambiarias. Tasas provistas en el issue, precios de `plans.ts`, promoción de `trial.ts`.

| Plan y cobro | Cobro USD | Neto ONVO | Neto Tilopay |
| --- | --- | --- | --- |
| Entreno mensual | $9.99 | $8.10 | $8.07 |
| Entreno + Nutrición mensual | $14.99 | $12.33 | $12.28 |
| Entreno anual | $59.99 | $50.40 | $50.19 |
| Entreno + Nutrición anual | $89.99 | $75.78 | $75.46 |
| Entreno primer mes con promoción | $4.99 | $3.87 | $3.85 |
| Entreno + Nutrición primer mes con promoción | $7.49 | $5.99 | $5.96 |

Cada primer pago adicional confirmado puede aportar el neto de su fila. El anual es un cobro por un año completo, no ingreso mensual recurrente por ese monto. Para N pagos, sumar los netos sin redondear y redondear el total al centavo; no multiplicar netos ya redondeados. Sin saber mezcla de planes, procesador y conversiones reales no se puede estimar un total ni afirmar que cubra el gasto.
