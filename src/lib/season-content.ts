// Contenido de la Temporada 1 de cada deporte: 8 semanas periodizadas, con el mecanismo de los programas.
// Fases: Base (semanas 1 a 3), Descarga (4), Potencia (5 a 7) y Afinar y prueba (8). Sesiones por semana, en orden de
// prioridad (la persona elige 2 a 4 en el cuestionario): 1 Fuerza, 2 Potencia y agilidad, 3 Tren superior y core,
// 4 Recuperación y movilidad. Solo ejercicios que existen (motor o biblioteca "ds:XXXX"); lo revisa season-content.test.ts.
//
// Evidencia (resumen; detalle en el documento del proyecto investigacion/evidencia-programas.md):
//   - Running: el entrenamiento de fuerza pesada y la pliometría mejoran la economía de carrera y el rendimiento en 3 a 5 km
//     sin aumentar la masa corporal (Blagrove et al., Sports Med 2018; Llanos-Lagos et al., Sports Med 2024). El trabajo
//     excéntrico de isquiotibiales (curl nórdico) reduce lesiones de isquiotibiales (van Dyk et al., BJSM 2019). La
//     fuerza de pantorrilla y sóleo (rodilla doblada) protege el tendón de Aquiles y la tibia.
//   - Raquetas: la potencia de rotación nace en piernas y tronco (cadena cinética); el trabajo de rotadores externos y de
//     escápula reduce el riesgo de hombro en deportes de lanzamiento y raqueta (Ellenbecker y Cools, BJSM 2010); el
//     trabajo excéntrico de extensores de muñeca ayuda en la epicondilalgia (codo de tenista) (Cullinane et al., Clin
//     Rehabil 2014). El equilibrio a una pierna y la fuerza de tobillo bajan los esguinces (Hübscher et al., MSSE 2010).
//   - Cross Training: periodización por bloques, técnica de olímpicos con cargas ligeras antes de cargar, y escalas para
//     cada movimiento. El acondicionamiento de alta intensidad mejora el VO2 máx. en pocas semanas, pero el riesgo de
//     lesión sube con la fatiga y la mala técnica (Claudino et al., Sports Med Open 2018): por eso el volumen sube poco a
//     poco y los saltos y lo que va sobre la cabeza tienen alternativa.
import type { ProgramExercise, ProgramMeta, ProgramSession } from "./programs";
import { programSeedSql, type ProgramSeed } from "./program-seed";
import { SPORTS, SEASONS_T1, SEASON_BY_SLUG, seasonSlug, type SportId } from "./seasons";

type Opt = Partial<Pick<ProgramExercise, "unit" | "tempo" | "note" | "home" | "perSide">>;
const x = (id: string, sets: number, lo: number, hi: number, rest: number, o: Opt = {}): ProgramExercise => ({ id, sets, lo, hi, rest, ...o });
const ses = (phase: number, day: number, title: string, focus: string, exercises: ProgramExercise[]): ProgramSession => ({ phase, day, title, focus, exercises });
const S = "3-1-1";

/** Fases iguales para los tres deportes (la persona recibe una descarga extra antes de su evento: seasons-server). */
export const SEASON_PHASES: ProgramMeta["phases"] = [
  { name: "Base", weeks: 3, focus: "Técnica, fuerza general y tendones fuertes. Cargas cómodas, 2 o 3 repeticiones en reserva." },
  { name: "Descarga", weeks: 1, deload: true, focus: "Semana ligera: menos series y carga. Llegas con energía a la fase de potencia." },
  { name: "Potencia", weeks: 3, focus: "Más carga en los básicos y saltos más explosivos. Lo que ganaste en la base se vuelve velocidad." },
  { name: "Afinar y prueba", weeks: 1, deload: true, focus: "Volumen bajo y tu prueba final: compara con la semana 1." },
];

// Por fase: 1 Base, 2 Descarga (las mismas sesiones de la base: el motor baja la carga), 3 Potencia, 4 Afinar y prueba.
const phase = (p: number) => (p === 2 ? 1 : p === 4 ? 3 : p);

