# Auditoría de pagos de punta a punta: ONVO y Tilopay (#296)

Fecha: 9 nov 2026. Motivo: el 7 nov una persona intentó pagar el plan anual de Entreno + Nutrición ($89.99) con Tilopay. En
/admin/pagos quedó "Incompleta" (`tlp:928033ff-…` es su cliente y `tlp:bbc-c5c579309c5bfc5b3b2832fd`, su suscripción) y el cobro
nunca se aprobó. Además, de 59 registros de la semana del 2 nov, nadie dejó tarjeta.

Embudo que mueve: tarjeta guardada y primer pago. Se mide con las filas `app.payment_failed` de `payment_events` (motivo de cada
fallo) frente a `app.checkout_started` y `charge.approved`.

## Resumen

| Hallazgo | Gravedad | Estado |
|---|---|---|
| La consulta de Tilopay (`/api/v1/consult`) no mandaba `merchantId`, que la documentación pública lista (en su ejemplo va vacío). Si Tilopay lo exige, cada consulta falla, se lee como "sin respuesta" y la compra queda Incompleta aunque el banco la aprobara. | Alta | Arreglado: se manda `merchantId` (TILOPAY_MERCHANT_ID si existe, si no vacío, como el ejemplo). |
| Si la consulta fallaba no quedaba rastro: `consultOrder` se tragaba el error. | Alta | Arreglado: línea `consult_failed` / `consult_unknown` en el log con el estado HTTP, sin la orden. |
| En una compra directa, si Tilopay devolvía `code` distinto de 1 (banco rechazó o 3D Secure sin terminar) y la consulta no respondía, la persona veía "Estamos confirmando tu pago" para siempre y la fila quedaba Incompleta sin motivo. | Alta | Arreglado: ve "Tu banco no aprobó el cobro" o "No terminaste la verificación de tu banco", con botón para reintentar, y se guarda el código. |
| La vuelta va a `/api/pagos/tilopay/vuelta?s=<estado>`. Si Tilopay agrega sus parámetros con otro `?` (su ejemplo de vuelta empieza con `?code=1`), el código queda pegado al estado, la firma no coincide y la vuelta se toma como "enlace vencido". | Media (no confirmado) | Arreglado a la defensiva: `splitReturn` separa el estado de lo que venga pegado. |
| Sin sesión al volver de Tilopay (otro navegador, cookie perdida) se mandaba a /entrar y la compra no se confirmaba hasta el cron del día siguiente. | Media | Arreglado: el estado firmado dice de quién es la orden; se confirma con la consulta y luego se pide entrar. |
| El cron de cobros corre una vez al día (06:20 UTC) y reconsultaba las compras de las últimas 24 h con más de 10 minutos. Una compra hecha en los 10 minutos antes de la corrida no entraba ni en esa ni en la siguiente. | Media | Arreglado: ventana de 26 h. |
| La consulta tomaba el campo `card` como token de la tarjeta, pero en la consulta `card` son dígitos de la tarjeta. Podía guardarse un número enmascarado como "token", y la renovación fallaría. | Media | Arreglado: solo `crd`, `token` o `cardToken`. |
| Los rechazos de ONVO en /pago/checkout y al dejar la tarjeta solo se mostraban en pantalla; no quedaba registro. | Media | Arreglado: el navegador avisa a `/api/pagos/fallo` con proveedor, etapa y código. |
| /admin/pagos mostraba "Incompleta" sin motivo ni forma de reenviar el pago. | Media | Arreglado: columna Motivo y botón Reintentar (abre o copia el enlace a Mi plan con el mismo plan y periodo). |

No se cambiaron precios ni la promo. Ningún registro guarda números de tarjeta, tokens, llaves ni variables de entorno.

## Qué se registra cuando un pago no se completa

Una fila en `payment_events` con `type = 'app.payment_failed'`, `status = 'processed'` y:

- `provider`: `onvo` o `tilopay`.
- `payload`: `{ provider, stage, code, kind, plan, billing }`.
  - `stage`: `tarjeta` (dejar la tarjeta), `checkout` (abrir el pago), `vuelta` (volver del banco o de Tilopay), `confirmacion` (consulta servidor a servidor).
  - `code`: el código corto del procesador (`issuer_declined`, `51`, `2`…) o uno nuestro (`abandono`, `sin_confirmar`, `vencido`, `sin_tarjeta`, `conexion`, `tilopay_502`…). Solo letras, números, punto, guion y guion bajo, máx. 40: un texto libre o un número de tarjeta queda como `desconocido`.
  - `kind`: la clase del fallo (ver la tabla de mensajes).
