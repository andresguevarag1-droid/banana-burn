// "Cómo te hablo": el registro con el que Banana Burn y Coach Banana explican el entreno.
// Básico (palabras simples, todo explicado), Intermedio (por defecto: términos ligeros explicados una vez) y
// Técnico (RIR, tempo, doble progresión, volumen). Solo cambia la explicación: los números son siempre los mismos.
// Sin dependencias de React ni del servidor: lo usan páginas, componentes de cliente, correos y notificaciones.

export type Voice = "basico" | "intermedio" | "tecnico";
export const DEFAULT_VOICE: Voice = "intermedio";

export const VOICES: { id: Voice; label: string; d: string; sample: string }[] = [
  { id: "basico", label: "Básico", d: "Palabras simples y todo explicado. Ideal si estás empezando.", sample: "Baja lento contando 3 y deja 2 repeticiones en el tanque." },
  { id: "intermedio", label: "Intermedio", d: "Términos de gym, explicados la primera vez.", sample: "Tempo 3-1-1 y RIR 2: te quedan 2 repeticiones en reserva." },
  { id: "tecnico", label: "Técnico", d: "Lenguaje preciso de entrenamiento, sin rodeos.", sample: "Tempo 3-1-1, RIR 2, doble progresión en 6-10 reps." },
];

export const isVoice = (x: unknown): x is Voice => x === "basico" || x === "intermedio" || x === "tecnico";
export const parseVoice = (x: unknown): Voice => (isVoice(x) ? x : DEFAULT_VOICE);

/** Elige el texto del registro. Si falta uno, usa el intermedio. */
export function t<T>(v: Voice, o: { basico: T; intermedio: T; tecnico: T }): T {
  return o[v] ?? o.intermedio;
}

/** Registro sugerido según la experiencia (en la bienvenida, hasta que la persona elija otro). */
export const voiceForLevel = (level: string): Voice => (level === "principiante" ? "basico" : level === "avanzado" ? "tecnico" : "intermedio");

const n = (x: number) => x.toLocaleString("es-419", { maximumFractionDigits: 2 });
const plural = (k: number, one: string, many: string) => (k === 1 ? one : many);

/** "2 min", "90 s": descansos en texto corrido. */
export function restText(sec: number) {
  if (sec >= 120 || (sec >= 60 && sec % 60 === 0)) return `${(sec / 60).toLocaleString("es-419", { maximumFractionDigits: 1 })} min`;
  return `${sec} s`;
}

/** Unidad del trabajo de una serie en palabras. */
export function unitWord(v: Voice, unit?: string, k = 2) {
  if (unit === "s") return plural(k, "segundo", "segundos");
  if (unit === "m") return plural(k, "metro", "metros");
  return v === "tecnico" ? "reps" : v === "basico" ? plural(k, "repetición", "repeticiones") : "reps";
}

/* ───────────── Reserva (RIR) ───────────── */

/** Cuántas repeticiones dejar sin hacer. `b` para un rango ("1 a 2"). */
export function rirText(v: Voice, a: number, b?: number) {
  const range = b != null && b !== a ? `${a} a ${b}` : String(a);
  const many = (b ?? a) !== 1;
  if (a === 0 && (b == null || b === 0)) return t(v, { basico: "hasta que no salga otra con buena forma", intermedio: "al límite (RIR 0: no salía otra)", tecnico: "RIR 0" });
  return t(v, {
    basico: `deja ${range} ${many ? "repeticiones" : "repetición"} en el tanque`,
    intermedio: `RIR ${b != null && b !== a ? `${a}-${b}` : a}: te ${many ? "quedan" : "queda"} ${range} ${many ? "reps" : "rep"} en reserva`,
    tecnico: `RIR ${b != null && b !== a ? `${a}-${b}` : a}`,
  });
}

/* ───────────── Tempo ───────────── */

/** "3-1-1" → bajada, pausa y subida en segundos. Acepta una "X" (explosivo) en la subida. */
export function parseTempo(tempo: string) {
  const m = /^(\d)-(\d)-(\d|x)$/i.exec(tempo.trim());
  if (!m) return null;
  return { down: Number(m[1]), pause: Number(m[2]), up: m[3].toLowerCase() === "x" ? null : Number(m[3]) };
}

