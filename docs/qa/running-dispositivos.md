# Running en celulares reales: checklist

Para Andrés. Cubre la pantalla Correr (`/app/correr`) en iPhone con Safari, iPhone con la app instalada y Android
(Chrome y la app). Revisa voz, aviso por km, modo carrera, pantalla encendida y pérdida de señal. Cada paso trae lo que
debe pasar; si pasa otra cosa, márcalo como falla y anota qué viste.

Las pruebas automáticas de la lógica (parciales, recorte de 200 m, puntos perdidos y relación con el plan) están en
`src/lib/runs.test.ts`, `src/lib/runs-qa.test.ts` y `src/lib/run-plan.test.ts`. Este checklist cubre lo que solo se
ve en un teléfono de verdad.

## Antes de salir

- Una cuenta con plan o prueba activa (sin eso no se guardan carreras).
- Para el modo carrera: la Temporada Running y una meta de carrera en `/app/correr/objetivo`.
- Volumen alto, sin modo silencio (en iPhone, el interruptor lateral sin el naranja) y sin audífonos al principio.
- Batería sobre 30 % y sin ahorro de batería (en los dos sistemas apaga el bloqueo de pantalla y el GPS en segundo
  plano).
- Ubicación del teléfono encendida y con ubicación exacta (precisa).
- Un recorrido al aire libre de 2.5 km o más, con un túnel, un paso bajo puente o un parqueo subterráneo donde se
  pierda la señal unos 40 s o más.
- Caminar sirve para casi todo; los avisos por km llegan igual, solo que más lento.

## Cómo anotar

En cada tabla, pon en Resultado `OK` o `Falla: lo que pasó`. Al final, anota modelo del teléfono, versión del
sistema y del navegador o de la app, y la fecha.

## A. iPhone en Safari

Abre `https://www.bananaburn.app/app/correr` en Safari (no desde la pantalla de inicio).

| # | Caso | Paso | Resultado esperado | Resultado |
|---|------|------|--------------------|-----------|
| A1 | Permiso | Toca "Empezar carrera" y permite la ubicación. | Safari pide la ubicación. Sale "Buscando señal de GPS" con la precisión en metros y, al bajar de 30 m, empieza a contar el tiempo. | |
| A2 | Voz | Con "Avisarme cada km en voz alta" marcado, toca "Empezar carrera". | Al tocar se oye "Vamos." en español latino (no con acento de España). | |
| A3 | Voz apagada | Desmarca "Avisarme cada km en voz alta", recarga la página y empieza. | La casilla sigue desmarcada después de recargar y no se oye nada en toda la carrera. Vuelve a marcarla al terminar. | |
| A4 | Aviso por km | Corre o camina 1 km con la voz encendida y la pantalla encendida. | Al llegar a 1.00 km se oye "Kilómetro 1, ritmo" y tu ritmo de ese km en minutos y segundos. Aparece "Km 1" en la lista de parciales con el mismo ritmo y "Parciales" pasa a 1. No vibra (Safari no deja vibrar). | |
| A5 | Aviso por km, segundo km | Sigue hasta 2.00 km. | Se oye "Kilómetro 2" una sola vez, con el ritmo del km 2 (no el promedio). | |
| A6 | Pantalla encendida | Deja el teléfono en la mano sin tocarlo 2 minutos (más que el bloqueo automático). | La pantalla no se apaga. Si sale "Tu navegador no deja mantener la pantalla encendida", anota la versión de iOS (hace falta iOS 16.4 o más). | |
| A7 | Volver a la app | Cambia a otra app 10 s y vuelve a Safari. | La pantalla vuelve a quedarse encendida sola (repite A6 un minuto). La distancia no salta. | |
| A8 | Teléfono bloqueado | Bloquea el teléfono, camina 1 minuto y desbloquea. | En Safari el GPS no mide bloqueado: la distancia no suma ese minuto. En el mapa queda un corte, sin una recta que una los dos lados. La carrera sigue al desbloquear. | |
| A9 | Pérdida de señal | Pasa por el túnel o parqueo (40 s o más sin señal). | Mientras no hay señal, el ritmo actual puede quedar en "--:--". Al salir, sigue sumando. En el mapa, corte sin recta; la distancia no salta más de lo que caminaste afuera. | |
| A10 | Pausa | Toca "Pausar", camina 100 m y toca "Seguir". | En pausa no suma distancia ni tiempo. Al seguir, el mapa no une con una recta el punto de pausa y el de regreso. | |
| A11 | Modo carrera | Ve a `/app/correr/carrera`, toca "Probar el modo carrera". Deja marcado "Modo carrera" y "Voz en español", y empieza. | Al tocar se oye "Vamos. Buscando señal de GPS." y, al encontrar señal, el primer tramo: "Ahora 1 kilómetro a ritmo de carrera" con el ritmo de tu meta (si dice "1 kilómetros", anótalo como falla). En pantalla: "Modo carrera. Tramo 1 de N", lo que falta en metros, "Ritmo objetivo" y "Tu ritmo" con texto ("Vas más rápido", "En ritmo" o "Vas más lento"), y "Km 1: pasa en" con el tiempo de tu tabla. | |
| A12 | Modo carrera, km | Llega a 1.00 km. | Se oye el tramo siguiente y "Kilómetro 1, ritmo" con tu ritmo y "Justo en tu plan" (menos de 5 s de diferencia) o "N segundos adelante de tu plan" o "atrás de tu plan". En pantalla, "Vas N s adelante", "atrás" o "justo en tu plan", igual a lo que dijo la voz. | |
| A13 | Modo carrera, aviso de ritmo | Corre un km claramente más rápido o más lento que la meta. | Pasado el primer minuto de carrera y 20 s del tramo, como mucho una vez por minuto, se oye "Un poco más suave." o "Sube un poco el ritmo." | |
| A14 | Terminar | Toca una vez "Terminar". Luego mantenlo presionado. | Un toque no termina. Manteniendo 1 s se llena la barra y guarda. Llega al detalle de la carrera. | |
| A15 | Detalle y privacidad | En el detalle, mira el mapa y los parciales. | El mapa no empieza ni termina donde saliste o llegaste: faltan unos 200 m en cada punta, y dice "Por tu privacidad, el mapa no muestra los primeros ni los últimos 200 m". Los parciales son los mismos de la carrera; el último, si sobraron 100 m o más, dice "Últimos N m". | |
| A16 | Sin internet al terminar | Empieza una carrera corta (300 m o más), pon modo avión y mantén "Terminar". | Sale un mensaje que termina en "Quedó guardada en tu teléfono." y el botón "Intentar guardar de nuevo". Quita el modo avión y tócalo: guarda. Si el mensaje empieza con texto en inglés ("Load failed"), anótalo como falla. | |
| A17 | Cerrar a mitad | Empieza, camina 300 m, cierra la pestaña y vuelve a abrir `/app/correr`. | Sale "Tienes una carrera sin guardar" con la distancia, y los botones "Guardarla", "Seguir corriendo" y "Descartar". "Seguir corriendo" sigue sumando sobre lo anterior. | |

