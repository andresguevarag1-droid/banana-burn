// Programas iniciales. FUENTE de la siembra de 0024_programas.sql (lo verifica programs.test.ts) y respaldo en modo demo.
// En producción el admin los edita desde /admin/retos.
//
// Criterios de entrenamiento (para quien edite esto):
//   - Sobrecarga progresiva: cada fase repite sus sesiones y el motor sube carga o repeticiones con la doble progresión
//     (prescribe en src/lib/engine). Las fases suben series o bajan el rango de repeticiones.
//   - Volumen: entre 10 y 20 series duras por músculo grande a la semana en las fases de construcción; menos en la base.
//   - Descarga en los programas de 8 semanas o más (fase con `deload`: -10 % de carga y una serie menos).
//   - Principiante por defecto: variantes fáciles de aprender (goblet antes que sentadilla con barra), 2 a 3 repeticiones
//     en reserva al empezar, descansos largos en los básicos.
//   - Solo ejercicios que existen: ids del motor (src/lib/engine/data.ts) o de la biblioteca ("ds:0739").
//   - Nada de promesas: el texto describe lo que haces, no resultados garantizados.
import type { ProgramExercise, ProgramExperience, ProgramMeta, ProgramSession } from "./programs";
import type { CoverStyle, Difficulty } from "./challenge-seed";

export type ProgramSeed = {
  slug: string; title: string; description: string; priceUsd: number; cover: CoverStyle; icon: string; difficulty: Difficulty; minutes: number;
  /** true = el programa es nuevo (se inserta); false = convierte un reto Premium que ya existe. */
  insert: boolean; featured: boolean; sort: number; badge: string; rewardTitle: string | null; xp: number; safetyNote: string | null;
  meta: ProgramMeta; sessions: ProgramSession[];
};

type Opt = Partial<Pick<ProgramExercise, "unit" | "tempo" | "note" | "home">>;
const x = (id: string, sets: number, lo: number, hi: number, rest: number, o: Opt = {}): ProgramExercise => ({ id, sets, lo, hi, rest, ...o });
const S = "3-1-1", I = "2-1-1";
const ses = (phase: number, day: number, title: string, focus: string, exercises: ProgramExercise[], optional = false): ProgramSession => ({ phase, day, title, focus, exercises, ...(optional ? { optional } : {}) });
/** Copia las sesiones de una fase a otra (descarga o cierre), con cambios opcionales por ejercicio. */
const copyPhase = (list: ProgramSession[], from: number, to: number, edit: (e: ProgramExercise, s: ProgramSession) => ProgramExercise = (e) => e, focus?: string) =>
  list.filter((s) => s.phase === from).map((s) => ({ ...s, phase: to, ...(focus ? { focus } : {}), exercises: s.exercises.map((e) => edit({ ...e }, s)) }));

// ───────────── Reconstrucción corporal 8 semanas (programa insignia) ─────────────
function reconstruccion(): ProgramSession[] {
  const extra = (p: number) => ses(p, 4, "Extra: brazos, hombros y core", "Opcional. Si te sobra energía esta semana, suma esta sesión corta.", [
    x("lateral", 3, 12, 15, 45, { tempo: I }), x("hammer", 2, 10, 12, 60, { tempo: I }), x("pushupd", 2, 8, 12, 60, { tempo: I }), x("bicycle", 2, 16, 24, 45),
  ], true);
  const p1 = [
    ses(1, 1, "Cuerpo completo A", "Sentadilla, empuje y tirón con cargas cómodas", [
      x("goblet", 3, 10, 12, 90, { tempo: S, note: "Baja hasta que la cadera pase la rodilla si tu movilidad lo permite." }),
      x("bench", 3, 8, 12, 120, { tempo: S }),
      x("lat", 3, 10, 12, 90, { tempo: I }),
      x("rdl", 3, 8, 12, 120, { tempo: S, note: "Espalda neutra; la barra baja pegada a las piernas." }),
      x("plank", 3, 30, 45, 45, { unit: "s" }),
    ]),
    ses(1, 2, "Cuerpo completo B", "Glúteo, hombro y espalda", [
      x("ds:1409", 3, 10, 12, 90, { tempo: I, note: "Pausa de 1 s arriba apretando glúteos.", home: "glutebridge" }),
      x("dbpress", 3, 8, 12, 90, { tempo: S }),
      x("dbrow", 3, 10, 12, 90, { tempo: I, note: "Repeticiones por brazo." }),
      x("bulgarian", 3, 8, 10, 90, { tempo: S, note: "Repeticiones por pierna." }),
      x("ds:0586", 2, 10, 12, 60, { tempo: I, home: "slrdl" }),
      x("kneeraise", 2, 8, 12, 60),
    ]),
    ses(1, 3, "Cuerpo completo C", "Pierna, pecho y espalda con más repeticiones", [
      x("ds:0739", 3, 10, 15, 120, { tempo: S, home: "goblet" }),
      x("incline", 3, 8, 12, 120, { tempo: S }),
      x("ds:0861", 3, 10, 12, 90, { tempo: I, home: "dbrow" }),
      x("pushup", 2, 8, 15, 60),
      x("facepull", 2, 12, 15, 60, { tempo: I }),
      x("carry", 3, 30, 40, 60, { unit: "m" }),
    ]),
    extra(1),
  ];
  const p2 = [
    ses(2, 1, "Fuerza A", "Sentadilla y press banca pesados", [
      x("squat", 4, 6, 8, 180, { tempo: S, note: "Si aún no dominas la sentadilla con barra, cámbiala por la goblet." }),
      x("bench", 4, 6, 10, 150, { tempo: S }),
      x("lat", 3, 8, 12, 90, { tempo: I }),
      x("rdl", 3, 8, 10, 150, { tempo: S }),
      x("lateral", 2, 12, 15, 45, { tempo: I }),
      x("plank", 3, 30, 45, 45, { unit: "s" }),
    ]),
    ses(2, 2, "Fuerza B", "Glúteo pesado, hombro y espalda", [
      x("ds:1409", 4, 8, 12, 120, { tempo: I, note: "Pausa de 1 s arriba apretando glúteos.", home: "glutebridge" }),
      x("dbpress", 3, 8, 10, 120, { tempo: S }),
      x("dbrow", 4, 8, 12, 90, { tempo: I, note: "Repeticiones por brazo." }),
      x("bulgarian", 3, 8, 12, 90, { tempo: S, note: "Repeticiones por pierna." }),
      x("ds:0586", 3, 10, 12, 60, { tempo: I, home: "slrdl" }),
      x("hammer", 2, 10, 12, 60, { tempo: I }),
    ]),
    ses(2, 3, "Volumen C", "Más repeticiones para sumar músculo", [
      x("ds:0739", 3, 10, 15, 120, { tempo: S, home: "goblet" }),
      x("incline", 3, 8, 12, 120, { tempo: S }),
      x("ds:0861", 3, 10, 12, 90, { tempo: I, home: "dbrow" }),
      x("pushup", 3, 10, 20, 60),
      x("facepull", 3, 12, 15, 60, { tempo: I }),
      x("kneeraise", 3, 10, 15, 60),
    ]),
    extra(2),
  ];
  const deload = copyPhase(p2, 2, 3, (e) => e, "Semana ligera: el motor baja la carga un 10 % y quita una serie. Llega descansado al cierre.");
  const cierre = copyPhase(p2, 2, 4, (e) => (["squat", "bench", "ds:1409"].includes(e.id) ? { ...e, sets: 3, lo: 5, hi: 8 } : e), "Semana de cierre: iguala o supera tus marcas de la semana 6 y compara con el día 1.");
  return [...p1, ...p2, ...deload, ...cierre];
}