/** El tempo explicado según el registro. Si no se entiende el formato, se muestra tal cual. */
export function tempoText(v: Voice, tempo = "3-1-1") {
  const p = parseTempo(tempo);
  if (!p) return `tempo ${tempo}`;
  const up = p.up == null ? "sube con fuerza" : p.up <= 1 ? "sube con fuerza" : `sube en ${p.up}`;
  const pause = p.pause ? `pausa ${p.pause}` : "sin pausa";
  return t(v, {
    basico: `baja lento contando ${p.down}, ${p.pause ? `aguanta ${p.pause}` : "sin pausa abajo"} y ${p.up == null || p.up <= 1 ? "sube con fuerza" : `sube contando ${p.up}`}`,
    intermedio: `tempo ${tempo}: baja en ${p.down} s, ${pause}, ${up}`,
    tecnico: `tempo ${tempo}`,
  });
}

/** Línea de técnica general que acompaña las series (reproductor y detalle de ejercicio). */
export function strengthCue(v: Voice, opts: { tempo?: string; rest?: number; unit?: string } = {}) {
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  if (opts.unit) {
    return t(v, {
      basico: `Mantén la forma limpia de principio a fin${opts.rest ? `. Después descansa ${restText(opts.rest)}` : ""}.`,
      intermedio: `Técnica limpia${opts.rest ? `, descanso de ${restText(opts.rest)}` : ""}.`,
      tecnico: `Técnica estricta${opts.rest ? `, descanso ${restText(opts.rest)}` : ""}.`,
    });
  }
  const tempo = tempoText(v, opts.tempo ?? "3-1-1");
  return t(v, {
    basico: `${cap(tempo)}. ${cap(rirText(v, 1, 2))}${opts.rest ? `. Después descansa ${restText(opts.rest)}` : ""}.`,
    intermedio: `${cap(tempo)}. ${rirText(v, 1, 2)}${opts.rest ? `, descanso de ${restText(opts.rest)}` : ""}.`,
    tecnico: `${cap(tempo)}, ${rirText(v, 1, 2)}${opts.rest ? `, descanso ${restText(opts.rest)}` : ""}.`,
  });
}

/* ───────────── Series y repeticiones ───────────── */

/** "4×6-10" (técnico/intermedio) o "4 series de 6 a 10" (básico). Los números no cambian. */
export function setsReps(v: Voice, sets: number, lo: number, hi: number, unit?: string) {
  const u = unit === "s" ? " s" : unit === "m" ? " m" : "";
  if (v === "basico") return `${sets} ${plural(sets, "serie", "series")} de ${lo === hi ? lo : `${lo} a ${hi}`}${unit ? ` ${unitWord(v, unit, hi)}` : ""}`;
  return `${sets}×${lo === hi ? lo : `${lo}-${hi}`}${u}`;
}

/** Leyenda corta para entender "4×6-10" la primera vez (en técnico no hace falta). */
export function setsLegend(v: Voice) {
  return t(v, {
    basico: "Una serie es una tanda de repeticiones seguidas. Entre serie y serie descansas.",
    intermedio: "4×6-10 = 4 series de 6 a 10 repeticiones.",
    tecnico: "",
  });
}

/** Resumen del día en Entrenar y en Hoy. */
export function sessionLine(v: Voice, o: { exercises: number; mins: number; cardio?: boolean }) {
  return t(v, {
    basico: `${o.exercises} ejercicios, unos ${o.mins} minutos${o.cardio ? ", y al final caminas" : ""}. Te guío paso a paso.`,
    intermedio: `${o.exercises} ejercicios en unos ${o.mins} min${o.cardio ? ", más cardio al final" : ""}, tempo 3-1-1`,
    tecnico: `${o.exercises} ejercicios, ~${o.mins} min${o.cardio ? " + cardio LISS" : ""}, tempo 3-1-1, RIR 1-2`,
  });
}

/* ───────────── Por qué importa ───────────── */

export function whyItMatters(v: Voice) {
  return t(v, {
    basico: "Entrenar con pesas hace que lo que bajes sea grasa y no músculo. Así tu cuerpo se ve firme, no flácido.",
    intermedio: "Entrenar fuerza hace que lo que bajes sea grasa y no músculo. Es la parte que más cambia tu cuerpo.",
    tecnico: "El estímulo de fuerza conserva masa magra en déficit: la pérdida viene de grasa y sube tu recomposición.",
  });
}

/* ───────────── Check-in de energía ───────────── */

