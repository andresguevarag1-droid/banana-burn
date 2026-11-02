# Activación: 10 piezas nuevas de noche (3 al 22 de noviembre de 2026)

BORRADORES PARA ANDRÉS. Nada se publica, programa ni responde sin su aprobación escrita por pieza y canal. $0 en anuncios: son piezas orgánicas para Instagram @bananaburnapp y la página de Facebook "Banana Burn". Hora de Costa Rica (UTC-6).

Son las 10 piezas que faltaban según el informe de revisión de #202 (sección 3). Todas empujan el mismo paso: **registrarse y terminar el primer entreno**. Llamada principal: «Regístrate y haz tu primer entreno hoy (12 min, también en casa)», siempre entre las 20:00 y las 22:00, que es cuando llega la gente.

## Calendario

| # | Fecha y hora | Formato | Pieza | Pieza del informe | Qué deja libre en Business Suite |
| --- | --- | --- | --- | --- | --- |
| 01 | Mar 3 nov, 20:00 | Reel + historia destacada | [Tu primer entreno de 12 minutos en casa](01-2026-11-03-primer-entreno-en-casa.md) | n.º 1 | Borra «10 minutos en casa» de las 7:00 p. m. |
| 02 | Mié 4 nov, 21:00 | Historia (2 pantallas) | [Abriste la app y no sabes qué tocar](02-2026-11-04-no-sabes-que-tocar.md) | n.º 5 | Nada |
| 03 | Jue 5 nov, 21:00 | Historia con encuesta | [Haz solo la primera serie](03-2026-11-05-solo-la-primera-serie.md) | n.º 7 | Nada |
| 04 | Sáb 7 nov, 20:00 | Carrusel de 6 láminas | [Qué pasa en tu día 1](04-2026-11-07-que-pasa-en-tu-dia-1.md) | n.º 3 | Borra «Cuánto descansar entre series» de las 7:00 p. m. |
| 05 | Mié 11 nov, 20:00 | Post fijado (carrusel de 4 láminas) | [Cuánto cuesta, precio honesto](05-2026-11-11-precio-honesto.md) | n.º 8 | Borra «Qué plan elegir» de las 7:00 p. m. |
| 06 | Vie 13 nov, 21:00 | Reel | [De noche también cuenta](06-2026-11-13-de-noche-tambien-cuenta.md) | n.º 6 | Nada (no hay post a las 7:00 p. m.) |
| 07 | Sáb 14 nov, 20:30 | Reel corto + historia | [Esto ves cuando terminas](07-2026-11-14-entreno-completado.md) | n.º 10 | Borra K09 Raquetas y Cross de las 7:00 p. m. |
| 08 | Lun 16 nov, 20:00 | Reel de 20 a 30 s | [Mi primer entreno (persona real)](08-2026-11-16-mi-primer-entreno-real.md) | n.º 2 | Nada (no hay post a las 7:00 p. m.) |
| 09 | Jue 19 nov, 20:30 | Reel largo grabado | [Haz conmigo el entreno](09-2026-11-19-haz-conmigo-el-entreno.md) | n.º 4 | Borra K11 Administradores de condominio de las 7:00 p. m. |
| 10 | Dom 22 nov, 20:00 | Reel con El Nuevo | [Sin gym, sin pena, sin saber](10-2026-11-22-sin-gym-sin-pena.md) | n.º 9 | Nada (Business Suite termina el 21) |

El orden sigue la urgencia: primero lo que lleva a la primera serie (01 a 04), después el precio (05) y al final lo que necesita más producción o una persona real (08 a 10). Los borrados de Business Suite están en [docs/metas/business-suite-cambios.md](../../../docs/metas/business-suite-cambios.md) (filas 4, 10, 16, 21 y 26).

## Qué es verdad en la app (no prometer más)

