# Referidos: correo a los 10 días del primer pago

Borrador para aprobación de Andrés. Este archivo no conecta ni envía correos, no publica ni modifica campañas o gasto.

## Regla vigente: el amigo cuenta cuando paga

Desde la decisión de Andrés del 1 de noviembre de 2026 (migración 0064), **3 amigos que pagan su primer plan = 1 mes gratis.** Activarse (bienvenida, entreno, agua, pasos o sueño) ya no basta. Las calificaciones registradas antes con la regla anterior se respetan.

Fuentes: `src/lib/referrals.ts` (constantes y simulación), `supabase/migrations/0025_regalos_referidos.sql` (`referral_attribute`, `_referral_settle`, `referral_annual_paid`), `supabase/migrations/0064_referidos_al_pagar.sql` (`_referral_try_qualify`, `referral_paid`, `admin_referral_refund`) y `src/app/(app)/app/referidos/page.tsx`. La calificación exige el primer pago verificado de un plan (Entreno o Entreno + Nutrición, mensual o anual, por ONVO o Tilopay) dentro de los 60 días desde que el amigo se registró con el enlace. No cuentan la prueba de 7 días, la tarjeta guardada sin cobro, cortesías, beta, condominio, retos ni temporadas sueltas, ni un pago reembolsado. La atribución se acepta en las primeras 72 horas de la cuenta; el enlace guarda una cookie de 30 días. No cuentan cuentas propias ni repetidas ni pagos con la misma tarjeta de quien invita; las sospechosas pasan por revisión. Cada grupo se recompensa una sola vez; máximo 12 recompensas no revocadas en 365 días. Si alguien del grupo compra anual confirmado por el webhook de ONVO, el premio sube a 3 meses en total, incluso si ya se entregó el primero.

## Correo listo para revisión

**Asunto:** Cada 3 amigos que pagan su plan te dan 1 mes

**Vista previa:** Comparte tu enlace y revisa quién ya cuenta para tu mes gratis.

**Cuerpo:**

Entrenar con tu gente puede regalarte tu próximo mes.

Abre Invita y gana en /app/referidos, toca Copiar y comparte tu enlace. Tus amigos crean una cuenta nueva con él y cuentan cuando pagan su primer plan, mensual o anual, dentro de los 60 días desde que se registran. La prueba gratis no cuenta.

Cada 3 amigos que pagan te dan 1 mes gratis, al final de tu acceso actual. Si uno del grupo paga el plan anual, ganas 3 meses en total.

No cuentan cuentas propias ni repetidas. Máximo 12 premios por año. Revisa tu avance en Invita y gana.

Coach Banana

**Botón:** Compartir mi enlace

**Destino:** https://bananaburn.app/app/referidos

El botón abre la página; allí la persona copia o comparte su enlace personal `/r/<código>`. No usar un código genérico ni pedir que comparta el destino del correo como invitación.

## Audiencia y convivencia

Propuesta de un solo envío al cumplir 10 días completos desde el primer pago confirmado de una suscripción, mensual o anual, con suscripción vigente. No contar registro, tarjeta guardada, cortesías ni compras de retos como primer pago. Revalidar antes de enviar: consentimiento y baja, pago no devuelto y suscripción sin cancelación. Deduplicar por usuario e hito; omitir atrasados. La automatización y su registro de envíos quedan pendientes de implementación y aprobación.

Complementa los correos de primer pago de días 1 y 21 de `docs/emails/primer-pago.md`. No reemplaza bienvenida, prueba iniciada, recordatorios de cobro, recibos ni el correo transaccional `regalo` que avisa una recompensa real. Al integrarlo, sustituir el recordatorio diario o reactivación que coincida ese día; priorizar transaccionales y resumen semanal, omitiendo esta pieza si coinciden. Usar motivo del correo, baja firmada y versión de texto plano del sistema existente.

Maquetación prevista: paper #FFF8E3, banana #FFD60A, ink #1B1505 y Plus Jakarta Sans; un solo botón principal. El cuerpo, incluida la firma, tiene menos de 120 palabras.

Alternativa B de asunto, sin correo adicional: «Tu enlace puede darte un mes gratis». Apostaría por A porque explica la condición desde el asunto. Primero medir el efecto frente a no enviar; probar asuntos cuando haya muestra suficiente.

## Costo frente a anuncios y dinero neto

Precios de `src/lib/plans.ts`, en USD. Neto por cobro = cobro ÷ 1.13 − (cobro × comisión porcentual + $0.35), con ONVO 3.9 % y Tilopay 4.25 %, según el encargo. Redondear solo el resultado final. Es neto de IVA y pasarela, antes de costos operativos, devoluciones y envío.

