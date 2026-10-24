// "Aprende a entrenar": un minicurso de 10 lecciones cortas para quien empieza de cero. Una idea por lección, unas 30
// segundos de lectura, un dibujo del coach y una pregunta fácil o un botón para hacerlo ahora. Puro y probado.
//
// Todo lo que se enseña aquí es lo que la app hace de verdad (src/lib/engine/index.ts, prescribe()):
//   - Calibración: la primera vez eliges un peso con el que llegas al rango dejando 2 repeticiones en reserva.
//   - Doble progresión: si llegas al tope del rango en todas las series, sube el peso y vuelves al mínimo; si no, mismo
//     peso y una repetición más por serie. Si una serie fue muy fácil (4 o más en reserva), también sube.
//   - Dos sesiones seguidas por debajo del rango: el peso baja 10 % para retomar con buena técnica.
//   - Bloques de 6 semanas: la sexta es de descarga (10 % menos de peso y una serie menos).
//   - Si se pasa un día, se hace al siguiente y se sigue el orden.
// Reglas de los textos: español neutro de tú, frases cortas, sin emojis, sin rayas largas, sin "·", sin hablar de
// inteligencia artificial, sin promesas falsas. Cada término de gimnasio se explica la primera vez que aparece.
import { PLANS } from "@/lib/plans";
import { money } from "@/lib/copy";

const UGC = "https://d8j0ntlcm91z4.cloudfront.net/user_3KlOTMXim7g88SAyF4A03SG6JZ6/";
/** Poses de Coach Banana del libro de marca (fondo transparente). Las mismas que usa la página de inicio. */
export const COACH_POSE = {
  flex: `${UGC}hf_20261023_061301_ed14348a-1464-482d-8fee-fbe951fd4d44.png`,
  bascula: `${UGC}hf_20261023_061356_83ad4af0-f8c7-4a04-8ff6-090e8e2dd637.png`,
  barra: `${UGC}hf_20261023_061358_9ff0ae8e-4afd-4a93-bb85-4207b5a2c361.png`,
  senala: `${UGC}hf_20261023_061359_e2ce4b14-b277-48d0-9b21-a0ead0d7a0c3.png`,
  entrenador: `${UGC}hf_20261023_061409_d0198d87-fa4d-4ff8-aaec-e30ab735a6e0.png`,
  salta: `${UGC}hf_20261023_061411_c121bf5f-06b1-4af8-95a3-2854fcde1109.png`,
  saluda: `${UGC}hf_20261023_061412_513c4e96-cb2a-46a6-ad65-6065ac48bb64.png`,
} as const;
export type Pose = keyof typeof COACH_POSE;

export type LessonCheck = { q: string; options: string[]; correct: number; explain: string };
export type Lesson = {
  slug: string;
  n: number;
  /** Corto, para la lista. */
  title: string;
  /** La idea de la lección en una línea. */
  idea: string;
  /** Lo esencial: 2 o 3 párrafos de una o dos frases. */
  body: string[];
  /** Pasos o claves para recordar. */
  points: string[];
  pose: Pose;
  check: LessonCheck | null;
  /** "Hazlo ahora": lleva a la pantalla donde se practica. */
  cta: { href: string; label: string } | null;
};

export type LessonInput = { nutrition: boolean; coach?: string };

const ENTRENO = PLANS.find((p) => p.id === "entreno")!;
const COMPLETO = PLANS.find((p) => p.id === "completo")!;

