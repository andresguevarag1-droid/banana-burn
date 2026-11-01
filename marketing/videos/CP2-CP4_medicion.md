# CP2 a CP4: medición, producción y neto

Paquetes propuestos para el 16 de noviembre de 2026, Costa Rica y Colombia. Tres Reels de 18 s y anuncios de 11 s. No hay videos generados, gasto nuevo, publicaciones, envíos ni cambios de campañas. La estructura reproduce R05 a R16: guion.md, proyecto/escenas.mjs, proyecto/render.mjs, proyecto/package.json y assets/.

## Qué cambia y qué demuestra

| Pieza | Hipótesis creativa | Evidencia |
| --- | --- | --- |
| CP2_otra-persona-condominio | Renovar persona y entorno conservando el gancho “Cuando no sabes cuánto peso usar” | Residente distinto al original en gym de condominio; verificar casting contra original antes de producir |
| CP3_con-cuanto-empiezo | Hacer explícita la pregunta desde el primer cuadro: “¿Con cuánto peso empiezo?” | Texto completo a los 0 s, sin logo |
| CP4_peso-en-pantalla | Resolver la duda con evidencia de producto | Captura real antes del CTA y conservada durante los 3 s finales |

Las tres incluyen gym residencial, captura real y cierre con peso indicado, Coach Banana señalando, botón y logo. Las variantes no son un experimento de una sola variable: también cambia el montaje. No atribuir causalidad a un elemento aislado. Los códigos ejecutables son una alternativa de motion graphics sin persona; para entregar CP2 con otra persona se necesita el montaje UGC descrito. No declarar el paquete como anuncio terminado.

## Embudo y medición

Mueve visita → registro → primer entreno → primer pago y renovación. Meta comercial: contribuir a 100 usuarios de pago activos cuyos ingresos netos cubran el gasto. Mostrar una carga concreta reduce incertidumbre de uso; no demuestra una mejora de conversión por sí mismo.

El US$1.09 por registro del 24 al 31 de octubre y la subida de 45 % son antecedentes del issue #169, no resultados verificados aquí ni una promesa de rendimiento futuro. Comparar CP2, CP3 y CP4 con “Cuánto peso” solo después de aprobación de Andrés, por país, ventana y condiciones comparables. No crear campañas ni asignar presupuesto en esta entrega.

Registrar pieza, versión 18/11 s, país y fecha con impresiones, vistas a 3 s/impresiones, clics, visitas, registros terminados, workout_saved, pruebas, usuarios con primer pago confirmado y renovación. El nombre de creativo en Meta no garantiza atribución de pagos en la app. CompleteRegistration sale al terminar /bienvenida; los eventos workout_open, workout_first_set y workout_saved en funnel_events permiten observar uso, pero no guardan UTMs. No inventar joins entre fuentes.

Para enlaces clicables futuros, usar `https://bananaburn.app/?ref=CODIGO_EXISTENTE_APROBADO&utm_source=meta&utm_medium=paid_social&utm_campaign=cuanto_peso_noviembre_2026&utm_content=cp2_cr_11s`, cambiando pieza, país y versión. Es una plantilla no publicable: requiere código existente activo y aprobado, sin crear afiliados ni comisiones. ref-capture.tsx guarda UTMs solo con ref; /r/<code> pierde parámetros. Si no existe atribución verificable, informar “sin atribución” y usar resultados agregados, sin adjudicar ingresos al Reel. Validar captura de atribución con un registro de prueba antes de usarla en reportes.

Contar primer pago en trial_charges con status 'succeeded', deduplicando usuarios y contrastando vigencia para usuarios activos. El píxel de /pago/exito no basta para cobros automáticos; no sumar eventos Subscribe a pagos reales. Para vías que no estén en trial_charges, verificar la fuente de cobro correspondiente. Reportar registro/visita, primer entreno/registro, primer pago/prueba y renovación con denominadores de la misma cohorte. Separar CR de CO y 18 s de 11 s. Observar cada cohorte tras sus 7 días de prueba y reintentos; una cohorte inmadura no prueba falta de conversión.

