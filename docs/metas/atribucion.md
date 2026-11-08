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