// ───────────── Running ─────────────
function running(): ProgramSession[] {
  const out: ProgramSession[] = [];
  for (const p of [1, 2, 3, 4]) {
    const pw = phase(p) === 3;
    const test = p === 4 ? " Prueba final: anota tus repeticiones y compara con la semana 1." : "";
    out.push(
      ses(p, 1, "Fuerza de corredor", "Piernas pesadas, lejos de tu carrera larga. Cadena posterior y una pierna a la vez.", [
        x(pw ? "squat" : "goblet", pw ? 4 : 3, pw ? 4 : 8, pw ? 6 : 10, pw ? 150 : 90, { tempo: S, home: "goblet", note: (pw ? "Pesado y limpio: sube con intención." : "Baja controlado, cadera atrás.") + test }),
        x("rdl", 3, pw ? 5 : 8, pw ? 6 : 10, 120, { tempo: S, home: "dbrdl", note: "Isquiotibiales y glúteo: espalda neutra." }),
        x("bulgarian", 3, pw ? 6 : 8, pw ? 8 : 10, 90, { perSide: true, note: "Por lado. La rodilla sigue la línea del pie." }),
        x("ds:0417", 3, 12, 15, 60, { tempo: "2-1-2", home: "ds:1373", note: "Pantorrilla: sube completo y baja lento." }),
        x("ds:1379", 3, 12, 15, 60, { tempo: "2-1-2", note: "Sóleo, rodilla doblada: protege Aquiles y tibia." }),
        x(pw ? "ds:0696" : "ds:3645", pw ? 3 : 2, pw ? 4 : 8, pw ? 6 : 10, 90, pw ? { note: "Curl nórdico asistido: baja lo más lento que puedas." } : { perSide: true, note: "Por lado. Puente a una pierna: cadera nivelada." }),
        x("plank", 2, 30, 45, 45, { unit: "s" }),
      ]),
      ses(p, 2, "Potencia y zancada", "Saltos cortos y rápidos para una zancada más elástica. Calidad sobre cantidad.", [
        x("ds:2612", 3, pw ? 40 : 30, pw ? 60 : 40, 60, { unit: "s", note: "Saltos de tobillo cortos y rápidos, sin flexionar mucho la rodilla." }),
        x("jumpsquat", 3, pw ? 5 : 6, pw ? 6 : 8, 90, { note: "Aterriza suave y en silencio. Descansa completo." }),
        x("ds:3361", 3, 6, 8, 60, { perSide: true, note: "Por lado. Salto lateral y quédate firme 1 s al caer." }),
        x("ds:0431", 3, 8, 10, 60, { perSide: true, note: "Por lado. Empuja con el pie de arriba, sin impulso del de abajo." }),
        x("slrdl", 2, 8, 10, 60, { perSide: true, note: "Por lado. Equilibrio y cadera estable." }),
        x("ds:1775", 2, 15, 25, 45, { unit: "s", perSide: true, note: "Por lado. Aductores fuertes: protegen ingle y rodilla." }),
      ]),
      ses(p, 3, "Tren superior y core", "Brazos y tronco para mantener la postura en los últimos kilómetros. Piernas ligeras.", [
        x("pushup", 3, 8, 12, 60),
        x("dbrow", 3, 10, 12, 60, { perSide: true, note: "Por lado. Codo cerca del cuerpo." }),
        x("ds:0979", 3, 10, 12, 45, { perSide: true, note: "Por lado. Pallof: no dejes que la banda te gire." }),
        x("ds:0276", 3, 8, 10, 45, { perSide: true, note: "Por lado. Espalda baja pegada al piso." }),
        x("ytw", 2, 8, 10, 45),
        x("carry", 3, 30, 40, 60, { unit: "m", note: "Camina erguido, hombros abajo." }),
      ]),
      ses(p, 4, "Recuperación y movilidad", "Después de tu carrera larga: sangre a las piernas y movilidad, sin cansarte.", [
        x("ds:3561", 2, 10, 12, 30, { note: "Puente con marcha: cadera quieta." }),
        x("ds:0628", 2, 10, 12, 30, { perSide: true, note: "Por lado. Pasos cortos con la banda." }),
        x("ds:1377", 2, 30, 45, 0, { unit: "s", perSide: true, note: "Por lado. Pantorrilla contra la pared." }),
        x("ds:1511", 2, 30, 45, 0, { unit: "s", perSide: true, note: "Por lado. Isquiotibiales, sin rebotar." }),
        x("ds:1358", 1, 30, 45, 0, { unit: "s", perSide: true, note: "Por lado. Respira lento." }),
      ]),
    );
  }
  return out;
}