La métrica de decisión es gasto aprobado / usuarios con primer pago confirmado y neto cobrado menos gasto. El costo por registro es diagnóstico. La meta interna de 35 % prueba a pago no es un resultado. Para rentabilidad semanal, comparar ingresos netos nuevos efectivamente cobrados con gasto de anuncios de la misma semana; acompañar con cohortes maduras para no confundir desfase de cobro con rendimiento.

## Dinero neto que puede mover

Fuente de precios: src/lib/plans.ts. USD. Neto por cobro = cobro / 1.13 − (cobro × tasa + $0.35). ONVO: tasa 3.9 %; Tilopay: 4.25 %. Se aplica comisión al importe total cobrado. Modelo pedido en el issue, no confirmación de disponibilidad de procesador por país ni utilidad contable: no descuenta operación, producción, devoluciones u otros cargos.

| Plan y ciclo | Cobro de tarifa | Neto ONVO | Neto Tilopay |
| --- | --- | --- | --- |
| Entreno mensual | $9.99 | $8.10 | $8.07 |
| Entreno + Nutrición mensual | $14.99 | $12.33 | $12.28 |
| Entreno anual | $59.99 | $50.40 | $50.19 |
| Entreno + Nutrición anual | $89.99 | $75.78 | $75.46 |

Son escenarios por un cobro conseguido, no previsiones. Calcular totales con netos sin redondear y redondear al final. Cien usuarios pagando no equivalen a cien pagos mensuales a tarifa completa: dependen de plan, ciclo, descuentos y vigencia. No repartir el cobro anual como si fuera caja mensual recurrente ni sumar anual y mensual del mismo usuario.

El primer mes con tarjeta opcional puede cobrarse a $4.99 o $7.49 según src/lib/trial.ts. A esos importes, neto ONVO: $3.87 / $5.99; neto Tilopay: $3.85 / $5.96. La prueba de 7 días cobra $0; no aplicar la comisión fija a una prueba sin transacción. La pieza ofrece prueba general sin tarjeta para ambos países, no un mes de convenio residencial.

Para cualquier gasto futuro G aprobado, pagos para recuperar medios = techo(G / neto por pago), usando importe realmente cobrado y mezcla de planes/procesadores, sin elegir la tarifa normal si la cohorte recibe descuento. El costo por usuario de pago debe ser menor al neto efectivamente cobrado para cubrir solo medios en ese primer cobro; hacen falta costos restantes para afirmar rentabilidad total. No se propone G ni se estima volumen sin datos. El presupuesto y las campañas siguen sujetos a aprobación escrita de Andrés.

## Estado y control de producción

Los tres checks de proyecto funcionan sin instalar dependencias y sin generar medios. Validan tiempos 18/11 s, escenas de 2.5/2 s y cierre de 3 s, máximo ocho palabras añadidas, cuadros a 30 fps y captura existente. No prueban casting, permisos, legibilidad ni técnica.

Falta PNG oficial de Coach Banana señalando; los renders se detienen si falta. También se requiere material UGC autorizado y cotejar a la persona nueva contra el original. No se han generado imágenes fijas ni videos de pago. Los prompts de ambiente quedan archivados sin ejecutar; no hacen falta para producir. El trabajo humano y cómputo local no implican costo total cero. Revisar ambos videos en celular, peso legible en el cierre y portada recortada antes de solicitar aprobación de los medios finales.

## Validación de esta entrega

Pasaron `npx tsc --noEmit -p .`, `npx eslint src scripts --quiet`, `npx vitest run` (211 archivos, 2,370 pruebas) y los tres `npm run check` equivalentes con Node desde cada proyecto. La prueba src/lib/cp2-cp4.test.ts contrasta la tabla de netos con PLANS y conserva la fuente real de captura y el texto del gancho CP3. No se ejecutó render ni se certifican medios finales.
