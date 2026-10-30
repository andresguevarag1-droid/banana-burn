# Checkout: claridad antes de pagar (#112)

## Cambios y abandono que buscan reducir

| Cambio en `src/app/pago/checkout/page.tsx` | Duda o abandono que busca reducir |
| --- | --- |
| Resumen compacto con nombre, precio USD y «Hoy y cada mes/año». | Confundir un cobro anual con una cuota mensual o desconocer cuánto se cobra hoy. |
| Anual: ahorro contra 12 mensualidades y `ANNUAL_SEASON_NOTE`. | No percibir el valor del pago anual ni la temporada incluida. |
| Mensual: enlace «Cambiar a anual» con precio y ahorro; conserva `plan` y envía `pago=anual` a Mi plan. | Salir a buscar precios y perder el plan elegido. El enlace permite revisar la selección; no cambia ni cobra la suscripción desde el checkout. |
| Menos espacio antes de ONVO, título breve y prestaciones en un desplegable después del formulario. | Abandonar por no encontrar dónde pagar en móvil. El formulario y su botón siguen siendo los originales de ONVO. |
| «Cancela cuando quieras desde Mi plan» antes del formulario; condiciones de acceso hasta fin del periodo debajo. | Miedo a permanencia o a tener que llamar para cancelar. |
| Crédito o débito, ONVO y cobro en USD. | Dudas sobre medios disponibles y moneda. No se anuncian marcas, billeteras ni transferencias sin respaldo de esta integración. |
| Explicación de confirmación, activación por ONVO, entreno y progreso guardado; aviso de no volver a pagar si tarda. | Incertidumbre sobre lo que se obtiene o repetir el pago mientras llega el webhook. |
| No incluidos tachados y advertencia médica junto a Banana Shield. | Expectativas incorrectas sobre prestaciones o uso médico. |
| «Continuar sin tarjeta» mantiene la salida existente a pago cancelado. | Sentir obligación de pagar. La salida no inicia ni extiende una prueba. |

Se conservan montos, llaves, controles de sesión/propiedad/estado, fecha de renovación y props de `OnvoPayForm`. No cambia `onvo-pay-form.tsx`, ni el SDK, ni la lógica de cobro. No se añaden imágenes, fuentes, dependencias o scripts.

Este es un checkout de cobro inmediato ya iniciado, por eso la acción principal es el botón real de ONVO. Ofrecer aquí «Empieza 7 días gratis» contradiría el cobro mostrado.

## Embudo y dinero

Mueve **pago** (checkout abierto a pago confirmado) y **anual** (mensual elegido a anual pagado). No se atribuye una mejora de conversión sin datos.

Valores actuales de `src/lib/plans.ts`; la interfaz usa `PLANS`, `annualSaving` y `ANNUAL_SEASON_NOTE`, con `money` (`usd2`) para formato:

| Plan | Mensual | Anual | Ahorro frente a 12 mensualidades | Mayor cobro inicial al elegir anual |
| --- | ---: | ---: | ---: | ---: |
| Entreno | $9.99 | $59.99 | $59.89 | $50.00 |
| Entreno + Nutrición | $14.99 | $89.99 | $89.89 | $75.00 |

Cada checkout adicional que termina en pago mueve el precio del plan/ciclo elegido. Diez pagos adicionales representarían $99.90 o $149.90 si son mensuales, o $599.90 o $899.90 si son anuales, antes de comisiones, impuestos y reembolsos. Son escenarios aritméticos, no previsiones. El anual adelanta caja y descuenta frente a doce mensualidades; no equivale a incrementar ingresos anuales. Sin gasto y margen observados no se puede afirmar rentabilidad.

Medir por plan y ciclo, en ventanas comparables antes y después:

- `checkout_view` conserva `FunnelTracker`, que mapea a **InitiateCheckout** con precio y moneda. Usuarios únicos que llegan al checkout son el denominador.
- Pagos confirmados del mismo grupo son el numerador. Usar `payment_events` procesados y suscripciones activas; deduplicar por identificador de pago, como hace Mi plan. Para cobros de prueba, `trial_charges.status = 'succeeded'`. No sumar dos veces el mismo cobro.
- `purchase_success` en `/pago/exito` es una señal de navegación, no reemplaza la confirmación del proveedor.
- Proporción de pagos anuales e importe confirmado por checkout, además de usuarios de pago activos hacia la meta de 100.
- `data-cta="checkout-cambiar-anual"` permite observar interés por anual mediante el seguimiento existente de clics; un clic no cuenta como venta.
- **AddPaymentInfo** sigue viniendo de `card_saved`, en su flujo existente. Esta página no lo emitía y no añade un evento que fingiera tarjeta guardada.

No se publica, envía ni gasta nada con este cambio.

## QA

Pruebas de render del servidor cubren los cuatro casos (dos planes por dos ciclos): precio y periodicidad, ahorro, temporada anual, enlace con plan conservado solo en mensual, tracker, salida sin tarjeta, exclusiones tachadas y orden del formulario antes de detalles.

### Revisión visual pendiente con ONVO real

No hay navegador disponible en este entorno ni sesión de pago real. **No está verificado el criterio del botón visible sin scroll a 375 px**, ni el LCP. La prueba de render sustituye ONVO y no acredita su altura real.

Antes de aprobar, capturar checkout mensual/anual de ambos planes en 375 × 667 y 375 × 812, y revisar también 1280 px. Con SDK cargado, comprobar que el botón real de pagar está dentro del primer viewport, que no hay scroll horizontal y que el teclado/foco permiten completar el formulario. Repetir con error de tarjeta y fallo de carga; no enviar un cobro real para la revisión. Si ONVO excede el espacio disponible, hace falta ajustar la presentación con evidencia de su altura real, sin ocultar condiciones ni duplicar su botón.

Comprobar además: enlace anual abre Mi plan con selección correcta, cancelar conserva acceso hasta fin del periodo, confirmación pendiente no invita a repetir pago, y eventos InitiateCheckout/AddPaymentInfo siguen sus flujos correspondientes. Capturas a actualizar: checkout de ambos planes, mensual y anual (375 px; referencia adicional a 390 px). No se añade a la landing una captura simulada de un formulario de pago.

### Resultado de checks en esta rama

- `npx tsc --noEmit -p .`: pasa.
- `npx eslint src scripts --quiet`: pasa; chequeo adicional del directorio checkout tras el último ajuste también pasa.
- `npx vitest run --maxWorkers=2`: 177 archivos y 2,021 tests pasan, incluidos los cuatro casos nuevos del checkout y los tests existentes del píxel.
- `npx next build`: pasa; muestra advertencias de lint preexistentes en archivos ajenos al cambio.
- `git diff --check`: pasa.

La primera suite tuvo un timeout de 5 s en `num.test.ts` al correr junto a TypeScript/build bajo presión de memoria. Se detuvieron los procesos concurrentes y se repitió toda la suite con dos workers, sin cambiar pruebas ni límites. El build final corrió después de la suite.
