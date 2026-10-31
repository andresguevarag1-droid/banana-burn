# Primer pago: acompañar hasta el segundo mes

Borradores para aprobación de Andrés. Este documento no activa envíos, publicaciones, campañas ni gasto. Paso del embudo: **primer pago → renovación del segundo mes**. Busca contribuir a 100 usuarios de pago activos y a ingresos que cubran el gasto, sin prometer resultados físicos ni conversiones.

## Día 1 después del pago

**Asunto:** Tu primera semana: entrena y registra

**Vista previa:** Sigue tu rutina y guarda un punto de partida para comparar.

**Cuerpo:**

Esta semana, dale espacio a tu entrenamiento en el calendario.

Abre Entrenar y sigue la rutina de tu plan. En cada sesión, registra el peso y las repeticiones que completes: así podrás comparar tu fuerza con el tiempo.

En Progreso, guarda tu peso y, si quieres, tus medidas o una foto. Ese será tu punto de partida, no una exigencia de cambiar en siete días.

Al terminar la semana, revisa lo que registraste. La primera meta es conocer tu rutina y volver a ella.

Coach Banana

**Botón:** Abrir mi rutina

**Destino:** https://bananaburn.app/app/entrenar

## Día 21 después del pago

**Asunto:** Mira lo que llevas este mes

**Vista previa:** Revisa tus registros y prepara las próximas semanas de entreno.

**Cuerpo:**

Ya puedes hacer una pausa para revisar lo que llevas de este mes.

Abre Progreso y compara los registros que hayas guardado: peso, medidas, fotos y fuerza. No todo cambia al mismo ritmo, y la báscula no cuenta toda la historia.

Si aún no tienes registros, guarda hoy tu punto de partida. Todavía puedes construir el hábito.

¿Qué viene? Seguir tu rutina, registrar tus sesiones y observar cómo evolucionan tus cargas. Tu plan incluye progresión automática para acompañar ese trabajo durante las próximas semanas.

Elige desde ahora cuándo harás tu próxima sesión.

Coach Banana

**Botón:** Revisar mi progreso

**Destino:** https://bananaburn.app/app/progreso

## Audiencia y convivencia con los correos actuales

Propuesta de integración futura: personas con su primer pago confirmado de una suscripción **mensual**, Entreno o Entreno + Nutrición. Anclar los hitos a la fecha real de ese pago: +24 horas y +21 días completos, no al registro ni al inicio de la prueba. Excluir pagos anuales de esta prueba de renovación mensual, compras de retos/temporadas, cortesías y pagos no confirmados. Revalidar suscripción vigente, preferencias y baja antes de cada envío; detener ante cancelación, devolución o pérdida de acceso. Una pieza por usuario e hito, sin recuperar correos atrasados en bloque.

Complementa `reciboPago` de `src/lib/email/templates.ts`: el recibo conserva importe, comprobante, método y próximo cobro. Estas piezas hablan de uso y continuidad; no repiten la confirmación ni sustituyen avisos de cobro o cancelación. No reemplazan bienvenida, `pruebaIniciada` ni `recordatorioCobro`. Al integrar, sustituir el recordatorio diario o `reactivacion` que coincida para esa persona y día; si coincide `resumenSemanal`, priorizar ese resumen con datos reales y omitir esta pieza. Aplicar la misma regla en control y tratamiento y registrar la omisión. Los transaccionales tienen prioridad. Esta coordinación aún no está implementada.

Usar el pie existente con motivo del correo y enlace de baja firmado; conservar versión de texto plano. Maquetación: paper #FFF8E3, banana #FFD60A, ink #1B1505, Plus Jakarta Sans, un botón principal. Los cuerpos, incluida la firma, tienen menos de 120 palabras. No requieren personalización ni un resumen mensual nuevo: el día 21 invita a consultar registros existentes y contempla que no haya datos.

Funciones verificadas en `src/lib/plans.ts`, `src/components/app-nav.tsx` y `src/app/(app)/app/progreso/page.tsx`: rutina, registro de sesiones, progresión de cargas y progreso de peso, medidas, fotos y fuerza. Todas están incluidas en ambos planes; no se promete nutrición al plan Entreno ni descuentos.