// ───────────── Glúteos de acero (6 semanas) ─────────────
function gluteos(): ProgramSession[] {
  const p1 = [
    ses(1, 1, "Glúteo fuerte", "Puente con barra, sentadilla y bisagra de cadera", [
      x("ds:1409", 3, 10, 12, 90, { tempo: I, note: "Pausa de 1 s arriba apretando glúteos; mentón adentro.", home: "glutebridge" }),
      x("goblet", 3, 10, 12, 90, { tempo: S }),
      x("rdl", 3, 10, 12, 120, { tempo: S, note: "Empuja la cadera hacia atrás hasta sentir el estiramiento." }),
      x("ds:0597", 2, 15, 20, 45, { tempo: I, home: "ds:0710" }),
      x("plank", 2, 30, 45, 45, { unit: "s" }),
    ]),
    ses(1, 2, "Una pierna y espalda", "Trabajo unilateral y tren superior", [
      x("bulgarian", 3, 8, 12, 90, { tempo: S, note: "Por pierna. Inclina un poco el torso al frente para cargar más el glúteo." }),
      x("ds:0381", 2, 10, 12, 90, { tempo: I, note: "Por pierna.", home: "lunge" }),
      x("ds:0228", 3, 12, 15, 45, { tempo: I, note: "Por pierna. Sin arquear la espalda baja.", home: "glutebridge" }),
      x("lat", 3, 10, 12, 90, { tempo: I }),
      x("dbpress", 2, 10, 12, 90, { tempo: S }),
    ]),
    ses(1, 3, "Glúteo volumen", "Más repeticiones y pausas arriba", [
      x("ds:0739", 3, 12, 15, 90, { tempo: S, note: "Pies altos y separados en la plataforma.", home: "goblet" }),
      x("ds:1409", 3, 12, 15, 60, { tempo: "2-2-1", note: "Pausa de 2 s arriba.", home: "glutebridge" }),
      x("ds:1757", 2, 10, 12, 60, { tempo: S, note: "Por pierna.", home: "slrdl" }),
      x("ds:0597", 2, 15, 20, 45, { tempo: I, home: "ds:0710" }),
      x("dbrow", 3, 10, 12, 90, { tempo: I, note: "Por brazo." }),
    ]),
  ];
  const p2 = [
    ses(2, 1, "Glúteo fuerte", "Más carga en el puente y la sentadilla", [
      x("ds:1409", 4, 8, 10, 120, { tempo: I, note: "Pausa de 1 s arriba apretando glúteos.", home: "glutebridge" }),
      x("squat", 3, 6, 10, 150, { tempo: S, note: "En casa se cambia por sentadilla goblet." }),
      x("rdl", 3, 8, 10, 120, { tempo: S }),
      x("ds:0597", 3, 15, 20, 45, { tempo: I, home: "ds:0710" }),
      x("plank", 2, 30, 45, 45, { unit: "s" }),
    ]),
    ses(2, 2, "Una pierna y espalda", "Unilateral más pesado", [
      x("bulgarian", 3, 8, 12, 90, { tempo: S, note: "Por pierna." }),
      x("ds:0381", 3, 10, 12, 90, { tempo: I, note: "Por pierna.", home: "lunge" }),
      x("ds:0228", 3, 12, 15, 45, { tempo: I, note: "Por pierna.", home: "glutebridge" }),
      x("lat", 3, 8, 12, 90, { tempo: I }),
      x("dbpress", 3, 8, 12, 90, { tempo: S }),
    ]),
    ses(2, 3, "Glúteo volumen", "Prensa, puente con pausa y peso muerto a una pierna", [
      x("ds:0739", 4, 10, 15, 120, { tempo: S, note: "Pies altos y separados.", home: "goblet" }),
      x("ds:1409", 3, 12, 15, 60, { tempo: "2-2-1", note: "Pausa de 2 s arriba.", home: "glutebridge" }),
      x("ds:1757", 2, 10, 12, 60, { tempo: S, note: "Por pierna.", home: "slrdl" }),
      x("dbrow", 3, 10, 12, 90, { tempo: I, note: "Por brazo." }),
    ]),
  ];
  const pico = copyPhase(p2, 2, 3, (e, s) => (s.day === 1 && e.id === "ds:1409" ? { ...e, lo: 6, hi: 8, rest: 150 } : e), "Semana pico: más carga en el puente con barra. Compara tus números con la semana 1.");
  return [...p1, ...p2, ...pico];
}

// ───────────── Dominadas desde cero (6 semanas) ─────────────
function dominadas(): ProgramSession[] {
  return [
    ses(1, 1, "Tirón A", "Colgarte, retraer los omóplatos y remar", [
      x("ds:0688", 3, 5, 8, 90, { tempo: I, note: "Brazos rectos: baja y junta los omóplatos sin doblar los codos. Termina colgado 10 s." }),
      x("invrow", 3, 6, 10, 90, { tempo: I, note: "Más horizontal = más difícil." }),
      x("kneeraise", 2, 6, 10, 60, { note: "Colgado de la barra: también entrena tu agarre." }),
      x("pushup", 2, 6, 12, 60),
    ]),
    ses(1, 2, "Tirón B", "Dominadas asistidas y remo lento", [
      x("ds:0970", 3, 5, 8, 120, { tempo: S, note: "Sin banda: apoya un pie en una silla y ayúdate lo mínimo." }),
      x("invrow", 3, 8, 12, 90, { tempo: S }),
      x("ytw", 2, 8, 10, 45),
      x("plank", 2, 30, 40, 45, { unit: "s" }),
    ]),
    ses(1, 3, "Tirón C", "Escapulares y remo", [
      x("ds:0688", 3, 6, 10, 90, { tempo: I }),
      x("invrow", 3, 6, 10, 90, { tempo: I }),
      x("kneeraise", 2, 8, 12, 60),
    ]),
    ses(2, 1, "Negativas A", "Bajar despacio construye la fuerza para subir", [
      x("ds:0652", 4, 3, 5, 120, { note: "Negativa: sube con un salto o una silla y baja en 5 s, controlado." }),
      x("invrow", 3, 8, 12, 90, { tempo: S }),
      x("ds:0688", 2, 8, 10, 60, { tempo: I }),
      x("kneeraise", 2, 8, 12, 60),
    ]),
    ses(2, 2, "Asistidas B", "Volumen de tirón con ayuda", [
      x("ds:0970", 3, 5, 8, 120, { tempo: S, note: "Usa la banda más delgada con la que llegues al rango." }),
      x("invrow", 3, 8, 12, 90, { tempo: S }),
      x("pushup", 3, 8, 12, 60),
      x("plank", 2, 30, 45, 45, { unit: "s" }),
    ]),
    ses(2, 3, "Negativas C", "Negativas y espalda alta", [
      x("ds:0652", 4, 3, 5, 120, { note: "Negativa de 5 s. Si bajas en menos de 3 s, termina la serie." }),
      x("ds:0688", 3, 8, 10, 60, { tempo: I }),
      x("ytw", 2, 10, 12, 45),
    ]),
    ses(3, 1, "Intentos A", "Tu primera dominada estricta", [
      x("pullup", 5, 1, 3, 150, { note: "Intenta una dominada estricta. Si no sale, haz una negativa de 5 s en su lugar." }),
      x("ds:0652", 3, 3, 5, 120, { note: "Negativa de 5 s." }),
      x("invrow", 3, 8, 12, 90, { tempo: S }),
    ]),
    ses(3, 2, "Asistidas B", "Volumen con menos ayuda", [
      x("ds:0970", 3, 6, 8, 120, { tempo: S, note: "Banda más delgada que en la fase 2." }),
      x("invrow", 3, 10, 12, 90, { tempo: S }),
      x("pushup", 3, 8, 15, 60),
      x("kneeraise", 2, 10, 12, 60),
    ]),
    ses(3, 3, "Intentos C", "Prueba final de la semana", [
      x("pullup", 5, 1, 3, 150, { note: "Anota cuántas estrictas haces. La última semana es tu prueba." }),
      x("ds:0688", 3, 8, 10, 60, { tempo: I }),
      x("ytw", 2, 10, 12, 45),
    ]),
  ];
}

// ───────────── 21 días de abdomen (3 semanas) ─────────────
function abdomen(): ProgramSession[] {
  const set = (p: number, a: number, b: number) => [
    ses(p, 1, "Core firme", "Anti-extensión: que la espalda baja no se arquee", [
      x(p === 3 ? "plankrkc" : "plank", a, p === 3 ? 15 : 20 + p * 5, p === 3 ? 25 : 30 + p * 5, 45, { unit: "s" }),
      x("ds:0276", b, 8, 10, 45, { tempo: I, note: "Por lado. Espalda baja pegada al piso." }),
      x("ds:0872", 2, 10, 12, 45, { tempo: I }),
    ]),
    ses(p, 2, "Oblicuos", "Rotación y anti-rotación", [
      x("ds:0705", a, 15 + p * 5, 25 + p * 5, 30, { unit: "s", note: "Por lado." }),
      x("ds:0687", b, 12, 16, 45, { note: "Cuenta cada lado." }),
      x("bicycle", 2, 16, 20, 45),
    ]),
    ses(p, 3, "Abdomen inferior", "Elevaciones de piernas y estabilidad", [
      x(p === 3 ? "legraise" : "kneeraise", a, 6, 10, 60, { note: "Sin balanceo: sube con el abdomen, no con impulso." }),
      x("planktap", b, 16, 20, 45, { note: "Cadera quieta." }),
      x("mountain", 2, 20, 30, 30, { unit: "s" }),
    ]),
  ];
  return [...set(1, 2, 2), ...set(2, 3, 2), ...set(3, 3, 2)];
}

// ───────────── Pierde 3 kg en 6 semanas ─────────────
function pierde3kg(): ProgramSession[] {
  const intervals = (p: number) => ses(p, 3, "Intervalos suaves", "Cardio en intervalos: 40 s de trabajo y 20 s de descanso. Suma 8.000 a 10.000 pasos al día.", [
    x("jacks", p === 1 ? 3 : 4, 30, 40, 20, { unit: "s" }),
    x("bwsquat", p === 1 ? 3 : 4, 30, 40, 20, { unit: "s" }),
    x("mountain", p === 1 ? 3 : 4, 20, 30, 20, { unit: "s" }),
    x("glutebridge", p === 1 ? 3 : 4, 30, 40, 20, { unit: "s" }),
  ]);
  const p1 = [
    ses(1, 1, "Fuerza A", "Cuerpo completo: sentadilla, empuje y tirón", [
      x("goblet", 3, 10, 12, 90, { tempo: S }), x("bench", 3, 8, 12, 120, { tempo: S }), x("lat", 3, 10, 12, 90, { tempo: I }),
      x("rdl", 3, 8, 12, 120, { tempo: S }), x("plank", 2, 30, 45, 45, { unit: "s" }),
    ]),
    ses(1, 2, "Fuerza B", "Cuerpo completo: pierna, hombro y espalda", [
      x("ds:0739", 3, 10, 15, 120, { tempo: S, home: "goblet" }), x("dbpress", 3, 8, 12, 90, { tempo: S }), x("dbrow", 3, 10, 12, 90, { tempo: I, note: "Por brazo." }),
      x("ds:1409", 3, 10, 12, 90, { tempo: I, home: "glutebridge" }), x("kneeraise", 2, 8, 12, 60),
    ]),
    intervals(1),
    ses(1, 4, "Fuerza C", "Una pierna, pecho y paseo del granjero", [
      x("bulgarian", 3, 8, 10, 90, { tempo: S, note: "Por pierna." }), x("incline", 3, 8, 12, 120, { tempo: S }), x("ds:0861", 3, 10, 12, 90, { tempo: I, home: "dbrow" }),
      x("ds:0586", 2, 10, 12, 60, { tempo: I, home: "slrdl" }), x("carry", 3, 30, 40, 60, { unit: "m" }),
    ]),
  ];
  const p2 = [
    ses(2, 1, "Fuerza A", "Una serie más en los básicos", [
      x("goblet", 4, 8, 12, 120, { tempo: S }), x("bench", 4, 6, 10, 150, { tempo: S }), x("lat", 4, 8, 12, 90, { tempo: I }),
      x("rdl", 3, 8, 10, 120, { tempo: S }), x("plank", 2, 30, 45, 45, { unit: "s" }),
    ]),
    ses(2, 2, "Fuerza B", "Pierna, hombro y espalda", [
      x("ds:0739", 3, 10, 15, 120, { tempo: S, home: "goblet" }), x("dbpress", 3, 8, 12, 90, { tempo: S }), x("dbrow", 3, 8, 12, 90, { tempo: I, note: "Por brazo." }),
      x("ds:1409", 3, 8, 12, 90, { tempo: I, home: "glutebridge" }), x("kneeraise", 3, 8, 12, 60),
    ]),
    intervals(2),
    ses(2, 4, "Fuerza C", "Una pierna, pecho y espalda", [
      x("bulgarian", 3, 8, 12, 90, { tempo: S, note: "Por pierna." }), x("incline", 3, 8, 12, 120, { tempo: S }), x("ds:0861", 3, 10, 12, 90, { tempo: I, home: "dbrow" }),
      x("pushup", 2, 8, 15, 60), x("ds:0586", 2, 10, 12, 60, { tempo: I, home: "slrdl" }), x("carry", 3, 30, 40, 60, { unit: "m" }),
    ]),
  ];
  const cierre = copyPhase(p2, 2, 3, (e) => e, "Última semana: pésate y toma tus medidas el último día para comparar con el día 1.");
  return [...p1, ...p2, ...cierre];
}

