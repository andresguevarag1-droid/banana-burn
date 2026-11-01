# Respuestas para anuncios de Cuánto peso

Borradores para comentarios y mensajes de Facebook e Instagram en Costa Rica y Colombia. Requieren aprobación de Andrés antes de publicar, responder o moderar. No se envió nada ni se tocaron campañas.

## Banco para copiar

Cada bloque citado es una respuesta completa de menos de 40 palabras. El mismo texto sirve para comentario o DM. Usar la variante del país cuando corresponda.

### ¿Cuánto cuesta?

> Entreno cuesta US$9.99 al mes; Entreno + Nutrición, US$14.99. También hay planes anuales de US$59.99 y US$89.99, respectivamente. Empieza con 7 días gratis sin tarjeta en https://bananaburn.app.

### ¿Es gratis?

> Tienes 7 días gratis con todo incluido, sin tarjeta, desde que creas tu cuenta. Después necesitas un plan para seguir entrenando. Si no guardas tarjeta, no hay cobro automático. Empieza en https://bananaburn.app.

### ¿Me cobran si cancelo? Durante la prueba

> Si guardaste tarjeta, cancela desde Mi plan antes del cobro programado: no se cobra y conservas el acceso hasta terminar la prueba. Puedes probar 7 días sin tarjeta en https://bananaburn.app.

### ¿Me cobran si cancelo? Plan ya pagado

> Cancela desde Mi plan para detener la renovación; conservas el acceso hasta terminar el periodo pagado. Cancelar no implica un reembolso automático. Si necesitas revisar un cobro, escribe a hola@bananaburn.app sin enviar datos sensibles.

### ¿Sirve si nunca he ido al gym?

> Sí. La rutina se adapta a tu nivel, tiempo y equipo, y tienes animaciones de técnica para aprender los movimientos. Empieza a tu ritmo con 7 días gratis sin tarjeta en https://bananaburn.app.

### ¿Funciona en mi país? Costa Rica

> Sí, puedes usar Banana Burn en Costa Rica. Los precios están en dólares estadounidenses. Prueba 7 días gratis sin tarjeta en https://bananaburn.app.

### ¿Funciona en mi país? Colombia

> Sí, puedes usar Banana Burn en Colombia. Los precios están en dólares estadounidenses; tu banco puede aplicar conversión y comisiones al pagar. Prueba 7 días gratis sin tarjeta en https://bananaburn.app.

### ¿Es una app o un entrenador real?

> Es una app con rutinas adaptadas a tu nivel y cargas sugeridas. No incluye sesiones con un entrenador humano. Puedes conocerla con 7 días gratis sin tarjeta en https://bananaburn.app.

### Comentario negativo: «Otra app que promete resultados mágicos»

> Entendemos la duda. No prometemos resultados de peso: la app te ayuda a organizar tus entrenamientos y registrar tu progreso. Puedes revisarla con 7 días gratis sin tarjeta en https://bananaburn.app.

### Spam

Sin respuesta pública ni DM; sin enlace a la prueba. Propuesta para aprobación: ocultar spam evidente y reportar fraude o enlaces maliciosos con las herramientas de la plataforma. Una crítica legítima no es spam.

## Criterio de atención y fuentes

