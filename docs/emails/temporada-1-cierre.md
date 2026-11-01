# Temporada 1: elige antes del cierre

Copy aprobado para implementar. Las plantillas están en `src/lib/email/templates.ts` (`SEASON_CLOSE`, `temporadaCierre`) y el envío en `runReminders` (`src/lib/notify-run.ts`, reglas en `src/lib/temporada-cierre.ts`). Activar el cron con estas piezas en producción sigue necesitando la aprobación de Andrés; no publica ni genera gasto. Mueve **compra extra** de temporada y **mensual → anual**; para pruebas, el anual también mueve **primer pago**. Contribuye a la meta de 100 usuarios de pago, sin contar un canje como un pagador nuevo.

## Correo del 16 de noviembre de 2026

**Asunto:** Elige tu Temporada 1

**Vista previa:** Running, Raquetas o Cross Training: puedes inscribirte hasta el 22 de noviembre.

**Cuerpo:**

Elige el deporte que quieres trabajar: Running ($14.99), Raquetas ($16.99) o Cross Training ($18.99), con un pago único por temporada.

La Temporada 1 va del 9 de noviembre de 2026 al 3 de enero de 2027. Todavía puedes sumarte hasta el 22 de noviembre; entras en la semana del calendario, sin reiniciar las ocho semanas.

¿Pagas mensual y quieres seguir todo el año? La mejor opción es el anual: Entreno por $59.99 o Entreno + Nutrición por $89.99. Se paga completo e incluye una temporada deportiva por año pagado. Si ya tienes un anual, revisa si te queda disponible ese canje.

Precios en USD.

**Botón:** Elegir mi temporada