// ───────────── Catálogo ─────────────

const RECON: ProgramMeta = {
  phases: [
    { name: "Base y técnica", weeks: 3, focus: "Aprende los movimientos con cargas cómodas. Termina cada serie con 2 a 3 repeticiones en reserva." },
    { name: "Construcción", weeks: 3, focus: "Más series en los básicos. Cuando llegas al tope del rango, el peso sube solo." },
    { name: "Descarga", weeks: 1, deload: true, focus: "Semana ligera para recuperarte y llegar fuerte al cierre." },
    { name: "Cierre", weeks: 1, focus: "Iguala o supera tus marcas y compara fuerza, peso y medidas con el día 1." },
  ],
  daysPerWeek: 4, sessionMinutes: 55, level: "principiante", equipment: "Gimnasio (se adapta a casa con mancuernas)", adapt: true,
  who: "Para quien bajó de peso rápido (con dieta estricta, ayuno o medicamentos como los GLP-1) y siente que perdió fuerza o firmeza. También si vuelves al gimnasio después de mucho tiempo.",
  result: "Recuperar músculo y fuerza en todo el cuerpo con 3 sesiones de cuerpo completo por semana, mientras cuidas el peso que ya bajaste.",
  outcomes: [
    "Cargas exactas en cada serie, que suben cuando estás listo",
    "3 sesiones de cuerpo completo por semana y una cuarta opcional",
    "Una semana de descarga antes del cierre",
    "Fuerza, peso y medidas comparados con tu día 1",
  ],
  keyLifts: ["bench", "rdl", "dbrow", "ds:1409"],
  nutrition: { mode: "recomp", proteinPerKg: 2.0, note: "Déficit pequeño y proteína alta: recuperas músculo sin recuperar la grasa." },
  previewExercise: "rdl",
};

const GLUTEOS: ProgramMeta = {
  phases: [
    { name: "Activación y técnica", weeks: 2, focus: "Aprende a sentir el glúteo en cada ejercicio con cargas moderadas." },
    { name: "Carga progresiva", weeks: 3, focus: "Más series y más peso en el puente con barra y la sentadilla." },
    { name: "Semana pico", weeks: 1, focus: "Carga más alta en el puente con barra y comparación con la semana 1." },
  ],
  daysPerWeek: 3, sessionMinutes: 45, level: "todos", equipment: "Gimnasio o casa con mancuernas", adapt: true,
  who: "Para quien quiere más glúteo y piernas más firmes, entrena en el gimnasio o en casa y busca un plan con pesos concretos en lugar de rutinas sueltas.",
  result: "Construir glúteo con 3 sesiones por semana enfocadas en puente con barra, sentadilla, peso muerto rumano y trabajo a una pierna.",
  outcomes: [
    "Unas 18 series semanales de trabajo directo de glúteo",
    "Versión para casa de cada ejercicio de máquina",
    "Pesos que suben solos con tu historial",
    "Comparación de fuerza en puente con barra y peso muerto rumano",
  ],
  keyLifts: ["ds:1409", "rdl", "ds:0739"],
  nutrition: { mode: "fuerza", proteinPerKg: 1.8, note: "Superávit pequeño (unas 250 kcal) y proteína alta: el músculo necesita energía para crecer." },
  previewExercise: "rdl",
};

const DOMINADAS: ProgramMeta = {
  phases: [
    { name: "Colgarte y retraer", weeks: 2, focus: "Dominadas escapulares, remo invertido y agarre." },
    { name: "Negativas", weeks: 2, focus: "Bajar despacio desde arriba construye la fuerza para subir." },
    { name: "Primera dominada", weeks: 2, focus: "Intentos de dominada estricta con negativas de respaldo." },
  ],
  daysPerWeek: 3, sessionMinutes: 30, level: "principiante", equipment: "Barra de dominadas (una banda elástica ayuda)", adapt: false,
  who: "Para quien todavía no hace una dominada, o hace una con impulso, y quiere un camino claro con una barra en casa o en el gimnasio.",
  result: "Intentar tu primera dominada estricta al final de las 6 semanas, con una espalda más fuerte en el camino.",
  outcomes: [
    "3 sesiones cortas por semana, de unos 30 minutos",
    "Progresión de escapulares a negativas y a intentos",
    "Registro de tus repeticiones en cada fase",
  ],
  keyLifts: ["invrow", "ds:0652", "pullup"],
  nutrition: null,
  previewExercise: "invrow",
};

const ABDOMEN: ProgramMeta = {
  phases: [
    { name: "Base", weeks: 1, focus: "Aprende a bloquear el core sin arquear la espalda." },
    { name: "Progresión", weeks: 1, focus: "Más series y más tiempo en las planchas." },
    { name: "Pico", weeks: 1, focus: "Variantes más difíciles: plancha RKC y elevación de piernas." },
  ],
  daysPerWeek: 3, sessionMinutes: 15, level: "todos", equipment: "Sin equipo (una barra para colgarte es opcional)", adapt: true,
  who: "Para quien quiere un core más fuerte y estable con sesiones cortas que caben en cualquier día.",
  result: "Fortalecer el abdomen al frente, los oblicuos y la estabilidad del core en 3 semanas. Que se vea el abdomen depende de tu grasa corporal, y eso lo mueve tu alimentación.",
  outcomes: [
    "3 sesiones de unos 15 minutos por semana",
    "Abdomen al frente, oblicuos y abdomen inferior",
    "Cada semana sube la exigencia",
  ],
  keyLifts: ["plank", "kneeraise"],
  nutrition: null,
  previewExercise: "plank",
};

const PIERDE: ProgramMeta = {
  phases: [
    { name: "Arranque", weeks: 2, focus: "Fuerza de cuerpo completo y el hábito de 4 sesiones por semana." },
    { name: "Progresión", weeks: 3, focus: "Una serie más en los básicos e intervalos más largos." },
    { name: "Cierre", weeks: 1, focus: "Misma estructura; el último día te pesas y tomas medidas." },
  ],
  daysPerWeek: 4, sessionMinutes: 45, level: "principiante", equipment: "Gimnasio o casa (se adapta a tu equipo)", adapt: true,
  who: "Para quien quiere bajar alrededor de 3 kg con un plan concreto de 6 semanas, sin perder el músculo que tiene.",
  result: "Bajar unos 0,5 kg por semana con 3 sesiones de fuerza y 1 de intervalos suaves, más el ajuste de calorías del programa. El resultado depende de tu punto de partida y de cómo comes.",
  outcomes: [
    "3 sesiones de fuerza y 1 de intervalos por semana",
    "Calorías y proteína del programa si tienes Entreno + Nutrición",
    "Peso y medidas comparados con el día 1",
  ],
  keyLifts: ["goblet", "bench", "rdl"],
  nutrition: { mode: "acelerada", proteinPerKg: 2.0, note: "Déficit moderado (unas 500 kcal) con proteína alta para que lo que bajes sea grasa y no músculo." },
  previewExercise: "bench",
};

const base = { featured: false, rewardTitle: null, safetyNote: null };

