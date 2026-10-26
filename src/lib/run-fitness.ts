// Running: estado de forma, ritmos de entrenamiento, marcas personales y si una meta es realista. PURO y probado en
// run-fitness.test.ts. Usa la fórmula de VDOT (Daniels y Gilbert) para estimar el estado de forma con un resultado real
// (una carrera o el mejor tramo con GPS) y la de Riegel para pasar un tiempo de una distancia a otra.

export type RaceKind = "5k" | "10k" | "21k" | "42k" | "trail";
export const RACE_KINDS: RaceKind[] = ["5k", "10k", "21k", "42k", "trail"];
export const RACE_LABEL: Record<RaceKind, string> = { "5k": "5K", "10k": "10K", "21k": "Medio maratón (21K)", "42k": "Maratón (42K)", trail: "Trail" };
export const RACE_SHORT: Record<RaceKind, string> = { "5k": "5K", "10k": "10K", "21k": "21K", "42k": "42K", trail: "trail" };
export const RACE_M: Record<Exclude<RaceKind, "trail">, number> = { "5k": 5000, "10k": 10000, "21k": 21097, "42k": 42195 };
export const raceDistance = (kind: RaceKind, trailM?: number | null) => (kind === "trail" ? Math.max(5000, Math.min(120_000, Math.round(trailM ?? 15000))) : RACE_M[kind]);

// ───────────── VDOT ─────────────

/** Consumo de oxígeno (ml/kg/min) a una velocidad en m/min. */
const vo2At = (v: number) => -4.6 + 0.182258 * v + 0.000104 * v * v;
/** Porcentaje del VO2 máx que se sostiene durante `t` minutos. */
const pctMax = (t: number) => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
/** Velocidad (m/min) que pide un consumo de oxígeno dado. */
const vAt = (vo2: number) => (-0.182258 + Math.sqrt(0.182258 ** 2 + 4 * 0.000104 * (vo2 + 4.6))) / (2 * 0.000104);

/** VDOT de un resultado: distancia en metros y tiempo en segundos. null si no es plausible. */
export function vdot(distM: number, timeS: number): number | null {
  if (!(distM >= 800 && timeS > 0)) return null;
  const t = timeS / 60, v = distM / t;
  // Más rápido que 2:30/km o más lento que 15:00/km no sirve para estimar.
  if (v > 400 || v < 66) return null;
  const x = vo2At(v) / pctMax(t);
  return x >= 15 && x <= 90 ? Math.round(x * 10) / 10 : null;
}

