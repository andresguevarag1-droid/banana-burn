# Fin del mes gratis del condominio: días 20 a 30

Qué hacer en los últimos 10 días del mes gratis de un condominio afiliado para que los residentes que lo usaron sigan con su propio plan. Son textos para que Andrés los revise: los correos a la administración los envía solo Harvey, desde hola@bananaburn.app y con su aprobación. El afiche lo diseña Mateo y nadie lo imprime ni lo envía sin el visto bueno de Andrés.

La oferta no cambia: primer mes gratis para todos los residentes, con todo incluido y sin tarjeta; la administración y el condominio nunca pagan nada; al terminar el mes, cada residente decide si sigue y paga su propio plan.

Este documento sigue al kit de implementación (`kit-implementacion.md`), que llega hasta el aviso a la administración del día 27 (paso 6). No lo reemplaza.

## Lo que hay que saber antes (verificado en el código)

- Los días se cuentan desde el inicio del "Mes gratis" del condominio, el rango que muestra el panel (Admin, Condominios, "Condominios afiliados"). Día 20 = 10 días antes de la fecha final de ese rango.
- Cada residente tiene 30 días desde el día en que activa el enlace, no desde la fecha del condominio (`CONDO_FREE_DAYS` en `src/lib/condos.ts`). Quien lo activó el primer día termina alrededor del día 30; quien lo activó la segunda semana, mucho después. Por eso ningún texto de aquí anuncia una fecha de cierre igual para todos.
- Mientras el condominio siga en "Mes gratis", el enlace `/c/` sigue funcionando: quien se une el día 25 recibe sus 30 días completos. Por eso el afiche y el mensaje también invitan a quien todavía no lo activa.
- Cada residente ve su fecha en la app, en Mi plan: su plan sale como "Cortesía" con la frase "Es un plan regalado hasta el [fecha]; no tiene cobros automáticos." (`src/app/(app)/app/suscripcion/page.tsx`).
- Al terminar sus 30 días, la app le muestra la pantalla de planes con el anual ya elegido y Entreno + Nutrición recomendado (`src/components/pricing.tsx`, `plan-wall.tsx`).

## Lo que el sistema ya envía (no repetirlo)

3 días antes de que terminen los 30 días de cada residente, el cron (`sweepCondos` en `src/lib/condos-server.ts`) le envía el correo `condominioMesTermina` de `src/lib/email/templates.ts`, con el asunto "Tu mes gratis del condominio termina pronto", y un aviso en la app. Ese correo ya le dice la fecha exacta, que elige su plan en Mi plan, que no se le cobra nada automáticamente y que su historial queda guardado.

Lo que se escribe aquí hace otra cosa: el día 20 le dice al grupo dónde ver su fecha y que ese correo va a llegar, invita a usar los días que quedan y responde el precio, que el correo no trae. No repite sus frases ni su botón.

## Calendario

| Cuándo | Qué | Quién |
| --- | --- | --- |
| Día 20 | Correo a la administración con el mensaje para el grupo de residentes (pieza 1) | Harvey, con aprobación de Andrés |
| Día 20 a día 30 | Afiche "te quedan 10 días" en el gimnasio, junto al afiche con QR (pieza 2). Se retira el día 30 | Mateo lo diseña; la administración lo imprime y coloca |
| Cuando pregunten | Respuesta a "¿cuánto cuesta después?" (pieza 3) | La administración en el grupo, o Harvey por correo |
| Día 27 | Aviso a la administración, paso 6 del kit de implementación | Harvey |
| 7 días después de la fecha final del "Mes gratis" | Reporte de cuántos residentes siguen (pieza 4) | Equipo de Banana Burn prepara el conteo; Harvey lo envía |

En los textos, lo que va entre corchetes se reemplaza antes de aprobar: [Nombre del condominio], [codigo], [N], [X], [Y].

---

## 1. Mensaje para el grupo de residentes (día 20)

Correo de Harvey a la administración. El enlace se copia con el botón "Copiar enlace" del condominio en el panel, no se escribe a mano. Si el afiche de la pieza 2 ya está aprobado, se adjunta y se agrega la oración entre corchetes; si no, se quita.

