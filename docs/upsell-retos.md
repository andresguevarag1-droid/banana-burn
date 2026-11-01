# Compra de retos dentro de la app

Mueve el paso de exploración de retos a compra adicional, conservando el inicio de pago existente y la confirmación del servidor. No sustituye la suscripción ni cuenta por sí sola como usuario con un plan de pago activo.

## Oferta y acceso

Entreno incluye rutina, progreso y retos gratis. Entreno + Nutrición añade comida y ajustes nutricionales. Los retos Premium y programas se compran aparte en ambos planes; requieren acceso activo para usarlos. Comprar un programa no desbloquea nutrición. Los hábitos acompañan la rutina y los programas cambian las sesiones. Precios en USD con IVA incluido, pago único sin renovación.

## Neto por compra

Fórmula solicitada: cobro / 1.13 − cobro × comisión − 0.35. Comisión ONVO: 3.9 %; Tilopay: 4.25 %. La compra actual de retos usa ONVO; Tilopay es solo comparación. No incluye otros costos, devoluciones ni diferencias cambiarias. Cada columna aplica el descuento al precio en centavos antes de calcular el neto, como priceMinor. Importes redondeados al final.

Catálogo de referencia: src/lib/challenge-seed.ts y src/lib/program-seed.ts. El catálogo publicado en la base puede cambiar; para ingresos reales manda challenge_purchases.amount_minor. No se incluyen temporadas porque tienen otra tienda.

| Reto o programa | Precio | ONVO 0 % | ONVO 10 % | ONVO 15 % | ONVO 20 % | Tilopay 0 % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 21 días de abdomen (abdomen-21) | $4.99 | $3.87 | $3.45 | $3.24 | $3.03 | $3.85 |
| Glúteos de acero (gluteos-30) | $6.99 | $5.56 | $4.97 | $4.67 | $4.38 | $5.54 |
| Pierde 3 kg en 6 semanas (pierde-3kg-6-semanas) | $9.99 | $8.10 | $7.26 | $6.83 | $6.41 | $8.07 |
| Dominadas desde cero (dominadas-desde-cero) | $7.99 | $6.41 | $5.73 | $5.39 | $5.06 | $6.38 |
| Sprint de verano 28 días (sprint-verano-28) | $5.99 | $4.72 | $4.21 | $3.96 | $3.70 | $4.70 |
| Reconstrucción corporal 8 semanas (reconstruccion-8-semanas) | $9.99 | $8.10 | $7.26 | $6.83 | $6.41 | $8.07 |
| Abdomen marcado (abdomen-marcado) | $7.99 | $6.41 | $5.73 | $5.39 | $5.06 | $6.38 |
| Brazos definidos (brazos-definidos) | $6.99 | $5.56 | $4.97 | $4.67 | $4.38 | $5.54 |
| Banana Girl (banana-girl) | $7.99 | $6.41 | $5.73 | $5.39 | $5.06 | $6.38 |
| Pilates en casa 30 días (pilates-casa-30) | $6.99 | $5.56 | $4.97 | $4.67 | $4.38 | $5.54 |

Descuentos vigentes de perksAt en src/lib/gamify.ts: 0 %, 10 %, 15 % y 20 %. No son descuentos acumulables. Para Tilopay con descuento se aplica la misma fórmula sobre el cobro descontado.

## Relación con la meta de 100 usuarios de pago

Según src/lib/plans.ts, Entreno cuesta $9.99 mensual o $59.99 anual; Entreno + Nutrición, $14.99 o $89.99. Sin descuentos, el neto ONVO por cobro es $8.10, $50.40, $12.33 y $75.78 respectivamente. Cien mensualidades completas aportarían $810.11 o $1,233.09 netos por ciclo, antes de otros costos. Son escenarios aritméticos, no una previsión de ventas. Cada compra de reto añade el neto de su fila; 100 compras adicionales multiplican ese neto sin redondear por 100. No se puede afirmar rentabilidad sin conocer el gasto real.

## Medición

Medir semanalmente compras pagadas y compradores únicos por challenge_slug en challenge_purchases, filtrando status = 'pagado', con paid_at y amount_minor. Calcular el neto sobre cada cobro real, y comparar con la semana anterior y el gasto real autorizado. Los intentos pendientes no son ingreso; los accesos de cortesía tampoco. Deduplicar por id de compra.

La conversión pendiente a pagado mide la finalización de pago; esta tabla no registra visitas al detalle ni clics. Para medir detalle a compra hace falta instrumentar esas exposiciones en una tarea posterior. Esta entrega no añade eventos ni inventa una tasa de conversión. La meta principal sigue siendo 100 suscripciones vigentes con cobro confirmado; reportar las compras adicionales por separado.

## Revisión visual

Revisar lista, detalle gratis, detalle de pago con y sin descuento, comprado, activo, pausa, límite de retos y compra no disponible. El botón móvil queda fijo encima de la navegación; el contenido reserva espacio al final. Revisar en 375, 390 y 1280 px, incluyendo carga, error de red y movimiento reducido. La demo no procesa pagos reales.

Capturas de landing a actualizar: Programas y retos, detalle Premium y detalle de programa. Ninguna pieza se publica con esta entrega.

No se pudieron generar capturas con Playwright: la descarga de Chromium desde cdn.playwright.dev fue rechazada con HTTP 403 por la red del entorno. La revisión visual de los estados y tamaños indicados sigue pendiente; no se afirma validación visual.

Para ejecutar la suite en este entorno de memoria limitada se usa `npx vitest run --maxWorkers=2`; el intento con los procesos predeterminados agotó los recursos. Ejecutar el build por separado.