export const PROGRAM_SEED: ProgramSeed[] = [
  { ...base, slug: "reconstruccion-8-semanas", title: "Reconstrucción corporal 8 semanas", insert: true, featured: true, sort: 5, priceUsd: 9.99, cover: "noche", icon: "gorilla", difficulty: "media", minutes: 55,
    description: "Para recuperar el músculo y la fuerza que se van cuando bajas de peso rápido. 8 semanas de cuerpo completo, 3 días por semana más uno opcional, con cargas exactas que suben solas.",
    badge: "Cuerpo reconstruido", rewardTitle: "Reconstruido", xp: 400,
    safetyNote: "Si tomas medicamentos para bajar de peso, tienes una lesión o una condición médica, consulta con tu médico antes de empezar. Las dos primeras semanas usa cargas que puedas mover con técnica limpia: el programa sube el peso cuando estás listo.",
    meta: RECON, sessions: reconstruccion() },
  { ...base, slug: "gluteos-30", title: "Glúteos de acero", insert: false, sort: 110, priceUsd: 6.99, cover: "ember", icon: "bolt", difficulty: "media", minutes: 45,
    description: "Programa de 6 semanas para construir glúteo: puente con barra, sentadilla, peso muerto rumano y trabajo a una pierna, 3 días por semana. Funciona en el gimnasio o en casa con mancuernas.",
    badge: "Glúteos de acero", xp: 350, meta: GLUTEOS, sessions: gluteos() },
  { ...base, slug: "dominadas-desde-cero", title: "Dominadas desde cero", insert: false, sort: 130, priceUsd: 7.99, cover: "noche", icon: "barbell", difficulty: "dificil", minutes: 30,
    description: "De colgarte de la barra a intentar tu primera dominada estricta en 6 semanas: dominadas escapulares, remo invertido, negativas y asistidas. Necesitas una barra.",
    badge: "Primera dominada", rewardTitle: "Espalda fuerte", xp: 350, meta: DOMINADAS, sessions: dominadas() },
  { ...base, slug: "abdomen-21", title: "21 días de abdomen", insert: false, sort: 100, priceUsd: 4.99, cover: "noche", icon: "target", difficulty: "media", minutes: 15,
    description: "Programa de core de 3 semanas: 3 sesiones cortas por semana para el abdomen al frente, los oblicuos y la estabilidad. Cada semana sube la exigencia.",
    badge: "Abdomen de acero", rewardTitle: "Core fuerte", xp: 300, meta: ABDOMEN, sessions: abdomen() },
  { ...base, slug: "pierde-3kg-6-semanas", title: "Pierde 3 kg en 6 semanas", insert: false, sort: 120, priceUsd: 9.99, cover: "banana", icon: "trendDown", difficulty: "media", minutes: 45,
    description: "Plan de 6 semanas que apunta a bajar unos 0,5 kg por semana: 3 sesiones de fuerza y 1 de intervalos suaves cada semana, con el ajuste de calorías del programa. El resultado depende de tu punto de partida y de cómo comes.",
    badge: "Seis semanas firmes", rewardTitle: "Disciplina", xp: 400,
    safetyNote: "Bajar alrededor de 0,5 kg por semana es un ritmo seguro para la mayoría de adultos. No es una garantía: cada cuerpo responde distinto. Si estás embarazada, tienes una condición médica o tomas medicamentos, consulta con tu médico antes de empezar.",
    meta: PIERDE, sessions: pierde3kg() },
];


// ───────────── 0027: programas nuevos y la experiencia de cada programa ─────────────

// ───────────── Abdomen marcado (6 semanas) ─────────────
function abdomenMarcado(): ProgramSession[] {
  const quema = (p: number, w: number) => ses(p, 4, "Quema final", `Circuito de ${w} vueltas: 40 s de trabajo y 20 s de descanso. Cierra con plancha.`, [
    x("bwsquat", w, 30, 40, 20, { unit: "s" }), x("mountain", w, 25, 35, 20, { unit: "s" }), x("bicycle", w, 25, 35, 20, { unit: "s" }), x("jacks", w, 30, 40, 20, { unit: "s" }),
    x(p === 3 ? "plankrkc" : "plank", 2, p === 3 ? 20 : 30, p === 3 ? 30 : 45, 45, { unit: "s" }),
  ]);
  const p1 = [
    ses(1, 1, "Fuerza y core A", "Cuerpo completo con cargas cómodas y core anti-extensión", [
      x("goblet", 3, 10, 12, 90, { tempo: S }), x("dbrow", 3, 10, 12, 90, { tempo: I, note: "Por brazo." }), x("pushup", 3, 8, 12, 60),
      x("ds:0276", 3, 8, 10, 45, { tempo: I, note: "Por lado. Espalda baja pegada al piso." }), x("plank", 3, 30, 45, 45, { unit: "s" }),
    ]),
    ses(1, 2, "Core y cardio", "Abdomen inferior, oblicuos e intervalos", [
      x("ds:0872", 3, 10, 15, 45, { tempo: I, note: "Sube la cadera con el abdomen, sin impulso." }), x("ds:0687", 3, 16, 20, 45, { note: "Cuenta cada lado." }),
      x("ds:0705", 3, 20, 30, 30, { unit: "s", note: "Por lado. Cadera alta." }), x("mountain", 4, 25, 30, 30, { unit: "s" }), x("jacks", 4, 30, 40, 20, { unit: "s" }),
    ]),
    ses(1, 3, "Fuerza y core B", "Bisagra de cadera, espalda y crunch con carga", [
      x("rdl", 3, 10, 12, 120, { tempo: S }), x("lat", 3, 10, 12, 90, { tempo: I }), x("incline", 3, 8, 12, 90, { tempo: S }),
      x("ds:0874", 3, 12, 15, 45, { tempo: I, note: "Redondea la espalda llevando las costillas a la cadera.", home: "ds:0274" }), x("planktap", 2, 16, 20, 45, { note: "Cadera quieta." }),
    ]),
    quema(1, 3),
  ];
  const p2 = [
    ses(2, 1, "Fuerza y core A", "Más series en los básicos", [
      x("goblet", 4, 8, 12, 120, { tempo: S }), x("dbrow", 4, 8, 12, 90, { tempo: I, note: "Por brazo." }), x("pushup", 3, 10, 15, 60),
      x("ds:0276", 3, 10, 12, 45, { tempo: I, note: "Por lado." }), x("plank", 3, 40, 60, 45, { unit: "s" }),
    ]),
    ses(2, 2, "Core y cardio", "Más tiempo bajo tensión y un intervalo más", [
      x("kneeraise", 3, 8, 12, 60, { note: "Colgado o en el piso: sube con el abdomen, sin balanceo." }), x("ds:0687", 3, 20, 24, 45, { note: "Cuenta cada lado." }),
      x("ds:0705", 3, 30, 40, 30, { unit: "s", note: "Por lado." }), x("mountain", 5, 30, 35, 25, { unit: "s" }), x("jacks", 5, 35, 40, 20, { unit: "s" }),
    ]),
    ses(2, 3, "Fuerza y core B", "Bisagra pesada y crunch con carga", [
      x("rdl", 4, 8, 10, 120, { tempo: S }), x("lat", 3, 8, 12, 90, { tempo: I }), x("incline", 3, 8, 10, 120, { tempo: S }),
      x("ds:0874", 3, 12, 15, 45, { tempo: I, home: "ds:0274" }), x("suitcase", 3, 20, 30, 60, { unit: "m", note: "Por lado. No dejes que el peso te incline." }),
    ]),
    quema(2, 4),
  ];
  const pico = copyPhase(p2, 2, 3, (e) => (e.id === "plank" ? { ...e, id: "plankrkc", lo: 20, hi: 30 } : e.id === "kneeraise" ? { ...e, id: "legraise", lo: 6, hi: 10 } : e), "Semana pico: variantes más difíciles. El último día toma tu medida de cintura y tu foto.");
  return [...p1, ...p2, ...pico.map((s) => (s.day === 4 ? quema(3, 5) : s))];
}

// ───────────── Brazos definidos (6 semanas) ─────────────
// Especialización de brazos: bíceps, tríceps y hombros en las 4 sesiones, con énfasis en la posición estirada
// (curl inclinado, extensión de tríceps sobre la cabeza), que en los estudios recientes hace crecer más el músculo.
function brazos(): ProgramSession[] {
  const bombeo = (p: number) => ses(p, 4, "Bombeo de brazos", "Opcional, 20 minutos: series ligeras y descansos cortos para bíceps, tríceps y hombro.", [
    x("curlp", 3, 10, 12, 45, { tempo: "2-1-1" }), x("ds:0333", 3, 12, 15, 45, { tempo: I, note: "Codo pegado al cuerpo; estira el brazo del todo." }),
    x("lateral", 3, 15, 20, 30, { tempo: I }), x("hammer", 2, 12, 15, 45), x("pushupd", 2, 8, 15, 45),
  ], true);
  const set = (p: number, plus: number, lo: number, hi: number) => [
    ses(p, 1, "Bíceps y espalda", "Tirones pesados y curl en estiramiento", [
      x("lat", 3, 8, 12, 90, { tempo: I, note: "Agarre supino (palmas hacia ti) para que trabaje más el bíceps." }),
      x("ds:0318", 3 + plus, 8, 12, 75, { tempo: S, note: "Brazos colgando detrás del cuerpo: el bíceps trabaja estirado." }),
      x("curl", 3, lo, hi, 75, { tempo: S, note: "Codos quietos al costado; baja en 3 s." }),
      x("hammer", 2 + plus, 10, 12, 60, { tempo: I }),
      x("ds:0297", 2, 12, 15, 45, { tempo: S, note: "Por brazo. Aprieta arriba 1 s." }),
    ]),
    ses(p, 2, "Tríceps y pecho", "Press cerrado y tríceps estirado sobre la cabeza", [
      x("closebench", 3, lo - 2, hi - 2, 120, { tempo: S, note: "Manos al ancho de los hombros; codos cerca del cuerpo." }),
      x("ds:0194", 3 + plus, 10, 12, 75, { tempo: S, note: "Estira del todo arriba de la cabeza: el tríceps largo crece más así.", home: "ds:0430" }),
      x("ds:0201", 3, 10, 15, 60, { tempo: I, note: "Codos pegados; estira del todo abajo.", home: "ds:0333" }),
      x("pushupd", 2 + plus, 8, 15, 60),
    ]),
    ses(p, 3, "Hombros y brazos", "Hombro ancho y un bombeo final de bíceps y tríceps", [
      x("dbpress", 3, lo, hi, 90, { tempo: S }),
      x("lateral", 4, 12, 20, 45, { tempo: I, note: "Sube hasta la altura del hombro, sin impulso." }),
      x("ds:2292", 3, 12, 15, 45, { tempo: I }),
      x("curlp", 2 + plus, 10, 12, 60, { tempo: "2-1-1" }),
      x("ds:0333", 2 + plus, 12, 15, 45, { tempo: I }),
    ]),
    bombeo(p),
  ];
  const pico = copyPhase(set(2, 1, 8, 12), 2, 3, (e) => (["curl", "closebench", "dbpress"].includes(e.id) ? { ...e, lo: 6, hi: 8 } : e), "Semana pico: más carga en curl, press cerrado y press de hombro. Toma tu foto y mide tu brazo el último día.");
  return [...set(1, 0, 8, 12), ...set(2, 1, 8, 12), ...pico];
}