export function lessons(i: LessonInput): Lesson[] {
  const coach = i.coach ?? "Coach Banana";
  return [
    {
      slug: "como-funciona", n: 1, title: "Cómo funciona Banana Burn", idea: "Todo cabe en 4 pasos que repites cada semana.",
      body: [
        "Banana Burn es como tener un entrenador personal en tu celular. Te dice qué ejercicios hacer, cuántas veces y con cuánto peso.",
        "Tú solo sigues los pasos y anotas lo que hiciste. La app aprende de eso y te ajusta el plan.",
      ],
      points: ["1. Abre Hoy y mira qué te toca.", "2. Toca Empezar y sigue el entrenamiento paso a paso.", "3. Anota cada serie cuando la terminas.", "4. Repite en tus días de entreno. La app sube el peso cuando ya puedes más."],
      pose: "saluda",
      check: { q: "¿Qué tienes que hacer al terminar cada serie?", options: ["Nada, la app lo adivina", "Anotar lo que hiciste", "Cerrar la app"], correct: 1, explain: "Anotar lo que hiciste es lo que le permite a la app saber cuándo subirte el peso." },
      cta: null,
    },
    {
      slug: "series-y-repeticiones", n: 2, title: "Qué es una serie y una repetición", idea: "Una repetición es un movimiento. Una serie es un grupo de repeticiones seguidas.",
      body: [
        "Si haces una sentadilla y vuelves a estar de pie, eso es 1 repetición. Muchas personas le dicen \"rep\".",
        "Si haces 10 sentadillas seguidas y luego descansas, eso es 1 serie de 10 repeticiones.",
        "Cuando la app dice \"3 × 8-12\", significa 3 series, y en cada una entre 8 y 12 repeticiones.",
      ],
      points: ["Repetición: un movimiento completo, de ida y vuelta.", "Serie: varias repeticiones seguidas, sin parar.", "El rango, como 8-12, es tu meta de repeticiones."],
      pose: "entrenador",
      check: { q: "\"3 × 10\" quiere decir…", options: ["3 repeticiones de 10 series", "3 series de 10 repeticiones", "30 minutos de ejercicio"], correct: 1, explain: "El primer número son las series y el segundo, las repeticiones de cada serie." },
      cta: null,
    },
    {
      slug: "cuanto-peso", n: 3, title: "Cuánto peso usar", idea: "Usa un peso con el que termines la serie sintiendo que podías hacer 2 repeticiones más.",
      body: [
        "La primera vez no sabemos cuánto puedes levantar, y está bien. Prueba un peso cómodo.",
        "Al terminar la serie, pregúntate: ¿podría hacer 2 más con buena técnica? Si sí, vas bien. Si podías hacer muchas más, sube un poco. Si no pudiste terminar, baja.",
        "A eso le decimos dejar 2 repeticiones \"en el tanque\". Así entrenas fuerte sin lastimarte.",
      ],
      points: ["Mejor empezar liviano y subir que empezar pesado y lastimarte.", "La técnica va primero que el peso.", "Anota el peso que usaste de verdad: la próxima vez la app te dirá con cuánto seguir."],
      pose: "barra",
      check: { q: "Terminas una serie y sientes que podías hacer 6 más. ¿Qué haces?", options: ["Subo un poco el peso", "Bajo el peso", "Dejo de entrenar"], correct: 0, explain: "Si te sobraban muchas, el peso es muy liviano. Súbelo un poco en la siguiente serie." },
      cta: null,
    },
    {
      slug: "descanso", n: 4, title: "Cuánto descansar", idea: "Descansar entre series es parte del entrenamiento. La app te cuenta el tiempo.",
      body: [
        "Cuando marcas una serie como hecha, arranca solo un reloj de descanso. Suele ser entre 1 y 3 minutos, según el ejercicio.",
        "Cuando falta poco, el celular suena y vibra para avisarte que toca seguir.",
      ],
      points: ["Descansar te deja hacer la siguiente serie con fuerza.", "Si necesitas más tiempo, usa +15 en el reloj.", "Toma agua en el descanso."],
      pose: "senala",
      check: { q: "¿Qué pasa cuando tocas \"Hecho\" al terminar una serie?", options: ["Se termina el entrenamiento", "Empieza el reloj de descanso", "Se borra la serie"], correct: 1, explain: "Al marcar la serie empieza el descanso con cuenta regresiva." },
      cta: null,
    },
    {
      slug: "tecnica", n: 5, title: "Cómo ver la técnica", idea: "Cada ejercicio tiene un dibujo que se mueve y los pasos para hacerlo bien.",
      body: [
        `Toca cualquier ejercicio de tu plan para ver cómo se hace. Verás a ${coach} haciendo el movimiento, el músculo que trabaja y los pasos en orden.`,
        "Míralo antes de tu primera serie. Baja el peso despacio, contando unos 3 segundos.",
        "Si algo duele (dolor punzante, no el cansancio normal del músculo), para. Cambia el ejercicio o pregúntale a tu coach.",
      ],
      points: ["Cansancio en el músculo: normal.", "Dolor en articulaciones o dolor punzante: para.", "Si un dolor sigue por días, consulta a un profesional de salud."],
      pose: "entrenador",
      check: null,
      cta: { href: "/app/entrenar#ejercicios", label: "Ver un ejercicio ahora" },
    },
    {
      slug: "cambiar-ejercicio", n: 6, title: "Si no tienes la máquina", idea: "Puedes cambiar cualquier ejercicio por otro que trabaja lo mismo.",
      body: [
        "¿La máquina está ocupada o tu gimnasio no la tiene? En el entrenamiento toca \"Cambiar ejercicio\".",
        "La app te muestra opciones que trabajan el mismo músculo. Elige una y sigue.",
        "Si entrenas en casa, cambia tu equipo en Perfil y tu plan se arma con lo que tienes.",
      ],
      points: ["Cambiar un ejercicio no arruina tu plan.", "Elige la opción que puedas hacer con buena técnica.", "En casa también se puede: hay entrenos sin equipo."],
      pose: "senala",
      check: { q: "La máquina que te toca está ocupada. ¿Qué haces?", options: ["Me salto el ejercicio", "Toco \"Cambiar ejercicio\" y elijo otro", "Me voy a la casa"], correct: 1, explain: "Cambiar el ejercicio te deja trabajar el mismo músculo sin esperar." },
      cta: null,
    },
    {
      slug: "progresar", n: 7, title: "Cómo progresar", idea: "Cuando ya puedes más, la app te sube el peso. Por eso es clave anotar.",
      body: [
        "Primero subes repeticiones con el mismo peso. Cuando llegas al número más alto del rango en todas las series, la próxima vez la app te sube el peso y vuelves al número más bajo.",
        "Si dos entrenos seguidos te quedas corto, la app baja el peso un poco para que retomes con buena técnica.",
        "Cada 6 semanas hay una semana más suave para que tu cuerpo se recupere. Se llama descarga.",
      ],
      points: ["Anota siempre lo que hiciste de verdad, aunque sea menos.", "Subir de a poco es lo que te hace más fuerte.", "Puedes ver tu fuerza crecer en Progreso."],
      pose: "flex",
      check: { q: "Tu rango es 8-12. Hiciste 12 en todas las series. ¿Qué pasa la próxima vez?", options: ["Sube el peso y vuelves a 8", "Sigue igual para siempre", "Baja el peso"], correct: 0, explain: "Llegaste al tope del rango: toca subir el peso y empezar otra vez desde 8." },
      cta: null,
    },
    {
      slug: "dias-de-entreno", n: 8, title: "Cuántos días entrenar", idea: "Entrena los días que elegiste. Si faltas uno, no pasa nada: hazlo al día siguiente.",
      body: [
        "Tu plan tiene los días por semana que elegiste al empezar. Los otros días son de descanso, y ahí también crece tu músculo.",
        "¿Se te pasó un día? Haz ese entrenamiento mañana y sigue el orden. No tienes que empezar de cero.",
        "¿Poco tiempo? Usa un entreno exprés de 10, 20 o 30 minutos. Algo es mucho mejor que nada.",
      ],
      points: ["La constancia le gana a la perfección.", "Descansar es parte del plan.", "Puedes cambiar tus días en Perfil."],
      pose: "salta",
      check: { q: "Ayer te tocaba entrenar y no pudiste. ¿Qué haces hoy?", options: ["Hago el entreno de ayer y sigo el orden", "Hago dos entrenos juntos", "Empiezo todo de nuevo"], correct: 0, explain: "Se hace el que quedó pendiente y se sigue con el orden de la semana." },
      cta: { href: "/app/entrenar", label: "Ver mis días" },
    },
    i.nutrition
      ? {
        slug: "comida", n: 9, title: "Comida sin dietas locas", idea: "No necesitas comer perfecto. Empieza por la proteína en cada comida.",
        body: [
          "La proteína (pollo, huevo, frijoles, atún, yogur, carne) es lo que cuida tu músculo mientras bajas grasa.",
          "La app te calcula cuántas calorías y cuánta proteína necesitas al día. Se ajusta cada semana con tu peso real.",
          "¿Comiste algo fuera del plan, como una hamburguesa? Regístralo igual. No es trampa: es información.",
        ],
        points: ["Proteína en cada comida.", "Registra lo que comes, aunque no sea perfecto.", "¿No sabes qué comer? Menú flash te da ideas."],
        pose: "bascula",
        check: { q: "¿Qué conviene tener en cada comida?", options: ["Proteína", "Solo ensalada", "Nada, mejor no comer"], correct: 0, explain: "La proteína te ayuda a cuidar tu músculo y te deja satisfecho por más tiempo." },
        cta: { href: "/app/nutricion", label: "Registrar mi comida" },
      }
      : {
        slug: "comida", n: 9, title: "Comida sin dietas locas", idea: "No necesitas comer perfecto. Empieza por la proteína en cada comida.",
        body: [
          "La proteína (pollo, huevo, frijoles, atún, yogur, carne) es lo que cuida tu músculo mientras bajas grasa.",
          "Come en horarios parecidos, toma agua y no te saltes comidas para \"compensar\".",
        ],
        points: ["Proteína en cada comida.", "Agua durante el día.", "Evita las dietas extremas: se pierde músculo."],
        pose: "bascula",
        check: { q: "¿Qué conviene tener en cada comida?", options: ["Proteína", "Solo ensalada", "Nada, mejor no comer"], correct: 0, explain: "La proteína te ayuda a cuidar tu músculo y te deja satisfecho por más tiempo." },
        cta: null,
      },
    {
      slug: "medir-progreso", n: 10, title: "Cómo medir tu progreso", idea: "La báscula no lo cuenta todo. Mira también tus medidas, tus fotos y tu fuerza.",
      body: [
        "Tu peso sube y baja cada día por el agua y la comida. Por eso importa la tendencia de varias semanas, no un solo día.",
        "Si estás ganando músculo y bajando grasa, la báscula puede moverse poco aunque tu cuerpo cambie mucho.",
      ],
      points: ["Pésate al despertar, después del baño y antes de comer.", "Mide tu cintura cada 2 semanas.", "Toma fotos con la misma luz cada 2 semanas.", "Mira cómo sube tu fuerza en Progreso."],
      pose: "bascula",
      check: { q: "Hoy pesas 1 kg más que ayer. ¿Qué significa?", options: ["Que todo salió mal", "Probablemente es agua: importa la tendencia de semanas", "Que debes dejar de comer"], correct: 1, explain: "El peso cambia cada día por agua y comida. Mira la curva de varias semanas." },
      cta: { href: "/app/progreso", label: "Ver mi progreso" },
    },
  ];
}

/** Nota honesta para quien tiene Entreno: qué suma la nutrición y su precio. */
export function nutritionUpsell(): string {
  return `Tu plan ${ENTRENO.name} no incluye nutrición. Con ${COMPLETO.name} (${money(COMPLETO.price.mes)} al mes) la app te calcula calorías y proteína, y te da recetas latinas.`;
}

export const lessonKey = (slug: string) => `lec-${slug}`.slice(0, 24);
export const lessonDone = (keys: readonly string[], slug: string) => keys.includes(lessonKey(slug));

/** Lecciones hechas y la siguiente por leer. */
export function courseProgress(all: Lesson[], keys: readonly string[]) {
  const done = all.filter((l) => lessonDone(keys, l.slug)).length;
  return { done, total: all.length, next: all.find((l) => !lessonDone(keys, l.slug)) ?? null, complete: done === all.length };
}