- Nunca pedir datos de tarjeta, salud ni documentos por mensaje o comentario. No solicitar capturas de pagos o de la cuenta que puedan contenerlos. La tarjeta solo se ingresa en el flujo de pagos dentro de la app, nunca en redes.
- Si alguien comparte datos sensibles, no copiarlos al registro ni citarlos. Proponer a Andrés retirar el comentario y orientar a soporte sin repetir esos datos.
- Un reclamo de cobro se deriva a hola@bananaburn.app, sin prometer devolución ni discutir el caso en público. Si el cobro ya está procesándose, no asegurar que se puede detener; pedir revisión por soporte sin datos sensibles.
- No pedir antecedentes, diagnósticos, peso ni fotos para recomendar un plan. Ante una consulta médica, no evaluar por DM y orientar a su médico. Si la respuesta trata de GLP-1, incluir: «No sustituye la indicación de tu médico.»
- Precios USD, funciones y prueba: `src/lib/plans.ts` (`PLANS`, `TRIAL_DAYS`); acceso: `src/lib/entitlements.ts`. Entreno no incluye nutrición. No prometer kilos perdidos ni acompañamiento humano.
- Prueba desde el registro, tarjeta opcional, promoción y cancelación previa: `src/lib/trial.ts` (`trialEndFor`, `firstChargeMinor`, `promoFor`, `canCancel`) y `src/lib/trial-billing.ts` (`cancelTrial`). Las cuentas antiguas de beta tienen fechas especiales: consultar Mi plan, no prometerles una prueba nueva.
- Renovación y acceso pagado: `src/lib/billing.ts` (`cancelAtPeriodEndFor`), `src/app/api/pagos/cancelar/route.ts`; reembolsos y conversión bancaria: `src/app/(marketing)/terminos/page.tsx`.
- País y procesador: `src/lib/pay-provider.ts`. Costa Rica usa ONVO; fuera de Costa Rica se usa Tilopay solo cuando está configurado y habilitado, con ONVO como alternativa. No se verificó la configuración de producción ni se garantiza aceptación de cualquier tarjeta.
- Voz: español neutro de tú, sin emojis ni menciones de tecnología interna. Si se convierte en arte: paper #FFF8E3, banana #FFD60A, ink #1B1505, Plus Jakarta Sans.

## Embudo y dinero neto

Mueve comentario o DM con objeción > visita > registro y prueba de 7 días > primer pago. El objetivo es contribuir a 100 usuarios de pago activos, no acumular respuestas o clics. Sin gasto adicional propuesto.

Medición semanal por país y objeción, ejecutada por Andrés tras aprobación: contar consultas legítimas, respuestas enviadas y visitas/altas atribuibles cuando exista atribución verificable. Registrar solo agregados, sin nombres, mensajes privados ni datos sensibles. Medir prueba a primer pago como usuarios únicos con primer cobro confirmado dividido entre nuevas pruebas de la misma cohorte, dejando madurar el periodo y los reintentos. Medir también usuarios de pago vigentes y segundo cobro.

Los enlaces del banco no identifican estas respuestas por separado: sin instrumentación aprobada, reportar consultas y pagos totales como contexto, sin atribuir causalidad. Las UTMs solas no garantizan atribución persistente; `ref-capture.tsx` guarda UTMs solo cuando hay `?ref=`. No inventar códigos de referido. Verificar pagos en `trial_charges` con estado `succeeded` y suscripciones vigentes; Meta Subscribe no captura el cobro automático de fin de prueba. No sumar dos veces un mismo pago.

Neto por cobro = cobro ÷ 1.13 − (cobro × comisión porcentual + US$0.35). ONVO: 3.9 %; Tilopay: 4.25 %. Supuestos de la tarea, no una auditoría de tarifas. Redondeo al centavo al final. Precios de `src/lib/plans.ts`; descuento de `src/lib/trial.ts`.

| Plan / cobro | Cobro USD | Neto ONVO USD | Neto Tilopay USD |
| --- | --- | --- | --- |
| Entreno mensual | $9.99 | $8.10 | $8.07 |
| Entreno + Nutrición mensual | $14.99 | $12.33 | $12.28 |
| Entreno anual | $59.99 | $50.40 | $50.19 |
| Entreno + Nutrición anual | $89.99 | $75.78 | $75.46 |
| Entreno primer mes con promoción | $4.99 | $3.87 | $3.85 |
| Entreno + Nutrición primer mes con promoción | $7.49 | $5.99 | $5.96 |

La promoción es opcional: 50 % menos solo el primer mes mensual, una vez por cuenta, si guarda tarjeta antes del primer cobro y nunca pagó un plan. Desde el segundo mes rige el precio normal; no aplica al anual. No ofrecerla como precio permanente.

Cada pago adicional verificable mueve el neto de su fila; el potencial total es la suma de cobros adicionales por su neto real. Sin datos de conversión no se estima cuántos pagos generarán estas respuestas. Los anuales son un cobro por año, no ingreso mensual recurrente por ese importe. Estos netos no descuentan operación, reembolsos ni adquisición; para evaluar rentabilidad se comparan con esos gastos reales.