// ───────────── Banana Girl (6 semanas) ─────────────
function bananaGirl(): ProgramSession[] {
  const cintura = (p: number) => ses(p, 4, "Cintura y cardio suave", "Core sin impacto y un circuito para sudar sin saltos.", [
    x("ds:0276", p === 1 ? 2 : 3, 8, 12, 45, { tempo: I, note: "Por lado. Espalda baja pegada al piso." }),
    x("ds:0705", p === 1 ? 2 : 3, 20, 35, 30, { unit: "s", note: "Por lado." }), x("ds:0687", 2, 16, 20, 45, { note: "Cuenta cada lado." }),
    x("bwsquat", p === 1 ? 3 : 4, 30, 40, 20, { unit: "s" }), x("ds:3561", p === 1 ? 3 : 4, 30, 40, 20, { unit: "s", note: "Cadera alta mientras marchas." }),
  ]);
  const p1 = [
    ses(1, 1, "Glúteo y pierna", "Aprende a sentir el glúteo en cada repetición", [
      x("ds:1409", 3, 10, 12, 90, { tempo: I, note: "Pausa de 1 s arriba; mentón adentro.", home: "glutebridge" }), x("goblet", 3, 10, 12, 90, { tempo: S }),
      x("ds:0597", 3, 15, 20, 45, { tempo: I, home: "ds:0710" }), x("ds:0381", 2, 8, 10, 75, { tempo: S, note: "Por pierna." }),
    ]),
    ses(1, 2, "Brazos, espalda y postura", "Brazos firmes y hombros atrás", [
      x("lat", 3, 10, 12, 90, { tempo: I, note: "Lleva los codos a los bolsillos." }), x("dbpress", 3, 10, 12, 90, { tempo: S }),
      x("ds:0333", 2, 12, 15, 45, { tempo: I }), x("hammer", 2, 10, 12, 60, { tempo: I }), x("ytw", 2, 8, 10, 45, { note: "Despacio; aprieta entre los omóplatos." }),
    ]),
    ses(1, 3, "Glúteo y femoral", "Bisagra de cadera y trabajo a una pierna", [
      x("rdl", 3, 10, 12, 120, { tempo: S, note: "Cadera atrás hasta sentir el estiramiento." }), x("ds:0431", 3, 8, 10, 75, { tempo: S, note: "Por pierna. Empuja con el talón." }),
      x("ds:0228", 2, 12, 15, 45, { tempo: I, note: "Por pierna. Sin arquear la espalda.", home: "ds:3561" }), x("ds:0628", 2, 12, 16, 45, { note: "Pasos por lado, con banda si tienes." }),
    ]),
    cintura(1),
  ];
  const p2 = [
    ses(2, 1, "Glúteo y pierna", "Más carga en el puente y la sentadilla", [
      x("ds:1409", 4, 8, 12, 120, { tempo: I, note: "Pausa de 1 s arriba.", home: "glutebridge" }), x("goblet", 4, 8, 12, 120, { tempo: S }),
      x("ds:0597", 3, 15, 20, 45, { tempo: I, home: "ds:0710" }), x("ds:0381", 3, 8, 12, 75, { tempo: S, note: "Por pierna." }),
    ]),
    ses(2, 2, "Brazos, espalda y postura", "Una serie más para brazos y espalda", [
      x("lat", 4, 8, 12, 90, { tempo: I }), x("dbpress", 3, 8, 12, 90, { tempo: S }), x("ds:0333", 3, 12, 15, 45, { tempo: I }),
      x("hammer", 3, 10, 12, 60, { tempo: I }), x("ytw", 2, 10, 12, 45),
    ]),
    ses(2, 3, "Glúteo y femoral", "Bisagra más pesada y subida al cajón", [
      x("rdl", 4, 8, 10, 120, { tempo: S }), x("ds:0431", 3, 10, 12, 75, { tempo: S, note: "Por pierna." }),
      x("ds:0228", 3, 12, 15, 45, { tempo: I, note: "Por pierna.", home: "ds:3561" }), x("ds:0628", 2, 14, 20, 45, { note: "Pasos por lado." }),
    ]),
    cintura(2),
  ];
  const brilla = copyPhase(p2, 2, 3, (e) => (e.id === "ds:1409" || e.id === "goblet" ? { ...e, lo: 6, hi: 10 } : e), "Semana para brillar: tus pesos más altos. Toma tus medidas y tu foto el último día y compara con el día 1.");
  return [...p1, ...p2, ...brilla];
}

// ───────────── Glúteos de acero v2 (0027): especialización completa de glúteo ─────────────
// Cada sesión es de glúteo: empuje de cadera (hip thrust), sentadilla y zancada profundas (glúteo estirado),
// bisagra de cadera y abducción para la parte alta. 3 sesiones y 1 exprés opcional en casa.
function gluteosV2(): ProgramSession[] {
  const expres = (p: number) => ses(p, 4, "Glúteo exprés en casa", "Opcional, 20 minutos y sin equipo: bombeo y abducción para sumar volumen.", [
    x("glutebridge", 3, 15, 25, 45, { tempo: "2-2-1", note: "Pausa de 2 s arriba." }), x("ds:0710", 3, 15, 20, 30, { note: "Por pierna, despacio." }),
    x("ds:0628", 2, 12, 16, 30, { note: "Pasos por lado, con banda si tienes." }), x("ds:3561", 2, 30, 40, 30, { unit: "s" }),
  ], true);
  const set = (p: number, plus: number) => [
    ses(p, 1, "Glúteo pesado", "Hip thrust pesado, búlgara y peso muerto rumano", [
      x("ds:1409", 3 + plus, p === 1 ? 8 : 6, p === 1 ? 12 : 10, 120, { tempo: I, note: "Pausa de 1 s arriba; mentón adentro y costillas abajo.", home: "glutebridge" }),
      x("bulgarian", 3, 8, 12, 90, { tempo: S, note: "Por pierna. Torso un poco inclinado al frente y baja profundo." }),
      x("rdl", 3, 8, 10, 120, { tempo: S, note: "Cadera atrás hasta sentir el estiramiento; no redondees la espalda." }),
      x("ds:0597", 2 + plus, 12, 20, 45, { tempo: I, note: "Inclina el torso al frente para cargar la parte alta del glúteo.", home: "ds:0710" }),
    ]),
    ses(p, 2, "Glúteo estirado", "Profundidad: sentadilla, peso muerto a una pierna y subida al cajón", [
      x("goblet", 3 + plus, 8, 12, 120, { tempo: S, note: "Baja tan profundo como tu movilidad permita: el glúteo trabaja más estirado." }),
      x("ds:1757", 3, 8, 12, 75, { tempo: S, note: "Por pierna.", home: "slrdl" }),
      x("ds:0431", 3, 8, 12, 75, { tempo: S, note: "Por pierna. Cajón alto y empuja con el talón." }),
      x("ds:0228", 2 + plus, 12, 15, 45, { tempo: I, note: "Por pierna. Sin arquear la espalda baja.", home: "ds:3561" }),
    ]),
    ses(p, 3, "Glúteo bombeo", "Más repeticiones y pausas para el glúteo medio y mayor", [
      x("ds:1409", 3, 12, 15, 75, { tempo: "2-2-1", note: "Pausa de 2 s arriba.", home: "glutebridge" }),
      x("ds:0381", 3, 10, 12, 75, { tempo: S, note: "Por pierna. Paso largo hacia atrás." }),
      x("ds:1774", 2 + plus, 10, 15, 45, { note: "Por lado." }),
      x("ds:0628", 2, 12, 16, 45, { note: "Pasos por lado, con banda si tienes." }),
    ]),
    expres(p),
  ];
  const pico = copyPhase(set(2, 1), 2, 3, (e, ss) => (ss.day === 1 && e.id === "ds:1409" ? { ...e, lo: 5, hi: 8, rest: 150 } : e), "Semana pico: tu hip thrust más pesado. Mide tu cadera y toma tu foto el último día.");
  return [...set(1, 0), ...set(2, 1), ...pico];
}

