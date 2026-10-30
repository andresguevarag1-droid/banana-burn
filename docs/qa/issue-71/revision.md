# Issue #71: oferta de Temporada 1

## Descripción propuesta del PR

La página /temporadas hacía visibles los precios, pero no enlazaba a la compra por deporte. Ahora cada tarjeta lleva al detalle autenticado que permite comprar o canjear la temporada incluida en el anual. El hero destaca el cierre real y el calendario compartido, y la oferta explica que la temporada se paga aparte del plan o prueba. Fechas y precios salen de SEASONS_T1; no se duplican importes en la landing.

El CTA principal es «Empieza 7 días gratis», acompañado de «Sin tarjeta» y «Continuar sin tarjeta». Los enlaces de compra son secundarios. Después del cierre en Costa Rica se retiran los enlaces de compra, también durante la prueba de regresión. La caché ISR existente se mantiene en una hora; el servidor de compra siempre valida el cierre.

Embudo: visita → registro → primer pago, con foco en compras de Temporada 1 antes del cierre. Medir clics `cta_click` con `props.cta` = `temporadas-comprar-running`, `temporadas-comprar-raquetas` o `temporadas-comprar-cross`, y compras confirmadas en `challenge_purchases` con `status = 'pagado'` y `challenge_slug` de Temporada 1. Comparar usuarios únicos que compran y proporción de clics que llegan a compra antes/después. Los clics no prueban atribución individual; un canje anual no es un pago nuevo. La meta de 100 usuarios de pago se sigue midiendo con cobros y suscripciones del documento de metas, sin contar clics como clientes.

Sirve como destino de K16 y R12. No publica piezas ni cambia campañas.

## Validación visual y rendimiento pendiente

No hay navegador instalado. Se intentó `npm exec --yes --package=@playwright/test -- playwright install chromium`; el CDN devolvió HTTP 403 por la restricción de salida del entorno. No se generaron capturas simuladas ni se declara un LCP medido.

Antes de aprobar, obtener capturas reales de página completa a 390 px y 1280 px y revisar ausencia de scroll horizontal, lectura de fechas/precios y navegación desde cada deporte. Revisar también las imágenes deportivas remotas: SafeImage conserva su respaldo local existente si el CDN falla.

Medir la versión base y la rama con build de producción, mismo dispositivo móvil o emulación y red, con al menos tres ejecuciones y mediana de LCP. Objetivo: menos de 2.5 s y sin regresión frente a la base. Este cambio no añade imágenes, fuentes, dependencias ni componentes de cliente; conserva los espacios reservados de las imágenes existentes. Esto limita cambios de carga, pero no sustituye la medición.

Nada se publica, envía ni se fusiona sin aprobación de Andrés.

## Comprobaciones ejecutadas

- `npx vitest run`: 143 archivos y 1,755 pruebas pasan, incluidas dos pruebas de la oferta y del cierre.
- `npx tsc --noEmit -p .`: pasa.
- `npx eslint src scripts --quiet`: pasa.
- `npm run build`: pasa; no se realizó despliegue.
