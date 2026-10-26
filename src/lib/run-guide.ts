// Sesiones guiadas y modo carrera en el tracker de Banana Run. PURO y probado en run-guide.test.ts: en qué tramo vas,
// cuánto te falta, si vas en ritmo, qué decir en voz alta y la tabla de ritmos (pace band) para el día de la carrera.
import { zonePace, type Paces } from "./run-fitness";
import type { Step } from "./run-plan";

export type GuideStep = { kind: Step["kind"]; label: string; distM?: number; timeS?: number; paceS: number | null; zoneLabel: string };
export type Guide = { title: string; steps: GuideStep[]; race?: { band: BandRow[]; goalS: number } };

const ZONE_SAY: Record<string, string> = { facil: "ritmo fácil", maraton: "ritmo de maratón", umbral: "ritmo tempo", intervalo: "ritmo de series", repeticion: "ritmo rápido y suelto", carrera: "ritmo de carrera", trote: "trote suave" };

/** Convierte los tramos del plan en tramos guiados con su ritmo objetivo (el trote de recuperación no tiene ritmo). */
export function toGuide(title: string, steps: Step[], p: Paces): Guide {
  return { title, steps: steps.map((s) => ({ kind: s.kind, label: s.label, distM: s.distM, timeS: s.timeS, paceS: s.zone === "trote" ? null : zonePace(p, s.zone), zoneLabel: ZONE_SAY[s.zone] ?? "" })) };
}

export type GuideState = { idx: number; startDist: number; startTime: number; done: boolean };
export const GUIDE_START: GuideState = { idx: 0, startDist: 0, startTime: 0, done: false };

/** Avanza la guía con la distancia y el tiempo en movimiento acumulados. Puede saltar varios tramos si hubo un corte. */
export function advance(steps: GuideStep[], st: GuideState, distM: number, timeS: number): { state: GuideState; changed: boolean } {
  let s = { ...st }, changed = false;
  while (!s.done) {
    const step = steps[s.idx];
    if (!step) { s.done = true; changed = true; break; }
    const doneStep = step.distM != null ? distM - s.startDist >= step.distM : step.timeS != null ? timeS - s.startTime >= step.timeS : true;
    if (!doneStep) break;
    // El siguiente tramo empieza donde terminó este (no donde estás ahora), para no perder metros de un corte.
    const endDist = step.distM != null ? s.startDist + step.distM : distM, endTime = step.timeS != null ? s.startTime + step.timeS : timeS;
    s = { idx: s.idx + 1, startDist: Math.min(distM, endDist), startTime: Math.min(timeS, endTime), done: s.idx + 1 >= steps.length };
    changed = true;
  }
  return { state: s, changed };
}

/** Lo que falta del tramo actual: metros o segundos, y la fracción hecha (0 a 1). */
export function remaining(step: GuideStep | undefined, st: GuideState, distM: number, timeS: number): { m: number | null; s: number | null; frac: number } {
  if (!step) return { m: null, s: null, frac: 1 };
  if (step.distM != null) { const left = Math.max(0, step.distM - (distM - st.startDist)); return { m: Math.round(left), s: null, frac: 1 - left / step.distM }; }
  if (step.timeS != null) { const left = Math.max(0, step.timeS - (timeS - st.startTime)); return { m: null, s: Math.round(left), frac: 1 - left / step.timeS }; }
  return { m: null, s: null, frac: 1 };
}

export type PaceCheck = "rapido" | "en_ritmo" | "lento";
/** Ritmo actual contra el objetivo, con 5 s/km de margen. */
export function paceCheck(current: number | null, target: number | null, tol = 5): PaceCheck | null {
  if (current == null || target == null) return null;
  if (current < target - tol) return "rapido";
  if (current > target + tol) return "lento";
  return "en_ritmo";
}
export const PACE_TEXT: Record<PaceCheck, string> = { rapido: "Vas más rápido", en_ritmo: "En ritmo", lento: "Vas más lento" };