// ───────────── Raquetas (tenis y pádel) ─────────────
function raquetas(): ProgramSession[] {
  const out: ProgramSession[] = [];
  for (const p of [1, 2, 3, 4]) {
    const pw = phase(p) === 3;
    const test = p === 4 ? "Prueba final: compara tu plancha lateral con la semana 1. " : "";
    out.push(
      ses(p, 1, "Fuerza de piernas", "Piernas fuertes para frenar, cambiar de dirección y aguantar el partido.", [
        x(pw ? "squat" : "goblet", pw ? 4 : 3, pw ? 5 : 8, pw ? 6 : 10, pw ? 150 : 90, { tempo: S, home: "goblet" }),
        x("ds:1410", 3, 8, 10, 90, { perSide: true, home: "lunge", note: "Por lado. Zancada lateral: frena con la cadera, no con la rodilla." }),
        x("ds:0381", 3, 8, 10, 90, { perSide: true, note: "Por lado. Paso atrás largo y torso firme." }),
        x("ds:1757", 3, 8, 10, 60, { perSide: true, home: "slrdl", note: "Por lado. Equilibrio y glúteo." }),
        x("ds:0417", 3, 12, 15, 60, { tempo: "2-1-2", home: "ds:1373", note: "Tobillos fuertes para el desplazamiento." }),
        x("ds:0705", 2, 25, 40, 45, { unit: "s", perSide: true, note: `${test}Por lado. Plancha lateral firme.` }),
      ]),
      ses(p, 2, "Potencia de rotación y agilidad", "El golpe nace en las piernas y el tronco. Rotaciones rápidas y saltos laterales.", [
        x("ds:3361", 3, 6, 8, 60, { perSide: true, note: "Por lado. Salto lateral y freno firme: como llegar a la bola." }),
        x("jumpsquat", 3, pw ? 4 : 5, pw ? 6 : 8, 90, { note: "Explota hacia arriba y cae suave." }),
        x("ds:0243", 3, 8, 10, 60, { perSide: true, home: "ds:0687", note: "Por lado. Gira desde la cadera, brazos largos." }),
        x("ds:1354", 3, 6, 8, 60, { note: "Slam con balón medicinal: todo el cuerpo." }),
        x("ds:2612", 3, 30, 45, 45, { unit: "s", note: "Pies rápidos y ligeros." }),
        x("ds:0979", 2, 10, 12, 45, { perSide: true, note: "Por lado. Antirrotación: el tronco no se mueve." }),
      ]),
      ses(p, 3, "Hombro, antebrazo y core", "Brazo sano: manguito rotador, escápula y muñeca. Piernas ligeras.", [
        x("ds:0235", 3, 12, 15, 45, { perSide: true, home: "ds:0864", note: "Por lado. Rotación externa: codo pegado y lento." }),
        x("facepull", 3, 12, 15, 60, { home: "ytw" }),
        x("dbrow", 3, 10, 12, 60, { perSide: true }),
        x("ds:1016", 2, 15, 20, 45, { note: "Flexores de muñeca: rango completo." }),
        x("ds:0994", 3, 12, 15, 45, { tempo: "1-0-4", note: "Extensores de muñeca: baja en 4 s. Cuida el codo." }),
        x("pushup", 2, 8, 12, 60),
        x("ds:0276", 2, 8, 10, 45, { perSide: true }),
      ]),
      ses(p, 4, "Recuperación y movilidad", "El día después del partido: movilidad de cadera, columna y hombro.", [
        x("ds:0628", 2, 10, 12, 30, { perSide: true, note: "Por lado. Activa el glúteo medio." }),
        x("ds:3561", 2, 10, 12, 30),
        x("ytw", 2, 8, 10, 30, { note: "Escápulas atrás y abajo, sin peso." }),
        x("ds:2329", 2, 6, 8, 20, { perSide: true, note: "Por lado. Gira la columna con calma." }),
        x("ds:1363", 2, 6, 8, 20, { tempo: "3-1-3" }),
      ]),
    );
  }
  return out;
}

