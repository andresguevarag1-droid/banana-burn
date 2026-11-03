# Campaña del 9 de noviembre: 3 anuncios nuevos

> **EN PAUSA por decisión del dueño: $0 en anuncios hasta llegar al 30 % de activación.** Activación = % de registrados que terminan su primer entreno en 72 h (hoy ~3 %, 1 nov 2026). Estos guiones quedan listos para producir cuando Andrés los apruebe y para publicar cuando vuelva la pauta. Mientras tanto se pueden usar solo en orgánico, con aprobación de Andrés.

Guiones de Martín para Andrés, issue #239. **Andrés aprueba antes de producir nada.** Este documento no publica, no crea ni edita nada en Meta Ads, no gasta dinero y no cambia código. La campaña y su evento de optimización son los de [campana-conversion-noviembre.md](../../docs/metas/campana-conversion-noviembre.md): estos tres anuncios se suman a esa campaña cuando se reactive, no abren otro presupuesto.

Los tres llevan a **"Empieza 7 días gratis"** y a la portada https://www.bananaburn.app/.

## Qué paso del embudo mueve

Registro > **primer entreno** > pago. Los tres anuncios enseñan el primer entreno antes del registro, para que quien llega ya sepa qué va a hacer. El objetivo es que más registrados terminen su primer entreno, y no solo traer más registros.

| Paso | Cómo se mide |
| --- | --- |
| Registro | `CompleteRegistration` (final de /bienvenida), la señal de optimización de la campaña |
| Primer entreno en 72 h | `workout_saved` en `funnel_events` dentro de las 72 h desde `profiles.created_at`, por cohorte de alta |
| Pago | `trial_charges` con `status = 'succeeded'`, sin duplicar personas ni reintentos |

Cada anuncio se juzga por su **costo por usuario de pago**, no por clic ni por registro. Los resultados de cada fila son por medir: hoy no hay ningún dato de estos anuncios.

## Reglas para los tres

- Personajes: solo Coach Banana, Coach Platanita y El Nuevo. Nunca se presentan como clientes ni dan testimonios.
- Capturas reales de la app, completas o recortadas sin cambiar ningún número, en marco de teléfono ink de radio 42. Las que muestran una carga o un plan de otra persona llevan la etiqueta "Ejemplo".
- Las tomas con personas son escenas actuadas, rotuladas "Escena ilustrativa". Nadie dice que la app le funcionó.
- Sin testimonios inventados ni antes y después. Sin promesas de kilos ni de cambios en el cuerpo.
- Precio: solo el mensual de Entreno, US$9.99. Nunca el anual dividido entre 12.
- Sin mencionar IA. "banana", nunca "banano". Sin emojis.
- Video 1080 × 1920, 30 fps, gancho completo desde el cuadro 0, sin logo al inicio. Un cambio visual cada 1.5 a 2.5 s y máximo 8 palabras añadidas por pantalla. Cierre de 3 s: Coach Banana señalando, botón ink "Empieza 7 días gratis en bananaburn.app" y logo `public/icons/logo.svg`.
- Texto principal en 3 líneas cortas, para que se lea completo antes del "Ver más". Revisar en la vista previa de Meta en celular antes de publicar.

## Anuncio 1: Tu primer entreno, 12 minutos, en tu sala