## Variantes de asunto para aprobación

Conservar cuerpo, vista previa y botón. No son envíos adicionales:

| Pieza | A (principal) | B |
| --- | --- | --- |
| Día 1 | Tu primera semana: entrena y registra | Guarda tu punto de partida esta semana |
| Día 21 | Mira lo que llevas este mes | Tu próxima semana empieza con tus registros |

Apostaría por A en ambos: propone una acción concreta y no presupone resultados. Primero medir la secuencia frente al control; probar asuntos después si el volumen permite comparar renovaciones, sin dividir una muestra pequeña en más grupos.

## Cómo medir renovación incremental

Diseño propuesto, aún sin instrumentar ni activar: asignación aleatoria estable por usuario al primer pago mensual confirmado, 50 % a secuencia y 50 % a control sin estas dos piezas. Ambos conservan los mismos transaccionales y reglas para otros correos. Estratificar por plan y promoción del primer pago; guardar asignación, fecha del primer pago, vencimiento del primer periodo, pieza, envío, omisión, entrega/rebote e identificador de Resend. No poner datos personales en enlaces.

**Métrica principal:** usuarios con cobro confirmado de renovación del segundo periodo mensual / usuarios asignados al grupo. Comparar tratamiento frente a control en puntos porcentuales y reportar numerador y denominador por grupo. Mantener en su grupo a quienes no recibieron una pieza por rebote, baja u omisión; comparar solo entregados introduciría sesgo. Reportar la recepción efectiva como dato secundario.

Cerrar la ventana 7 días después del vencimiento real del primer periodo para dar el mismo margen de reintento a ambos grupos. No asumir que todos los meses duran 30 días. Esperar cohortes con ventana completa; cancelaciones y pagos fallidos sin recuperación cuentan como no renovación. Separar cambios a anual de la renovación mensual y mostrarlos con su ingreso real, sin contarlos dos veces. Reportar diferencia con incertidumbre, sin declarar éxito por aperturas o con muestra insuficiente; no hay línea base ni tamaño de muestra verificados.

Conciliar primer pago con `trial_charges.status = 'succeeded'` cuando corresponda y pagos directos con eventos de pago, suscripción y proveedor. Ese estado del primer cobro no demuestra una renovación: para el segundo mes se necesita un cobro distinto confirmado, vinculado al usuario y al segundo periodo, deduplicado por referencia del proveedor. No usar clics, tarjeta guardada, `/pago/exito`, Meta Subscribe ni una suscripción activa por sí sola como evidencia de ese segundo cobro. Antes de activar, verificar que la conciliación cubre renovaciones de los proveedores en uso.

Registrar ingresos efectivamente cobrados por grupo y usuario asignado, devoluciones, comisiones, impuestos y costo incremental de envío. Mostrar cobro bruto y contribución tras costos por separado; no atribuir toda renovación del grupo a los correos. Renovaciones incrementales estimadas = usuarios de tratamiento × (tasa de tratamiento − tasa de control), con la misma ventana. Comparar también ingresos por usuario asignado para captar cambios de plan. Andrés debe aprobar envíos y cualquier costo antes de activar.

## Dinero que puede mover

Precios regulares en USD según `src/lib/plans.ts`:

| Plan | Renovación mensual | Anual, cobro por año |
| --- | ---: | ---: |
| Entreno | $9.99 | $59.99 |
| Entreno + Nutrición | $14.99 | $89.99 |

Cada renovación mensual adicional a precio regular aporta $9.99 o $14.99 brutos. Potencial del segundo mes = renovaciones incrementales Entreno × $9.99 + renovaciones incrementales Entreno + Nutrición × $14.99. Usar importes reales si difieren del precio de lista; no extrapolar la promoción inicial al segundo mes.

Referencia aritmética, no pronóstico: 100 renovaciones del mismo plan equivalen a $999.00 o $1,499.00 brutos de ese mes. No se afirma que esta secuencia consiga esas renovaciones ni que cubra costos desconocidos. Los anuales no generan otro pago en el segundo mes y quedan fuera de esa cuenta. No hay gasto nuevo autorizado ni estimación de rentabilidad sin costos y datos observados.