// ───────────── Cross Training ─────────────
function cross(): ProgramSession[] {
  const out: ProgramSession[] = [];
  for (const p of [1, 2, 3, 4]) {
    const pw = phase(p) === 3;
    const bench = p === 1 || p === 4 ? " Benchmark: anota tus rondas para compararlas en la semana 8." : "";
    out.push(
      ses(p, 1, "Fuerza", "Los básicos con técnica limpia. Escala la carga: debes terminar cada serie con 2 repeticiones en reserva.", [
        x(pw ? "squat" : "goblet", pw ? 5 : 4, pw ? 3 : 6, pw ? 5 : 8, pw ? 150 : 120, { tempo: S, home: "goblet" }),
        x(pw ? "deadlift" : "dbrdl", pw ? 4 : 3, pw ? 3 : 8, pw ? 5 : 10, 150, { home: "dbrdl", note: "Espalda neutra siempre. Si se redondea, baja el peso." }),
        x("dbpress", 3, pw ? 5 : 8, pw ? 6 : 10, 90, { note: "Escala: si no hay control sobre la cabeza, hazlo sentado." }),
        x(pw ? "pullup" : "ds:0970", 3, pw ? 3 : 5, pw ? 6 : 8, 90, { home: "invrow", note: "Escala: banda más gruesa o remo invertido." }),
        x("row", 3, 8, 10, 90, { home: "dbrow" }),
      ]),
      ses(p, 2, "Técnica y potencia", "Olímpicos y kettlebell con cargas ligeras: primero el movimiento, después el peso.", [
        x("ds:0549", 4, 12, 15, 60, { note: "Swing: la cadera empuja, los brazos solo guían." }),
        x("ds:0535", 4, pw ? 3 : 5, pw ? 5 : 6, 90, { perSide: true, note: "Por lado. Cargada colgante: técnica antes que carga." }),
        x("ds:1700", 3, 5, 8, 90, { note: "Push press: impulso de piernas y bloquea arriba." }),
        x("jumpsquat", 3, 5, 6, 90, { note: "Escala: sentadilla rápida sin salto." }),
        x("ds:0688", 3, 6, 8, 60, { note: "Gimnásticos: solo escápulas, codos rectos." }),
      ]),
      ses(p, 3, "Acondicionamiento con escalas", "Circuito de 3 a 5 rondas a ritmo sostenible, con la escala que te deja moverte bien todo el tiempo.", [
        x("ds:0550", 3, pw ? 10 : 8, pw ? 12 : 10, 30, { home: "goblet", note: `Thruster con kettlebell. Escala: goblet sin empuje.${bench}` }),
        x("burpee", 3, pw ? 8 : 6, pw ? 12 : 8, 30, { note: "Escala: sin salto o con las manos en un banco." }),
        x("ds:2142", 3, 30, 45, 30, { unit: "s", home: "jacks", note: "SkiErg. Escala: jumping jacks." }),
        x("ds:2612", 3, 40, 60, 30, { unit: "s", note: "Saltos simples con cuerda." }),
        x(pw ? "kneeraise" : "legraisef", 3, 8, 12, 30, { home: "legraisef" }),
        x("carry", 3, 30, 40, 45, { unit: "m" }),
      ]),
      ses(p, 4, "Movilidad y gimnásticos", "Hombros, cadera y tobillo con rango completo, y progresiones gimnásticas sin prisa.", [
        x("bearcrawl", 3, 20, 30, 45, { unit: "s" }),
        x("pikepush", 3, 5, 8, 60, { note: "Progresión hacia el pino. Escala: manos en un banco." }),
        x("ds:0276", 3, 8, 10, 45, { perSide: true, note: "Por lado. Base para el hollow." }),
        x("plank", 2, 30, 45, 45, { unit: "s" }),
        x("ds:1363", 2, 6, 8, 20, { tempo: "3-1-3" }),
        x("ds:1377", 2, 30, 45, 0, { unit: "s", perSide: true }),
      ]),
    );
  }
  return out;
}

const SESSIONS: Record<SportId, () => ProgramSession[]> = { running, raquetas, cross };

