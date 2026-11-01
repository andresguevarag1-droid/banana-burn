# Revisión de marca para noviembre (cuarta entrega)

Revisión del 1 de noviembre de 2026 para #154. Referencia: manual de marca, landing y UX; tokens de `src/app/globals.css`. Las líneas indican la versión corregida. Se distinguen correcciones aplicadas de pendientes visuales.

## Hallazgos

| Archivo | Línea | Qué decía | Qué debería decir / corrección aplicada | Gravedad |
| --- | ---: | --- | --- | --- |
| `src/app/(marketing)/running/page.tsx` | 39, 62, 105 | «Incluida en el plan anual», «Los planes anuales la incluyen gratis» | «El anual incluye 1 temporada deportiva por año pagado». Evita sugerir que Running se regala además de otra temporada ya elegida; el detalle de precios conserva la condición de no haber usado el beneficio. FAQ visible y JSON-LD comparten la corrección. | Media |
| `src/app/(marketing)/running/page.tsx` | 112 | «Precios en USD» | «Precios en USD, IVA incluido. El anual se paga completo». Mejora de transparencia sin modificar importes. | Media |
| `src/app/(marketing)/running/page.tsx` | 102 | `text-white/85` | `text-paper`: texto sólido de la paleta sobre ink. No se afirma un fallo de contraste previo sin medición renderizada. | Baja |
| `src/app/(marketing)/running/page.tsx` | 111, 136 | Títulos sin `text-balance` | Se añade la clase de composición del manual. | Baja |
| `src/app/(marketing)/layout.tsx` | 42 | «Empezar gratis» con los días solo para lector de pantalla | «Empieza 7 días gratis», coherente con los CTA de Running. Corrección en el encabezado compartido, visible también en las otras páginas públicas. Bajo 400 px reserva 112 px y permite dos líneas para el CTA. | Media |
| `src/components/hoy/annual-upsell.tsx` | 33, 34 | Título sin composición equilibrada; importe sin moneda e IVA explícitos | `text-balance` y «en USD, IVA incluido, en un solo pago por 12 meses». Conserva comparación frente a mensualidades y reemplazo sin prorrateo. | Media |
| `docs/upsell-anual.md` | 24 | Sin especificación del texto de marca visible | Se documentan moneda, IVA, pago completo, comparación regular y acciones para una cuenta existente. | Baja |
| `docs/emails/primer-pago.md` | 86 | «Precios regulares en USD» | «Precios regulares en USD, IVA incluido». Los cuerpos y asuntos cumplen el manual y se conservan. | Baja |
| `src/app/(marketing)/running/page.tsx` | 64, 97, 134 | Hero y cierre sin poses independientes; solo la sección de compatibilidad usa `coach.hello` | Pendiente visual: incorporar poses oficiales distintas en las secciones que correspondan y comprobarlas junto a las mascotas dentro de capturas reales. No se inventan ni duplican personajes para cubrir la falta de recursos. | Baja |

## Cobertura y comprobaciones de contenido

Se revisó el único archivo de `/running`, el aviso anual y ambos documentos completos. Se contrastaron con precios de `plans.ts`, fechas y precio de `seasons.ts`, navegación actual, `Phone`, layout público y pruebas de contenido existentes.

- Paper #FFF8E3, banana #FFD60A e ink #1B1505 coinciden con los tokens; Plus Jakarta Sans se hereda globalmente. Se conservan banana-soft, body y el error semántico bad del aviso.
- Running conserva «Empieza 7 días gratis» y «Continuar sin tarjeta» en hero, cierre y barra fija. La prueba no incluye comprar la temporada. El aviso para suscriptores y los correos posteriores al pago mantienen acciones específicas; no ofrecen una segunda prueba.
- Las capturas existentes son reales y están rotuladas como ejemplo de 21K con meta de 1:55:00. `Phone` reserva proporción 390/844; las imágenes son WebP, el hero prioriza una captura y la mascota reserva proporción cuadrada. No se agregan imágenes ni solicitudes externas.
- Los excluidos de las tarjetas comerciales están tachados. El anual permite elegir Running si el beneficio no se ha usado. Fechas de inscripción reales no se convierten en urgencia artificial. La cuenta regresiva mencionada describe la carrera del usuario, no escasez comercial.
- FAQ aclara que el GPS requiere app abierta y pantalla encendida. No se habilitan dispositivos ni se cambia acceso a funciones.
- Los correos usan «Entrenar» y «Progreso», que coinciden con la navegación actual; firma Coach Banana, un botón por pieza, baja, coordinación con transaccionales y aprobación de Andrés. No hay cambios en cuerpos comparados por pruebas.
- No se encontraron emojis, menciones comerciales de inteligencia artificial, testimonios, rayas largas ni promesas de resultados físicos garantizados en las piezas revisadas. No hay menciones de GLP-1 que requieran agregar el aviso médico.
- No cambian precios, montos, proveedores, condiciones de elegibilidad, cierre del aviso, rutas de pago ni lógica de cobro. No se modifican migraciones, dependencias ni configuración de GitHub.

