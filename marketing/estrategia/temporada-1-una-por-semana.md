# Temporada 1: una pieza por semana (noviembre de 2026)

Regla del dueño (#215, 2 nov 2026): Temporada 1 sale **como máximo en una pieza por semana**, y **desde el 23 de noviembre ninguna pieza la vende**, porque la inscripción cierra el 22 (`src/lib/seasons.ts`). Temporada 1 es una segunda compra: compite con la llamada principal de noviembre, «Regístrate y haz tu primer entreno hoy (12 min, también en casa)», que va de noche (20:00 a 22:00).

Es un plan en archivos. No publica, no programa ni borra nada en Business Suite. Andrés aprueba antes de publicar.

- **Qué paso del embudo mueve:** registro → primer entreno. Libera las historias y los carruseles que vendían la temporada para la llamada de noviembre.
- **Cómo se mide:** % de registrados que terminan su primer entreno en 72 h (`workout_saved` de `funnel_events` sobre las cuentas nuevas). Hoy ~3 %, meta 30 %. Las compras de temporada se cuentan aparte, por medir.

## La pieza de cada semana

Semanas de lunes a domingo, hora de Costa Rica.

| Semana | Única pieza de Temporada 1 | Cuándo | Lo que deja de vender la temporada esa semana |
| --- | --- | --- | --- |
| 2 al 8 nov | R04 «La Temporada 1 empieza el 9» (`marketing/videos/R04_temporada-1/`) | A más tardar el domingo 8 | Carrusel C4 del viernes 6 (`comunidad/carruseles.md`); sticker «Conocer Temporada 1» del domingo 8 (`comunidad/2026-11-08.md`); textos del 2 al 8 de `comunidad/temporada-1-ventas.md` |
| 9 al 15 nov | K15 «Tu primer 5K» con la Temporada Running (`marketing/instagram/K15/`) | Entre el lunes 9 y el domingo 15, de 20:00 a 22:00 | Historias y carrusel del lunes 9 (`comunidad/2026-11-09.md`); historia del jueves 12 «Tu anual incluye una temporada»; carrusel K09 Raquetas y Cross del sábado 14 (Business Suite); mención de la inscripción del domingo 15; textos del 9 al 15 de la capa de ventas |
| 16 al 22 nov | K12 «Cierre de inscripciones» (Business Suite, ya programado) | Viernes 20, 7:00 p. m. | Carrusel P-Cross del miércoles 18; historias del viernes 20 y del domingo 22; R12 (sin producir); escenas de la Temporada Running en R09 (ahora piden el primer entreno); textos del 16 al 22 de la capa de ventas |
| Desde el 23 nov | Ninguna | | K15 y A03 no se publican ni se promocionan. A03 queda archivado hasta que exista Temporada 2. R15 no vende la inscripción. Las respuestas a dudas dicen que la inscripción cerró y no enlazan a la compra |

El carrusel K03 Temporadas estaba programado para el domingo 1 de noviembre, antes de esta revisión.

## Qué se marcó en cada archivo

Nada se borró. Los archivos archivados y los planes semanales llevan arriba un aviso con «#215» y un enlace a este documento; los ajustes de una línea van directo en el texto.

- Archivados: `comunidad/2026-11-09.md`, `comunidad/2026-11-20.md`, `comunidad/2026-11-22.md`, `comunidad/temporada-1-ventas.md` (salvo el banco de respuestas R1 a R5), el carrusel C4 de `comunidad/carruseles.md`, `videos/A03_temporada-incluida/` (hasta Temporada 2), K09 en el calendario de Business Suite y R12 en el kit de Reels.
- Ajustados: `comunidad/2026-11-08.md` y `2026-11-12.md` (sin Temporada), `2026-11-15.md` (sin la mención de la inscripción), `2026-11-18.md` (sin el carrusel P-Cross), `respuestas.md` (después del 22 no se enlaza a la compra), `semana-2026-11-09.md` y `semana-2026-11-16.md`, R09 (escenas y pie de foto de primer entreno), R04 y K15 (ventana de publicación) y el calendario de Business Suite (K12 como pieza de la semana).
- K15: la lámina 5 y el pie de foto dicen «USD, IVA incluido» y la fecha de cierre (lámina renderizada de nuevo).

## Pendiente fuera de este cambio

Los dos correos de cierre de Temporada 1 (16 y 21 nov, `docs/emails/temporada-1-cierre.md`) los envía el código (`src/lib/notify-run.ts`, `src/lib/temporada-cierre.ts`) y su texto tiene que coincidir con `src/lib/email/templates.ts`. Son correos, no piezas de redes, pero también venden la temporada y dicen «Precios en USD.» sin «IVA incluido». Para mandarlos solo a quien ya terminó un entreno y agregar el IVA hace falta un cambio de código en un issue aparte.