const META_BASE = (sport: SportId): Omit<ProgramMeta, "experience"> => ({
  phases: SEASON_PHASES, daysPerWeek: 4, sessionMinutes: 45, level: "todos", equipment: "Gimnasio, con versión para casa", adapt: true,
  who: {
    running: "Para quien corre de 5K a maratón o trail y quiere correr más fuerte y con menos lesiones, con fuerza acomodada alrededor de sus días de carrera.",
    raquetas: "Para quien juega tenis o pádel y quiere más potencia, mejores desplazamientos y cuidar codo y hombro, sin llegar sin energía al partido.",
    cross: "Para quien va a un box o entrena funcional y quiere más fuerza, mejor técnica y más aguante, con escalas para cada movimiento.",
  }[sport],
  result: {
    running: "Fuerza pesada, pliometría y prevención de lesiones 2 a 4 veces por semana, sin tocar tus días de correr.",
    raquetas: "Fuerza de piernas, potencia de rotación, agilidad y salud de hombro y antebrazo, acomodadas a tus partidos.",
    cross: "Bloques de fuerza, técnica de olímpicos con carga ligera, acondicionamiento con escalas y gimnásticos.",
  }[sport],
  outcomes: {
    running: ["Fuerza de piernas y glúteo para una zancada más eficiente", "Pantorrilla, sóleo y tibia fuertes", "Saltos cortos para una zancada elástica", "Prueba final para comparar con la semana 1"],
    raquetas: ["Piernas que frenan y cambian de dirección", "Rotación potente desde la cadera", "Hombro, codo y muñeca más fuertes", "Prueba final para comparar con la semana 1"],
    cross: ["Sentadilla, peso muerto y press más fuertes", "Técnica de cargada y swing", "Más rondas en el mismo tiempo", "Benchmark en las semanas 1 y 8"],
  }[sport],
  keyLifts: { running: ["squat", "rdl"], raquetas: ["squat", "ds:0417"], cross: ["squat", "deadlift"] }[sport],
  nutrition: { mode: "recomp", proteinPerKg: 1.6, note: "Come para rendir: carbohidratos antes de tu deporte y proteína en cada comida." },
  previewExercise: { running: "rdl", raquetas: "goblet", cross: "goblet" }[sport],
});