export function readinessTips(v: Voice): [string, string, string] {
  return [
    t(v, { basico: "Modo suave: una serie menos en cada ejercicio y que te sobren 3 repeticiones. Entrenar suave también suma a tu racha.", intermedio: "Modo suave: una serie menos por ejercicio y RIR 3 (te quedan 3 reps). Entrenar suave también suma a tu racha.", tecnico: "Modo suave: −1 serie por ejercicio, RIR 3. Cuenta para la racha." }),
    t(v, { basico: "Plan normal: baja lento contando 3 y deja 1 o 2 repeticiones en el tanque.", intermedio: "Plan normal: tempo 3-1-1 y RIR 1-2 (te quedan 1 o 2 reps).", tecnico: "Plan normal: tempo 3-1-1, RIR 1-2." }),
    t(v, { basico: "Aprovecha: intenta 1 repetición extra en la última serie de los ejercicios grandes.", intermedio: "Aprovecha: intenta 1 rep extra en la última serie de cada básico.", tecnico: "Día fuerte: +1 rep en la última serie de los compuestos (top set)." }),
  ];
}

/* ───────────── Indicación del motor (prescripción) ───────────── */

export type RxType = "cal" | "up" | "reps" | "hold" | "reset" | "deload";

export function rxBadge(v: Voice, type: RxType) {
  const L: Record<RxType, { basico: string; intermedio: string; tecnico: string }> = {
    cal: { basico: "Primer día", intermedio: "Calibración", tecnico: "Calibración" },
    up: { basico: "Sube el peso", intermedio: "Sube carga", tecnico: "Progresión de carga" },
    reps: { basico: "+1 repetición", intermedio: "+1 rep", tecnico: "Progresión de reps" },
    hold: { basico: "Repite y mejora", intermedio: "Consolida", tecnico: "Consolidación" },
    reset: { basico: "Baja un poco", intermedio: "Reinicio −10 %", tecnico: "Reinicio −10 %" },
    deload: { basico: "Semana suave", intermedio: "Descarga", tecnico: "Descarga" },
  };
  return t(v, L[type]);
}

/**
 * La indicación de cada ejercicio en el registro de la persona. Mismos números que `prescribe` (motor):
 * peso, repeticiones, series y descanso no cambian; solo cómo se dicen.
 */
export function rxNote(v: Voice, rx: { type: RxType; kg: number | null; reps: number[]; sets: number }, cfg: { lo: number; hi: number; rest: number; unit?: string }, o: { weighted: boolean }): string {
  const { lo, hi } = cfg;
  const r = rx.reps[0] ?? lo;
  const kg = rx.kg != null ? n(rx.kg) : null;
  if (cfg.unit === "s" && cfg.rest <= 30) {
    return t(v, {
      basico: `Trabaja ${hi} segundos y descansa ${cfg.rest}. Ve a tu ritmo; si la forma se rompe, baja la velocidad.`,
      intermedio: `Intervalos: ${hi} s de trabajo y ${cfg.rest} s de descanso. Ritmo firme y técnica limpia; si se rompe la forma, baja la velocidad.`,
      tecnico: `Intervalos ${hi}:${cfg.rest} s (trabajo:descanso). Si la técnica se degrada, baja la cadencia.`,
    });
  }
  switch (rx.type) {
    case "cal": {
      if (o.weighted) return t(v, {
        basico: `Primer día con este ejercicio: elige un peso con el que puedas hacer de ${lo} a ${hi} repeticiones y te queden 2 más en el tanque. Anota lo que hiciste y yo ajusto el resto.`,
        intermedio: `Calibración: elige un peso con el que llegues a ${lo}-${hi} reps con RIR 2 (te quedan 2 reps en reserva).`,
        tecnico: `Calibración: carga para ${lo}-${hi} reps a RIR 2. Esta sesión fija tu punto de partida para la doble progresión.`,
      });
      const u = unitWord(v, cfg.unit, hi);
      return t(v, {
        basico: `Primer día con este ejercicio: haz de ${lo} a ${hi} ${u} con buena forma y que te sobren 1 o 2. Anota lo que hiciste en cada serie.`,
        intermedio: `Calibración: haz ${lo}-${hi} ${u} limpias con RIR 1-2 (te quedan 1 o 2 en reserva). Anota lo que hiciste en cada serie.`,
        tecnico: `Calibración: ${lo}-${hi} ${u} a RIR 1-2. Registra cada serie.`,
      });
    }
    case "up":
      if (!o.weighted || kg == null) return t(v, {
        basico: `Ya dominas este ejercicio: hoy busca ${r} repeticiones en cada serie.`,
        intermedio: `Dominaste el rango: busca ${r} reps hoy.`,
        tecnico: `Rango dominado: objetivo ${r} reps por serie.`,
      });
      return t(v, {
        basico: `La vez pasada llegaste a ${hi} repeticiones: hoy sube a ${kg} kg y vuelve a ${lo}. Así se gana fuerza.`,
        intermedio: `Llegaste a ${hi} reps: sube a ${kg} kg y vuelve a ${lo}.`,
        tecnico: `Tope del rango (${hi}) alcanzado: carga a ${kg} kg y vuelves a ${lo} reps (doble progresión).`,
      });
    case "reset":
      return t(v, {
        basico: `Las últimas dos veces costó mucho: baja a ${kg} kg (un 10 % menos) y vuelve a subir desde ahí. Es parte del plan.`,
        intermedio: `Dos sesiones bajo ${lo} reps: reinicia a ${kg} kg (−10 %).`,
        tecnico: `2 sesiones bajo el mínimo del rango (${lo}): reinicio a ${kg} kg (−10 %).`,
      });
    case "hold":
      return t(v, {
        basico: "La vez pasada terminaste sin fuerzas: hoy repite el mismo peso y las mismas repeticiones, pero más limpias.",
        intermedio: "La vez pasada llegaste al límite (RIR 0): mismo peso y mismas reps, con técnica más limpia.",
        tecnico: "RIR 0 en todas las series de trabajo: mantienes carga y reps para consolidar.",
      });
    case "deload":
      return t(v, {
        basico: "Semana suave: menos peso, una serie menos y que te sobren 3 repeticiones. Tu cuerpo se recupera y vuelve más fuerte.",
        intermedio: "Semana de descarga: −10 % de carga, una serie menos y RIR 3 (te quedan 3 reps).",
        tecnico: "Descarga: −10 % de carga, −1 serie, RIR 3.",
      });
    default:
      return t(v, {
        basico: "Mismo peso que la vez pasada y 1 repetición más en cada serie.",
        intermedio: "Mismo peso, +1 rep por serie.",
        tecnico: `Carga fija, +1 rep por serie hasta ${hi} (doble progresión).`,
      });
  }
}

