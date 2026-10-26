// Plan de carrera por fases para la Temporada Running: base, construcción, pico, afinar, semana de carrera y una semana
// de recuperación. PURO y probado en run-plan.test.ts. Reglas:
//   - El volumen semanal sube 10 % como mucho y cada 3 o 4 semanas hay una semana de descarga (80 %).
//   - Afinar dura de 7 a 14 días según la distancia.
//   - La carrera larga va en el día que la persona eligió; las sesiones de calidad, lejos de la larga y entre ellas.
//   - Las corridas con GPS marcan como hechas las del plan cuando se parecen; el plan se ajusta si falta la larga o si la
//     carga se pasó.
import { trainingPaces, zonePace, type Paces, type PaceZone, type RaceKind } from "./run-fitness";

export type Level = "empezando" | "recreativo" | "competitivo";
export type Phase = "base" | "construccion" | "pico" | "afinar" | "carrera" | "recuperar";
export const PHASE_LABEL: Record<Phase, string> = { base: "Base", construccion: "Construcción", pico: "Pico", afinar: "Afinar", carrera: "Semana de carrera", recuperar: "Recuperación" };
export const PHASE_HINT: Record<Phase, string> = {
  base: "Kilómetros suaves para construir el motor y que tus piernas se acostumbren.",
  construccion: "Entran el tempo y las series: aquí te vuelves más rápido.",
  pico: "Las semanas más exigentes, con trabajo al ritmo de tu carrera.",
  afinar: "Menos volumen y la misma chispa: llegas fresco a la línea de salida.",
  carrera: "Poco volumen, piernas sueltas y a disfrutar tu carrera.",
  recuperar: "Trotes suaves para recuperar. Tu cuerpo se adapta descansando.",
};

export type RunKind = "facil" | "larga" | "tempo" | "intervalos" | "cuestas" | "progresivo" | "ritmo" | "suelto" | "carrera" | "recuperacion";
export const KIND_LABEL: Record<RunKind, string> = {
  facil: "Fácil", larga: "Carrera larga", tempo: "Tempo", intervalos: "Series", cuestas: "Cuestas", progresivo: "Progresivo", ritmo: "Ritmo de carrera",
  suelto: "Trote suelto", carrera: "Tu carrera", recuperacion: "Recuperación",
};
export const QUALITY: RunKind[] = ["tempo", "intervalos", "cuestas", "progresivo", "ritmo"];

/** Un tramo de una sesión guiada. Distancia (m) o tiempo (s). */
export type Step = { kind: "calentar" | "trabajo" | "recuperar" | "enfriar" | "continuo"; distM?: number; timeS?: number; zone: PaceZone | "trote"; label: string };
export type PlannedRun = {
  id: string; date: string; dow: number; kind: RunKind; title: string; detail: string;
  /** Distancia aproximada total (m). */
  distM: number; steps: Step[]; strides: boolean; key: boolean; note?: string;
};
export type PlanWeek = { n: number; start: string; phase: Phase; km: number; cutback: boolean; runs: PlannedRun[] };
export type RacePlan = { weeks: PlanWeek[]; paces: Paces; raceDate: string; distM: number; kind: RaceKind; peakKm: number; longDow: number; qualityDows: number[] };