## B. iPhone con la app instalada

La app de Banana Burn desde TestFlight (o Xcode). La app mide también con el teléfono bloqueado o en otra app.

Si en vez de la app usas Safari, "Compartir" y "Agregar a inicio", se porta como Safari: repite la sección A en esa
versión y anota aparte lo que cambie.

| # | Caso | Paso | Resultado esperado | Resultado |
|---|------|------|--------------------|-----------|
| B1 | Permiso | Correr, "Empezar carrera". | iOS pide la ubicación con las opciones de "Al usar la app" (nunca pide "Siempre"). Elige "Al usar la app" con "Ubicación exacta". | |
| B2 | Texto de la pantalla | Antes de empezar, lee la lista. | Dice "Puedes bloquear el teléfono o abrir otra app: seguimos midiendo hasta que termines". | |
| B3 | Permiso negado | En Ajustes, Banana Burn, Ubicación, elige "Nunca" y vuelve a empezar. | Sale "Banana Burn no tiene permiso de ubicación." con los pasos de iPhone y el botón "Abrir ajustes", que abre los ajustes de la app. Vuelve a "Al usar la app". | |
| B4 | Voz | Con la voz encendida, toca "Empezar carrera". | Se oye "Vamos." en español latino. | |
| B5 | Aviso por km | 1 km con la pantalla encendida. | Igual que A4: "Kilómetro 1, ritmo" y el ritmo, "Km 1" en la lista. | |
| B6 | Teléfono bloqueado | Bloquea el teléfono y camina unos 3 minutos. | Arriba aparece el indicador azul de ubicación. Al desbloquear, la distancia siguió sumando lo caminado, sin corte en el mapa. | |
| B7 | Voz con el teléfono bloqueado | Pasa un km entero con el teléfono bloqueado. | Lo ideal es oír "Kilómetro N". Puede quedarse callada (está anotado como pendiente en `docs/app-nativa.md`): anota si habló o no, y si habló tarde al desbloquear. | |
| B8 | En otra app | Abre Música u otra app 2 minutos y vuelve. | La distancia siguió sumando. | |
| B9 | Pérdida de señal | Pasa por el túnel o parqueo. | Igual que A9: corte sin recta, sin saltos de distancia. | |
| B10 | Modo carrera | Igual que A11 a A13 desde `/app/correr/carrera`. | Lo mismo que en Safari. | |
| B11 | Terminar y detalle | Igual que A14 y A15. | Lo mismo que en Safari. Al terminar desaparece el indicador azul de ubicación. | |
| B12 | Salir de Correr a mitad | Empieza una carrera, ve a otra pestaña de la app (por ejemplo Hoy) y espera 1 minuto. | El indicador azul se apaga al salir de Correr. Al volver a Correr sale "Tienes una carrera sin guardar". | |