/** "5:42" dicho en voz alta: "5 42". */
export const sayPace = (s: number) => `${Math.floor(s / 60)} ${String(s % 60).padStart(2, "0")}`;
const sayDist = (m: number) => (m >= 1000 ? `${Math.round(m / 100) / 10} kilómetros`.replace(".", " coma ") : `${m} metros`);
const sayTime = (s: number) => (s >= 60 && (s % 60 === 0 || s >= 120) ? `${Math.round(s / 60)} ${Math.round(s / 60) === 1 ? "minuto" : "minutos"}` : `${s} segundos`);

/** Lo que se dice al empezar un tramo. */
export function stepCue(step: GuideStep | undefined): string {
  if (!step) return "Terminaste tu sesión. Muy bien hecho. Camina un poco y luego toca Terminar.";
  const amount = step.distM != null ? sayDist(step.distM) : step.timeS != null ? sayTime(step.timeS) : "";
  if (step.kind === "recuperar") return `Recupera trotando suave, ${amount}.`;
  if (step.kind === "calentar") return `Calentamiento: ${amount} a ritmo fácil.`;
  if (step.kind === "enfriar") return `Enfriamiento: ${amount} suaves.`;
  const pace = step.paceS ? `, ${sayPace(step.paceS)} por kilómetro` : "";
  return `Ahora ${amount} a ${step.zoneLabel}${pace}.`;
}

/** Aviso de cada kilómetro (en cualquier carrera). En modo carrera, compara con el plan de la carrera. */
export function kmCue(km: number, splitS: number, totalS: number, band?: BandRow[]): string {
  let s = `Kilómetro ${km}, ritmo ${sayPace(splitS)}.`;
  const row = band?.find((r) => r.km === km);
  if (row) {
    const diff = Math.round(totalS - row.cumS);
    s += Math.abs(diff) < 5 ? " Justo en tu plan." : diff < 0 ? ` ${-diff} segundos adelante de tu plan.` : ` ${diff} segundos atrás de tu plan.`;
  }
  return s;
}

/** Aviso de ritmo en un tramo de trabajo (cada cierto tiempo, no a cada rato). */
export function paceCue(c: PaceCheck | null): string | null {
  if (c === "rapido") return "Un poco más suave.";
  if (c === "lento") return "Sube un poco el ritmo.";
  return null;
}

// ───────────── Pace band ─────────────

export type BandRow = { km: number; splitS: number; cumS: number; clock: string | null };
export type Strategy = "pareja" | "negativa";

/**
 * Parciales por km para hacer la meta. Pareja: el mismo ritmo todo el tiempo. Negativa: la primera mitad 2 % más lenta
 * y la segunda más rápida para cerrar en el mismo tiempo. El último tramo (si no es km entero) va con su fracción.
 * `start` "07:00" agrega la hora del reloj en cada km.
 */
export function paceBand(distM: number, goalS: number, strategy: Strategy = "pareja", start: string | null = null): BandRow[] {
  const kms = distM / 1000, n = Math.ceil(kms - 1e-9);
  const pace = goalS / kms;
  const half = kms / 2;
  // Negativa: ritmo a en la primera mitad y b en la segunda, con a = 1.02 * pace y a + b = 2 * pace (misma media).
  const a = strategy === "negativa" ? pace * 1.02 : pace, b = strategy === "negativa" ? 2 * pace - a : pace;
  const timeAt = (x: number) => (x <= half ? x * a : half * a + (x - half) * b);
  const m = start ? /^(\d{1,2}):(\d{2})$/.exec(start) : null;
  const startS = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : null;
  const clock = (s: number) => { if (startS == null) return null; const t = Math.round(startS + s) % 86400; return `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}`; };
  const rows: BandRow[] = [];
  for (let k = 1; k <= n; k++) {
    const x = Math.min(k, kms), cum = Math.round(timeAt(x));
    rows.push({ km: Math.round(x * 100) / 100, splitS: cum - (rows.at(-1)?.cumS ?? 0), cumS: cum, clock: clock(cum) });
  }
  // La suma cierra exacto en la meta.
  const last = rows.at(-1);
  if (last && last.cumS !== goalS) { last.splitS += goalS - last.cumS; last.cumS = goalS; last.clock = clock(goalS); }
  return rows;
}

