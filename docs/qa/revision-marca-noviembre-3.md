# Revisión de marca para noviembre (tercera entrega)

Revisión del 31 de octubre de 2026 para #137. Referencia: manual de marca, landing y UX; tokens de `src/app/globals.css`. Las líneas indican la versión corregida de esta entrega. Todas las filas siguientes están corregidas; se separan incumplimientos de mejoras de claridad comercial.

## Hallazgos

| Archivo | Línea | Qué decía | Qué debería decir / corrección aplicada | Gravedad |
| --- | ---: | --- | --- | --- |
| `src/app/pago/checkout/page.tsx` | 54 | Resumen sin aclaración de IVA | «Precios en USD, IVA incluido.» antes de la condición de cancelación. Mejora de transparencia junto al total, sin alterar importes. | Media |
| `src/app/pago/checkout/page.tsx` | 98 | «Ver mi suscripción» | «Ver mi plan», coherente con el nombre de la sección de destino. | Baja |
| `src/components/nutrition-upsell.tsx` | 18 | Título sin `text-balance` | Se añade la clase de composición de títulos del manual, tanto en la versión completa como compacta. | Baja |
| `src/components/nutrition-upsell.tsx` | 22 | «US$14.99/mes o US$89.99/año» | Se conserva `usd2`, con «$14.99/mes o $89.99/año»; la línea siguiente ya especifica USD. Se unifica la notación con checkout y correos; se actualiza la comparación literal en `src/lib/nutrition-upsell-qa.test.tsx` (80). | Baja |
| `src/components/nutrition-upsell.tsx` | 23 | Periodo anual sin aclaración de pago completo | «El anual se paga completo.» Mejora de claridad, sin presentar el total anual como una mensualidad. | Media |
| `src/app/(app)/app/nutricion/page.tsx` | 52 | Texto secundario `text-ink/70` sobre banana | `text-ink`: usa la tinta sólida indicada para texto sobre banana. No se certifica aquí un fallo de contraste del estado anterior. | Baja |
| `src/app/(app)/app/nutricion/page.tsx` | 70 | «algo no tan fit», «suma XP y tu semana se equilibra» | «¿Comiste fuera? Regístralo igual para revisar tus calorías y proteína sin culpa.» Prioriza nutrición sobre gamificación y elimina una compensación semanal no garantizada. | Media |
| `docs/emails/recuperacion-prueba.md` | 7 | «Tu plan sigue guardado» | «Tu historial sigue guardado». Se actualizan el título (5), explicación (65 a 67), variante A (85) y comparación en `src/lib/recuperacion-prueba.test.ts` (21). No sugiere una suscripción reservada a quien no eligió plan. | Media |

## Cobertura y comprobaciones de contenido

Se revisaron checkout, `nutrition-upsell.tsx`, `nutrition-upsell-weekly.tsx`, la página de Comida y el documento completo de recuperación. Se contrastaron con `plans.ts`, los tokens globales, el layout de pago y las pruebas de contenido existentes.

- Checkout mantiene «Continuar sin tarjeta» visible, detalles de incluidos y excluidos tachados, renovación, cancelación y aviso médico. La carga o confirmación del proveedor conserva su funcionamiento.
- El upsell completo y el compacto comparten precios de `PLANS`, enlace a Mi plan y aviso «No sustituye la indicación de tu médico.» cuando mencionan GLP-1. No se toca la frecuencia semanal, el almacenamiento local, los permisos ni la selección por objetivo.
- Comida sigue mostrando alimentos latinos y acceso condicionado al plan. No se cambian metas, comidas, cálculos, pautas del programa ni registros.
- Paper #FFF8E3, banana #FFD60A e ink #1B1505 coinciden con CSS; Plus Jakarta Sans se hereda globalmente. No se detectó una paleta alternativa. Peel se usa como éxito y seguridad en checkout.
- Sin emojis, menciones comerciales de IA, testimonios, contadores, urgencia falsa ni promesas de pérdida de peso en las piezas estáticas revisadas. El CTA «Empieza 7 días gratis» corresponde a captación: estas piezas se dirigen a cuentas existentes y conservan acciones de pago, cambio de plan o recuperación, sin ofrecer otra prueba.
- Los correos mantienen precios e IVA, baja, audiencias excluidas, convivencia con transaccionales y aprobación de Andrés. Son propuestas: no se implementa ningún envío ni experimento.
- No se añaden mascotas, imágenes, fuentes, dependencias ni solicitudes externas. No hay secciones ilustradas nuevas que requieran poses. No cambian lógica, precios, cobro, rutas, eventos ni condiciones de promoción.