const EXPERIENCE = (sport: SportId): NonNullable<ProgramMeta["experience"]> => ({
  running: {
    mode: SPORTS.running.mode,
    welcome: "Te damos la bienvenida a tu Temporada de Running. Tu fuerza va lejos de tu carrera larga: corres igual que siempre y llegas más fuerte cada semana.",
    habits: [
      { key: "entreno", label: "Tu sesión de fuerza o tu carrera", kind: "entreno" as const },
      { key: "carbo", label: "Carbohidratos antes de correr", kind: "check" as const },
      { key: "agua", label: "Toma 8 vasos de agua", kind: "agua" as const, target: 8 },
      { key: "sueno", label: "Duerme 7 horas", kind: "sueno" as const, target: 7 },
    ],
    tips: [
      "Semana 1: cargas cómodas. Termina cada serie sintiendo que podías hacer 2 o 3 más; tus tendones se adaptan más lento que tus músculos.",
      "Semana 2: nunca piernas pesadas el día antes de tu carrera larga. Si la mueves, mueve también tu fuerza.",
      "Semana 3: el sóleo (pantorrilla con rodilla doblada) carga más que cualquier otro músculo al correr. No te saltes ese ejercicio.",
      "Semana 4: semana ligera. Menos series para llegar con energía a la fase de potencia.",
      "Semana 5: empieza la potencia. En los saltos, cada repetición es rápida y limpia; si se vuelven lentos, para.",
      "Semana 6: si un día tus piernas no responden, haz la sesión con menos carga. Correr bien manda.",
      "Semana 7: última semana fuerte. Mira cuánto subieron tus pesos desde la semana 1.",
      "Semana 8: afina y prueba. Volumen bajo y tu prueba final para comparar.",
    ],
    coachFocus: "Fuerza para corredores: cadena posterior, una pierna, pantorrilla y sóleo, pliometría y prevención de lesiones, siempre acomodada a sus días de carrera. Habla de su carrera larga y de su próximo evento.",
    restDay: "Corre según tu plan o camina 20 minutos y estira pantorrillas y cadera",
    food: ["Antes de una carrera larga: carbohidratos de fácil digestión 2 a 3 horas antes.", "Después de correr o entrenar: proteína y carbohidratos en la siguiente comida.", "Más de 75 minutos corriendo: lleva algo para tomar o comer en el camino.", "Proteína en cada comida para recuperar."],
  },
  raquetas: {
    mode: SPORTS.raquetas.mode,
    welcome: "Te damos la bienvenida a tu Temporada de Raquetas. Más potencia, mejores desplazamientos y brazo sano, con energía para tus partidos.",
    habits: [
      { key: "entreno", label: "Tu sesión o tu partido", kind: "entreno" as const },
      { key: "brazo", label: "5 minutos de hombro y muñeca", kind: "check" as const },
      { key: "agua", label: "Toma 8 vasos de agua", kind: "agua" as const, target: 8 },
      { key: "sueno", label: "Duerme 7 horas", kind: "sueno" as const, target: 7 },
    ],
    tips: [
      "Semana 1: el golpe nace en las piernas. Fuerza de piernas primero, brazo después.",
      "Semana 2: nunca piernas pesadas el día antes de un partido. Si cambia tu partido, cambia tu sesión.",
      "Semana 3: el manguito rotador se entrena con poco peso y mucho control. Lento y sin dolor.",
      "Semana 4: semana ligera. Juega más suelto y deja que el cuerpo absorba lo que entrenaste.",
      "Semana 5: potencia de rotación: gira desde la cadera, no desde el brazo.",
      "Semana 6: en los saltos laterales, frena firme como cuando llegas a una bola abierta.",
      "Semana 7: última semana fuerte. Compara tus saltos laterales con la semana 1.",
      "Semana 8: afina y prueba. Llega con energía a tus partidos.",
    ],
    coachFocus: "Tenis y pádel: fuerza de piernas, potencia de rotación, agilidad lateral y salud de hombro, codo y muñeca, acomodado a sus partidos. Habla de sus partidos y torneos.",
    restDay: "Juega según tu plan o camina 20 minutos y haz movilidad de hombro",
    food: ["Antes de jugar: una comida con carbohidratos 2 a 3 horas antes.", "Partidos de más de 90 minutos: agua y algo de carbohidrato en los cambios de lado.", "Después del partido: proteína y carbohidratos para recuperar.", "Si sudas mucho, suma sal a tu comida del día."],
  },
  cross: {
    mode: SPORTS.cross.mode,
    welcome: "Te damos la bienvenida a tu Temporada de Cross Training. Fuerza, técnica y acondicionamiento con escalas: primero el movimiento, después la carga.",
    habits: [
      { key: "entreno", label: "Tu sesión o tu clase", kind: "entreno" as const },
      { key: "proteina", label: "Proteína en cada comida", kind: "proteina" as const },
      { key: "agua", label: "Toma 8 vasos de agua", kind: "agua" as const, target: 8 },
      { key: "sueno", label: "Duerme 7 horas", kind: "sueno" as const, target: 7 },
    ],
    tips: [
      "Semana 1: anota tu benchmark. Es tu punto de partida, no un examen.",
      "Semana 2: técnica antes que carga en la cargada y el swing. Si la forma se rompe, baja el peso.",
      "Semana 3: elige la escala que te deja moverte bien todo el circuito. Eso es lo que más te hace avanzar.",
      "Semana 4: semana ligera. Menos series y más movilidad.",
      "Semana 5: empieza la potencia: series cortas y pesadas con descanso completo.",
      "Semana 6: los gimnásticos se ganan con progresiones. Nada de forzar el rango con dolor.",
      "Semana 7: última semana fuerte. Mira tus pesos de la semana 1.",
      "Semana 8: repite tu benchmark y compara.",
    ],
    coachFocus: "Cross Training: fuerza, técnica de olímpicos con carga ligera, acondicionamiento con escalas y progresiones gimnásticas, sin forzar con dolor. Respeta lo que la persona no puede o no quiere hacer.",
    restDay: "Descanso activo: 20 minutos de caminata y movilidad de cadera y hombro",
    food: ["Proteína en cada comida para recuperar entre sesiones.", "Carbohidratos alrededor de tus sesiones fuertes.", "Agua durante el día, no solo en el entreno.", "Si entrenas en ayunas y te mareas, come algo ligero antes."],
  },
}[sport]);