| Plan | Cobro mensual | Neto ONVO | Neto Tilopay | Cobro anual | Neto ONVO | Neto Tilopay |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Entreno | $9.99 | $8.10 | $8.07 | $59.99 | $50.40 | $50.19 |
| Entreno + Nutrición | $14.99 | $12.33 | $12.28 | $89.99 | $75.78 | $75.46 |

Valorar un mes regalado como el neto mensual regular que se deja de cobrar: $8.07–$8.10 en Entreno o $12.28–$12.33 en Entreno + Nutrición. Es costo de oportunidad, no una salida de efectivo ni el costo marginal de prestar el servicio. Con la regla vigente cada mes llega con 3 primeros pagos; repartido entre esos 3 invitados, ese costo es $2.69–$2.70 o $4.09–$4.11 por usuario de pago, respectivamente, sin costo de envío.

Comparación con la sección 3 de [campana-conversion-noviembre.md](../metas/campana-conversion-noviembre.md): su caso conservador fija un techo de **$4.99 por usuario de pago** (y $1.75 por prueba iniciada); los techos mensuales regulares son $9.99 y $14.99. El costo repartido del mes regalado queda por debajo del techo de $4.99, porque la regla vigente solo lo entrega cuando los 3 pagan. Pero esos valores son límites antes de comisión, no CAC observados. Aplicando las comisiones del encargo al primer cobro promocional de $4.99 o $7.49 de `src/lib/trial.ts`, quedan $3.85–$3.87 o $5.96–$5.99 netos: esos serían techos más estrictos para recuperar en el primer cobro.

Por tanto, no se puede afirmar aún que referidos cueste menos que los anuncios reales. Con la regla anterior un premio podía salir sin ningún pago; con la vigente cada premio viene de 3 primeros pagos, y un reembolso anula la recompensa de su grupo. El premio anual consume 3 meses: valorar ese costo con el plan y los meses efectivamente otorgados, sin aplicar el cálculo de un mes. Comparar siempre (neto de todos los regalos + costo incremental de envío) ÷ invitados con pago confirmado contra gasto publicitario ÷ usuarios de pago atribuidos a anuncios, con la misma ventana. Las UTMs de `/r/<código>` se pierden al redirigir; usar la atribución en `referrals`, no prometer seguimiento por UTM.

Escenario aritmético, no pronóstico: si tres invitados hacen un primer pago mensual regular del mismo plan que quien invita y se entrega un solo mes, el neto de esos tres cobros menos el regalo sería $16.21 con ONVO o $16.14 con Tilopay para Entreno; $24.66 o $24.56 para Entreno + Nutrición. Calculado sin redondeos intermedios. Si hay promoción, anual, mezcla de planes o devolución, usar los cobros reales y el regalo real. No hay tasa de conversión verificada para estimar cuánto ingresará por este correo.

## Embudo y medición propuesta

Mueve **usuario de pago → invitación → registro atribuido → primer pago del invitado**; busca sumar usuarios de pago activos hacia la meta de 100 sin sacrificar margen. Desde 0064 un calificado es un invitado que pagó, salvo las calificaciones anteriores a esa migración.

Antes de activar, asignar por usuario un grupo estable con correo y otro sin correo; guardar asignación, envío, omisión y fecha del primer pago del remitente. Medir durante 30 días desde la asignación en ambos grupos; cerrar solo cohortes con ventana completa. Es una propuesta, aún no instrumentada.

Métrica principal: invitados únicos con primer pago confirmado por usuario asignado, comparando tratamiento y control. Vincular `referrals.referred` con `trial_charges.status = 'succeeded'` cuando corresponda, y conciliar pagos directos con proveedor y suscripción vigente; deduplicar por usuario y referencia. No usar Meta Subscribe, visitas ni estado `calificado` como evidencia de pago. Reportar cuentas y denominadores, bajas, devoluciones y usuarios de pago activos al cierre; no declarar éxito solo por clics.

Medir además registros atribuidos, calificados, recompensas no revocadas y meses otorgados por plan. Resultado económico por grupo = neto de cobros de invitados − neto dejado de cobrar por regalos − costo incremental de envío; comparar por usuario asignado para estimar el aporte incremental del correo. Controlar premios posteriores de esos grupos, incluido el aumento por anual, antes de concluir rentabilidad. Andrés debe aprobar la activación y cualquier gasto.