- `note`: lo que ve el equipo, por ejemplo "Tilopay, al volver del banco: Banco rechazó (código 2)".
- `event_key`: `app.payment_failed:s:<suscripción>:<etapa>:<código>`; sin suscripción, por persona y ventana de 10 minutos. El mismo fallo repetido es una sola fila.

También queda una línea en el log de Vercel: `{"area":"pagos","code":"payment_failed","provider",...,"failCode","kind"}`.

La descripción que manda Tilopay en la vuelta solo se usa para clasificar (reconocer 3D Secure o fondos) y nunca se guarda.

## Mensajes para la persona

| Clase | Mensaje | Reintentar |
|---|---|---|
| rechazada | Tu banco no aprobó el cobro. Prueba con otra tarjeta o pide a tu banco activar las compras internacionales en dólares. | Sí |
| verificacion | No terminaste la verificación de tu banco. Vuelve a intentarlo y completa el código que te pide tu banco. | Sí |
| fondos | Tu tarjeta no tiene fondos suficientes para este cobro. Prueba con otra tarjeta. | Sí |
| datos | Algún dato de la tarjeta no coincide. Revisa el número, el vencimiento y el código de seguridad. | Sí |
| vencida | Tu tarjeta está vencida. Prueba con otra. | Sí |
| conexion | Se perdió la conexión con el procesador de pagos. Revisa tu internet e intenta de nuevo. | Sí |
| sin_confirmar | Todavía no tenemos la respuesta de tu banco. Si lo aprueba, tu plan se activa solo. No vuelvas a pagar por ahora. | No (podría cobrarse dos veces). Enlace "Ver si ya se confirmó". |
| abandono | El pago no se terminó y no se hizo ningún cobro. | Sí |
| vencido | El enlace de pago venció. Vuelve a intentarlo. | Sí |
| error | No pudimos terminar el pago. Intenta de nuevo en un momento. | Sí |

Fuente: `src/lib/pago-fallo.ts` (`failKind`, `FAIL_MESSAGE`). Pruebas: `src/lib/pago-fallo.test.tsx`.

## Cada camino

### 1. Dejar la tarjeta con ONVO (Costa Rica)