/** Prefijo del modo del día (check-in de energía). */
export function modeNote(v: Voice, mode: "suave" | "fuerte") {
  if (mode === "suave") return t(v, { basico: "Hoy vas suave: una serie menos y que te sobren 3 repeticiones.", intermedio: "Modo suave: una serie menos y RIR 3 (te quedan 3 reps).", tecnico: "Modo suave: −1 serie, RIR 3." });
  return t(v, { basico: "Hoy vienes con todo: busca 1 repetición extra en la última serie.", intermedio: "Día fuerte: busca 1 rep extra en la última serie.", tecnico: "Día fuerte: +1 rep en la última serie." });
}

/** Tempo de un programa como prefijo de la indicación ("Baja lento contando 2, aguanta 1..."). */
export function programTempoNote(v: Voice, tempo: string) {
  const s = tempoText(v, tempo);
  return `${s[0].toUpperCase()}${s.slice(1)}.`;
}

/** Etiqueta corta del tempo para listas de un programa. */
export function tempoLabel(v: Voice, tempo: string) {
  const p = parseTempo(tempo);
  if (!p) return `tempo ${tempo}`;
  return t(v, { basico: `baja en ${p.down} s`, intermedio: `tempo ${tempo}`, tecnico: `tempo ${tempo}` });
}

/* ───────────── Esfuerzo (¿cómo se sintió?) ───────────── */

export function effortHints(v: Voice): { f: string; j: string; l: string } {
  return t(v, {
    basico: { f: "Me sobraban 4 o más", j: "Me sobraban 1 o 2", l: "No salía otra" },
    intermedio: { f: "Sobraban 4 o más", j: "Sobraban 1 o 2", l: "No salía otra" },
    tecnico: { f: "RIR 4 o más", j: "RIR 1-2", l: "RIR 0" },
  });
}

/* ───────────── Coach Banana ───────────── */

/** Una regla para el coach: cómo hablarle a esta persona. */
export function coachRule(v: Voice) {
  return t(v, {
    basico: "Habla en palabras simples, sin jerga de gym: explica cada término (en vez de RIR di \"deja 2 repeticiones en el tanque\"; en vez de tempo 3-1-1, \"baja lento contando 3\").",
    intermedio: "Usa términos de gym comunes y explícalos una vez entre paréntesis (por ejemplo, RIR 2: te quedan 2 repeticiones).",
    tecnico: "Usa lenguaje técnico preciso (RIR, tempo, doble progresión, volumen por grupo muscular, e1RM) sin explicar lo básico.",
  });
}