- Registro con 7 días gratis y sin tarjeta. Guardar la tarjeta es opcional: con ella, el primer mes del plan mensual va al 50 % ($4.99 o $7.49), solo si la guardas antes del primer cobro y una vez por cuenta. No aplica al anual (`src/lib/trial.ts`).
- La bienvenida pregunta qué quieres lograr, dónde entrenas y cuánta experiencia tienes (`src/app/bienvenida/wizard.tsx`). Al terminarla se abre Hoy.
- El primer día, Hoy muestra solo el saludo y el primer entreno. El botón dice «Empezar mi primer entreno (N min)». Si entrenas en gym, aparece también «¿No estás en el gym? Hazlo en casa ahora (12 min, sin equipo)», primero si te registraste de noche (`src/components/readiness.tsx`). Los minutos son una estimación a tu ritmo.
- El reproductor te guía ejercicio por ejercicio, con el descanso marcado y aviso de los últimos 10 segundos. Al terminar dice «Lo lograste» y la pantalla final, «Entreno completado» (`src/components/workout/recap.tsx`).
- Precios: Entreno $9.99 al mes o $59.99 al año; Entreno + Nutrición $14.99 al mes o $89.99 al año. USD, IVA incluido (`src/lib/plans.ts`).

## Reglas de todas las piezas

- Capturas y grabaciones de pantalla reales de la app, sin cambiar ningún número, dentro de un marco de teléfono ink de radio 42. Si se graba con una cuenta de prueba, que sea una cuenta nueva sin entrenos, para que se vea el primer día de verdad.
- Reel: 1080 × 1920, 30 fps, H.264. Gancho en el segundo 0 a 1, sin logo al inicio, un cambio visual cada 1.5 a 2.5 s, máximo 8 palabras por pantalla, cierre de 3 s con Coach Banana y el botón ink «Empieza 7 días gratis en bananaburn.app». Portada legible recortada a 1080 × 1350.
- Historia: 1080 × 1920, 250 px libres arriba y 350 abajo. Los stickers (enlace, encuesta) se ponen desde el celular, nativos; nunca dibujados.
- Carrusel: 1080 × 1350, fondos lisos paper, banana o ink, títulos Plus Jakarta Sans 800, última lámina con la llamada a la acción.
- Solo Coach Banana, Coach Platanita y El Nuevo, nunca como clientes. Sin emojis en el arte, sin IA, sin testimonios inventados, contadores, escasez, antes y después ni WhatsApp. «banana», nunca «banano». Sin guiones largos.
- Duración: siempre 12 min. No usar 10, 15 ni 15–20 min.
- Pie de foto con enlace a bananaburn.app y #BananaBurn más 4 del tema.

## Medición

Paso del embudo: registro y primer entreno terminado. Indicador que manda: % de registrados que terminan su primer entreno en 72 h (hoy ~3 %, meta 30 %).

Por pieza, a las 24 h, Andrés anota de las estadísticas de Instagram y Facebook: alcance, reproducciones, clics de enlace, guardados y compartidos. El equipo con acceso suma, en las 24 h siguientes a la salida, las cuentas nuevas y los primeros `workout_open`, `workout_first_set` y `workout_saved` por persona en `funnel_events`, con `workouts.finished_at` como prueba de entreno terminado (consulta en [docs/activacion-primer-entreno.md](../../../docs/activacion-primer-entreno.md)). Son agregados del día: no se atribuye a una pieza un registro ni un pago, porque las UTM de `/r/<código>` se pierden.

Resultados: **por medir**. Ninguna cifra de resultado está escrita aquí.

## Coordinación

- #214 reescribe la comunidad del 9 nov al 6 dic. Si cambia sus horas de noche, estas piezas mantienen su hora y la historia de comunidad de esa noche se mueve 30 min.
- #213 corrige la regla de referidos: estas piezas no hablan de referidos.
- #215 lleva Temporada 1, GLP-1 y precios: la pieza 05 usa los precios de `src/lib/plans.ts` con «USD, IVA incluido».
