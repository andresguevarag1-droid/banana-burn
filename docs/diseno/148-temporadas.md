# Inscripción a temporadas dentro de la app

El catálogo muestra los tres precios y permite iniciar la compra o el canje sin abrir el detalle. Reutiliza SeasonBuy y los servicios actuales, incluido el flujo /pago/temporada. El detalle conserva sus estados de compra, cuestionario y activación; la ilustración queda en escritorio para dar prioridad al contenido y al botón en móvil.

## Embudo y dinero

Mueve compra extra y cambio a anual. Medir semanalmente compras de temporadas en challenge_purchases con status = 'pagado', separadas por challenge_slug y sumando amount_minor / 100. Separar los canjes gratis de las compras; un canje no es ingreso nuevo. Comparar con el periodo anterior sin atribuir automáticamente toda variación a esta pantalla. No se agregó seguimiento de clics, por lo que no hay una tasa de conversión por exposición atribuible a este cambio.

Cada compra extra mueve US$14.99 en Running, US$16.99 en Raquetas o US$18.99 en Cross Training, según el catálogo de temporadas. Según src/lib/plans.ts, cada contratación anual cobra US$59.99 en Entreno o US$89.99 en Entreno + Nutrición e incluye una temporada. Los mensuales cuestan US$9.99 y US$14.99 respectivamente. Son importes brutos por operación, no una previsión de ventas ni ingresos incrementales garantizados. El anual reemplaza el plan actual sin prorrateo; el enlace lleva a revisar ese cambio antes de pagar.

## Revisión visual pendiente

Playwright pudo instalarse fuera del proyecto, pero Chromium no se pudo descargar: el servidor de descarga respondió 403 por restricciones de red del sandbox. No se generaron capturas ni se comprobó visualmente que el botón quede dentro del primer pantallazo.

Revisar a 375 y 390 px de ancho con altura de 667 y 844 px, y a 1280 × 800: catálogo mensual, anual con canje, anual sin canje disponible, temporada comprada, inscripciones cerradas, catálogo vacío y enlace vencido. Revisar también detalle, carga, error de compra y éxito con los estados existentes. Comprobar que avisos globales de prueba, tarjeta o programa activo no empujen la inscripción fuera de pantalla.

Capturas para actualizar en la landing: catálogo de Temporadas con precios y detalle de Temporada Running con inscripción, ambas a 390 px. Agregar variantes de canje anual solo cuando existan capturas reales revisadas. No se modificó ni publicó la landing.

## Validación de código

Pasaron `npx tsc --noEmit -p .`, `npx eslint src scripts --quiet`, `npx vitest run` (199 archivos, 2,249 pruebas) y `npx next build`. Las cuatro pruebas nuevas verifican precios, fechas, comparación anual, disponibilidad del canje, compras existentes, cierre, recuperación y catálogo vacío. Se conservan los estados globales de carga y error y los estados de compra de SeasonBuy.
