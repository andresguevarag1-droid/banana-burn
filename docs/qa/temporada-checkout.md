# Checkout de temporadas, issue #166

## Cambios y abandono que buscan reducir

- Resumen amarillo compacto: deporte, precio de la compra pendiente (no recalculado), 8 semanas, fechas del catálogo y adaptación del programa. Reduce dudas sobre qué se compra y cuánto se cobra. Temporada 1: del 9 de noviembre de 2026 al 3 de enero de 2027.
- Pago único, IVA incluido y sin renovación automática junto al precio: reduce temor a cargos recurrentes.
- Menos espacio vertical antes del formulario, título pequeño, regreso al final y tarjetas con 12 px de relleno móvil: acerca la acción de pago al primer vistazo.
- Se retira el enlace «Continuar sin tarjeta» debajo del botón de pago: la temporada requiere un cobro con tarjeta y ese texto podía confundirse con la prueba gratis. Reduce expectativas incorrectas y una salida inmediata antes de pagar. Se conserva «Volver a la temporada» al final.
- Explicación de confirmación y cuestionario: reduce incertidumbre sobre la entrega y pagos repetidos mientras confirma el proveedor.
- Medio disponible en esta ruta: tarjeta de crédito o débito por ONVO Pay en USD. No se promete Tilopay, transferencias ni otros medios que esta pantalla no ofrece.
- Opción anual para suscripción mensual activa con plan reconocido, sin otra anual activa: precios de PLANS ($59.99 Entreno, $89.99 Entreno + Nutrición), ahorro ante 12 mensualidades y una temporada incluida por año pagado. Es el total anual, sin inventar descuentos por saldo mensual. Enlace a Mi plan para revisar antes de comprar por separado. Reduce compras duplicadas y facilita mayor ingreso anticipado.
- Detalle de lo incluido después del formulario: explica el valor sin alargar el recorrido previo al cobro. Las fechas siguen el catálogo, sin crear urgencia artificial.

## Alcance y revisión móvil

No cambia OnvoPayForm, sus propiedades, importes, identificadores, proveedores, confirmación ni lógica de cobro. No añade recursos gráficos ni dependencias. Mantiene tokens de marca y la tipografía heredada.

Revisar con una compra pendiente real y el SDK de ONVO cargado, a 375 × 667 y 375 × 812, zoom 100 %: el botón del proveedor debe verse sin desplazar la pantalla. Comprobar los tres deportes y títulos largos, tarjeta rechazada, carga lenta y confirmación demorada. El ancho por sí solo no define la altura visible. No se fuerza altura ni se recorta el formulario externo para ocultar campos. La posición final del botón depende del contenido que inyecta ONVO; esta verificación requiere navegador y credenciales de pruebas y queda pendiente en este entorno. No se afirma una validación visual ni un LCP medido.

Comprobar también mensual Entreno y Completo (precios respectivos), anual activo y ausencia de suscripción (sin oferta anual), y que los enlaces Volver a la temporada y Mi plan lleguen a sus destinos. No se presenta una compra única como prueba gratis.

## Embudo y dinero

Paso que mueve: compra de temporada pendiente → cobro confirmado; paso secundario: mensual → revisión del anual. Medir por cohortes semanales: compras únicas que pasan de pendiente a pagado en challenge_purchases, separando challenge_slug y proveedor. La proporción de pagadas entre compras creadas es una aproximación: incluye personas que no abrieron esta pantalla. No equivale a conversión por visita; no se añaden eventos nuevos. Para anual, contar suscripciones anuales activadas y cobros efectivamente confirmados, sin atribuirlos automáticamente a este enlace. Comparar cohortes equivalentes antes y después; no hay aumento garantizado.

Neto estimado por cobro = importe / 1.13 − importe × comisión porcentual − $0.35, antes de otros gastos, devoluciones o cancelaciones. Temporadas según SEASON_PRICE_MINOR en src/lib/seasons.ts; anuales según src/lib/plans.ts. Tilopay se incluye solo como comparación económica, no como medio de esta ruta.

| Cobro USD | Neto ONVO (3.9 %) | Neto Tilopay (4.25 %) |
| --- | --- | --- |
| $14.99 | $12.33 | $12.28 |
| $16.99 | $14.02 | $13.96 |
| $18.99 | $15.71 | $15.65 |
| $59.99 | $50.40 | $50.19 |
| $89.99 | $75.78 | $75.46 |

Cada pago adicional recuperado aporta el neto correspondiente. Diez compras adicionales de Running, por ejemplo, aportarían aproximadamente $123.31 por ONVO (calculado antes de redondear), sin suponer que ocurrirán. Un anual no es todo ingreso incremental frente al mensual: adelanta ingresos y exige descontar las mensualidades que sustituye y la temporada incluida al evaluar rentabilidad. No se publica, envía ni gasta dinero con este cambio.

## Resultado de checks

- `npx tsc --noEmit -p .`: correcto.
- `npx eslint src scripts --quiet`: correcto.
- `npx next build`: correcto; advertencias previas en meals.ts, admin/contenido/page.tsx y program-week.tsx.
- `npx vitest run`: 210 archivos y 2,366 pruebas correctas al verificar la corrección de revisión.
- `git diff --check`: correcto. Revisión visual del formulario externo pendiente según el apartado móvil.