Revisión de código y contenido: sin comprobación en navegador ni medición de LCP móvil; no certifica LCP < 2.5 s ni contraste renderizado. Los textos dinámicos de programas y el formulario externo no quedan certificados por esta revisión. Pendiente actualizar capturas reales de checkout, upsell de Comida, upsell al cierre del entreno y tarjeta de recetas/reglas en Comida tras un despliegue autorizado; no se inventan capturas.

## Rentabilidad y medición

Pasos del embudo: primer pago desde checkout y recuperación de prueba vencida; plan más alto desde el upsell; anual como alternativa explícita. La claridad sobre historial y cobro busca facilitar una decisión informada, sin atribuir mejoras de conversión no medidas.

Medir usuarios únicos expuestos que completan un cobro confirmado, desglosados por plan y periodo. `checkout_view`, la vista `page_view` con `screen: nutrition_upsell` y los clics de cambio de plan son señales auxiliares, no pagos. Conciliar pagos directos con proveedor, `payment_events` y suscripción; para cobros de fin de prueba usar `trial_charges.status = 'succeeded'`. Contar usuarios con suscripción vigente para la meta de 100 usuarios de pago. Comparar cohortes equivalentes antes/después del despliegue autorizado, sin afirmar causalidad. En recuperación seguir la ventana de 7 días desde envío, deduplicación y grupo de control propuestos en el documento; esa atribución aún no está implementada.

Escenarios aritméticos con precios regulares de `src/lib/plans.ts`, IVA incluido; no son previsiones ni beneficio:

| Movimiento | Importe bruto en USD |
| --- | --- |
| Primer pago mensual | Entreno $9.99; Entreno + Nutrición $14.99 |
| Primer pago anual | Entreno $59.99; Entreno + Nutrición $89.99, cobrados completos |
| Plan más alto | Diferencia de $5.00 por mes o $30.00 por año; no implica ese cobro inmediato al cambiar |
| 100 pagos mensuales del mismo plan | $999.00 o $1,499.00 por periodo mensual |
| 100 pagos anuales del mismo plan | $5,999.00 o $8,999.00 por año, no ingreso mensual |

Medir dinero efectivamente cobrado, con promociones, ajustes, devoluciones y comisiones reales. El anual adelanta cobro a cambio de un menor total que 12 mensualidades. Sin costos verificados no se puede afirmar que estas cifras cubran el gasto. No se contrata gasto, publica, envía ni toca campañas; la activación corresponde a Andrés.

## Validación técnica

Verificaciones finales con código de salida 0:

- `npx tsc --noEmit -p .`
- `npx eslint src scripts --quiet`
- `npx vitest run --maxWorkers=2`: 198 archivos y 2,245 pruebas aprobados.
- `npm run build`: compilación, tipos y generación de páginas completadas.
- `git diff --check`: sin errores.

La primera ejecución concurrente agotó la memoria disponible y se repitió secuencialmente. La comparación literal adicional del precio del upsell se actualizó antes de la ejecución final completa. El build muestra avisos de caché de webpack y advertencias existentes de lint en `src/app/actions/meals.ts`, `src/app/admin/contenido/page.tsx` y `src/components/programas/program-week.tsx`; no impiden la compilación.