**Destino:** `/app/temporadas` (https://bananaburn.app/app/temporadas).

## Correo del 21 de noviembre de 2026

**Asunto:** La inscripción a Temporada 1 cierra mañana, 22 de noviembre

**Vista previa:** El 22 de noviembre es el último día para comprar o canjear tu temporada.

**Cuerpo:**

Mañana, 22 de noviembre de 2026, cierra la inscripción a Temporada 1. Elige Running por $14.99, Raquetas por $16.99 o Cross Training por $18.99: un pago único por temporada.

El calendario comenzó el 9 de noviembre y termina el 3 de enero. Te sumas a la semana actual; no son ocho semanas nuevas desde tu inscripción.

Si pagas mensual y quieres seguir todo el año, la mejor opción es el anual: Entreno por $59.99 o Entreno + Nutrición por $89.99, pagados completos. Cada año pagado incluye una temporada deportiva. Si tienes un canje anual disponible, úsalo antes del cierre.

Precios en USD.

**Botón:** Inscribirme en Temporada 1

**Destino:** `/app/temporadas` (https://bananaburn.app/app/temporadas).

## Audiencia y operación propuesta

- Revalidar antes de cada envío: acceso por plan o prueba activa, ninguna inscripción a cualquiera de las tres temporadas número 1 en `challenge_entitlements`, permiso para correo comercial y ausencia de baja. Excluir a quien se inscribió después del primer correo; máximo una pieza por persona y fecha.
- Usar las fechas de Costa Rica, como el calendario del producto. El 22 de noviembre de 2026 está incluido; desde el 23 no se compra ni canjea. Enviar el segundo solo el 21 local, sin recuperar envíos atrasados: «mañana» depende de esa fecha.
- La prueba permite comprar una temporada, pero no da el canje anual. Solo un anual pagado vigente con canje disponible lo permite; uno por periodo anual. No prometer que una compra extiende el acceso de la prueba.
- Estos dos avisos comerciales no reemplazan bienvenida, pruebaIniciada ni recordatorioCobro de `src/lib/email/templates.ts`. Implementación: salen a la hora del recordatorio de cada persona, solo con novedades y promociones activadas (`notification_prefs.marketing`, apagado por defecto) y con la baja de novedades. Ceden ante el aviso o el correo del cobro, la secuencia de la prueba, la recuperación, el primer pago o cualquier correo que ya salió ese día local: entonces se omiten y quedan anotadas en `notification_log` con channels vacío. Si salen, ese día reemplazan los correos de rutina (recordatorio, racha, reactivación y resumen semanal, porque el 16 de noviembre es lunes); push y campanita siguen igual. Una pieza por cuenta, con su llave de idempotencia, sin duplicarla por tener más de un estado de acceso. El staff no las recibe.
- El botón abre Temporadas; no cobra ni cambia el plan. La persona revisa el anual en Mi plan (`/app/suscripcion`) y vuelve a Temporadas para canjear. No asumir prorrateo, crédito por mensualidades anteriores ni descuentos adicionales.
- Maquetación futura: paper #FFF8E3, banana #FFD60A, ink #1B1505, Plus Jakarta Sans; botón principal ink y versión de texto plano. Ambos cuerpos tienen menos de 120 palabras.

## Medición y dinero que puede mover

**Métrica principal: inscripciones confirmadas atribuidas / correos enviados**, por envío y total. El denominador cuenta cada envío aceptado por el proveedor, incluso si una persona recibió ambos; mostrar rebotes aparte. Numerador: personas únicas con una nueva inscripción número 1 en `challenge_entitlements`, separando `source = compra` y `source = anual`. No contar clics, intentos de pago ni solo el cuestionario como inscripción.

Registro de envíos: `notification_log` guarda usuario, pieza (`temporada1_cierre_16` o `temporada1_cierre_21`) y día local; channels vacío marca una pieza omitida. La variante de asunto B todavía no está instrumentada. Asociar la inscripción posterior al último correo enviado, hasta el cierre del 22 de noviembre en Costa Rica; una inscripción solo se atribuye una vez. Es atribución temporal, no prueba de causalidad. Reportar también destinatarios únicos y su tasa de inscripción, sin confundirla con inscripciones por correo enviado.

**Cobros:** compras confirmadas en `challenge_purchases` con `status = pagado`, conciliadas con su inscripción. Canjes anuales existentes aportan $0 de cobro extra. Para nuevos anuales, confirmar el pago y la suscripción vigente con la fuente de pagos correspondiente; no contar un cambio de selección ni un cobro mensual automático como venta anual del correo. Separar pagos durante la prueba de los de usuarios que ya pagaban. Restar devoluciones al reportar ingreso cobrado.

| Producto | Precio regular USD | Paso del embudo |
| --- | --- | --- |
| Running | $14.99 | Compra extra |
| Raquetas | $16.99 | Compra extra |
| Cross Training | $18.99 | Compra extra |
| Entreno mensual | $9.99/mes | Referencia del plan actual |
| Entreno + Nutrición mensual | $14.99/mes | Referencia del plan actual |
| Entreno anual | $59.99/año | Anual o primer pago |
| Entreno + Nutrición anual | $89.99/año | Anual o primer pago |

Ingreso bruto potencial = $14.99 × compras Running + $16.99 × compras Raquetas + $18.99 × compras Cross Training + $59.99 × nuevos pagos Entreno anual + $89.99 × nuevos pagos Entreno + Nutrición anual. El canje incluido no suma otra compra de temporada. Usar montos efectivamente cobrados para el informe real, sin sumar otra vez una renovación ya prevista.

Referencia aritmética, no pronóstico: 10 compras de temporada mueven $149.90 / $169.90 / $189.90 según el deporte; 10 pagos anuales mueven $599.90 / $899.90 según el plan. El cobro anual cubre un año, no es ingreso mensual ni margen. No hay volumen, conversión ni costos verificados para prometer rentabilidad o cobertura del gasto. Comparar contra un grupo sin estos avisos, si Andrés aprueba la prueba, para estimar ingreso adicional.

## Alternativas de asunto

Dos variantes por fecha, sin envíos extra. A son los asuntos anteriores. B del 16: «Tu deporte, tu Temporada 1». B del 21: «Hasta mañana, 22 de noviembre: elige tu temporada». Apostaría por A: nombra el producto y comunica el cierre de forma explícita. Mantener cuerpo, vista previa y botón; asignación estable por usuario. Elegir por inscripciones por correo enviado y cobros, con ventanas completas, sin decidir por aperturas.

## Fuentes y comprobación antes de aprobar

`src/lib/plans.ts`: `PLANS` y `ANNUAL_SEASON_NOTE`. `src/lib/seasons.ts`: `SEASONS_T1`, `SEASON_PRICE_MINOR`, `canEnroll`, `canRedeemAnnual`; fechas oficiales: del 9 de noviembre de 2026 al 3 de enero de 2027, inscripción hasta el 22 de noviembre de 2026 incluido. `src/lib/season-purchase.ts`: pagos, canjes y acceso. Revalidar además fechas y precios en la tabla operativa `seasons` antes de enviar, porque el servidor compra con esos datos. No se consultaron datos de producción ni se autorizó ningún envío.
