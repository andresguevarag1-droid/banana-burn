# Atribución: de qué anuncio viene cada registro (#283)

Para saber cuánto deja cada dólar de Meta, por anuncio y por país, en /admin/embudo.

## Qué poner en cada anuncio de Meta

En el Administrador de anuncios, dentro de cada anuncio, en **Destino > Parámetros de URL**, pega exactamente:

```
utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}
```

- Meta cambia `{{campaign.name}}` y `{{ad.name}}` por el nombre de la campaña y del anuncio. Ponles nombres cortos y claros (por ejemplo "Primer entreno nov" y "Video 12 min casa"): así salen en los filtros **Campaña** y **Anuncio** del embudo.
- No hace falta agregar `fbclid`: Meta lo agrega solo. Una visita con `fbclid` y sin utm también cuenta como Anuncio.
- Sirve para cualquier página pública: la landing, /precios, /glp1, /c/[código], etc.
- Para otras fuentes pagadas usa el mismo formato con su nombre en `utm_source` (por ejemplo `utm_source=tiktok&utm_medium=paid`).

## Qué se guarda

1. En la primera visita que trae `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` o `fbclid`, el navegador guarda una cookie de primer contacto (`bb_ft`) con esos valores, la página de llegada y la fecha. Dura 30 días, es SameSite=Lax y no se pisa: gana el primer anuncio, no el último.
2. Al crear la cuenta (con correo o con Google), el servidor la guarda una sola vez en `signup_attribution` (migración 0069). Solo cuentas de menos de 72 h.
3. Solo los parámetros de la URL, la página y la fecha: sin IP, sin user agent, sin datos personales nuevos. Cada valor tiene máximo 200 caracteres.
4. La persona no puede leer la tabla; solo el servidor y el staff (para el embudo).

## Cómo se lee en /admin/embudo

- **Origen = Anuncio** si la cuenta tiene `signup_attribution` con utm de campaña o fbclid, o si llegó por un enlace de referidor con utm. Condominio manda sobre Anuncio.
- **Campaña** (`utm_campaign`) y **Anuncio** (`utm_content`): solo aparecen los valores que existen en las 8 semanas.
- Junto con el filtro **País** y el gasto de la semana, da el ingreso neto por campaña o anuncio para compararlo con lo gastado.

Las cuentas creadas antes de esta versión quedan como Orgánico salvo que vinieran de un referidor: la atribución empieza a contar desde que se aplica 0069.

## Qué evento recibe Meta en cada momento (#331)

El píxel (navegador) y la API de Conversiones (servidor) mandan el mismo `event_id`, así Meta cuenta cada evento una vez. Desde la app nativa no va nada a Meta. Nunca se manda correo, teléfono, id de la persona en claro ni datos de salud.

| Momento | Evento de Meta | Valor | event_id | Desde dónde |
| --- | --- | --- | --- | --- |
| Toca un botón de registro o de planes | `Lead` | sin valor | aleatorio | píxel y servidor (`/api/track`) |
| Termina la bienvenida | `CompleteRegistration` | sin valor | aleatorio | píxel y servidor, una vez por cuenta |
| Ve el muro de planes | `ViewContent` | sin valor | aleatorio | píxel y servidor |
| Abre el pago o el formulario de la tarjeta | `InitiateCheckout` | precio del plan | aleatorio | píxel y servidor |
| Guarda la tarjeta | `AddPaymentInfo` | sin valor | aleatorio | píxel y servidor |
| **Guarda la tarjeta y empieza la prueba** (bienvenida, Mi plan, primera serie, condominio, vuelta de Tilopay) | **`StartTrial`** | `value` = primer cobro (por ejemplo 4.99 con el 50 %), `predicted_ltv` fijo | `trial-<id del cobro programado>` | servidor al guardar (`/api/pagos/tarjeta` o vuelta de Tilopay) y píxel en la misma pantalla o en Mi plan |
| Compra directa en /pago/checkout | `Subscribe` | precio del plan | `buy-<suscripción>` | píxel de /pago/exito y servidor (webhook o vuelta de Tilopay) |
| Primer cobro real de la prueba (día 8) y renovaciones | `Subscribe` | lo cobrado en USD (con el 50 % si aplica, por ejemplo 4.99 o 7.49) | id del cobro (`onvo.first:<sub>` o el `event_key`) | solo servidor (`system_generated`) |

`StartTrial` solo sale cuando la tarjeta crea el cobro programado de la prueba (o del fin de la beta). No sale al cambiar la tarjeta, al volver a guardarla ni cuando la prueba ya terminó y el cobro es inmediato: ese caso es un `Subscribe` cuando se aprueba.

**predicted_ltv de StartTrial:** plan mensual = precio mensual × 3 (`TRIAL_LTV_MONTHS` en `src/lib/meta-pixel.ts`): Entreno 29.97, Entreno + Nutrición 44.97. Plan anual = precio del año (59.99 u 89.99).

Para optimizar los anuncios por quien deja la tarjeta y empieza la prueba, el evento de conversión de la campaña es `StartTrial` (lo decide Andrés el 23 de noviembre).