const DAY = 864e5;
const t = (iso: string) => Date.parse(iso.slice(0, 10) + "T12:00:00Z");
export const addDays = (iso: string, n: number) => new Date(t(iso) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((t(b) - t(a)) / DAY);
export const dowOf = (iso: string) => (new Date(t(iso)).getUTCDay() + 6) % 7;
export const mondayOf = (iso: string) => addDays(iso, -dowOf(iso));

/** Días de afinar antes de la carrera. */
export function taperDays(kind: RaceKind, distM: number): number {
  if (kind === "5k") return 7;
  if (kind === "10k") return 7;
  if (kind === "21k") return 10;
  if (kind === "42k") return 14;
  return distM <= 15000 ? 7 : distM <= 30000 ? 10 : 14;
}

/** Volumen de pico (km por semana) por distancia y nivel. */
const PEAK: Record<"5k" | "10k" | "21k" | "42k", Record<Level, number>> = {
  "5k": { empezando: 22, recreativo: 32, competitivo: 45 },
  "10k": { empezando: 26, recreativo: 38, competitivo: 55 },
  "21k": { empezando: 32, recreativo: 45, competitivo: 65 },
  "42k": { empezando: 42, recreativo: 58, competitivo: 80 },
};
/** Tope de la carrera larga (km). */
const LONG_CAP: Record<"5k" | "10k" | "21k" | "42k", Record<Level, number>> = {
  "5k": { empezando: 8, recreativo: 10, competitivo: 14 },
  "10k": { empezando: 11, recreativo: 14, competitivo: 18 },
  "21k": { empezando: 17, recreativo: 19, competitivo: 23 },
  "42k": { empezando: 28, recreativo: 32, competitivo: 34 },
};
const bucket = (kind: RaceKind, distM: number): "5k" | "10k" | "21k" | "42k" => (kind !== "trail" ? kind : distM <= 12000 ? "10k" : distM <= 30000 ? "21k" : "42k");
export const peakKm = (kind: RaceKind, distM: number, level: Level) => PEAK[bucket(kind, distM)][level];

export type PlanInput = {
  /** Día en que se armó el plan (no se programan sesiones antes). */
  start: string; raceDate: string; kind: RaceKind; distM: number; level: Level;
  runDays: number[]; longRunDay: number | null; kmWeek: number; paces: Paces; hills?: boolean;
};

/** Día de la carrera larga: el elegido, o el último día de fin de semana entre los días que corre, o el último. */
export function pickLongDay(runDays: number[], longRunDay: number | null): number {
  if (longRunDay !== null && runDays.includes(longRunDay)) return longRunDay;
  const we = runDays.filter((d) => d >= 5);
  return we.length ? we[we.length - 1] : runDays[runDays.length - 1] ?? 6;
}
const circ = (a: number, b: number) => { const d = Math.abs(a - b) % 7; return Math.min(d, 7 - d); };
/** Días de calidad: los más lejanos de la larga y entre ellos; evita el día antes de la larga si se puede. */
export function pickQualityDays(runDays: number[], longDow: number, count: number): number[] {
  const out: number[] = [];
  const cands = runDays.filter((d) => d !== longDow);
  for (let k = 0; k < count; k++) {
    const left = cands.filter((d) => !out.includes(d));
    if (!left.length) break;
    const score = (d: number) => Math.min(circ(d, longDow), ...out.map((o) => circ(d, o))) * 10 - (d === (longDow + 6) % 7 ? 15 : 0) - (out.some((o) => circ(d, o) < 2) ? 30 : 0);
    out.push(left.sort((a, b) => score(b) - score(a) || a - b)[0]);
  }
  return out.sort((a, b) => a - b);
}
/** Cuántas sesiones de calidad por semana según la fase, los días que corre y el nivel. */
export function qualityCount(phase: Phase, nRuns: number, level: Level): number {
  if (phase === "recuperar" || phase === "carrera" || nRuns <= 1) return phase === "carrera" && nRuns >= 3 ? 1 : 0;
  if (phase === "base" || phase === "afinar") return nRuns >= 3 ? 1 : 0;
  const q = nRuns >= 4 ? 2 : 1;
  return level === "empezando" ? Math.min(1, q) : q;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const km = (m: number) => round1(m / 1000);

/** Arma una sesión de calidad. `idx` es la semana dentro de la fase (para progresar). */
function qualityRun(kind: RunKind, b: "5k" | "10k" | "21k" | "42k", phase: Phase, idx: number, p: Paces, short = false): { steps: Step[]; detail: string } {
  void p;
  const warm: Step = { kind: "calentar", timeS: short ? 600 : 900, zone: "facil", label: "Calentamiento suave" };
  const cool: Step = { kind: "enfriar", timeS: short ? 300 : 600, zone: "facil", label: "Enfriamiento suave" };
  const reps = (n: number, work: Omit<Step, "kind">, rest: Omit<Step, "kind">): Step[] => Array.from({ length: n }, (_, i) => [{ kind: "trabajo", ...work, label: `${work.label} ${i + 1} de ${n}` } as Step, ...(i < n - 1 ? [{ kind: "recuperar", ...rest } as Step] : [])]).flat();
  if (kind === "cuestas") {
    const n = Math.min(10, 6 + idx);
    return { steps: [warm, ...reps(n, { timeS: 45, zone: "repeticion", label: "Cuesta" }, { timeS: 90, zone: "trote", label: "Baja trotando" }), cool], detail: `${n} cuestas de 45 s, bajando al trote` };
  }
  if (kind === "progresivo") {
    const mins = Math.min(40, 30 + idx * 3);
    return { steps: [{ kind: "continuo", timeS: Math.round(mins * 0.7) * 60, zone: "facil", label: "Fácil" }, { kind: "continuo", timeS: Math.round(mins * 0.3) * 60, zone: "umbral", label: "Termina a ritmo tempo" }], detail: `${mins} min: los últimos ${Math.round(mins * 0.3)} a ritmo tempo` };
  }
  if (kind === "tempo") {
    const mins = Math.min(b === "5k" ? 20 : 30, 15 + idx * 3);
    return { steps: [warm, { kind: "trabajo", timeS: mins * 60, zone: "umbral", label: "Tempo continuo" }, cool], detail: `${mins} min a ritmo tempo` };
  }
  if (kind === "ritmo") {
    if (phase === "afinar" || phase === "carrera") {
      const n = phase === "carrera" ? 2 : 3;
      return { steps: [warm, ...reps(n, { distM: 1000, zone: "carrera", label: "Km a ritmo de carrera" }, { timeS: 120, zone: "trote", label: "Recupera trotando" }), cool], detail: `${n} km a ritmo de carrera con 2 min de trote` };
    }
    if (b === "42k") {
      const k = Math.min(16, 8 + idx * 2);
      return { steps: [warm, { kind: "trabajo", distM: k * 1000, zone: "carrera", label: "Bloque a ritmo de maratón" }, cool], detail: `${k} km a ritmo de maratón` };
    }
    const n = Math.min(b === "21k" ? 3 : 4, 2 + idx), d = b === "21k" ? 3000 : 2000;
    return { steps: [warm, ...reps(n, { distM: d, zone: "carrera", label: `${d / 1000} km a ritmo de carrera` }, { timeS: 180, zone: "trote", label: "Recupera trotando" }), cool], detail: `${n} x ${d / 1000} km a ritmo de carrera` };
  }
  // Series
  if (phase === "afinar") return { steps: [warm, ...reps(4, { distM: 400, zone: "intervalo", label: "400 m" }, { timeS: 90, zone: "trote", label: "Recupera trotando" }), cool], detail: "4 x 400 m a ritmo de series, con 90 s de trote" };
  if (b === "5k" || b === "10k") {
    const ladder: [number, number, number][] = [[6, 400, 90], [8, 400, 90], [5, 800, 120], [6, 800, 120], [5, 1000, 150], [4, 1200, 180]];
    const [n, d, r] = ladder[Math.min(ladder.length - 1, phase === "pico" ? 4 + Math.min(1, idx) : idx)];
    return { steps: [warm, ...reps(n, { distM: d, zone: "intervalo", label: `${d} m` }, { timeS: r, zone: "trote", label: "Recupera trotando" }), cool], detail: `${n} x ${d} m a ritmo de series, con ${r} s de trote` };
  }
  const n = Math.min(6, 4 + idx);
  return { steps: [warm, ...reps(n, { distM: 1000, zone: "umbral", label: "1 km" }, { timeS: 60, zone: "trote", label: "Recupera trotando" }), cool], detail: `${n} x 1 km a ritmo tempo, con 1 min de trote` };
}

/** Distancia estimada de los tramos (los de tiempo, al ritmo de su zona). */
export function stepsDistance(steps: Step[], p: Paces): number {
  return Math.round(steps.reduce((a, s) => a + (s.distM ?? ((s.timeS ?? 0) / (s.zone === "trote" ? p.facil[1] + 30 : zonePace(p, s.zone))) * 1000), 0));
}
const easySteps = (m: number, label = "Fácil"): Step[] => [{ kind: "continuo", distM: m, zone: "facil", label }];

/** Fases de las semanas antes de afinar. */
export function phaseSplit(m: number): { base: number; build: number; peak: number } {
  if (m <= 0) return { base: 0, build: 0, peak: 0 };
  const base = m >= 6 ? Math.round(m * 0.4) : m >= 3 ? 1 : 0;
  const peak = m >= 3 ? Math.max(1, Math.round(m * 0.25)) : 0;
  return { base, build: m - base - peak, peak };
}

export function buildPlan(i: PlanInput): RacePlan {
  const b = bucket(i.kind, i.distM);
  const runDays = [...new Set(i.runDays.filter((d) => d >= 0 && d <= 6))].sort((a, c) => a - c);
  const days = runDays.length ? runDays : [1, 3, 5];
  const longDow = pickLongDay(days, i.longRunDay);
  const raceMon = mondayOf(i.raceDate);
  // Si en la semana en que se arma el plan ya no quedan días de correr, empieza el lunes siguiente.
  let startMon = mondayOf(i.start);
  if (startMon < raceMon && !days.some((d) => addDays(startMon, d) >= i.start)) startMon = addDays(startMon, 7);
  const n = Math.max(1, Math.floor(daysBetween(startMon, raceMon) / 7) + 1);
  const tw = taperDays(i.kind, i.distM) > 7 ? 2 : 1;
  const split = phaseSplit(n - tw);
  const phases: Phase[] = [];
  for (let k = 0; k < n; k++) {
    if (k === n - 1) phases.push("carrera");
    else if (k >= n - tw) phases.push("afinar");
    else if (k < split.base) phases.push("base");
    else if (k < split.base + split.build) phases.push("construccion");
    else phases.push("pico");
  }
  phases.push("recuperar");
  const peak = Math.max(peakKm(i.kind, i.distM, i.level), 0);
  const startKm = Math.min(150, Math.max(8, i.kmWeek || 0));
  const target = Math.max(startKm, peak);
  const cutEvery = i.level === "empezando" ? 3 : 4;
  // Volumen por semana.
  const vols: number[] = [];
  let lastFull = startKm, sinceCut = 0, top = startKm;
  phases.forEach((ph, k) => {
    if (ph === "afinar") { vols.push(round1(top * (b === "42k" ? 0.7 : 0.75))); return; }
    if (ph === "carrera") { vols.push(round1(Math.max(6, top * 0.35)) + km(i.distM)); return; }
    if (ph === "recuperar") { vols.push(round1(Math.max(6, top * 0.35))); return; }
    if (k === 0) { vols.push(round1(startKm)); sinceCut = 1; top = startKm; return; }
    if (sinceCut >= cutEvery - 1 && k < n - tw - 1) { vols.push(round1(lastFull * 0.8)); sinceCut = 0; return; }
    const v = Math.min(target, lastFull * 1.1);
    lastFull = v; top = Math.max(top, v); sinceCut++;
    vols.push(round1(v));
  });
  const racePace = i.paces.carrera;
  const longCap = LONG_CAP[b][i.level];
  const weeks: PlanWeek[] = [];
  const phaseIdx: Record<Phase, number> = { base: 0, construccion: 0, pico: 0, afinar: 0, carrera: 0, recuperar: 0 };
  let longPrev = 0;
  phases.forEach((ph, k) => {
    const mon = addDays(startMon, k * 7);
    const idx = phaseIdx[ph]++;
    const cutback = k > 0 && ph !== "afinar" && ph !== "carrera" && ph !== "recuperar" && vols[k] < vols[k - 1] * 0.95 && vols[k] < top;
    const runs: PlannedRun[] = [];
    const add = (date: string, kind: RunKind, title: string, detail: string, steps: Step[], extra: Partial<PlannedRun> = {}) => {
      runs.push({ id: `${date}:${kind}`, date, dow: dowOf(date), kind, title, detail, distM: stepsDistance(steps, i.paces), steps, strides: false, key: kind === "larga" || kind === "carrera" || QUALITY.includes(kind), ...extra });
    };
    const ok = (d: number) => addDays(mon, d) >= i.start;
    if (ph === "carrera") {
      const race = i.raceDate;
      add(race, "carrera", "Tu carrera", `${km(i.distM)} km. A disfrutar`, [{ kind: "continuo", distM: i.distM, zone: "carrera", label: "Tu carrera" }]);
      const before = days.filter((d) => ok(d) && addDays(mon, d) < addDays(race, -1));
      before.forEach((d, j) => {
        const date = addDays(mon, d);
        if (j === 0 && before.length >= 2 && i.distM <= 21100) { const q = qualityRun("ritmo", b, "carrera", 0, i.paces); add(date, "ritmo", "Recordatorio de ritmo", q.detail, q.steps); }
        else add(date, "suelto", "Trote suelto", "25 min suaves con 4 rectas de 20 s", [{ kind: "continuo", timeS: 1500, zone: "facil", label: "Trote suelto" }], { strides: true });
      });
      if (days.includes(dowOf(addDays(race, -1))) && ok(dowOf(addDays(race, -1)))) add(addDays(race, -1), "suelto", "Activación", "15 min muy suaves y 3 rectas cortas. Prepara tu ropa y tu número", [{ kind: "continuo", timeS: 900, zone: "facil", label: "Activación" }], { strides: true });
      weeks.push({ n: k + 1, start: mon, phase: ph, km: vols[k], cutback: false, runs: runs.sort((a, c) => a.date.localeCompare(c.date)) });
      return;
    }
    if (ph === "recuperar") {
      const from = addDays(i.raceDate, b === "42k" ? 4 : 2);
      const rd = days.filter((d) => addDays(mon, d) >= from).slice(0, 3);
      rd.forEach((d) => add(addDays(mon, d), "recuperacion", "Trote de recuperación", "20 a 30 min muy suaves. Si algo duele, camina", [{ kind: "continuo", timeS: 1500, zone: "facil", label: "Recuperación" }]));
      weeks.push({ n: k + 1, start: mon, phase: ph, km: vols[k], cutback: false, runs });
      return;
    }
    const nRuns = days.length;
    const qn = qualityCount(ph, nRuns, i.level);
    const qd = pickQualityDays(days, longDow, qn);
    // Larga: 30 % del volumen (45 % con 2 días), con tope por distancia y sin subir más de ~2 km por semana.
    const share = [1, 1, 0.5, 0.42, 0.33, 0.28, 0.25, 0.25][nRuns];
    let longKm = Math.min(longCap, vols[k] * share);
    if (longPrev && !cutback) longKm = Math.min(longKm, longPrev + 2);
    if (ph === "afinar") longKm = Math.min(longKm, longCap * (phases[k + 1] === "afinar" ? 0.7 : 0.55));
    longKm = Math.max(4, round1(longKm));
    if (!cutback && ph !== "afinar") longPrev = longKm;
    let left = vols[k] * 1000 - longKm * 1000;
    // Calidad
    const qKinds: RunKind[] = [];
    if (ph === "base") qKinds.push(i.hills || idx % 2 === 0 ? "cuestas" : "progresivo");
    else if (ph === "afinar") qKinds.push(b === "21k" || b === "42k" ? "ritmo" : "intervalos");
    else {
      const second: RunKind = b === "21k" || b === "42k" ? "ritmo" : "tempo";
      if (qn >= 2) qKinds.push("intervalos", ph === "pico" ? second : "tempo");
      else qKinds.push(ph === "pico" ? (b === "21k" || b === "42k" ? "ritmo" : "intervalos") : idx % 2 === 0 ? "tempo" : "intervalos");
    }
    const qRuns: { d: number; kind: RunKind; steps: Step[]; detail: string }[] = [];
    qd.forEach((d, j) => {
      const kind = qKinds[j] ?? "tempo";
      const q = qualityRun(kind, b, ph, idx, i.paces, i.level === "empezando" || vols[k] < 20);
      qRuns.push({ d, kind, ...q });
      left -= stepsDistance(q.steps, i.paces);
    });
    // Fáciles: lo que queda del volumen, nunca más que la larga. Si no alcanza para fáciles de 2.5 km, esos días se
    // descansan (con poco volumen, mejor menos días bien hechos).
    let easyDays = days.filter((d) => d !== longDow && !qd.includes(d));
    while (easyDays.length > 1 && left / easyDays.length < 2500) easyDays = easyDays.slice(0, -1);
    const easyM = easyDays.length ? Math.min(Math.round(longKm * 800), Math.max(2500, Math.round(left / easyDays.length / 100) * 100)) : 0;
    days.forEach((d) => {
      if (!ok(d)) return;
      const date = addDays(mon, d);
      if (d === longDow) {
        add(date, "larga", "Carrera larga", `${longKm} km a ritmo fácil${ph === "pico" && b === "42k" ? ". Si te sientes bien, los últimos 3 km a ritmo de maratón" : ""}`, easySteps(Math.round(longKm * 1000), "Carrera larga"));
        return;
      }
      const q = qRuns.find((x) => x.d === d);
      if (q) { add(date, q.kind, KIND_LABEL[q.kind], q.detail, q.steps); return; }
      if (!easyDays.includes(d)) return;
      // Rectas en la primera fácil de la semana (base y construcción).
      const strides = (ph === "base" || ph === "construccion" || ph === "pico") && easyDays[0] === d;
      add(date, "facil", "Fácil", `${km(easyM)} km suaves${strides ? " y 4 a 6 rectas de 20 s al final" : ""}`, easySteps(easyM), { strides });
    });
    weeks.push({ n: k + 1, start: mon, phase: ph, km: vols[k], cutback, runs: runs.sort((a, c) => a.date.localeCompare(c.date)) });
  });
  // Semanas: km reales del plan (lo que suman sus sesiones).
  for (const w of weeks) w.km = round1(w.runs.reduce((a, r) => a + r.distM, 0) / 1000);
  return { weeks, paces: { ...i.paces, carrera: racePace }, raceDate: i.raceDate, distM: i.distM, kind: i.kind, peakKm: Math.max(...weeks.map((w) => w.km)), longDow, qualityDows: pickQualityDays(days, longDow, qualityCount("construccion", days.length, i.level)) };
}

// ───────────── Hechas, pendientes y ajustes ─────────────

export type DoneRun = { id: string; day: string; distanceM: number; movingS: number };
export type RunStatus = "hecha" | "pendiente" | "hoy" | "perdida";
export type MatchedRun = PlannedRun & { status: RunStatus; doneId?: string };

/**
 * Marca como hecha una sesión cuando hay una corrida el mismo día (o un día antes o después, si ese día no tenía otra
 * sesión) con al menos 60 % de la distancia planeada. Cada corrida cuenta para una sola sesión.
 */
export function matchRuns(planned: PlannedRun[], done: DoneRun[], today: string): MatchedRun[] {
  const used = new Set<string>();
  const dates = new Set(planned.map((p) => p.date));
  const out = planned.map((p) => ({ ...p, status: (p.date < today ? "perdida" : p.date === today ? "hoy" : "pendiente") as RunStatus } as MatchedRun));
  for (const offset of [0, -1, 1]) {
    for (const p of out) {
      if (p.status === "hecha") continue;
      const day = addDays(p.date, offset);
      if (offset !== 0 && dates.has(day)) continue;
      const r = done.filter((x) => x.day === day && !used.has(x.id) && x.distanceM >= p.distM * 0.6).sort((a, b) => Math.abs(a.distanceM - p.distM) - Math.abs(b.distanceM - p.distM))[0];
      if (r) { used.add(r.id); p.status = "hecha"; p.doneId = r.id; }
    }
  }
  return out;
}

export type Adjust = { kind: "larga_movida" | "larga_sin_subir" | "carga_alta" | "regreso"; message: string };

/**
 * Ajusta la semana en curso con lo que pasó:
 *   - Larga perdida en los últimos 3 días: pasa a la siguiente fácil de la semana; si no hay, la de la próxima semana no
 *     sube de distancia.
 *   - Carga alta: más de 30 % (y 5 km) sobre lo planeado en los últimos 7 días: la siguiente calidad de los próximos 3 días
 *     se vuelve fácil.
 *   - 10 días o más sin correr (con el plan en marcha): esta semana al 80 %.
 */
export function adaptPlan(plan: RacePlan, done: DoneRun[], today: string, start: string): { plan: RacePlan; adjusts: Adjust[] } {
  const weeks = plan.weeks.map((w) => ({ ...w, runs: w.runs.map((r) => ({ ...r })) }));
  const all = weeks.flatMap((w) => w.runs);
  const matched = matchRuns(all, done, today);
  const status = new Map(matched.map((m) => [m.id, m.status]));
  const adjusts: Adjust[] = [];
  const thisMon = mondayOf(today);
  const wk = weeks.find((w) => w.start === thisMon);
  const next = weeks.find((w) => w.start === addDays(thisMon, 7));
  // 1. Larga perdida
  const missed = all.filter((r) => r.kind === "larga" && status.get(r.id) === "perdida" && daysBetween(r.date, today) <= 3).at(-1);
  if (missed) {
    const target = wk?.runs.find((r) => r.kind === "facil" && r.date >= today && status.get(r.id) !== "hecha");
    const w = weeks.find((x) => x.runs.some((r) => r.id === missed.id));
    if (target && w === wk) {
      Object.assign(target, { kind: "larga", title: "Carrera larga", detail: missed.detail, steps: missed.steps, distM: missed.distM, key: true, strides: false, note: "Movimos aquí tu carrera larga, que quedó pendiente." });
      adjusts.push({ kind: "larga_movida", message: `Tu carrera larga quedó pendiente: la pasamos al ${new Intl.DateTimeFormat("es-419", { weekday: "long", timeZone: "UTC" }).format(new Date(target.date + "T12:00:00Z"))}.` });
    } else {
      const nl = (w === wk ? next : wk)?.runs.find((r) => r.kind === "larga" && r.date > today);
      if (nl && nl.distM > missed.distM) {
        Object.assign(nl, { distM: missed.distM, steps: missed.steps, detail: missed.detail, note: "Repetimos la distancia de la larga que quedó pendiente, sin subir." });
        adjusts.push({ kind: "larga_sin_subir", message: "Como quedó pendiente tu carrera larga, la próxima repite esa distancia en vez de subir." });
      }
    }
  }
  // 2. Carga alta
  const from = addDays(today, -6);
  const doneKm = done.filter((r) => r.day >= from && r.day <= today).reduce((a, r) => a + r.distanceM, 0) / 1000;
  const planKm = all.filter((r) => r.date >= from && r.date <= today).reduce((a, r) => a + r.distM, 0) / 1000;
  if (doneKm > planKm * 1.3 && doneKm - planKm >= 5) {
    const q = all.find((r) => QUALITY.includes(r.kind) && r.date >= today && r.date <= addDays(today, 3) && status.get(r.id) !== "hecha");
    if (q) {
      const m = Math.round(q.distM / 100) * 100;
      Object.assign(q, { kind: "facil", title: "Fácil", detail: `${km(m)} km suaves`, steps: easySteps(m), key: false, note: "Cargaste más kilómetros de lo planeado: esta vez, suave." });
    }
    adjusts.push({ kind: "carga_alta", message: `Llevas ${round1(doneKm)} km en 7 días y el plan pedía ${round1(planKm)}. Tomamos los próximos días con calma para que no te lesiones.` });
  }
  // 3. Regreso después de una pausa
  const last = done.filter((r) => r.day <= today).map((r) => r.day).sort().at(-1);
  if (wk && daysBetween(start, today) >= 10 && (!last || daysBetween(last, today) >= 10)) {
    for (const r of wk.runs) if (r.date >= today && r.kind !== "carrera") { const m = Math.round((r.distM * 0.8) / 100) * 100; r.distM = m; if (r.kind === "facil" || r.kind === "larga") { r.steps = easySteps(m, r.kind === "larga" ? "Carrera larga" : "Fácil"); r.detail = `${km(m)} km suaves`; } }
    adjusts.push({ kind: "regreso", message: "Hace días que no registras una carrera. Esta semana bajamos el volumen al 80 % para retomar sin riesgo." });
  }
  for (const w of weeks) w.km = round1(w.runs.reduce((a, r) => a + r.distM, 0) / 1000);
  return { plan: { ...plan, weeks }, adjusts };
}

/** La próxima sesión pendiente (hoy o después). */
export function nextRun(plan: RacePlan, done: DoneRun[], today: string): MatchedRun | null {
  return matchRuns(plan.weeks.flatMap((w) => w.runs), done, today).find((r) => r.status === "hoy" || r.status === "pendiente") ?? null;
}

/** Racha: días seguidos con una carrera, terminando hoy o ayer. */
export function runStreak(days: string[], today: string): number {
  const set = new Set(days);
  let d = set.has(today) ? today : addDays(today, -1), n = 0;
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
/** Semanas seguidas (lunes a domingo) con al menos una carrera, contando la semana en curso si ya corrió. */
export function weekStreak(days: string[], today: string): number {
  const weeks = new Set(days.map(mondayOf));
  let w = mondayOf(today), n = 0;
  if (!weeks.has(w)) w = addDays(w, -7);
  while (weeks.has(w)) { n++; w = addDays(w, -7); }
  return n;
}

/** Ritmos para un plan: con meta de tiempo, el ritmo de carrera es el de la meta; si no, el estimado. */
export function planPaces(vd: number, distM: number, goalOrPredS: number) { return trainingPaces(vd, Math.round(goalOrPredS / (distM / 1000))); }

/** Línea para la coach. */
export function planForCoach(plan: RacePlan, today: string, raceName: string | null): string {
  const w = plan.weeks.find((x) => x.start === mondayOf(today));
  const f = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const p = plan.paces;
  return [`Prepara ${raceName ?? "su carrera"} (${km(plan.distM)} km) el ${plan.raceDate}, faltan ${daysBetween(today, plan.raceDate)} días.`,
    w ? `Semana ${w.n} de ${plan.weeks.length - 1}, fase ${PHASE_LABEL[w.phase].toLowerCase()}, ${w.km} km planeados.` : "",
    `Ritmos (min/km): fácil ${f(p.facil[0])} a ${f(p.facil[1])}, tempo ${f(p.umbral)}, series ${f(p.intervalo)}, carrera ${f(p.carrera)}.`].filter(Boolean).join(" ");
}
