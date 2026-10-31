# Mensajes semanales para el grupo de residentes

Borradores para revisión de Andrés. La administración los publica únicamente después de su aprobación. No se ha publicado ni enviado nada.

## Preparación y calendario

Para condominios afiliados de Costa Rica. Publicar una pieza por semana, desde el inicio del mes gratis del condominio. Las semanas organizan los mensajes del grupo; cada residente recibe 30 días desde su propia activación, sin tarjeta, con entreno y nutrición incluidos. La administración y el condominio nunca pagan; cada residente decide si continúa con su propio plan.

Reemplazar [Nombre del condominio] y la URL completa https://www.bananaburn.app/c/[codigo] por el nombre y el enlace real, copiado del panel interno del equipo. No usar /condominios ni inventar códigos. Los bloques son texto plano listo para copiar; cada uno tiene menos de 80 palabras. Recontar después de personalizar.

## Semana 1: cómo empezar

```text
Hola, residentes de [Nombre del condominio]. Ya pueden activar su primer mes gratis de Banana Burn, con entreno y nutrición incluidos, sin tarjeta. Entra con el enlace del condominio, crea tu cuenta y completa tus datos para empezar con tu rutina. Tus 30 días cuentan desde que lo activas. La administración nunca paga y, después, cada residente decide si continúa con su propio plan.
https://www.bananaburn.app/c/[codigo]
```

## Semana 2: una rutina de 30 minutos en el gimnasio

```text
Reserva 30 minutos en el gimnasio del edificio: 5 para caminar suave y movilizar articulaciones, 20 para seguir los ejercicios de tu rutina en Banana Burn, con sus descansos, y 5 para volver a la calma. Usa cargas que controles y detente si hay dolor. Guarda tu entreno al terminar. La administración nunca paga; después del mes gratis, cada residente decide si sigue con su propio plan.
https://www.bananaburn.app/c/[codigo]
```

## Semana 3: cómo ver tu progreso

```text
Tu progreso también se registra. En Banana Burn, abre Progreso para llevar tu peso, medidas y fotos, y comparar tus registros con el tiempo. Si todavía no tienes registros, empieza con uno hoy. Son datos personales: la administración no recibe tus medidas, fotos ni entrenamientos. La administración nunca paga y, al terminar tu mes gratis, cada residente decide si sigue con su propio plan.
https://www.bananaburn.app/c/[codigo]
```

## Semana 4: qué pasa al terminar el mes

```text
¿Cuándo termina tu mes gratis? Mira tu fecha en Mi plan: tienes 30 días desde tu activación. No hay cobro automático de la cortesía. Al terminar, cada residente decide si continúa y paga su propio plan: Entreno por $9.99/mes o Entreno + Nutrición por $14.99/mes. También hay planes anuales. La administración nunca paga. Si aún no lo activas, usa el enlace mientras el condominio siga en Mes gratis.
https://www.bananaburn.app/c/[codigo]
```

Coordinar la semana 4 con [fin-mes-gratis.md](fin-mes-gratis.md): sustituye el mensaje de grupo de su pieza 1 esa semana, para no duplicarlo. Su pieza 3 sirve para preguntas sobre precios anuales. Este enlace es una referencia interna, no se pega en el grupo. No reemplaza el correo ni el aviso que el sistema envía tres días antes del vencimiento individual.

## Embudo, medición y dinero

Mueve prueba a pago: activación en la semana 1, uso del gimnasio en la 2, seguimiento en la 3 y decisión de primer pago en la 4. El anual es una opción, sin urgencia ni descuentos añadidos.

El equipo registra internamente las fechas de publicación aprobadas y mide por cohorte de activación del condominio, usando `condo_members` y el vencimiento individual en `comp_grants`. Cuenta residentes vinculados y quienes guardaron un entreno durante sus primeros 30 días. Para conversión, usa como denominador quienes ya completaron sus 30 días y una ventana adicional de 7 días; como numerador, quienes hicieron un primer pago confirmado dentro de esa ventana posterior al vencimiento. Desglosa mensual y anual. Los residentes que todavía tienen cortesía no son abandonos.

Verifica el pago con el registro del proveedor y una suscripción vigente en `subscriptions`; para cobros que pasen por `trial_charges`, exige `status = 'succeeded'`. Una suscripción `past_due`, un registro o una visita no prueban pago. La consulta de continuidad de fin-mes-gratis.md incluye `past_due`: no usar ese conteo como ingresos cobrados. La medición propuesta requiere un reporte interno; este documento no agrega instrumentación ni atribuye causalidad a los mensajes. A la administración solo se comparten conteos de residentes vinculados y de quienes entrenaron en la semana, nunca datos personales o pagos individuales.

Precios en USD verificados en `src/lib/plans.ts`:

| Plan | Por nuevo pago mensual | Por nuevo pago anual |
| --- | --- | --- |
| Entreno | $9.99 | $59.99 |
| Entreno + Nutrición | $14.99 | $89.99 |

Ingreso bruto cobrado atribuible a la cohorte = $9.99 × pagos mensuales de Entreno + $14.99 × pagos mensuales de Entreno + Nutrición + $59.99 × pagos anuales de Entreno + $89.99 × pagos anuales de Entreno + Nutrición. Contar cada primer pago una sola vez. El cobro anual no es ingreso mensual recurrente.

Como escenario aritmético de la meta de la oficina, 100 usuarios con plan mensual representan $999/mes si todos eligen Entreno o $1,499/mes si todos eligen Entreno + Nutrición. No es una previsión de conversiones. No se conoce cuántos pagarán ni el gasto total: rentabilidad por confirmar con cobros reales, comisiones, devoluciones y costos. Esta entrega no autoriza gastos, campañas ni envíos.

Fuentes locales: `src/lib/condos.ts`, `src/lib/condos-server.ts`, `src/lib/plans.ts`, `src/components/app-nav.tsx` y `fin-mes-gratis.md`.