const GLUTEOS_V2: ProgramMeta = {
  phases: [
    { name: "Activación y técnica", weeks: 2, focus: "Siente el glúteo en cada repetición: pausas arriba y bajadas lentas." },
    { name: "Carga progresiva", weeks: 3, focus: "Una serie más en hip thrust, sentadilla y abducción, y más peso cuando llegas al tope." },
    { name: "Semana pico", weeks: 1, focus: "Tu hip thrust más pesado y la comparación con la semana 1." },
  ],
  daysPerWeek: 4, sessionMinutes: 45, level: "todos", equipment: "Gimnasio o casa con mancuernas y banda", adapt: true,
  who: "Para quien quiere más glúteo y caderas más firmes, y puede entrenar glúteo 3 veces por semana durante 6 semanas, en el gimnasio o en casa.",
  result: "Construir glúteo con 3 sesiones dedicadas por semana y una exprés opcional: hip thrust, sentadilla y zancada profundas, bisagra de cadera y abducción para la parte alta.",
  outcomes: [
    "Glúteo en todas las sesiones: unas 20 a 25 series semanales",
    "Ejercicios en posición estirada (sentadilla profunda, búlgara) y en contracción (hip thrust)",
    "Versión para casa de cada ejercicio de máquina",
    "Fuerza en hip thrust y peso muerto rumano comparada con el día 1",
  ],
  keyLifts: ["ds:1409", "rdl", "goblet"],
  nutrition: { mode: "fuerza", proteinPerKg: 1.8, note: "Superávit pequeño (unas 200 a 300 kcal) y proteína alta: el glúteo necesita energía para crecer." },
  previewExercise: "rdl",
};

/** Programas de 0024 que 0027 rehace (sesiones y meta nuevas; mismas compras). */
export const PROGRAM_UPGRADES: Record<string, Pick<ProgramSeed, "description" | "minutes" | "meta" | "sessions">> = {
  "gluteos-30": {
    description: "6 semanas de especialización en glúteo: hip thrust, sentadilla y zancada profundas, peso muerto rumano y abducción, 3 sesiones dedicadas y 1 exprés opcional por semana. En el gimnasio o en casa.",
    minutes: 45, meta: GLUTEOS_V2, sessions: gluteosV2(),
  },
};

const ABDOMEN_MARCADO: ProgramMeta = {
  phases: [
    { name: "Base", weeks: 2, focus: "Core estable, fuerza de cuerpo completo y el hábito de 4 sesiones por semana." },
    { name: "Quema", weeks: 3, focus: "Más series, más tiempo en las planchas y un intervalo más en el circuito." },
    { name: "Pico", weeks: 1, focus: "Variantes más difíciles y tu medida de cintura del último día." },
  ],
  daysPerWeek: 4, sessionMinutes: 40, level: "todos", equipment: "Gimnasio o casa con mancuernas", adapt: true,
  who: "Para quien quiere ver su abdomen más marcado: core fuerte, cintura más pequeña y menos grasa abdominal, sin pasar horas haciendo abdominales.",
  result: "Bajar grasa y fortalecer el abdomen con 2 sesiones de fuerza y core, 1 de core y cardio y 1 circuito de quema por semana. Que se marque depende de tu grasa corporal: por eso el programa ajusta tu comida y tus pasos.",
  outcomes: [
    "4 sesiones de unos 40 minutos por semana",
    "Abdomen al frente, oblicuos, abdomen inferior y core profundo",
    "Calorías y proteína del programa si tienes Entreno + Nutrición",
    "Medida de cintura y foto comparadas con el día 1",
  ],
  keyLifts: ["plank", "rdl", "goblet"],
  nutrition: { mode: "acelerada", proteinPerKg: 2.0, note: "Déficit moderado y proteína alta: el abdomen se marca cuando baja la grasa, sin perder músculo." },
  previewExercise: "plank",
};

const BRAZOS: ProgramMeta = {
  phases: [
    { name: "Base", weeks: 2, focus: "Técnica estricta en curl, tríceps y press. Codos quietos, bajadas lentas." },
    { name: "Volumen", weeks: 3, focus: "Una serie más en los principales. Cuando llegas al tope del rango, sube el peso." },
    { name: "Pico", weeks: 1, focus: "Más carga en los básicos y la foto de tus brazos del último día." },
  ],
  daysPerWeek: 4, sessionMinutes: 45, level: "todos", equipment: "Gimnasio (se adapta a casa con mancuernas)", adapt: true,
  who: "Para quien quiere brazos firmes y definidos: bíceps, tríceps y hombros como prioridad durante 6 semanas.",
  result: "Construir bíceps, tríceps y hombros con 3 sesiones de brazos por semana y una de bombeo opcional, con ejercicios en posición estirada y pesos que suben solos. Mantén tus pasos para cuidar las piernas.",
  outcomes: [
    "Unas 14 a 18 series semanales de bíceps y de tríceps",
    "Hombro lateral y posterior para un brazo que se ve más ancho",
    "Sesión opcional de bombeo de 20 minutos",
    "Fuerza en curl y press cerrado comparada con el día 1",
  ],
  keyLifts: ["curl", "closebench", "dbpress"],
  nutrition: { mode: "recomp", proteinPerKg: 1.8, note: "Déficit pequeño y proteína alta: ganas músculo en los brazos mientras se ve más la definición." },
  previewExercise: "curl",
};

const BANANA_GIRL: ProgramMeta = {
  phases: [
    { name: "Aprende y activa", weeks: 2, focus: "Siente el glúteo, cuida la postura y aprende cada movimiento sin prisa." },
    { name: "Tonifica", weeks: 3, focus: "Más series y más peso en glúteo y brazos. Tu cuerpo se pone firme." },
    { name: "Brilla", weeks: 1, focus: "Tus pesos más altos y la comparación con tu día 1." },
  ],
  daysPerWeek: 4, sessionMinutes: 45, level: "principiante", equipment: "Gimnasio o casa con mancuernas", adapt: true,
  who: "Para chicas que quieren glúteos más firmes, cintura definida, brazos tonificados y mejor postura, con un plan claro y amable desde el primer día.",
  result: "Tonificar todo el cuerpo con prioridad en glúteo: 2 sesiones de glúteo y pierna, 1 de brazos y postura y 1 de cintura y cardio suave por semana.",
  outcomes: [
    "4 sesiones de unos 45 minutos por semana",
    "Glúteo en 3 de las 4 sesiones",
    "Brazos y espalda para una postura erguida",
    "Cardio suave sin saltos y hábitos de autocuidado cada día",
  ],
  keyLifts: ["ds:1409", "goblet", "rdl"],
  nutrition: { mode: "recomp", proteinPerKg: 1.6, note: "Déficit pequeño y proteína suficiente: tonificas sin pasar hambre." },
  previewExercise: "rdl",
};

