# Cuánto peso usar: anuncios para Costa Rica y Colombia

Textos propuestos para usar desde el 9 de noviembre de 2026. Pendientes de aprobación de Andrés: este documento no autoriza publicación, envío, gasto ni cambios en campañas. Destino: https://www.bananaburn.app/.

## Costa Rica

Tú, español neutro de uso natural en Costa Rica, sin modismos forzados.

### CR-A: rutina

- **Texto principal:** Cuando no sabes cuánto peso usar, una rutina con guía ayuda a empezar. Abre tu rutina en Banana Burn y consulta la carga sugerida, las repeticiones y la técnica de cada ejercicio. Empieza tu prueba de 7 días gratis, sin tarjeta, en bananaburn.app.
- **Título:** Prueba tu rutina 7 días gratis
- **Descripción:** Sin cobro durante la prueba. Luego, Entreno por US$9.99 al mes.

### CR-B: técnica

- **Texto principal:** Cuando no sabes cuánto peso usar, empieza por conocer el movimiento. Revisa las animaciones de técnica de Banana Burn y sigue una rutina adaptada a tu nivel, tiempo y equipo. Prueba 7 días gratis, sin tarjeta, en bananaburn.app.
- **Título:** Conoce la técnica. Prueba 7 días
- **Descripción:** Prueba sin cobro. Después, Entreno por US$9.99 al mes.

### CR-C: registro

- **Texto principal:** Cuando no sabes cuánto peso usar, llevar un registro da una referencia para la próxima sesión. Registra tus series en Banana Burn y consulta tu progreso de fuerza. Empieza tu prueba de 7 días gratis, sin tarjeta, en bananaburn.app.
- **Título:** Registra tus series. Prueba 7 días
- **Descripción:** 7 días sin cobro. Luego, Entreno por US$9.99 al mes.

## Colombia

Tú, español neutro. Todos los precios siguientes son dólares estadounidenses (USD).

### CO-A: rutina

- **Texto principal:** Cuando no sabes cuánto peso usar, una rutina con guía ayuda a empezar. Abre tu rutina en Banana Burn y consulta la carga sugerida, las repeticiones y la técnica de cada ejercicio. Prueba 7 días gratis, sin tarjeta y sin cobro durante la prueba. Después, el plan Entreno cuesta US$9.99 al mes, en dólares estadounidenses. Empieza en bananaburn.app.
- **Título:** Prueba tu rutina 7 días gratis
- **Descripción:** Sin cobro en la prueba. Luego, US$9.99/mes en dólares.

### CO-B: técnica

- **Texto principal:** Cuando no sabes cuánto peso usar, empieza por conocer el movimiento. Revisa las animaciones de técnica de Banana Burn y sigue una rutina adaptada a tu nivel, tiempo y equipo. Prueba 7 días gratis, sin tarjeta y sin cobro durante la prueba. Después, Entreno cuesta US$9.99 al mes, en dólares estadounidenses. Empieza en bananaburn.app.
- **Título:** Conoce la técnica. Prueba 7 días
- **Descripción:** Prueba sin cobro. Después, US$9.99/mes en dólares.

### CO-C: registro

- **Texto principal:** Cuando no sabes cuánto peso usar, llevar un registro da una referencia para la próxima sesión. Registra tus series en Banana Burn y consulta tu progreso de fuerza. Prueba 7 días gratis, sin tarjeta y sin cobro durante la prueba. Después, Entreno cuesta US$9.99 al mes, en dólares estadounidenses. Empieza en bananaburn.app.
- **Título:** Registra tus series. Prueba 7 días
- **Descripción:** 7 días sin cobro. Luego, US$9.99/mes en dólares.

## Condiciones y revisión de las piezas

La prueba incluye todo durante 7 días desde la creación de la cuenta. No requiere tarjeta. Sin tarjeta, al terminar se elige y paga un plan para continuar. Guardar tarjeta es opcional y programa el cobro al terminar la prueba, salvo cancelación previa. El precio mostrado en los anuncios es el mensual normal de Entreno; no implica renovación automática sin autorización. Si se guarda tarjeta antes del primer cobro y nunca se pagó un plan, el primer mes mensual tiene 50 % de descuento: Entreno US$4.99 o Entreno + Nutrición US$7.49. Desde el segundo mes se cobra el precio normal. No aplica al anual.

Fuentes: `src/lib/plans.ts` (precios, funciones y duración), `src/lib/trial.ts` (tarjeta opcional, cobro y promoción). Revalidar antes de aprobar si cambian.

El gancho habla de la carga de un ejercicio, no del peso corporal ni de una condición personal. Los textos no prometen cambios físicos, no incluyen comparaciones corporales, testimonios ni urgencias. Para el montaje, usar capturas reales sin alterar cifras, sin comparativas corporales ni referencias a condiciones de salud. Paper #FFF8E3, banana #FFD60A, ink #1B1505 y Plus Jakarta Sans. Sin emojis ni menciones de inteligencia artificial en el anuncio. Andrés revisa también el creativo y el destino antes de publicar; el texto por sí solo no garantiza aprobación de Meta.

## Apuesta y medición por país