## C. Android en Chrome

Abre `https://www.bananaburn.app/app/correr` en Chrome.

| # | Caso | Paso | Resultado esperado | Resultado |
|---|------|------|--------------------|-----------|
| C1 | Permiso | "Empezar carrera" y permite la ubicación. | Chrome pide la ubicación; después, igual que A1. | |
| C2 | Permiso bloqueado | Bloquea la ubicación desde el candado de la dirección y vuelve a empezar. | Sale "El permiso de ubicación está bloqueado." con los pasos de iPhone y de Android. Vuelve a permitirla. | |
| C3 | Voz | Con la voz encendida, empieza. | Se oye "Vamos." en español latino. Si no hay voz en español instalada, anota qué voz se oyó. | |
| C4 | Aviso por km | 1 km con la pantalla encendida. | Igual que A4. | |
| C5 | Vibración en modo carrera | En el modo carrera (A11), llega a 1 km. | Vibra al cambiar de tramo (dos pulsos) y al pasar el km (uno corto), además de la voz. | |
| C6 | Pantalla encendida | 2 minutos sin tocar el teléfono. | La pantalla no se apaga. | |
| C7 | Volver a Chrome | Cambia de app 10 s y vuelve. | La pantalla vuelve a quedarse encendida (repite C6 un minuto). | |
| C8 | Teléfono bloqueado | Bloquea, camina 1 minuto y desbloquea. | Como en A8: no suma ese minuto y queda un corte sin recta. | |
| C9 | Pérdida de señal | Túnel o parqueo. | Igual que A9. | |
| C10 | Modo carrera | A11 a A13. | Lo mismo que en Safari, con vibración. | |
| C11 | Terminar, detalle, sin internet y cerrar a mitad | A14 a A17. | Lo mismo que en Safari. Sin internet, el mensaje puede empezar con "Failed to fetch": anótalo como falla si sale en inglés. | |

## D. Android con la app instalada

La app de Banana Burn (APK de Actions o Google Play cuando esté).

| # | Caso | Paso | Resultado esperado | Resultado |
|---|------|------|--------------------|-----------|
| D1 | Permiso | "Empezar carrera". | Android pide la ubicación: elige "Mientras se usa la app" y "Ubicación precisa". | |
| D2 | Permiso negado | En Ajustes, Banana Burn, Permisos, Ubicación, elige "No permitir" y vuelve a empezar. | Sale "Banana Burn no tiene permiso de ubicación." con los pasos de Android y "Abrir ajustes". | |
| D3 | Texto de la pantalla | Antes de empezar, lee la lista. | Dice que puedes bloquear el teléfono y "(verás un aviso fijo de Banana Burn)". | |
| D4 | Voz y aviso por km | Igual que C3 y C4. | Lo mismo que en Chrome. | |
| D5 | Teléfono bloqueado | Bloquea y camina 3 minutos. | Queda el aviso fijo "Midiendo tu carrera". Al desbloquear, la distancia siguió sumando, sin corte. | |
| D6 | Más de 5 minutos bloqueado | Bloquea y camina 7 minutos. | Al desbloquear, la distancia sumó todo el tramo (después de 5 minutos no debe dejar de recibir puntos). | |
| D7 | Voz con el teléfono bloqueado | Un km entero bloqueado. | Como en B7: anota si habló o no. | |
| D8 | Pérdida de señal | Túnel o parqueo. | Igual que A9. | |
| D9 | Modo carrera | A11 a A13. | Lo mismo que en Chrome, con vibración. | |
| D10 | Terminar | A14 y A15. | Lo mismo que en Safari. Al terminar desaparece el aviso fijo. | |

## Datos del teléfono

| Sección | Teléfono | Sistema | Navegador o app | Fecha |
|---------|----------|---------|-----------------|-------|
| A | | | | |
| B | | | | |
| C | | | | |
| D | | | | |
