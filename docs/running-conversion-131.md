# /running: embudo e ingresos (#131)

Texto para la descripción del PR: esta landing mueve visita a prueba de 7 días, prueba a primer pago, compra extra de Temporada Running y elección de plan anual. Se mide con `funnel_events` y cobros confirmados, no con clics como resultado comercial. Este documento detalla las fuentes y los límites de atribución.

## Medición

- Visita a prueba: contar `funnel_events.name = 'page_view'` con `path = '/running'`. Los eventos `cta_click` con `props.cta` igual a `running-hero`, `running-sticky` o `running-final` distinguen el acceso al registro. Confirmar después la cuenta creada y `onboarding_done` por usuario; un clic no demuestra que empezó la prueba. Reportar cuentas nuevas en prueba y cuentas que completan onboarding por separado.
- Prueba a primer pago: para la cohorte identificable, contar usuarios únicos con `trial_charges.status = 'succeeded'` y conciliar los cobros con `payment_events` procesados y la suscripción vigente. Dividir quienes hicieron su primer pago entre quienes iniciaron la prueba, con el mismo período de seguimiento. No sumar reintentos ni duplicar un cobro entre tablas; `purchase_success` es una señal de navegación, no evidencia suficiente de dinero cobrado.
- Compra extra: contar `challenge_purchases` con `challenge_slug = 'temporada-running-1'` y `status = 'pagado'`; sumar `amount_minor / 100`. Un canje de temporada incluida en el anual no es una venta adicional de US$14.99.
- Anual: contar primeros pagos confirmados de suscripciones con `billing = 'anual'`, separados por plan, y sumar los importes realmente cobrados. No sumar el anual otra vez al total de primeros pagos ni contar la temporada incluida como ingreso extra.

La atribución individual requiere un `user_id` enlazable. Las visitas y clics anónimos se guardan sin ese identificador y no permiten reconstruir de forma fiable toda la ruta hasta el pago. Informar esos volúmenes por separado y declarar la cobertura de atribución; no adjudicar todos los pagos posteriores a /running. `funnel_events.path` no conserva UTM y los UTM solo se guardan cuando la visita lleva `?ref=`. Este cambio no añade seguimiento ni modifica el píxel o los UTM.

## Dinero que puede mover

Precios de lista en USD tomados de `PLANS` en `src/lib/plans.ts`. El `RUN` de la landing es la temporada Running de `SEASONS_T1`, en `src/lib/seasons.ts`; `RUN.priceMinor / 100 = 14.99`.

| Resultado confirmado | Importe de lista por compra |
| --- | ---: |
| Entreno mensual | US$9.99 |
| Entreno + Nutrición mensual | US$14.99 |
| Entreno anual, incluye 1 temporada | US$59.99 |
| Entreno + Nutrición anual, incluye 1 temporada | US$89.99 |
| Temporada Running comprada aparte | US$14.99 |

Para cantidades observadas de compras mutuamente excluyentes de suscripción, el valor de lista es `9.99 × mensuales Entreno + 14.99 × mensuales completos + 59.99 × anuales Entreno + 89.99 × anuales completos`, más `14.99 × compras extra pagadas de Running`. Cada compra adicional mueve el importe de su fila; no se presupone cuántas ocurrirán ni una tasa de conversión. La prueba gratuita genera US$0 hasta el cobro.

Estos valores son potencial bruto de lista, no una previsión de ingresos ni beneficio. Para ingresos reales usar los montos confirmados en los registros de pago, respetando promociones aplicadas, reembolsos y moneda. No sumar doce mensualidades a un anual ni valorar la temporada incluida como dinero cobrado. La rentabilidad requiere contrastar ingresos reales con costos reales; este cambio documental no autoriza gasto, campañas ni publicación.