```
Asunto: recordatorio para el grupo

Hola, administración de [Nombre del condominio].

Quedan 10 días del primer mes del condominio en Banana Burn. Este mensaje corto ayuda a que cada residente sepa cuándo termina su mes y a que se sumen quienes todavía no lo activan. Puedes copiarlo tal cual:

Hola, vecinos de [Nombre del condominio].

Un recordatorio sobre Banana Burn, el mes gratis que el condominio les regaló.

Tus 30 días cuentan desde el día en que activaste el enlace, así que cada residente termina en una fecha distinta. La tuya está en la app, en Mi plan. Unos días antes te llega un correo de Banana Burn con lo que sigue.

Si llevas días sin entrenar, hoy es un buen día para retomar tu plan: está hecho con el equipo del gimnasio del condominio o con lo que tengas en casa.

Si todavía no lo activas, tus 30 días empiezan el día que lo actives: https://www.bananaburn.app/c/[codigo]

[Te adjunto también un afiche para el gimnasio, en PDF y tamaño A4.] ¿Lo puedes publicar en el grupo esta semana?

Andrés Guevara
Fundador, Banana Burn
bananaburn.app
```

Reglas de este mensaje:

- Sin precios: si alguien pregunta en el grupo, se responde con la pieza 3.
- No dice "termina el [fecha]" ni "quedan 10 días" a los residentes, porque cada uno tiene su fecha. Los 10 días son del condominio y van solo en el correo a la administración.
- Un solo enlace, el `/c/` del condominio.

## 2. Afiche "te quedan 10 días" (texto para Mateo)

Va junto al afiche con QR que ya está en el gimnasio, no lo reemplaza. Se coloca el día 20 y se retira el día 30: después de ese día el título deja de ser cierto.

Especificaciones:

- A4 vertical (210 x 297 mm), para imprimir a color y en tamaño real.
- Fondo paper #FFF8E3, con una franja o bloque banana #FFD60A detrás del título. Todo el texto en ink #1B1505; nada en gris sobre el banana.
- Solo Plus Jakarta Sans: título en 800, cuerpo en 400 a 600, cifras en 800 con números tabulares. Eyebrow en mayúsculas, 700, en banana-ink #8A6200.
- Sin emojis, sin signos de exclamación, sin rayas largas, sin mencionar IA, sin testimonios ni cifras de residentes.
- Coach Banana de pie (`public/brand/mascota-sola.webp` o `marketing/instagram/recursos/coach-banana-oficial.png`), sin redibujarlo.
- QR al enlace `/c/` del condominio, el mismo del afiche del panel (`src/lib/condo-qr.ts`), con el enlace escrito debajo.
- Logo de `public/icons/logo.svg`, sin recolorear.

Texto, en este orden:

```
Eyebrow: BANANA BURN EN [NOMBRE DEL CONDOMINIO]

Título: Si lo activaste el primer día, te quedan 10 días.

Bajada: Tu mes gratis dura 30 días desde el día en que lo activaste. Mira tu fecha en la app, en Mi plan.

Bloque: Úsalos. Tu rutina se arma con el equipo que tienes, aquí o en casa.

Bloque junto al QR: ¿Todavía no lo activas? Escanea el código. Tus 30 días empiezan el día que lo actives.

Enlace bajo el QR: bananaburn.app/c/[codigo]

Pie: Al terminar el mes, cada residente decide si sigue con su plan. La administración no paga nada.
```

## 3. Respuesta a "¿cuánto cuesta después?"

Para la administración, si alguien pregunta en el grupo, y para Harvey, si un residente escribe a hola@bananaburn.app. El anual va primero, como en la pantalla de planes de la app. Precios de `src/lib/plans.ts`, en dólares; el ahorro es la diferencia entre 12 meses y el pago anual (`annualSaving`).

```
Después de tus 30 días, cada residente decide si sigue y elige su propio plan. La administración no paga nada.

Plan anual, un solo pago al año:
Entreno: $59.99 al año. Ahorras $59.89 frente a pagar $9.99 al mes.
Entreno + Nutrición: $89.99 al año. Ahorras $89.89 frente a pagar $14.99 al mes.
El plan anual incluye 1 temporada deportiva gratis.

Plan mensual, sin permanencia:
Entreno: $9.99 al mes.
Entreno + Nutrición: $14.99 al mes.

Entreno + Nutrición suma calorías y macros calculados para ti, registro de comidas con alimentos latinos y Banana Shield para personas en GLP-1. No sustituye la indicación de tu médico.

El día que termina tu mes, la app te muestra los planes con el anual primero, y eliges ahí.
```

Lo que no se dice:

- Ningún descuento. El 50 % del primer mes es de la prueba individual de 7 días con tarjeta guardada (`src/lib/trial.ts`), y al unirse al condominio esa prueba se cancela (`joinCondo` en `src/lib/condos-server.ts`). No aplica a los residentes.
- Ningún precio en colones ni conversión: los planes se cobran en dólares.
- Si preguntan algo que no está aquí: "Andrés lo confirma por correo".