Dónde: bienvenida (`src/app/bienvenida/wizard.tsx`), hoja del primer entreno (#281, `src/components/workout/first-set-card-ask.tsx`), Mi plan (`card-panel.tsx`), renovación rechazada (`past-due-card.tsx`) y condominios con tarjeta (`src/app/c/[code]/condo-card.tsx`, solo ONVO). Todos usan `CardForm` (`src/components/pagos/card-form.tsx`).

1. `POST /api/pagos/tarjeta {action:"preparar"}` crea o reutiliza el cliente de ONVO.
2. El navegador manda la tarjeta DIRECTO a ONVO (`/v1/payment-methods`) con la llave publicable. A nuestro servidor solo llega el ID.
3. `POST /api/pagos/tarjeta {action:"guardar"}` verifica la tarjeta con ONVO y programa el cobro (prueba) o cobra en ese momento (cuenta bloqueada, sin promo).

Qué ve la persona si falla:
- ONVO no acepta la tarjeta (paso 2): el mensaje de `onvoCardError` bajo el formulario; el formulario sigue abierto. **Ahora** se registra `stage=tarjeta` con la razón de ONVO (`issuer_declined`, `cards.invalid_card_info`…) o `conexion`.
- El servidor rechaza la tarjeta (paso 3, error 400): "No pudimos usar esa tarjeta. Prueba con otra." **Ahora** se registra `tarjeta_rechazada` (o `billing_<estado>`; un 409, cobro en curso, no es fallo).
- Tarjeta guardada pero el cobro inmediato se rechazó: la pantalla del cobro fallido de `CardPanel`. **Ahora** se registra `cobro_rechazado`.

Dónde puede quedar a medias: en ningún lado como "Incompleta"; si no se guarda, no hay fila de suscripción.

### 2. Dejar la tarjeta con Tilopay (otros países)

1. `POST /api/pagos/tilopay {purpose:"tarjeta"}` pide a Tilopay la página segura (`processTokenize`) con un estado firmado de 2 horas.
2. La persona escribe la tarjeta en Tilopay (y la verificación de su banco, si la pide).
3. Tilopay la devuelve a `/api/pagos/tilopay/vuelta`, que guarda el token y termina en Mi plan con `?tilopay=<resultado>`.

Qué ve la persona si falla:
- No se pudo abrir la página: mensaje bajo el botón, puede volver a tocar. **Ahora** se registra `stage=tarjeta`, `tilopay_<estado>`.
- Tilopay devolvió un código distinto de 1: "Tu banco no aprobó el cobro…" o "No terminaste la verificación de tu banco…", con "Intentar de nuevo con tu tarjeta". **Ahora** se registra `stage=vuelta` con el código.
- Volvió sin tarjeta: "No recibimos tu tarjeta desde Tilopay. Intenta de nuevo." **Ahora** se registra `sin_tarjeta`.
- Cerró el navegador en Tilopay: no vuelve nunca; no hay fila que quede a medias y no queda nada que registrar del lado nuestro.

### 3. Checkout de plan con ONVO (mensual y anual)

1. Mi plan o /precios: `POST /api/pagos/checkout {plan, billing}` crea la suscripción en ONVO y una fila `incomplete`, y manda a `/pago/checkout?s=<suscripción>`.
2. El SDK de ONVO muestra el formulario y hace el cobro (y 3D Secure dentro del SDK, si el banco lo pide).
3. Éxito: `/pago/exito`, que espera el webhook hasta ~3 minutos y luego dice "Sigue pendiente. Revisa en unos minutos desde tu suscripción" (nunca se queda cargando).
4. El webhook de ONVO (`/api/pagos/webhook`) es el único que activa el plan.

Qué ve la persona si falla:
- No se pudo crear el pago: mensaje en el botón del plan. **Ahora** se registra `stage=checkout` con el código.
- El SDK rechaza (banco, fondos, 3D Secure): mensaje simple de `FAIL_MESSAGE` sobre el formulario, que sigue abierto para reintentar. **Ahora** se registra `stage=checkout` con la razón de ONVO y la suscripción.
- "Continuar sin tarjeta": `/pago/cancelado`, "No se hizo ningún cobro", con "Intentar de nuevo".

Dónde queda "Incompleta": la fila `incomplete` de ONVO queda así si la persona no paga (cierra la página, abandona 3D Secure dentro del SDK sin que el SDK avise, o lo rechazan). Se reutiliza si vuelve dentro de 1 hora con el mismo plan. En /admin/pagos ahora se ve su motivo guardado o, si no hay, "Pago en curso" (menos de 2 horas) o "Sin respuesta del procesador: no volvió del pago".

### 4. Checkout de plan con Tilopay (mensual y anual): el caso del 7 nov

1. `POST /api/pagos/checkout` con Tilopay: fila `incomplete` con `provider_subscription_id = tlp:bbc-<24 hex>` y `provider_customer_id = tlp:<usuario>`, evento `app.checkout_started`, y la URL de la página de pago de Tilopay (`processPayment`, monto del servidor: $89.99 en el anual de Entreno + Nutrición).
2. La persona paga en Tilopay; si su banco pide 3D Secure, va al banco y vuelve a Tilopay.
3. Tilopay la manda a `/api/pagos/tilopay/vuelta?s=<estado>` con `code`, `description`, `order`, etc.
4. La vuelta NUNCA da acceso por los parámetros del navegador: consulta la orden a Tilopay (`/api/v1/consult`). Aprobada y con el monto correcto: activa el plan y guarda la tarjeta para renovar.
5. Sin respuesta clara: queda pendiente y el cron diario vuelve a consultar.

Por qué pudo quedar "Incompleta" el 7 nov (en orden de probabilidad, sin acceso a los registros de Vercel ni al portal de Tilopay):
1. **El banco rechazó o no terminó 3D Secure**, y la consulta no respondió (o no se reconoció). Antes: "Estamos confirmando tu pago" y fila Incompleta sin motivo. Ahora: mensaje claro, botón para reintentar y motivo en el admin.
2. **La consulta falló por la forma del pedido** (sin `merchantId`). Antes: sin rastro. Ahora: se manda y, si falla, queda `consult_failed` en el log.
3. **La vuelta se tomó como vencida** porque Tilopay pegó su `?code=` al estado. Ahora se separa.
4. **Cerró el navegador** en Tilopay o en su banco. Ahora el cron, pasadas 2 horas sin que Tilopay conozca la orden, guarda `abandono`.

Qué revisar a mano (Andrés): en el portal de Tilopay, la orden `bbc-c5c579309c5bfc5b3b2832fd` del 7 nov (si existe y con qué código), y en los registros de Vercel, el 7 nov, `tilopay_return_params` (nombres de los parámetros de vuelta, sin valores) y `tilopay_return_failed`. Si la orden aparece aprobada en Tilopay, el plan debe activarse a mano y revisar por qué la consulta no lo vio. Las variables de Tilopay (TILOPAY_API_USER, TILOPAY_API_PASSWORD, TILOPAY_KEY, TILOPAY_ENABLED, TILOPAY_STATE_SECRET y, si Tilopay la pide, TILOPAY_MERCHANT_ID) las revisa Andrés en Vercel.

### 5. Redirección y vuelta de 3D Secure

- ONVO: 3D Secure ocurre dentro del SDK (`/pago/checkout`) o en la verificación de la tarjeta. Si el SDK avisa con `onError`, se muestra el mensaje y se registra. Si la persona cierra la ventana del banco sin que el SDK avise, no hay evento: la fila queda Incompleta con el motivo calculado "no volvió del pago".
- Tilopay: el banco vuelve a Tilopay y Tilopay a nuestra vuelta. Un código distinto de 1 con una descripción de autenticación se clasifica como `verificacion` ("No terminaste la verificación de tu banco").
- La vuelta exige el estado firmado (2 horas). Pasado ese tiempo: "El enlace de pago venció. Vuelve a intentarlo.", registrado como `vencido`.

### 6. Webhook o confirmación de Tilopay

Tilopay no firma sus webhooks (el algoritmo de `OrderHash` no es público), así que no hay webhook: solo cuentan la respuesta del cobro con tarjeta guardada y la consulta de la orden, servidor a servidor. La consulta corre:
- al volver la persona (con o sin sesión), y
- en el cron diario `/api/cron/cobros` (06:20 UTC) para las compras `incomplete` de las últimas 26 horas con más de 10 minutos.

Una consulta rechazada deja la fila `expired` y guarda el código. Una aprobada después de vencer reactiva la fila (o avisa para reembolso si ya tenía otro plan).

### 7. Si la persona cierra el navegador a mitad del pago

| Dónde cerró | Qué queda | Qué se registra |
|---|---|---|
| Formulario de ONVO, antes de pagar | Fila ONVO `incomplete` | Nada del procesador; en el admin, "no volvió del pago" pasadas 2 horas |
| Formulario de ONVO, después de pagar | El webhook activa el plan aunque no vea /pago/exito | Nada (no es fallo) |
| Página de Tilopay o su banco | Fila Tilopay `incomplete` | El cron consulta; si Tilopay no conoce la orden pasadas 2 horas, `abandono` |
| Después de pagar en Tilopay, antes de volver | Fila `incomplete` hasta que el cron consulte | Si se aprobó, el cron activa el plan; si no, el código del rechazo |
| Página de Tilopay para guardar tarjeta | Nada | Nada |

## Revisar "Incompleta" en /admin/pagos

La tabla "Pagos fallidos" incluye las suscripciones `incomplete` y `past_due` con:
- **Motivo**: la última nota `app.payment_failed` de esa suscripción o, si no hay, "Pago en curso" o "Sin respuesta del procesador: no volvió del pago".
- **Reintentar**: abre en otra pestaña `https://www.bananaburn.app/app/suscripcion?plan=<plan>&pago=<periodo>` (el mismo plan y periodo, ya elegido en Mi plan) y un botón para copiar ese enlace y enviárselo a la persona.

La tabla "Últimos cobros rechazados" también muestra cada `app.payment_failed` con su nota.

## Fuera de alcance

- No se marca como vencida una compra Incompleta: queda visible con su motivo para que el equipo la siga.
- La forma exacta de la vuelta de `processTokenize` y de la consulta sigue sin estar confirmada con datos reales; las lecturas siguen siendo a la defensiva y lo que no se reconoce nunca se toma como aprobado.