/** La carrera como sesión guiada: un tramo por km con el ritmo de la tabla. */
export function raceGuide(title: string, band: BandRow[], goalS: number): Guide {
  return {
    title, race: { band, goalS },
    steps: band.map((r, i) => ({ kind: "trabajo", label: `Km ${Number.isInteger(r.km) ? r.km : r.km.toFixed(1)}`, distM: Math.round((r.km - (band[i - 1]?.km ?? 0)) * 1000), paceS: Math.round(r.splitS / (r.km - (band[i - 1]?.km ?? 0))), zoneLabel: "ritmo de carrera" })),
  };
}

// ───────────── Semana de carrera ─────────────

export type RaceWeekDay = { date: string; offset: number; title: string; items: string[] };
/** Lista día por día de los 6 días antes de la carrera, el día y el siguiente. Consejos generales, no médicos. */
export function raceWeek(raceDate: string, distM: number): RaceWeekDay[] {
  const long = distM >= 21000;
  const d = (o: number) => new Date(Date.parse(raceDate + "T12:00:00Z") + o * 864e5).toISOString().slice(0, 10);
  const out: [number, string, string[]][] = [
    [-6, "Semana de carrera", ["Sigue tu plan: poco volumen y algo de ritmo de carrera.", "Duerme 7 a 9 horas desde hoy: el sueño de toda la semana cuenta.", "Revisa la hora de salida, el lugar y cómo vas a llegar."]],
    [-5, "Prueba tu ropa", ["Corre con la ropa, los calcetines y los tenis del día de la carrera. Nada nuevo el día de la carrera.", "Si vas a usar geles o bebida, pruébalos en esta semana."]],
    [-4, "Mira el recorrido", ["Revisa el mapa del recorrido: subidas, puntos de hidratación y dónde está la meta.", "Haz tu tabla de ritmos y guárdala en el teléfono."]],
    [-3, "Hidrátate", ["Toma agua durante el día, sin exagerar.", long ? "Desde hoy, un poco más de carbohidratos en tus comidas: arroz, pasta, papa, frutas, pan." : "Comidas normales, con carbohidratos que conoces bien."]],
    [-2, "Descanso activo", ["Hoy descanso o caminata suave.", "Recoge tu número y tu paquete si te toca."]],
    [-1, "Prepara todo", ["15 minutos muy suaves con 3 rectas, si te toca.", "Deja lista tu ropa, el número con ganchos, los tenis, el reloj o el teléfono cargado.", "Cena algo que conozcas bien y acuéstate temprano."]],
    [0, "Día de carrera", ["Desayuna 2 a 3 horas antes lo que ya probaste.", "Llega con tiempo para el baño y el calentamiento.", "Sal a tu ritmo, no al de los demás. Los primeros km siempre se sienten fáciles."]],
    [1, "Recupera", ["Camina o trota suave 20 minutos solo si te sientes bien.", "Come bien y duerme. Tu plan ya tiene tu semana de recuperación."]],
  ];
  return out.map(([o, title, items]) => ({ date: d(o), offset: o, title, items }));
}

/** Calentamiento del día de la carrera (más corto en distancias largas). */
export function raceWarmup(distM: number): string[] {
  if (distM >= 21000) return ["5 a 8 minutos de trote muy suave.", "Balanceo de piernas: 10 por pierna, adelante y atrás.", "2 o 3 rectas cortas de 15 segundos sin cansarte.", "Termina 10 minutos antes de la salida y mantente en movimiento."];
  return ["10 minutos de trote suave.", "Balanceo de piernas: 10 por pierna.", "Skipping A y talones al glúteo: 2 tramos de 20 metros cada uno.", "4 rectas de 20 segundos, la última a ritmo de carrera.", "Termina 5 a 10 minutos antes de la salida."];
}