## 4. Qué ve la administración y qué le reportamos

La administración no entra a Admin: `/admin/condominios` es el panel interno de Banana Burn. Lo que ve la administración es lo que el equipo le comparte por correo, y solo son conteos.

Lo que muestra el panel para cada condominio:

- "Residentes vinculados": cuántas cuentas se unieron con el enlace.
- "Entrenaron esta semana": cuántas de ellas entrenaron en los últimos 7 días.
- "Mes gratis": el rango de fechas del condominio.

Lo que nunca se comparte: nombres, correos, pesos, medidas, fotos, entrenos, comidas, ni qué plan eligió cada residente.

### Cuántos residentes siguen

El panel todavía no muestra este número. Hasta que exista, el equipo lo saca con esta consulta de solo lectura en el editor SQL de Supabase, cambiando [codigo]. Devuelve dos conteos y ningún dato personal:

```sql
select
  count(*) filter (where g.expires_at <= now()) as terminaron_su_mes,
  count(*) filter (where g.expires_at <= now() and exists (
    select 1 from public.subscriptions s
    where s.user_id = m.user_id
      and s.status in ('active', 'past_due')
      and s.current_period_end > now()
  )) as siguen_con_su_plan
from public.condo_members m
join public.condos c on c.id = m.condo_id
join public.comp_grants g on g.id = m.grant_id
where c.code = '[codigo]';
```

Propuesta para que Andrés decida: si [Y] es 1 o 2 en un condominio pequeño, decir "menos de 3" en vez del número, para que nadie pueda adivinar de quién se trata.

Correo de Harvey a la administración, 7 días después de la fecha final del "Mes gratis". [N] es "Residentes vinculados" del panel ese día; [X] y [Y] salen de la consulta.

```
Asunto: cómo siguen los residentes

Hola, administración de [Nombre del condominio].

Este es el cierre del primer mes. Se unieron [N] residentes. De los [X] que ya terminaron sus 30 días, [Y] siguen con su propio plan. Los demás todavía están dentro de su mes.

Solo te comparto estos conteos, nunca datos de nadie. La administración no paga nada, ni ahora ni después.

¿Te sirve que te envíe el mismo conteo el próximo mes para la junta?

Andrés Guevara
Fundador, Banana Burn
bananaburn.app
```

---

## Embudo y rentabilidad

- Paso del embudo: pago. Mueve a residentes que ya usaron su mes gratis (el equivalente a la prueba) hacia su primer pago, y empuja el anual, que asegura la renovación de todo un año.
- Cómo se mide: por condominio, [Y] dividido entre [X] de la consulta de la pieza 4, 7 días después de la fecha final del "Mes gratis". Se compara con la meta de la oficina de 35 % de prueba a pago. Además, cuántos de los [Y] eligieron anual, en `subscriptions` de esas mismas cuentas.
- Por qué no agrega costo: no hay pauta, ni descuentos, ni herramientas nuevas. Los correos salen por Harvey, que ya existe; el afiche lo imprime la administración; el aviso a cada residente ya lo envía el cron. El único costo es el tiempo de diseño de Mateo para un afiche reutilizable con todos los condominios.
- Nada se publica ni se envía sin la aprobación de Andrés.

## Hallazgos en la app para Andrés (no se cambian en esta entrega)

1. Mientras dura la cortesía, Mi plan no muestra Entreno + Nutrición ni pone el anual primero: el plan regalado cuenta como el plan "actual" en mensual y anual, y la lista se ordena como si ya pagara (`isCurrent` y `paid` en `src/app/(app)/app/suscripcion/manager.tsx`). Por eso la pieza 3 dice que se elige el día que termina el mes, cuando la app muestra todos los planes con el anual primero.
2. Al terminar su mes, la pantalla de planes le dice al residente "Tu prueba gratis terminó" (`plan-wall.tsx`), aunque para él fue el mes gratis del condominio.
3. El panel no tiene el conteo de residentes que siguen; hoy sale de la consulta de la pieza 4.

## Antes de aprobar cada pieza

- El nombre del condominio está escrito igual que en el panel.
- Máximo un enlace, y es el `/c/` del condominio (nunca el de /condominios).
- Sin teléfonos, sin números de WhatsApp, sin emojis, sin signos de exclamación y sin mencionar IA.
- Precios solo en la pieza 3 y solo los de `src/lib/plans.ts`.
- Solo conteos para la administración.
- Si dicen que no o piden no recibir más correos, no se responde.
