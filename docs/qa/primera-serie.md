# Primera serie del primer entreno (#273)

Datos del 5 y 6 nov 2026: de 6 que vieron Hoy, 5 abrieron el entreno (`workout_open`) y solo 3 hicieron la primera serie
(`workout_first_set`). Esta revisión mira qué ve una persona que nunca entrenó entre esos dos eventos, en un celular de
375 px de ancho.

**Límite de evidencia:** el sandbox no tiene navegador, así que no hay capturas. Las alturas salen de las clases de
`src/components/workout/guided.tsx` y `src/app/(app)/app/entreno/player.tsx`, con dos altos de pantalla: 667 px (app
instalada en un iPhone SE) y 553 px (Safari en el mismo teléfono, con sus barras). Repetir en un teléfono real antes de
dar por cerrada la fuga.

## Qué pasa entre `workout_open` y `workout_first_set`

1. **Pantallas:** una sola. Desde "¿Entrenamos ahora?" (`/app/primer-entreno`) o Hoy, el botón lleva directo a
   `/app/entreno` (o `?casa=1`). El primer entreno usa el modo guiado (#226): un ejercicio por pantalla, sin tarjeta previa,
   sin calentamiento y sin lista de series. Solo si ya hizo esa plantilla hoy aparece antes el aviso de "Ya hiciste".
2. **Toques:** 2 en total. Uno en Hoy y uno en el botón grande "Terminé la serie" (80 px de alto, fijo en el pie). Las
   series por tiempo piden "Empezar" y después "Terminé la serie".
3. **Lo que se ve, de arriba hacia abajo:** salir y "Ejercicio 1 de 3" con su barra; el movimiento en grande (botón "Ver
   cómo se hace"); el nombre del ejercicio; la clave de técnica; la tarjeta "Serie 1 de 2 · 10 repeticiones" con qué hacer;
   el peso sugerido con menos y más (solo si el ejercicio usa peso). El botón queda fijo abajo.
4. **Primeros ejercicios del plan:** gym y mixto: Sentadilla goblet (mancuerna, 6 kg sugeridos), Press inclinado con
   mancuernas y Jalón al pecho (máquina). En casa con mancuernas: Sentadilla goblet, Press de piso y Remo con mancuerna.
   Sin equipo: Sentadilla con peso corporal, Flexiones y Puente de glúteo, sin peso.

### Alturas antes del cambio (Sentadilla goblet, gym)

| Bloque | Alto aprox. | Termina en (667 px) | Termina en (553 px) |
|---|---|---|---|
| Encabezado (salir, ejercicio 1 de 3, barra) | 70 px | 70 | 70 |
| Movimiento (34 % del alto) | 12 + 227 / 188 px | 309 | 270 |
| Nombre | 47 px | 356 | 317 |
| Clave (2 líneas) | 48 px | 404 | 365 |
| Tarjeta de la serie | 111 px | 515 | 476 |
| Peso sugerido (tarjeta aparte) | 76 px | 591 | 552 |
| Pie con "Terminé la serie" | 109 px | fijo | fijo |

Lo visible sin desplazarse termina donde empieza el pie: 558 px con la app instalada y 444 px en Safari.

## Lo que frenaba

- **El peso sugerido quedaba debajo del pliegue.** Con 667 px se cortaba la mitad de la fila; en Safari no se veía nada
  y la instrucción de la serie quedaba cortada. Quien entra al gym por primera vez no sabe qué mancuerna tomar, y la
  pantalla no se lo decía hasta desplazarse.
- **Sin salida si no reconoce la máquina.** El guiado quitó "Cambiar" para simplificar (#226). Con "Jalón al pecho" o una
  mancuerna que no encuentra, la única salida era la X.
- **No se sabía si se iban antes o después de ver el ejercicio.** Entre `workout_open` y `workout_first_set` no había
  ningún evento.

Lo que ya estaba bien y no se tocó: la primera serie arranca con un solo toque grande; en casa sin equipo no pide peso
(el ejercicio no usa carga y el guiado no exige kilos); el movimiento está arriba y se ve sin desplazarse; no hay pantalla
previa.

## Cambios

1. **Peso sugerido dentro de la tarjeta de la serie**, justo debajo de "Serie 1 de 2 · 10 repeticiones", en el mismo tamaño
   (20 px, extra negrita): "6 kg" y debajo "Sugerido. Ajústalo si quieres." (el mismo texto que cita el anuncio del 9 de noviembre) con menos y más de 48 px. La clave de técnica pasa
   debajo de la tarjeta. El movimiento conserva su tamaño y el botón sigue siendo uno solo.
2. **"¿No conoces este equipo? Usa otro"**, un botón secundario debajo de la clave. Abre la lista de "Cambiar ejercicio"
   que ya existía (mismo patrón, mismas series), así que no es una pantalla nueva ni cambia el plan. Sale solo si el
   ejercicio usa peso y tiene alternativas (o si ya se cambió, para poder volver). Sin equipo no aparece, y con el reloj
   corriendo se oculta.
3. **Evento `workout_first_set_view`**: se registra una vez por entreno abierto, cuando la persona ve el primer ejercicio
   sin series hechas (después de leer lo guardado en el teléfono y del aviso de "Ya hiciste"). Lleva `first_session`,
   `template` y `guided`.

### Alturas después del cambio

| Bloque | Termina en (667 px) | Termina en (553 px) |
|---|---|---|
| Nombre | 356 | 317 |
| Serie (línea) | 396 | 357 |
| Peso sugerido con menos y más | 464 | 425 |
| Qué hacer (2 líneas) | 521 | 482 |
| Clave y "Usa otro" | 640 | 601 |

Ahora el peso sugerido se ve sin desplazarse en los dos altos. La clave y "Usa otro" son secundarios y piden desplazar un
poco en pantallas bajas. El movimiento, el nombre, la serie, el peso y el botón grande no lo piden.

## Cómo se mide

- `workout_first_set_view / workout_open` del primer entreno (`first_session: true`): si es bajo, se van antes de ver el
  ejercicio (carga, error o la pantalla anterior).
- `workout_first_set / workout_first_set_view`: si es bajo, ven el ejercicio y no hacen la serie. Es la fuga que atacan
  estos cambios.
- `exercise_swap` con `guided: true`: cuántos usan "Usa otro" en el primer entreno.
- Seguir mirando el primer `workout_saved` completo, para que una primera serie más fácil no termine en menos entrenos
  guardados.