/** La Temporada 1 de un deporte como programa (siembra y catálogo de respaldo). */
export function seasonSeed(sport: SportId): ProgramSeed {
  const slug = seasonSlug(sport, 1);
  const s = SEASON_BY_SLUG[slug];
  return {
    slug, title: s.title, priceUsd: s.priceMinor / 100, cover: { running: "ember", raquetas: "selva", cross: "noche" }[sport] as ProgramSeed["cover"], icon: SPORTS[sport].icon,
    difficulty: "media", minutes: 45, insert: true, featured: false, sort: { running: 1, raquetas: 2, cross: 3 }[sport],
    description: `${SPORTS[sport].tagline} 8 semanas con fechas oficiales, acomodadas a tus días de ${sport === "cross" ? "box" : sport === "running" ? "carrera" : "partido"}.`,
    badge: `${SPORTS[sport].name} T1`, rewardTitle: { running: "Zancada de acero", raquetas: "Brazo de hierro", cross: "Motor completo" }[sport], xp: 400,
    safetyNote: "Si tienes dolor, una lesión reciente o una condición médica, consulta con un profesional antes de empezar. El cuestionario solo cambia ejercicios: no es un diagnóstico.",
    meta: { ...META_BASE(sport), experience: EXPERIENCE(sport) }, sessions: SESSIONS[sport](),
  };
}

export const SEASON_SEED: ProgramSeed[] = (["running", "raquetas", "cross"] as SportId[]).map(seasonSeed);
export const SEASON_SEED_BY_SLUG: Record<string, ProgramSeed> = Object.fromEntries(SEASON_SEED.map((p) => [p.slug, p]));

// ───────────── SQL de la siembra (scripts/gen-temporadas-seed.ts; season-content.test.ts comprueba 0048) ─────────────
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
/** Bloque 2 de 0048: los programas de la Temporada 1 y sus filas en public.seasons (sin pisar lo editado en el panel). */
export function seasonSeedSql(): string {
  const out = [programSeedSql(SEASON_SEED).replace(/^-- ─+ 6\. Siembra[^\n]*\n/, "-- ───────────── 2. Siembra de la Temporada 1 (generada con scripts/gen-temporadas-seed.ts) ─────────────\n").replace(/-- Retos Premium que pasan a ser programas[^\n]*\n/, "")];
  out.push("insert into public.seasons (slug, sport, number, starts_on, ends_on, enroll_until, price_minor) values");
  out.push(SEASONS_T1.map((s) => `  (${[q(s.slug), q(s.sport), s.number, q(s.startsOn), q(s.endsOn), q(s.enrollUntil), s.priceMinor].join(", ")})`).join(",\n"));
  out.push("on conflict (slug) do nothing;");
  return out.join("\n") + "\n";
}

const jj = (v: unknown) => `$j$${JSON.stringify(v)}$j$::jsonb`;
/**
 * 0050: la Temporada 1 vuelve a sus ejercicios originales, ahora con animación propia (25/10). 0048 ya sembró la
 * versión con sustitutos y su siembra no pisa nada; esto actualiza solo lo que nadie editó en el panel.
 */
export function seasonTechniqueSql(): string {
  const out = ["-- 0050: Temporada 1 con sus ejercicios originales (cada uno con su animación de técnica revisada).",
    "-- Generado con scripts/gen-temporadas-seed.ts --0050. Solo toca filas que nadie editó en el panel (updated_by nulo). Idempotente.", ""];
  for (const p of SEASON_SEED) {
    out.push(`update public.challenges_catalog set program = ${jj(p.meta)} where slug = ${q(p.slug)} and kind = 'programa' and updated_by is null;`);
    for (const s of p.sessions) out.push(`update public.program_sessions set title = ${q(s.title)}, focus = ${q(s.focus)}, optional = ${!!s.optional}, exercises = ${jj(s.exercises)}, updated_at = now() where slug = ${q(p.slug)} and phase = ${s.phase} and day = ${s.day} and updated_by is null;`);
  }
  return out.join("\n") + "\n";
}