Apostaría por **A en ambos países**: responde a la duda sobre la carga con la sugerencia que aparece en la rutina y un siguiente paso concreto. B prueba el interés por aprender técnica; C, por registrar sesiones. Es una hipótesis, no un resultado. Comparar dentro de cada país manteniendo creativo, público y destino equivalentes; estos textos no proponen presupuesto nuevo.

Mueve el paso **visita > cuenta con prueba iniciada**, con seguimiento hasta **primer pago > renovación**. Una prueba barata solo sirve si produce pagos rentables.

| País | Costo por prueba iniciada | Costo por usuario de pago |
| --- | --- | --- |
| Costa Rica | Gasto CR ÷ cuentas nuevas únicas atribuidas a CR con prueba iniciada | Gasto CR ÷ usuarios únicos atribuidos a CR con primer cobro confirmado |
| Colombia | Gasto CO ÷ cuentas nuevas únicas atribuidas a CO con prueba iniciada | Gasto CO ÷ usuarios únicos atribuidos a CO con primer cobro confirmado |

Separar A/B/C y cohortes de fecha de alta. La prueba inicia en `profiles.created_at`, no al guardar tarjeta ni al completar bienvenida. `CompleteRegistration` mide el final de bienvenida, una señal auxiliar, no el inicio exacto de prueba. Para pagos, verificar `trial_charges.status = 'succeeded'`, sin duplicar usuarios ni reintentos, y contrastar suscripciones vigentes para la meta de 100 usuarios de pago activos. `Subscribe` solo se dispara en `/pago/exito`: omite el cobro automático de fin de prueba y no basta para este informe.

Reportar gasto, pruebas, primeros pagadores, conversión prueba a pago, costo por prueba, costo por pagador, cobros netos y usuarios de pago activos por país y variante. Con denominador cero, informar «sin conversiones», no costo cero. Evaluar cohortes después de sus 7 días y del reintento automático del día siguiente; marcar cobros pendientes y comprobar renovaciones por separado. No declarar ganadora una variante por clics o por una cohorte aún en prueba.

Atribución pendiente de verificar antes de activar: usar URL directa a la landing con `utm_source=meta`, `utm_medium=paid_social`, `utm_campaign=bb-nov26-cr-cuanto-peso` o `bb-nov26-co-cuanto-peso`, y `utm_content=cr-a`, `cr-b`, `cr-c`, `co-a`, `co-b` o `co-c`. Hoy `ref-capture.tsx` solo persiste UTMs si hay un `ref` válido; UTMs solos no garantizan atribución en base de datos. El equipo debe validar un código de referencia por variante y comprobar visita > alta > pago con `src/app/api/ref/route.ts` antes de publicar. No usar `/r/<code>`, que pierde los parámetros. Hasta validar esa unión, informar la atribución faltante; no deducir país de la moneda ni presentar costos por país como verificados.

## Dinero neto que puede mover

Escenarios aritméticos, no pronóstico de ventas. Precios USD de `src/lib/plans.ts`; promoción calculada según `src/lib/trial.ts`. Fórmula solicitada: **neto = cobro ÷ 1.13 − (cobro × comisión porcentual + US$0.35)**. ONVO: 3.9 %; Tilopay: 4.25 %. Se muestran ambos procesadores para cada país, sin asumir cuál procesará sus pagos.

| Plan y cobro | Cobro USD | Neto ONVO USD | Neto Tilopay USD |
| --- | --- | --- | --- |
| Entreno, primer mes promocional | 4.99 | 3.87 | 3.85 |
| Entreno + Nutrición, primer mes promocional | 7.49 | 5.99 | 5.96 |
| Entreno, mensual normal | 9.99 | 8.10 | 8.07 |
| Entreno + Nutrición, mensual normal | 14.99 | 12.33 | 12.28 |
| Entreno, anual por cobro anual | 59.99 | 50.40 | 50.19 |
| Entreno + Nutrición, anual por cobro anual | 89.99 | 75.78 | 75.46 |

Si 100 personas pagan el primer mes promocional de Entreno, el neto conjunto calculado sin redondear cada fila es US$387.13 con ONVO o US$385.39 con Tilopay. Con 100 pagos mensuales normales de Entreno sería US$810.11 o US$806.61 por ciclo, respectivamente. Son escenarios de 100 cobros del mismo tipo, no ingresos atribuibles ya obtenidos por estos anuncios ni una mezcla asumida de planes.

Para recuperar solo publicidad con el primer cobro, el costo por nuevo pagador debe quedar por debajo del neto real de ese cobro; con Entreno promocional, US$3.87 ONVO o US$3.85 Tilopay aproximadamente. El margen disponible para publicidad será menor al descontar otros costos, devoluciones y contracargos: este neto no es utilidad. Para gasto aprobado S, pagos homogéneos necesarios = redondear hacia arriba S ÷ neto por cobro. Con mezcla de planes, sumar los netos reales en lugar de asumir un promedio.

No se asume conversión, retención ni valor de vida. Comparar cada semana los cobros netos nuevos confirmados con el gasto publicitario de esa semana, además de las cohortes: los netos deben superar el gasto y cubrir la operación. La prueba retrasa los cobros; no contar pruebas iniciadas como ingreso. Si faltan datos de conversión a pago o aprobación de Andrés, no activar gasto nuevo.