/** Lo que cada programa cambia en la app mientras está activo. Para los de 0024 se agrega en 0027 sin pisar ediciones del panel. */
export const EXPERIENCES: Record<string, ProgramExperience> = {
  "reconstruccion-8-semanas": {
    mode: "Modo reconstrucción",
    welcome: "Empieza tu reconstrucción. Estas primeras semanas usa cargas cómodas y técnica limpia: el programa sube el peso cuando estás listo.",
    habits: [
      { key: "entreno", label: "Sesión del programa", kind: "entreno" },
      { key: "proteina", label: "Proteína en cada comida", kind: "proteina" },
      { key: "pasos", label: "Camina 8.000 pasos", kind: "pasos", target: 8000 },
      { key: "sueno", label: "Duerme 7 horas", kind: "sueno", target: 7 },
    ],
    tips: [
      "Semana 1: el objetivo es aprender. Termina cada serie sintiendo que podías hacer 2 o 3 repeticiones más.",
      "Semana 2: anota cada serie. Si completas el rango con buena técnica, el peso sube solo la próxima vez.",
      "Semana 3: la proteína es tu ladrillo. Busca una porción del tamaño de tu mano en cada comida.",
      "Semana 4: empieza la construcción. Más series en los básicos; descansa completo entre series pesadas.",
      "Semana 5: si un día llegas sin energía, haz la sesión con el mismo peso. Constancia antes que heroísmo.",
      "Semana 6: compara tus pesos con la semana 1. Ese es el músculo que estás recuperando.",
      "Semana 7: semana ligera. Bajar la carga ahora te deja llegar fuerte al cierre.",
      "Semana 8: cierre. Iguala o supera tus marcas y toma tus medidas el último día.",
    ],
    coachFocus: "Recuperar músculo y fuerza después de bajar de peso rápido, sin recuperar la grasa. Prioriza técnica, proteína y progresión de cargas.",
    restDay: "Descanso activo: camina 20 minutos y estira 10",
    food: ["Proteína en cada comida: pollo, huevo, pescado, frijoles con queso o yogur griego.", "Déficit pequeño: no recortes más comida. Tu músculo necesita energía para reconstruirse.", "Antes de entrenar, algo con carbohidrato: arroz, pan, fruta o avena.", "Si usas GLP-1, come la proteína primero, aunque tengas poco apetito."],
  },
  "gluteos-30": {
    mode: "Modo glúteo",
    welcome: "Empieza Glúteos de acero. Antes de cada sesión, activa tu glúteo 5 minutos: lo vas a sentir mucho más en cada repetición.",
    habits: [
      { key: "entreno", label: "Sesión del programa", kind: "entreno" },
      { key: "activacion", label: "Activación de glúteo de 5 minutos", kind: "check" },
      { key: "proteina", label: "Proteína en cada comida", kind: "proteina" },
      { key: "pasos", label: "Camina 8.000 pasos", kind: "pasos", target: 8000 },
    ],
    tips: [
      "Semana 1: en el puente con barra, pausa 1 segundo arriba y aprieta. Si sientes la espalda baja, mete el mentón y las costillas.",
      "Semana 2: en el peso muerto rumano la cadera va hacia atrás, no hacia abajo. Para cuando sientas el estiramiento detrás del muslo.",
      "Semana 3: el glúteo crece con carga. Si completas el rango, deja que el peso suba aunque te dé miedo.",
      "Semana 4: en la búlgara, inclina un poco el torso al frente para que trabaje más el glúteo.",
      "Semana 5: come suficiente. Un superávit pequeño y proteína alta son la energía que tu glúteo necesita para crecer.",
      "Semana 6: semana pico. Prueba tu mejor puente con barra y compara con la semana 1.",
    ],
    coachFocus: "Construir glúteo: técnica del puente con barra, bisagra de cadera y trabajo a una pierna, con superávit pequeño y proteína alta.",
    restDay: "Descanso activo: 10 minutos de puente de glúteo y estiramiento de cadera",
    food: ["Come un poco más de lo que gastas: unas 250 kcal extra al día, sobre todo en carbohidratos alrededor del entreno.", "Proteína en cada comida, también en el desayuno: huevos, yogur griego o queso.", "Arroz, papa, plátano, avena y tortillas son tus aliados: el glúteo crece con energía.", "Después de entrenar: proteína y carbohidrato en la siguiente comida."],
  },
  "dominadas-desde-cero": {
    mode: "Modo dominada",
    welcome: "Empieza Dominadas desde cero. Cada sesión cuenta: colgarte, retraer y bajar despacio construyen la fuerza para subir.",
    habits: [
      { key: "entreno", label: "Sesión del programa", kind: "entreno" },
      { key: "colgarte", label: "Cuélgate de la barra 3 veces 20 segundos", kind: "check" },
      { key: "proteina", label: "Proteína en cada comida", kind: "proteina" },
      { key: "sueno", label: "Duerme 7 horas", kind: "sueno", target: 7 },
    ],
    tips: [
      "Semana 1: en la dominada escapular los brazos no se doblan. Solo bajas y juntas los omóplatos.",
      "Semana 2: tu agarre también se entrena. Colgarte unos segundos extra al final de cada serie suma.",
      "Semana 3: en las negativas, cuenta 5 segundos en la bajada. Si bajas en menos de 3, termina la serie.",
      "Semana 4: usa la banda más delgada con la que llegues al rango. Menos ayuda, más fuerza.",
      "Semana 5: intenta tu primera dominada estricta al empezar la sesión, cuando estás fresco.",
      "Semana 6: semana de prueba. Anota cuántas estrictas haces y compáralo con el día 1.",
    ],
    coachFocus: "Lograr la primera dominada estricta: progresión de escapulares a negativas y a intentos, agarre y espalda.",
    restDay: "Descanso activo: cuélgate de la barra 3 veces y camina 20 minutos",
    food: ["Proteína en cada comida para que tu espalda se haga más fuerte.", "Si quieres que la dominada salga antes, bajar un poco de grasa ayuda: menos peso que subir.", "Carbohidrato antes de entrenar para tener fuerza en los intentos.", "Agua durante el día: el agarre se cansa antes cuando estás deshidratado."],
  },
  "abdomen-21": {
    mode: "Modo core",
    welcome: "Empieza 21 días de abdomen. Sesiones cortas, core bloqueado y espalda baja protegida en cada ejercicio.",
    habits: [
      { key: "entreno", label: "Sesión del programa", kind: "entreno" },
      { key: "core", label: "1 minuto de plancha extra", kind: "check" },
      { key: "agua", label: "Toma 8 vasos de agua", kind: "agua", target: 8 },
      { key: "pasos", label: "Camina 8.000 pasos", kind: "pasos", target: 8000 },
    ],
    tips: [
      "Semana 1: en la plancha, aprieta glúteos y lleva el ombligo hacia la columna. Calidad antes que segundos.",
      "Semana 2: en los oblicuos, gira desde el torso y no desde los brazos.",
      "Semana 3: semana pico. Que se vea el abdomen depende de tu grasa corporal: cuida tu comida y tus pasos.",
    ],
    coachFocus: "Core fuerte y estable: anti-extensión, oblicuos y abdomen inferior con la espalda baja protegida.",
    restDay: "Descanso activo: camina 20 minutos y 2 minutos de plancha",
    food: ["Que se vea el abdomen depende de tu grasa corporal: cuida las porciones.", "Fibra en cada comida: frutas, verduras, frijoles y avena te mantienen lleno.", "Cambia las bebidas azucaradas por agua o café sin azúcar.", "Proteína en cada comida para cuidar tu músculo mientras bajas."],
  },
  "pierde-3kg-6-semanas": {
    mode: "Modo quema",
    welcome: "Empieza Pierde 3 kg. Fuerza para cuidar tu músculo, intervalos suaves y pasos cada día: el déficit hace el resto.",
    habits: [
      { key: "entreno", label: "Sesión del programa", kind: "entreno" },
      { key: "pasos", label: "Camina 10.000 pasos", kind: "pasos", target: 10000 },
      { key: "agua", label: "Toma 8 vasos de agua", kind: "agua", target: 8 },
      { key: "proteina", label: "Proteína en cada comida", kind: "proteina" },
    ],
    tips: [
      "Semana 1: pésate 3 mañanas por semana, al despertar. La app usa la tendencia, no el número de un día.",
      "Semana 2: los pasos suman más de lo que parece. Camina 10 minutos después de cada comida.",
      "Semana 3: si la báscula se detiene, mira tus medidas. A veces bajas cintura antes que kilos.",
      "Semana 4: la proteína te mantiene lleno. Empieza cada comida por ella.",
      "Semana 5: duerme 7 horas. Dormir poco sube el hambre al día siguiente.",
      "Semana 6: última semana. Pésate y mide tu cintura el último día para comparar con el día 1.",
    ],
    coachFocus: "Bajar unos 0,5 kg por semana sin perder músculo: déficit moderado, proteína alta, pasos y fuerza.",
    restDay: "Descanso activo: camina 30 minutos",
    food: ["Déficit moderado: unas 500 kcal menos al día, no más.", "Empieza cada comida por la proteína y las verduras.", "Las bebidas con azúcar y el alcohol son lo primero que conviene recortar.", "Ten listas comidas fáciles: pollo desmenuzado, huevos duros, frijoles y arroz."],
  },
  "abdomen-marcado": {
    mode: "Modo abdomen",
    welcome: "Empieza Abdomen marcado. Tu core se entrena en cada sesión, pero lo que lo deja ver es bajar la grasa: pasos, agua y comida cuentan igual que los ejercicios.",
    habits: [
      { key: "entreno", label: "Sesión del programa", kind: "entreno" },
      { key: "pasos", label: "Camina 10.000 pasos", kind: "pasos", target: 10000 },
      { key: "agua", label: "Toma 8 vasos de agua", kind: "agua", target: 8 },
      { key: "sin-azucar", label: "Cero bebidas azucaradas hoy", kind: "check" },
    ],
    tips: [
      "Semana 1: mide tu cintura a la altura del ombligo, en ayunas. Es tu número del día 1.",
      "Semana 2: en el dead bug, la espalda baja no se despega del piso. Si se despega, acorta el movimiento.",
      "Semana 3: las bebidas azucaradas son las calorías más fáciles de quitar. Cámbialas por agua o café sin azúcar.",
      "Semana 4: en el crunch con polea, piensa en llevar las costillas hacia la cadera, no la cabeza hacia las rodillas.",
      "Semana 5: si la báscula no se mueve, mira la cinta métrica. La cintura suele bajar primero.",
      "Semana 6: semana pico. Mide tu cintura y toma tu foto el último día para compararla con el día 1.",
    ],
    coachFocus: "Abdomen más marcado: core fuerte (anti-extensión, oblicuos, abdomen inferior) y bajar grasa con déficit moderado, proteína alta y pasos.",
    restDay: "Descanso activo: camina 30 minutos y 2 minutos de plancha",
    food: ["Déficit moderado y constante: el abdomen se marca cuando baja la grasa de todo el cuerpo.", "Proteína alta en cada comida para no perder músculo mientras bajas.", "Llena medio plato de verduras y suma frijoles o avena: la fibra calma el hambre.", "Recorta primero lo líquido: refrescos, jugos y alcohol."],
  },
  "brazos-definidos": {
    mode: "Modo brazos",
    welcome: "Empieza Brazos definidos. Codos quietos, bajadas lentas y pesos que suben solos: así se construyen brazos firmes.",
    habits: [
      { key: "entreno", label: "Sesión del programa", kind: "entreno" },
      { key: "proteina", label: "Proteína en cada comida", kind: "proteina" },
      { key: "agua", label: "Toma 8 vasos de agua", kind: "agua", target: 8 },
      { key: "hombros", label: "2 minutos de movilidad de hombros", kind: "check" },
    ],
    tips: [
      "Semana 1: en el curl, los codos no se mueven. Si tienes que balancearte, el peso es demasiado alto.",
      "Semana 2: el tríceps es dos tercios de tu brazo. Estira del todo en cada extensión.",
      "Semana 3: el hombro lateral hace que el brazo se vea más ancho. Sube hasta la altura del hombro, sin impulso.",
      "Semana 4: en el curl inclinado y la extensión sobre la cabeza, la bajada lenta y el estiramiento completo son lo que más hace crecer el brazo.",
      "Semana 5: la sesión de bombeo es opcional. Si te sobra energía, súmala; si no, descansa.",
      "Semana 6: semana pico. Toma tu foto con la misma luz que el día 1 y compara.",
    ],
    coachFocus: "Brazos definidos: bíceps, tríceps y hombros con técnica estricta y sobrecarga progresiva, sin descuidar pierna y espalda.",
    restDay: "Descanso activo: camina 20 minutos y estira hombros y pecho",
    food: ["Proteína en cada comida: el brazo crece con ladrillos.", "Déficit pequeño: si recortas mucho, el brazo no crece.", "Carbohidrato antes de entrenar para rendir en las series de brazos.", "Hidrátate bien: el músculo lleno de agua y glucógeno se ve más firme."],
  },
  "banana-girl": {
    mode: "Modo Banana Girl",
    welcome: "Bienvenida a Banana Girl. Seis semanas para sentirte firme y fuerte, a tu ritmo. Hoy empieza tu glow up.",
    habits: [
      { key: "entreno", label: "Sesión del programa", kind: "entreno" },
      { key: "agua", label: "Toma 8 vasos de agua", kind: "agua", target: 8 },
      { key: "pasos", label: "Camina 8.000 pasos", kind: "pasos", target: 8000 },
      { key: "autocuidado", label: "10 minutos para ti: estira o respira", kind: "check" },
    ],
    tips: [
      "Semana 1: antes de cada sesión de glúteo, haz 2 series de puente sin peso. Vas a sentirlo mucho más.",
      "Semana 2: hombros atrás y abajo, también fuera del gym. La postura cambia cómo te ves desde el primer día.",
      "Semana 3: no tengas miedo a subir el peso. Las cargas te tonifican; no te van a hacer ver voluminosa de un día para otro.",
      "Semana 4: tu ciclo puede cambiar tu energía. Si un día te sientes baja, repite el peso de la vez pasada y listo.",
      "Semana 5: la proteína también es para ti. Súmala en el desayuno: huevos, yogur griego o queso.",
      "Semana 6: semana para brillar. Toma tus medidas y tu foto el último día y mira todo lo que lograste.",
    ],
    coachFocus: "Tonificar el cuerpo de una chica con prioridad en glúteo, cintura, brazos y postura. Tono cálido y motivador, sin presión por el peso.",
    restDay: "Descanso activo: 20 minutos de caminata y 10 de estiramiento",
    food: ["Proteína en cada comida, empezando por el desayuno: huevos, yogur griego o queso.", "Déficit pequeño: tonificas sin pasar hambre ni perder energía.", "Hierro y calcio cuentan: frijoles, hojas verdes, lácteos y carnes magras.", "Antes de entrenar, una fruta o un pan con algo de proteína."],
  },
};