**Para quién:** quien no va al gym o no tiene tiempo de ir. **Qué muestra:** el primer entreno en casa y guiado (#194 y #226): un ejercicio por pantalla, la serie en una línea, un botón grande de "Terminé la serie" y el descanso con cuenta regresiva.

**Gancho de los primeros 2 segundos:** de noche, una persona en el sillón de su sala mira el celular y lo deja en la mesa. Texto grande desde el cuadro 0: "Tu primer entreno: 12 minutos, en tu sala".

### Guion (20 s)

| Segundo | Escena | Texto en pantalla |
| --- | --- | --- |
| 0 a 2 | Sala de noche, persona en el sillón con el celular (escena ilustrativa) | Tu primer entreno: 12 minutos, en tu sala |
| 2 a 4 | Captura C1: Hoy con el botón "Empezar en casa" ("Sin equipo, unos 12 min") | Sin equipo y sin gym |
| 4 a 6.5 | Captura C2: "Ejercicio 1 de 3", Sentadilla con peso corporal, "Serie 1 de 2" | Un ejercicio por pantalla |
| 6.5 a 8.5 | La persona hace sentadillas junto al sillón (escena ilustrativa) | Haces la serie |
| 8.5 a 10.5 | Captura C3: el dedo toca el botón "Terminé la serie" | Terminas la serie |
| 10.5 a 12.5 | Captura C4: "Descansa", cuenta regresiva y "Sigue: Flexiones" | Descansas 30 segundos |
| 12.5 a 14.5 | La persona hace puente de glúteo en el piso de la sala (escena ilustrativa) | 3 ejercicios, 2 series cada uno |
| 14.5 a 17 | Captura C5: "Entreno completado" | Tu primer entreno, hecho |
| 17 a 20 | Cierre: Coach Banana señalando, botón ink y logo | Empieza 7 días gratis en bananaburn.app |

**Versión de 15 s:** se quitan las escenas de 6.5 a 8.5 y de 12.5 a 14.5.

### Textos

- **Texto principal:**
  Tu primer entreno: 12 minutos, en tu sala.
  Sin equipo. Un ejercicio a la vez, a tu ritmo.
  Empieza 7 días gratis, sin tarjeta.
- **Título:** Empieza 7 días gratis
- **Descripción:** Sin tarjeta. Cancelas cuando quieras.
- **Botón:** Registrarte

### Condición antes de publicar

Lo que sale del código (`firstSessionDay` en `src/lib/engine/index.ts`): la versión de 12 minutos (`FIRST_HOME_MIN`) es la opción en casa que Hoy ofrece a quien eligió **Gimnasio** al registrarse. Quien elige **Sin equipo** o **En casa con mancuernas** recibe un primer entreno de hasta 15 minutos (`FIRST_MAX_MIN`), y Hoy le muestra "Empezar mi primer entreno (15 min)". Este anuncio llama justo a quien no va al gym, que probablemente elegirá Sin equipo y verá 15 minutos, no los 12 del anuncio.

Antes de publicar, Andrés elige una de dos:

1. Pedir al equipo de producto que el primer entreno de Sin equipo use también el descanso corto de la versión en casa, para que quepa en 12 minutos. El anuncio queda como está.
2. Publicar sin ese cambio con este gancho y estos textos: "Tu primer entreno: 15 minutos, en tu sala" y "Tu primer entreno: 15 minutos o menos, en tu sala." en el texto principal. En C1 se usa entonces el Hoy de una cuenta Sin equipo.

Mientras no se decida, este anuncio no se publica con "12 minutos".

## Anuncio 2: No sabes qué hacer en el gym

**Para quién:** quien ya paga un gym o va a empezar y no sabe qué hacer ahí. **Por qué:** evoluciona "Cuánto peso", el anuncio que mejor ha rendido: de $1.11 a $1.55 por registro según el issue #239, y $0.64 un solo día, el 28 de octubre, según [embudo-noviembre.md](../estrategia/embudo-noviembre.md). Pasa de una sola duda (la carga) a las tres que tiene quien empieza: qué ejercicio, con cuánto peso y cuántas repeticiones.

**Gancho de los primeros 2 segundos:** una persona de pie en medio del gym, entre máquinas, mira a un lado y a otro sin saber a cuál ir. Texto grande desde el cuadro 0: "¿No sabes qué hacer en el gym?".

### Guion (18 s)

| Segundo | Escena | Texto en pantalla |
| --- | --- | --- |
| 0 a 2 | Persona en el gym entre máquinas, sin saber a cuál ir (escena ilustrativa) | ¿No sabes qué hacer en el gym? |
| 2 a 4 | Captura C7 (`public/landing/entreno.png`), recorte al nombre: "Puente de glúteo con barra" | Coach Banana te dice el ejercicio + Ejemplo |
| 4 a 6 | La misma captura, recorte a "con 20 kg" | Con cuánto peso + Ejemplo |
| 6 a 8 | La misma captura, recorte a "10 a 12 repeticiones" | Y cuántas repeticiones + Ejemplo |
| 8 a 10 | Captura C8: la técnica animada que abre "Ver cómo se hace" | Y cómo se hace |
| 10 a 12.5 | La persona hace la serie y toca "Terminé la serie" en el celular (escena ilustrativa) | Terminas la serie y sigues |
| 12.5 a 15 | Captura C6: el primer entreno en el gym, "Ejercicio 1 de 3", Sentadilla goblet y "Sugerido. Ajústalo si quieres." | El primer día, un ejercicio a la vez |
| 15 a 18 | Cierre: Coach Banana señalando, botón ink y logo | Empieza 7 días gratis en bananaburn.app |

**Versión de 15 s:** se quita la escena de 10 a 12.5 y la de 8 a 10 dura 1.5 s.

La captura C7 es una sesión concreta de otra persona: los 20 kg no son la carga que se recomienda a quien ve el anuncio. Por eso lleva "Ejemplo" y nunca se cambia la cifra.

### Textos

- **Texto principal:**
  ¿No sabes qué hacer en el gym?
  Coach Banana te dice el ejercicio, el peso y las repeticiones.
  Empieza 7 días gratis, sin tarjeta.
- **Título:** Empieza 7 días gratis
- **Descripción:** Sin tarjeta. Cancelas cuando quieras.
- **Botón:** Registrarte

## Anuncio 3: No sabes qué hacer en el gym, para hispanos en Estados Unidos

**Para quién:** hispanos en Estados Unidos que salen tarde del trabajo y pagan el gym de cadena de su barrio sin saber qué hacer ahí. **Gancho:** el mismo del anuncio 2, con la vida allá: turnos largos y el gym de cadena que les queda cerca. Español neutro, sin regionalismos de ningún país. No se nombra ninguna cadena de gimnasios ni se muestra su logo.

**Gancho de los primeros 2 segundos:** de noche, una persona con ropa de trabajo entra al gym con la mochila al hombro y se queda parada mirando las máquinas. Texto grande desde el cuadro 0: "Sales del turno. Llegas al gym. ¿Y ahora?".

### Guion (20 s)

| Segundo | Escena | Texto en pantalla |
| --- | --- | --- |
| 0 a 2 | Persona con ropa de trabajo entra al gym de noche y se queda mirando las máquinas (escena ilustrativa, sin logos de la cadena) | Sales del turno. Llegas al gym. ¿Y ahora? |
| 2 a 4 | Captura C7 (`public/landing/entreno.png`), recorte al nombre del ejercicio | Coach Banana te dice qué hacer + Ejemplo |
| 4 a 6 | La misma captura, recorte a "con 20 kg" | Con cuánto peso + Ejemplo |
| 6 a 8 | La misma captura, recorte a "10 a 12 repeticiones" | Y cuántas repeticiones + Ejemplo |
| 8 a 10 | La misma captura, recorte a "Ejercicio 1 de 6" y "Faltan unos 36 min" | Sabes cuánto te falta + Ejemplo |
| 10 a 12.5 | La persona termina la serie y guarda el celular (escena ilustrativa) | Entras, entrenas y te vas |
| 12.5 a 15 | Captura C1: Hoy con "Empezar en casa" ("Sin equipo, unos 12 min") | ¿Saliste tarde? Hazlo en casa |
| 15 a 17 | Tarjeta paper con el precio, sin captura | US$9.99 al mes. Cancela cuando quieras |
| 17 a 20 | Cierre: Coach Banana señalando, botón ink y logo | Empieza 7 días gratis en bananaburn.app |

**Versión de 15 s:** se quitan las escenas de 8 a 10 y de 10 a 12.5, y la de 15 a 17 se queda.

Aquí la opción en casa de 12 minutos sí es la que se ve: este anuncio llama a quien ya tiene gym, que al registrarse elige Gimnasio, y a esa persona Hoy le ofrece la versión en casa (C1).

### Textos

- **Texto principal:**
  ¿Sales tarde del trabajo y no sabes qué hacer en el gym?
  Coach Banana te dice el ejercicio, el peso y las repeticiones.
  Empieza 7 días gratis. Luego, US$9.99 al mes.
- **Título:** Empieza 7 días gratis
- **Descripción:** Sin tarjeta. Cancela cuando quieras.
- **Botón:** Registrarte

### Condiciones antes de publicar en Estados Unidos

- Estados Unidos no está en la campaña de conversión, que hoy es solo de Costa Rica y Colombia. Va en su propio conjunto de anuncios, con público de Estados Unidos e idioma español, y la decisión es de Andrés.
- Las tarjetas de fuera de Costa Rica las cobra Tilopay (`providerFor` en `src/lib/pay-provider.ts`). Antes de publicar hay que confirmar que Tilopay está encendido en producción y que acepta tarjetas emitidas en Estados Unidos. Si no, este anuncio no se publica.
- El precio es el de `src/lib/plans.ts`, en dólares e IVA incluido, como dice /precios. En el anuncio no se agrega "más impuestos" ni otro precio. El banco de la persona puede cobrar su propia comisión por compra internacional: eso no lo controla Banana Burn y el anuncio no promete un precio final distinto al de /precios.
- Sin la oferta de condominios, que solo existe en Costa Rica.

## Capturas de la app que se necesitan

Todas son reales, de una cuenta de prueba o del modo demo de la app, sin cambiar ningún número ni el nombre. Las capturas de C1 a C6 y C8 no existen en el repositorio: las toma Andrés o el equipo de producto en un celular (780 × 1688, como las de `public/landing/`) y las guarda en `public/landing/`.

| Código | Pantalla | Cómo llegar | ¿Existe? | Anuncios |
| --- | --- | --- | --- | --- |
| C1 | Hoy del primer día con el botón "Empezar en casa" ("Sin equipo, unos 12 min") arriba | Cuenta nueva con equipo Gimnasio, bienvenida terminada entre las 6 p.m. y las 5 a.m., sin entrenos guardados | No | 1 y 3 |
| C2 | Primer entreno guiado en casa: "Ejercicio 1 de 3", Sentadilla con peso corporal, "Serie 1 de 2" y el botón "Terminé la serie" | Desde C1, tocar el botón en casa (`/app/entreno?casa=1`) | No | 1 |
| C3 | La misma pantalla con el dedo sobre el botón "Terminé la serie" (grabación de pantalla de 2 s) | Igual que C2 | No | 1 |
| C4 | Descanso del entreno guiado: "Descansa", cuenta regresiva y "Sigue: Flexiones" | Tocar "Terminé la serie" en la primera serie de C2 | No | 1 |
| C5 | Resumen al terminar: "Entreno completado" | Terminar las 6 series de C2. Recortar arriba de la tarjeta de planes y de la burbuja del coach | No | 1 |
| C6 | Primer entreno guiado en el gym: "Ejercicio 1 de 3", Sentadilla goblet, los kilos con "Sugerido. Ajústalo si quieres." | Cuenta nueva con equipo Gimnasio, botón "Empezar mi entreno" | No | 2 |
| C7 | Reproductor normal: "Puente de glúteo con barra", "10 a 12 repeticiones con 20 kg", "Ejercicio 1 de 6", "Faltan unos 36 min" | `public/landing/entreno.png` | Sí | 2 y 3 |
| C8 | La técnica animada de un ejercicio, abierta desde "Ver cómo se hace" | Tocar "Ver cómo se hace" en el reproductor | No | 2 |

Además, el cierre de los tres necesita a **Coach Banana en la pose "señala"** como PNG con fondo transparente. En el repositorio solo está la pose de pie (`public/brand/mascota-sola.webp`). Andrés la pasa como PNG. No se redibuja ni se inventa.

Qué no se captura: el chat del coach, la tarjeta de planes del resumen ni ningún dato personal. Si la cuenta tiene un nombre real, se usa el modo demo o una cuenta con nombre de ejemplo.

## Nombres y enlaces

| Anuncio | Nombre en Meta | utm_content |
| --- | --- | --- |
| 1, Costa Rica | `BB Conv Nov26 CR Sala 12 min` | cr-sala-12 |
| 1, Colombia | `BB Conv Nov26 CO Sala 12 min` | co-sala-12 |
| 2, Costa Rica | `BB Conv Nov26 CR Que hago en el gym` | cr-gym-que-hago |
| 2, Colombia | `BB Conv Nov26 CO Que hago en el gym` | co-gym-que-hago |
| 3, Estados Unidos | `BB Conv Nov26 US Que hago en el gym` | us-gym-que-hago |

URL final: `https://www.bananaburn.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=bb-conv-nov26&utm_content=<utm_content>`. Hoy la app guarda los UTM solo si la visita trae `?ref=` (`src/components/ref-capture.tsx`), así que la atribución por anuncio es por confirmar, como en [campana-conversion-noviembre.md](../../docs/metas/campana-conversion-noviembre.md). No usar `/r/<code>`, que pierde los parámetros.

| Anuncio | Hook rate | Costo por registro | % que termina su primer entreno en 72 h | Costo por usuario de pago |
| --- | --- | --- | --- | --- |
| 1 | por medir | por medir | por medir | por medir |
| 2 | por medir | por medir | por medir | por medir |
| 3 | por medir | por medir | por medir | por medir |

Hipótesis, no resultado: el anuncio 1 trae menos registros que el 2, pero con más primeros entrenos terminados, porque muestra que el primer entreno es corto y se hace en casa. El 2 debería traer registros al costo de "Cuánto peso" o menos. La comparación se hace con las cohortes ya cerradas: 72 h para el primer entreno y 7 días más el reintento para el pago.

## Lista para aprobar

- [ ] Andrés aprueba los guiones y textos de los tres anuncios antes de producir.
- [ ] Anuncio 1: Andrés elige entre el cambio de producto para que Sin equipo dure 12 minutos o el texto de 15 minutos.
- [ ] Anuncio 3: Andrés decide si se abre el conjunto de Estados Unidos y se confirma que Tilopay cobra tarjetas de allá.
- [ ] Se toman las capturas de C1 a C6 y C8, y Andrés pasa el PNG de Coach Banana señalando.
- [ ] Nada se publica ni gasta hasta que la activación llegue al 30 % y Andrés lo apruebe por escrito.
