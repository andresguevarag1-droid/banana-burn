# Comprobante electrónico de Hacienda por cada cobro (#334)

Estado: **primera etapa, apagada.** Cada cobro exitoso deja un comprobante en `pendiente` (tabla `billing_documents`,
migración 0074). La emisión con Alegra solo corre con `ALEGRA_ENABLED=1`: hasta que Andrés la prenda no se emite nada
ni se llama a Alegra. Este documento es para que Andrés y su contador decidan antes de prenderla.

Lo que no está claro está marcado **Pregunta para el contador**. Nada de aquí es asesoría legal ni tributaria.

## 1. Qué comprobante corresponde

| Caso | Comprobante | Cómo lo sabemos en la app |
|---|---|---|
| Persona en Costa Rica que no da cédula | Tiquete electrónico (consumidor final) | Por defecto: todo cobro entra como `tiquete` |
| Persona o empresa que pide factura a su nombre | Factura electrónica, con la identificación del receptor | Hoy responde al recibo con sus datos; todavía no hay campo en la app |
| Cliente fuera de Costa Rica | Factura electrónica de exportación (exportación de servicios) | País de la tarjeta o del perfil; ver la pregunta 4 |

- El tiquete no necesita los datos del receptor; la factura sí (tipo y número de identificación, nombre y correo).
- Hacienda usa la versión 4.4 de los comprobantes. Cada comprobante emitido tiene un **consecutivo** de 20 dígitos y una
  **clave numérica** de 50 dígitos; los dos se guardan en `billing_documents` (`number`, `hacienda_key`).
- **Pregunta para el contador 1:** ¿el tiquete a consumidor final sirve para todas las ventas en Costa Rica, o hace falta
  factura en algún caso aunque la persona no la pida?
- **Pregunta para el contador 2:** si alguien pide factura después de haber recibido el tiquete, ¿se anula el tiquete con
  nota de crédito y se emite la factura, o cuál es el procedimiento?

## 2. Datos que hacen falta

Datos de Banana Burn (se configuran una vez en Alegra, no en la app):

- Cédula del emisor, nombre comercial, correo y la llave criptográfica y el usuario de comprobantes de Hacienda.
- **Pregunta para el contador 3:** el código de actividad económica que corresponde (suscripción a una app de
  entrenamiento y nutrición) y el código CAByS del servicio.

Datos de cada cobro (ya los tiene la app):

| Dato | De dónde sale |
|---|---|
| Fecha y monto total con IVA | `payment_events` / el cobro verificado (`amount_minor`, `currency`) |
| Descripción | El plan (Entreno, Nutrición, Completo) y el periodo (mes o año) |
| Medio de pago | Tarjeta (ONVO o Tilopay) |
| Condición de venta | Contado |
| Referencia del procesador | `charge_id` = `onvo:<referencia>` o `tilopay:<referencia>`, la misma del recibo |

Datos del receptor (solo para factura): tipo y número de identificación, nombre y correo. Hoy no se piden; la segunda
etapa agregaría un campo opcional en Mi plan.

## 3. IVA incluido en el precio

Los precios se publican en USD **con IVA incluido** (regla de la oficina). El comprobante necesita la base y el impuesto por
separado, así que se calculan desde el total:

- base = total / 1.13, redondeada al centavo; IVA = total − base (así la suma siempre da el total cobrado).
- Ejemplo: $9.99 → base $8.84 + IVA $1.15. Código: `splitIva` en `src/lib/factura.ts`.
- Alegra recibe el precio **sin** impuestos y le suma el IVA configurado, por eso se le manda la base.
- **Pregunta para el contador 4:** ¿la tarifa general del 13 % es la que aplica a este servicio?
- **Pregunta para el contador 5:** los cobros son en USD. ¿El comprobante se emite en USD con el tipo de cambio de
  referencia del BCCR del día, y quién lo pone (Alegra o nosotros)?
- **Pregunta para el contador 6:** con el redondeo, Alegra puede calcular un IVA que difiera en 1 centavo del nuestro.
  ¿Se acepta esa diferencia o el total del comprobante tiene que ser exactamente el monto cobrado?

## 4. Clientes fuera de Costa Rica

Banana Burn vende en toda Latinoamérica. Un servicio prestado a alguien fuera de Costa Rica podría ser exportación de
servicios, con otro comprobante y otro trato del IVA.

- **Pregunta para el contador 7:** ¿una suscripción digital pagada por una persona en otro país es exportación de servicios?
  ¿Lleva IVA o va exenta, y con qué comprobante?