Revisión de código y contenido: no certifica contraste renderizado ni LCP móvil menor a 2.5 s. Pendiente comprobar 390 y 1280 px, especialmente el CTA más largo del encabezado a 320/390 px, y actualizar capturas reales de Running y de Hoy con ambos planes anuales. Los estados de cierre y almacenamiento siguen la lista de `docs/upsell-anual.md`. No se generan capturas inventadas ni se declara una revisión en navegador no realizada.

## Rentabilidad y medición

Pasos del embudo: prueba a primer pago desde Running, anual desde el aviso de Hoy y renovación del segundo mes desde los correos. La temporada es una compra extra; la incluida en el anual no es otra venta. La claridad comercial busca facilitar una decisión informada, sin atribuir mejoras no medidas.

Medir usuarios de prueba que completan primer pago confirmado por plan y periodo; para cobros de fin de prueba usar `trial_charges.status = 'succeeded'`, y para pagos directos conciliar proveedor, eventos y suscripción. Medir cambios mensuales a anual confirmados, no clics. El aviso no tiene nueva instrumentación de exposición, por lo que no permite atribución causal. Para renovación seguir el control, ventanas y conciliación de un segundo cobro distinto propuestos en `docs/emails/primer-pago.md`; la secuencia aún no está activada. Contar usuarios con pago confirmado y suscripción vigente para la meta de 100.

Escenarios aritméticos con precios regulares de `src/lib/plans.ts`, USD e IVA incluido; no son previsiones:

| Movimiento | Cobro bruto |
| --- | --- |
| Primer pago o renovación mensual | Entreno $9.99; Entreno + Nutrición $14.99 |
| Pago anual completo | Entreno $59.99; Entreno + Nutrición $89.99 |
| Ahorro del cliente frente a 12 mensualidades | $59.89 o $89.89 por año |
| 10 cambios a anual frente a una mensualidad del mismo plan | $599.90 frente a $99.90; $899.90 frente a $149.90: adelanto de $500.00 o $750.00 |
| 100 pagos mensuales del mismo plan | $999.00 o $1,499.00 por periodo mensual |

El anual adelanta caja y reduce el total frente a 12 mensualidades; ese adelanto no es ingreso incremental anual. Running cuesta $14.99 por temporada según `seasons.ts`, separado de los precios de suscripción. Usar cobros reales con promociones, devoluciones, impuestos y comisiones para evaluar contribución; sin costos verificados no se puede afirmar que cubran el gasto. Nada se publica, envía, gasta ni modifica campañas. La activación requiere aprobación de Andrés.

## Validación técnica

Verificaciones terminadas con código de salida 0:

- `npx tsc --noEmit -p .`
- `npx eslint src scripts --quiet`
- `npx vitest run`: 203 archivos y 2,272 pruebas aprobados, incluidas las comparaciones de Running, anual y primer pago.
- `NODE_OPTIONS=--max-old-space-size=1536 npx next build`: compilación, tipos y generación de páginas completadas.
- `git diff --check`: sin errores.

La primera ejecución de `npx next build` compiló pero terminó con salida 137 durante la validación de tipos por el límite de memoria del contenedor. La repetición limita el heap de Node sin modificar configuración del repositorio y termina correctamente. Persisten avisos de caché de webpack y advertencias existentes en `src/app/actions/meals.ts`, `src/app/admin/contenido/page.tsx` y `src/components/programas/program-week.tsx`, sin cambios en esta entrega.
