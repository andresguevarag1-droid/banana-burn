# E03 "Sientes que todos te miran": guion

Capítulo 3 de la serie El Nuevo. Tema: principiantes en el gym del condominio. Estado: **borrador para revisión de marca. No se publica sin la aprobación por escrito de Andrés.**

## Formato (el de V02, monos que hablan)

- Reel de 23 s, 1080 x 1920, 30 fps, MP4 H.264, sin audio. El audio en tendencia se pone al publicar. No hay voces humanas, narración grabada ni testimonios.
- Seis imágenes fijas de Higgsfield (T1 a T6, ver `prompts-higgsfield.md`) animadas en código: acercamientos, paneos y cortes.
- Los monos "hablan" con globos de diálogo (tarjeta blanca, borde ink y cola hacia quien habla). El narrador es un rótulo ink con letra cream. Los globos y rótulos son los subtítulos: todo lo que se dice está escrito.
- Solo aparecen El Nuevo, Coach Banana y Coach Platanita. Platanita no habla: está al fondo, en su serie.
- Lugar: el gym del condominio (máquinas, rack de mancuernas, pared de espejos y ventanal con plantas tropicales), igual en las seis tomas.
- Textos entre y = 250 y y = 1570 (zona segura). Máximo 8 palabras por pantalla; un cambio visual cada 2 s.

## Reel de 23 s

| Tiempo | Toma | Lo que se ve | Subtítulo (quién) | Palabras |
| --- | --- | --- | --- | --- |
| 0.0 a 2.0 | T1 | El Nuevo congelado en la puerta del gym, mochila puesta. Tarjeta banana completa desde el cuadro 0 | POV: sientes que todos te miran (rótulo del gancho) | 6 |
| 2.0 a 4.0 | T1 | Golpe de cámara a la cara de El Nuevo, ojos de reojo | ¿Me están mirando todos? (El Nuevo) | 4 |
| 4.0 a 6.0 | T2 | Pared de espejos: El Nuevo repetido en cada espejo | Y encima, espejos por todos lados (El Nuevo) | 6 |
| 6.0 a 8.0 | T2 | Paneo lento por los reflejos: todos son él | Spoiler: el único que te mira eres tú (narrador) | 8 |
| 8.0 a 10.0 | T3 | Coach Banana le pone la mano en el hombro | Nadie te está mirando. Respira. (Coach Banana) | 5 |
| 10.0 a 12.0 | T4 | Gym abierto. Al fondo, Coach Platanita en su serie con audífonos | Cada quien viene a lo suyo. (Coach Banana) | 5 |
| 12.0 a 14.0 | T4 | Golpe de cámara a Platanita, concentrada, sin mirar a nadie | Ella está en su serie, no en ti (narrador) | 8 |
| 14.0 a 16.0 | captura real | Teléfono ink con la captura real del entreno (`public/landing/entreno.png`); aro banana en "10 a 12 repeticiones con 20 kg" | Tú, a lo tuyo: tu serie de hoy (narrador) | 8 |
| 16.0 a 18.0 | T5 | El Nuevo hace su primera sentadilla con mancuerna, concentrado | Primera serie. Nadie miró. (narrador) | 4 |
| 18.0 a 20.0 | T6 | Choque de puños de Coach Banana y El Nuevo | Todos empezamos así. (Coach Banana) | 3 |
| 20.0 a 23.0 | cierre | Fondo paper. Coach Banana señalando, botón ink y logo | Empieza 7 días gratis en bananaburn.app / BananaBurn | 7 |

El cierre "Todos empezamos así" va en dos tiempos: Coach Banana lo dice en T6 y enseguida entra el cierre de 3 s de la marca. Juntos en una pantalla serían 10 palabras, y el máximo es 8.

## Versión de 15 s para anuncios

El mismo chiste con un cambio cada 1.5 s. Se quitan el globo de los espejos y el acercamiento a Platanita.

| Tiempo | Toma | Subtítulo | Palabras |
| --- | --- | --- | --- |
| 0.0 a 1.5 | T1 | POV: sientes que todos te miran | 6 |
| 1.5 a 3.0 | T1 (cara) | ¿Me están mirando todos? | 4 |
| 3.0 a 4.5 | T2 (reflejos) | Spoiler: el único que te mira eres tú | 8 |
| 4.5 a 6.0 | T3 | Nadie te está mirando. Respira. | 5 |
| 6.0 a 7.5 | T4 | Cada quien viene a lo suyo. | 5 |
| 7.5 a 9.0 | captura real | Tú, a lo tuyo: tu serie de hoy | 8 |
| 9.0 a 10.5 | T5 | Primera serie. Nadie miró. | 4 |
| 10.5 a 12.0 | T6 | Todos empezamos así. | 3 |
| 12.0 a 15.0 | cierre | Empieza 7 días gratis en bananaburn.app / BananaBurn | 7 |

## Revisión

- Gancho POV completo en el cuadro 0, sin logo y sin entrada animada: se lee entre el segundo 0 y el 1.
- Ninguna pantalla pasa de 8 palabras y ninguna escena dura menos de 1.5 s ni más de 2.5 s (el cierre, 3 s): `proyecto/render.mjs` lo revisa y falla si no se cumple.
- Sin voces humanas, sin testimonios, sin números inventados. El único dato es la captura real del entreno, sin tocar ningún número.
- Sin emojis, sin IA, sin contadores ni escasez. "Spoiler" y "POV" se dejan en inglés porque así se usan en redes en toda Latinoamérica.

## Pie de foto propuesto

Pendiente de aprobación por escrito de Andrés, igual que el video:

> Spoiler: en el gym casi nadie te está mirando. Cada quien va a lo suyo, y tú también: tu plan de hoy te dice qué hacer, con cuánto peso y cuántas repeticiones. Todos empezamos así. Empieza 7 días gratis en bananaburn.app
>
> #BananaBurn #PrimerDiaEnElGym #GymPrincipiantes #GymDelCondominio #EntrenamientoDeFuerza