const withX = (slug: string, meta: ProgramMeta): ProgramMeta => (EXPERIENCES[slug] ? { ...meta, experience: EXPERIENCES[slug] } : meta);

/** Programas nuevos de 0027 (se insertan; después manda el panel). */
export const PROGRAM_SEED_2: ProgramSeed[] = [
  { ...base, slug: "abdomen-marcado", title: "Abdomen marcado", insert: true, featured: true, sort: 20, priceUsd: 7.99, cover: "sky", icon: "target", difficulty: "media", minutes: 40,
    description: "6 semanas para un abdomen más marcado: core en cada sesión, fuerza de cuerpo completo, un circuito de quema y el ajuste de comida y pasos que hace falta para bajar grasa.",
    badge: "Abdomen marcado", rewardTitle: "Core de acero", xp: 400,
    safetyNote: "Si tienes diástasis abdominal, una hernia, dolor de espalda baja, estás embarazada o tuviste un parto reciente, consulta con tu médico antes de empezar.",
    meta: withX("abdomen-marcado", ABDOMEN_MARCADO), sessions: abdomenMarcado() },
  { ...base, slug: "brazos-definidos", title: "Brazos definidos", insert: true, featured: false, sort: 30, priceUsd: 6.99, cover: "ember", icon: "barbell", difficulty: "media", minutes: 45,
    description: "6 semanas de especialización en brazos: bíceps, tríceps y hombros en cada sesión, con curl inclinado y tríceps sobre la cabeza para trabajar el músculo estirado. 3 sesiones y 1 de bombeo opcional por semana.",
    badge: "Brazos definidos", rewardTitle: "Brazos de acero", xp: 350,
    safetyNote: "Si sientes dolor en el codo o el hombro (no cansancio muscular), baja el peso y consulta con un profesional antes de seguir.",
    meta: withX("brazos-definidos", BRAZOS), sessions: brazos() },
  { ...base, slug: "banana-girl", title: "Banana Girl", insert: true, featured: true, sort: 15, priceUsd: 7.99, cover: "fresa", icon: "sparkle", difficulty: "facil", minutes: 45,
    description: "6 semanas para chicas: glúteos firmes, cintura definida, brazos tonificados y mejor postura, con cardio suave sin saltos y hábitos de autocuidado cada día.",
    badge: "Banana Girl", rewardTitle: "Glow up", xp: 400,
    safetyNote: "Si estás embarazada, tuviste un parto reciente o tienes una condición médica, consulta con tu médico antes de empezar.",
    meta: withX("banana-girl", BANANA_GIRL), sessions: bananaGirl() },
];

/** Todos los programas de la siembra con su experiencia (catálogo de respaldo y modo demo). */
export const ALL_PROGRAM_SEED: ProgramSeed[] = [...PROGRAM_SEED.map((p) => { const u = PROGRAM_UPGRADES[p.slug]; const q2 = u ? { ...p, ...u } : p; return { ...q2, meta: withX(p.slug, q2.meta) }; }), ...PROGRAM_SEED_2];
export const PROGRAM_SEED_BY_SLUG: Record<string, ProgramSeed> = Object.fromEntries(ALL_PROGRAM_SEED.map((p) => [p.slug, p]));

/** Bloque de siembra de 0027: programas nuevos y la experiencia de los de 0024 (solo si todavía no tienen una). */
export function program0027Sql() {
  const out = [programSeedSql(PROGRAM_SEED_2).replace("-- ───────────── 6. Siembra (generada con scripts/gen-programas-seed.ts; no pisa lo editado en el panel) ─────────────", "-- ───────────── Siembra de programas nuevos (generada con scripts/gen-programas-seed.ts --0027) ─────────────").replace(/-- Retos Premium que pasan a ser programas[^\n]*\n/, "")];
  out.push("-- Programas de 0024 rehechos en 0027 (enfoque completo en su objetivo). Mismo slug: las compras siguen valiendo.");
  for (const [slug, u] of Object.entries(PROGRAM_UPGRADES)) {
    const weeks = u.meta.phases.reduce((a, x) => a + x.weeks, 0);
    out.push(`update public.challenges_catalog set program = ${j(withX(slug, u.meta))}, description = ${q(u.description)}, minutes = ${u.minutes}, days = ${weeks * 7} where slug = ${q(slug)} and kind = 'programa';`);
    out.push(`delete from public.program_sessions where slug = ${q(slug)};`);
    out.push("insert into public.program_sessions (slug, phase, day, title, focus, optional, exercises) values");
    out.push(u.sessions.map((s) => `  (${[q(slug), s.phase, s.day, q(s.title), q(s.focus), !!s.optional, j(s.exercises)].join(", ")})`).join(",\n"));
    out.push("on conflict (slug, phase, day) do nothing;");
  }
  out.push("-- Duración en días = semanas del programa (algunos retos convertidos en 0024 conservaban la de 0018).");
  for (const p of PROGRAM_SEED.filter((x) => !x.insert && !PROGRAM_UPGRADES[x.slug])) {
    const d = p.meta.phases.reduce((a, x) => a + x.weeks, 0) * 7;
    out.push(`update public.challenges_catalog set days = ${d} where slug = ${q(p.slug)} and kind = 'programa' and days <> ${d};`);
  }
  out.push("-- Experiencia de los programas de 0024: solo si el panel todavía no les puso una.");
  for (const p of PROGRAM_SEED) {
    if (!EXPERIENCES[p.slug] || PROGRAM_UPGRADES[p.slug]) continue;
    out.push(`update public.challenges_catalog set program = program || jsonb_build_object('experience', ${j(EXPERIENCES[p.slug])}) where slug = ${q(p.slug)} and kind = 'programa' and program is not null and not (program ? 'experience');`);
  }
  return out.join("\n") + "\n";
}

// ───────────── SQL de la siembra (lo usa scripts/gen-programas-seed.ts y lo comprueba programs.test.ts) ─────────────

const q = (s: string | null) => (s === null ? "null" : `'${s.replace(/'/g, "''")}'`);
const j = (v: unknown) => `$j$${JSON.stringify(v)}$j$::jsonb`;

export function programSeedSql(seed: ProgramSeed[] = PROGRAM_SEED) {
  const out: string[] = ["-- ───────────── 6. Siembra (generada con scripts/gen-programas-seed.ts; no pisa lo editado en el panel) ─────────────"];
  for (const p of seed.filter((s) => s.insert)) {
    out.push(
      "insert into public.challenges_catalog (slug, title, description, days, rules, status, price_usd, difficulty, minutes, cover, icon, verify, grace, xp, badge, reward_title, start_mode, featured, coming_soon, safety_note, sort, kind, program) values",
      `  (${[q(p.slug), q(p.title), q(p.description), p.meta.phases.reduce((a, x) => a + x.weeks, 0) * 7, "'{}'::jsonb", "'publicado'", p.priceUsd.toFixed(2), q(p.difficulty), p.minutes, q(p.cover), q(p.icon), "'workout'", 0, p.xp, q(p.badge), q(p.rewardTitle), "'libre'", p.featured, false, q(p.safetyNote), p.sort, "'programa'", j(p.meta)].join(", ")})`,
      "on conflict (slug) do nothing;",
    );
  }
  out.push("-- Retos Premium que pasan a ser programas: solo la primera vez (kind todavía 'reto'); después manda el panel.");
  for (const p of seed.filter((s) => !s.insert)) {
    out.push(`update public.challenges_catalog set kind = 'programa', program = ${j(p.meta)}, title = ${q(p.title)}, description = ${q(p.description)}, minutes = ${p.minutes}, safety_note = ${q(p.safetyNote)} where slug = ${q(p.slug)} and kind = 'reto';`);
  }
  out.push("insert into public.program_sessions (slug, phase, day, title, focus, optional, exercises) values");
  out.push(seed.flatMap((p) => p.sessions.map((s) => `  (${[q(p.slug), s.phase, s.day, q(s.title), q(s.focus), !!s.optional, j(s.exercises)].join(", ")})`)).join(",\n"));
  out.push("on conflict (slug, phase, day) do nothing;", "");
  return out.join("\n");
}
