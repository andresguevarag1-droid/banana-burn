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
import type { ProgramExercise, ProgramMeta, ProgramSession } from "./programs";
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

export const PROGRAM_SEED_BY_SLUG: Record<string, ProgramSeed> = Object.fromEntries(PROGRAM_SEED.map((p) => [p.slug, p]));

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