- **Pregunta para el contador 8:** ¿qué prueba de que el cliente está fuera de Costa Rica basta: el país de la tarjeta, el
  país que eligió en su perfil, la IP? Hoy la app sabe el país del perfil y Tilopay se usa para tarjetas de fuera.
- Mientras no haya respuesta, todo entra como `tiquete` y nada se emite (la bandera está apagada).

## 5. Integración con Alegra

Andrés ya lleva la contabilidad en Alegra, y Alegra es proveedor de facturación electrónica en Costa Rica. La app le pide a
Alegra que cree y emita el comprobante; Alegra lo firma, lo manda a Hacienda y guarda la respuesta.

Documentación pública de la API:

- Crear factura de venta: https://developer.alegra.com/reference/post_invoices (`POST https://api.alegra.com/api/v1/invoices`)
- Emitir varias facturas ya creadas: https://developer.alegra.com/reference/post_invoices-stamp (`POST /invoices/stamp`)
- Facturación electrónica de Alegra en Costa Rica: https://www.alegra.com/costarica/facturacion/

Cómo funciona:

1. Se autentica con usuario (correo) y token de la API de Alegra (autenticación básica).
2. Al crear la factura se manda `stamp: { generateStamp: true }` para que Alegra la emita ante Hacienda. Si sale bien, la
   factura queda abierta y trae los datos del comprobante.
3. Cada línea lleva el id del producto en Alegra, la cantidad, el precio sin impuestos y el id del impuesto.

Lo que hace la app (`src/lib/factura.ts`):

```
cobro verificado (notifyPaid en src/lib/billing.ts)
  └─ enqueueBillingDocument: billing_documents en 'pendiente' (una vez por cobro: charge_id único)
  └─ issueBillingDocument:
       ALEGRA_ENABLED distinto de "1" → no hace nada (sin llamadas a Alegra)
       ALEGRA_ENABLED = "1"           → POST /invoices con stamp; guarda número, clave, PDF → 'emitido'
                                         si Alegra falla → 'error' con el motivo (el cobro y el recibo siguen)
```

Variables de entorno (Andrés las configura en Vercel, nunca van en el código):

- ALEGRA_ENABLED: `1` para emitir. Cualquier otro valor o vacía = apagada.
- ALEGRA_USER y ALEGRA_TOKEN: usuario y token de la API de Alegra.
- ALEGRA_CLIENT_ID: el contacto "consumidor final" en Alegra (para tiquetes).
- ALEGRA_ITEM_ID: el producto "Suscripción Banana Burn" en Alegra, con su CAByS.
- ALEGRA_TAX_ID: el impuesto IVA 13 % en Alegra.

Por verificar en la empresa de prueba de Alegra antes de prender (no lo pudimos confirmar en la documentación pública):

- El nombre del campo con la clave de 50 dígitos y del enlace al PDF en la respuesta. Si la respuesta no trae una clave
  válida, el documento queda en `pendiente` con el id de Alegra y el motivo, para revisarlo a mano.
- Cómo se marca en Alegra que el comprobante es tiquete y no factura (¿numeración distinta?) y cómo se manda la moneda USD.
- Si Alegra le manda el comprobante por correo a la persona o lo hacemos nosotros.

## 6. Recibo por correo

- Con la bandera apagada el recibo no cambia.
- Con la bandera prendida agrega: "Tu comprobante electrónico te llega aparte."

## 7. Para prender la bandera (checklist de Andrés)

1. El contador responde las preguntas 1 a 8.
2. En Alegra: datos del emisor, llave de Hacienda, contacto consumidor final, producto con CAByS e impuesto IVA 13 %.
3. Probar en la empresa de prueba de Alegra con ALEGRA_ENABLED=1 y revisar en `billing_documents` que quede `emitido` con
   número y clave.
4. Configurar las variables en Vercel (producción) y prender ALEGRA_ENABLED.

## 8. Lo que queda para la segunda etapa

- Reintento de los `pendiente` y `error` (por ejemplo en el cron de recordatorios) y de los cobros anteriores a la bandera.
- Campo opcional de cédula en Mi plan para emitir factura en lugar de tiquete.
- Mostrar el comprobante (número y PDF) en el historial de pagos de Mi plan.
- **Pregunta para el contador 9:** cuánto tiempo hay que conservar los comprobantes. Por eso la fila no se borra si la
  persona borra su cuenta (`user_id` queda vacío).