/** Tiempo (s) que corresponde a un VDOT en una distancia (búsqueda binaria). */
export function predictTime(vd: number, distM: number): number {
  let lo = distM / 400 * 60, hi = distM / 50 * 60;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    const x = vo2At(distM / (mid / 60)) / pctMax(mid / 60);
    if (x > vd) lo = mid; else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

/** Riegel: pasa un tiempo de una distancia a otra (exponente 1.06). */
export const riegel = (timeS: number, fromM: number, toM: number) => Math.round(timeS * (toM / fromM) ** 1.06);

/** Trail: por desnivel y terreno se corre más lento que en calle. Sin desnivel conocido sumamos 12 %. */
export const TRAIL_FACTOR = 1.12;
export function predictRace(vd: number, kind: RaceKind, distM: number) {
  const t = predictTime(vd, distM);
  return kind === "trail" ? Math.round(t * TRAIL_FACTOR) : t;
}

// ───────────── Ritmos ─────────────

export type PaceZone = "facil" | "maraton" | "umbral" | "intervalo" | "repeticion" | "carrera";
export const ZONE_LABEL: Record<PaceZone, string> = { facil: "Fácil", maraton: "Maratón", umbral: "Umbral (tempo)", intervalo: "Intervalos", repeticion: "Repeticiones", carrera: "Ritmo de carrera" };
export const ZONE_HINT: Record<PaceZone, string> = {
  facil: "Puedes conversar sin problema. Casi todo tu volumen va aquí.",
  maraton: "Cómodo pero con intención. El ritmo que aguantarías unas 3 horas o más.",
  umbral: "Fuerte y controlado. Puedes decir frases cortas, no conversar.",
  intervalo: "Duro. Tramos de 2 a 5 minutos con recuperación.",
  repeticion: "Rápido y suelto, con buena técnica. Tramos cortos con recuperación completa.",
  carrera: "El ritmo de tu meta para el día de la carrera.",
};
/** Ritmos en segundos por km. `facil` es un rango: [más rápido, más lento]. */
export type Paces = { vdot: number; facil: [number, number]; maraton: number; umbral: number; intervalo: number; repeticion: number; carrera: number };

const paceAt = (vo2: number) => Math.round(60_000 / vAt(vo2));
export function trainingPaces(vd: number, racePaceS?: number | null): Paces {
  const intervalo = paceAt(vd * 0.975);
  const maraton = Math.round(predictTime(vd, 42195) / 42.195);
  return {
    vdot: vd, facil: [paceAt(vd * 0.74), paceAt(vd * 0.62)], maraton, umbral: paceAt(vd * 0.88), intervalo, repeticion: Math.max(120, intervalo - 15),
    carrera: racePaceS ?? maraton,
  };
}
/** Ritmo objetivo de una zona (el fácil, en el medio del rango). */
export const zonePace = (p: Paces, z: PaceZone) => (z === "facil" ? Math.round((p.facil[0] + p.facil[1]) / 2) : p[z]);

// ───────────── Marcas personales ─────────────

export type RunLike = { id: string; day: string; distanceM: number; movingS: number; splits: { km: number; seconds: number }[] };
export type Best = { seconds: number; runId: string; day: string };
export type Bests = { km1: Best | null; km5: Best | null; km10: Best | null; km21: Best | null; longest: { distanceM: number; runId: string; day: string } | null };

/** Mejor tramo de `k` km seguidos dentro de una carrera (con sus parciales de 1 km). */
export function bestWindow(splits: { km: number; seconds: number }[], k: number): number | null {
  const full = splits.filter((s) => Number.isInteger(s.km)).map((s) => s.seconds);
  if (full.length < k || full.some((s) => !(s >= 120 && s <= 3600))) return null;
  let sum = full.slice(0, k).reduce((a, b) => a + b, 0), best = sum;
  for (let i = k; i < full.length; i++) { sum += full[i] - full[i - k]; best = Math.min(best, sum); }
  return best;
}

/** Marcas personales con los mejores tramos de cada carrera: 1 km, 5 km, 10 km, 21 km y la más larga. */
export function personalBests(runs: RunLike[]): Bests {
  const out: Bests = { km1: null, km5: null, km10: null, km21: null, longest: null };
  const keys = [[1, "km1"], [5, "km5"], [10, "km10"], [21, "km21"]] as const;
  for (const r of runs) {
    for (const [k, key] of keys) {
      const s = bestWindow(r.splits, k);
      const cur = out[key];
      if (s != null && (!cur || s < cur.seconds || (s === cur.seconds && r.day < cur.day))) out[key] = { seconds: s, runId: r.id, day: r.day };
    }
    if (!out.longest || r.distanceM > out.longest.distanceM) out.longest = { distanceM: r.distanceM, runId: r.id, day: r.day };
  }
  return out;
}

/** Marcas que una carrera nueva mejoró (comparando con las anteriores). */
export function newBests(before: RunLike[], run: RunLike): ("km1" | "km5" | "km10" | "km21" | "longest")[] {
  const a = personalBests(before), b = personalBests([...before, run]);
  const out: ("km1" | "km5" | "km10" | "km21" | "longest")[] = [];
  for (const k of ["km1", "km5", "km10", "km21"] as const) if (b[k]?.runId === run.id && (!a[k] || b[k]!.seconds < a[k]!.seconds)) out.push(k);
  if (before.length && b.longest?.runId === run.id && (!a.longest || run.distanceM > a.longest.distanceM)) out.push("longest");
  return out;
}

// ───────────── Estado de forma ─────────────

export type Fitness = { vdot: number; source: "resultado" | "gps" | "estimado"; label: string };

/**
 * Estado de forma: el mejor VDOT entre un resultado reciente (si lo dio) y los mejores tramos de 5 y 10 km con GPS de
 * las últimas 12 semanas. Sin nada de eso, una estimación prudente por nivel.
 */
export function estimateFitness(o: { recent?: { distM: number; timeS: number } | null; runs?: RunLike[]; level?: "empezando" | "recreativo" | "competitivo"; today?: string }): Fitness {
  const cands: Fitness[] = [];
  if (o.recent) { const x = vdot(o.recent.distM, o.recent.timeS); if (x) cands.push({ vdot: x, source: "resultado", label: "tu resultado reciente" }); }
  const since = o.today ? new Date(Date.parse(o.today + "T12:00:00Z") - 84 * 864e5).toISOString().slice(0, 10) : "";
  const pb = personalBests((o.runs ?? []).filter((r) => r.day >= since));
  if (pb.km5) { const x = vdot(5000, pb.km5.seconds); if (x) cands.push({ vdot: x, source: "gps", label: "tus mejores 5 km con GPS" }); }
  if (pb.km10) { const x = vdot(10000, pb.km10.seconds); if (x) cands.push({ vdot: x, source: "gps", label: "tus mejores 10 km con GPS" }); }
  if (cands.length) return cands.sort((a, b) => b.vdot - a.vdot)[0];
  const base = { empezando: 30, recreativo: 38, competitivo: 46 }[o.level ?? "recreativo"];
  return { vdot: base, source: "estimado", label: "tu nivel (todavía sin carreras para medir)" };
}

// ───────────── ¿La meta es realista? ─────────────

export type GoalCheck = {
  /** Tiempo estimado hoy y al llegar a la carrera con el plan. */
  now: number; withPlan: number;
  status: "sin_meta" | "conservadora" | "realista" | "ambiciosa" | "muy_ambiciosa";
  /** Rango sugerido [rápido, prudente] cuando la meta es muy ambiciosa. */
  range: [number, number] | null;
  message: string;
};

/** Mejora razonable de VDOT por semana de entrenamiento y su tope, según el nivel. */
const GAIN: Record<"empezando" | "recreativo" | "competitivo", [number, number]> = { empezando: [0.5, 6], recreativo: [0.33, 4], competitivo: [0.2, 2.5] };
export const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.round(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
};
/** Lee "52:30" o "1:52:30" a segundos. */
export function parseTime(x: unknown): number | null {
  if (typeof x !== "string") return null;
  const m = /^\s*(?:(\d{1,2}):)?(\d{1,3}):(\d{2})\s*$/.exec(x);
  if (!m) return null;
  const s = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return Number(m[3]) < 60 && s > 0 ? s : null;
}

export function checkGoal(o: { fitness: Fitness; kind: RaceKind; distM: number; goalS: number | null; weeks: number; level: "empezando" | "recreativo" | "competitivo" }): GoalCheck {
  const [perWeek, cap] = GAIN[o.level];
  // Las últimas 1 a 2 semanas son de afinar: casi no suman forma.
  const gain = Math.min(cap, Math.max(0, o.weeks - 1) * perWeek);
  const now = predictRace(o.fitness.vdot, o.kind, o.distM), withPlan = predictRace(o.fitness.vdot + gain, o.kind, o.distM);
  if (!o.goalS) return { now, withPlan, status: "sin_meta", range: null, message: `Con tu plan, un tiempo cercano a ${fmtTime(withPlan)} es una buena referencia. Lo importante es llegar bien y disfrutarla.` };
  if (o.goalS >= now) return { now, withPlan, status: "conservadora", range: null, message: `Tu meta está a tu alcance hoy. Con el plan podrías apuntar a algo cerca de ${fmtTime(withPlan)}.` };
  if (o.goalS >= withPlan) return { now, withPlan, status: "realista", range: null, message: "Tu meta es realista si sigues el plan. Va a pedir constancia." };
  const stretch = predictRace(o.fitness.vdot + gain * 1.25, o.kind, o.distM);
  if (o.goalS >= stretch) return { now, withPlan, status: "ambiciosa", range: null, message: `Tu meta es ambiciosa para el tiempo que queda. Es posible si todo sale bien; una meta segura sería ${fmtTime(withPlan)}.` };
  const fast = withPlan, slow = predictRace(o.fitness.vdot + gain * 0.5, o.kind, o.distM);
  return {
    now, withPlan, status: "muy_ambiciosa", range: [fast, slow],
    message: `Con ${o.weeks} ${o.weeks === 1 ? "semana" : "semanas"} es difícil llegar a ${fmtTime(o.goalS)} sin arriesgar una lesión. Te sugerimos apuntar entre ${fmtTime(fast)} y ${fmtTime(slow)}, y guardar tu meta para la siguiente carrera.`,
  };
}

// ───────────── Formulario de la carrera objetivo ─────────────

export type RaceGoalInput = {
  name: string | null; raceDate: string; kind: RaceKind; distanceM: number; goalS: number | null;
  recentDistanceM: number | null; recentS: number | null; ownPlan: boolean; hardDays: number[];
};
export const RECENT_OPTIONS = [{ id: "5k", m: 5000, label: "5K" }, { id: "10k", m: 10000, label: "10K" }, { id: "21k", m: 21097, label: "21K" }] as const;

/** Sanea el formulario. Devuelve los datos o un mensaje de error para la persona. */
export function parseRaceGoal(x: unknown, today: string): { ok: true; goal: RaceGoalInput } | { ok: false; error: string } {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const raceDate = typeof o.raceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.raceDate) && !Number.isNaN(Date.parse(o.raceDate)) ? o.raceDate : null;
  if (!raceDate) return { ok: false, error: "Elige la fecha de tu carrera." };
  const days = Math.round((Date.parse(raceDate + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 864e5);
  if (days < 0) return { ok: false, error: "La fecha de tu carrera ya pasó. Elige una próxima." };
  if (days > 365) return { ok: false, error: "Elige una carrera dentro del próximo año." };
  const kind = RACE_KINDS.includes(o.kind as RaceKind) ? (o.kind as RaceKind) : null;
  if (!kind) return { ok: false, error: "Elige la distancia." };
  let trailM: number | null = null;
  if (kind === "trail") {
    const km = typeof o.trailKm === "number" ? o.trailKm : Number(String(o.trailKm ?? "").replace(",", "."));
    if (!(km >= 5 && km <= 120)) return { ok: false, error: "Escribe los km de tu trail (entre 5 y 120)." };
    trailM = Math.round(km * 1000);
  }
  const distanceM = raceDistance(kind, trailM);
  let goalS: number | null = null;
  if (o.goal !== "terminar" && o.goal != null && o.goal !== "") {
    goalS = parseTime(o.goal);
    if (!goalS) return { ok: false, error: "Escribe tu meta de tiempo como 55:00 o 1:59:00." };
    if (goalS / (distanceM / 1000) < 150 || goalS / (distanceM / 1000) > 1200) return { ok: false, error: "Esa meta de tiempo no parece de esta distancia. Revísala." };
  }
  let recentDistanceM: number | null = null, recentS: number | null = null;
  const rd = RECENT_OPTIONS.find((r) => r.id === o.recentDist);
  if (rd && o.recentTime) {
    recentS = parseTime(o.recentTime);
    if (!recentS) return { ok: false, error: "Escribe tu tiempo reciente como 25:30 o 1:05:00." };
    if (!vdot(rd.m, recentS)) return { ok: false, error: "Ese tiempo reciente no parece de esa distancia. Revísalo." };
    recentDistanceM = rd.m;
  }
  const name = typeof o.name === "string" ? o.name.trim().replace(/\s+/g, " ").slice(0, 80) || null : null;
  const hardDays = [...new Set((Array.isArray(o.hardDays) ? o.hardDays : []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) as number[])].sort((a, b) => a - b);
  return { ok: true, goal: { name, raceDate, kind, distanceM, goalS, recentDistanceM, recentS, ownPlan: o.ownPlan === true, hardDays: o.ownPlan === true ? hardDays : [] } };
}
