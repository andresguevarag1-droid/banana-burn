// Motivación dentro del entreno: meta de nivel, hitos, bono por terminar y datos del descanso.
// Lógica pura (sin React ni navegador). Usa las mismas reglas de XP que el servidor (gamify.workoutXp).
import { FULL_BONUS, MIN_SET_SECONDS, levelOf, workoutXp } from "@/lib/gamify";
import { e1, num, volumeText, type Row } from "./logic";
import { ES_LANG, wFmt, wNum, type Lang } from "./lang";

/** `totalSets` es el plan (para el bono); `doable` las series que quedan en pantalla (menos si pasó a modo exprés). */
type XpState = { doneSets: number; totalSets: number; prs: number; seconds: number; doable?: number };
const leftOf = (o: XpState) => Math.max(0, Math.min(o.totalSets, o.doable ?? o.totalSets) - o.doneSets);
const xpOf = (o: XpState) => workoutXp({ doneSets: o.doneSets, totalSets: o.totalSets, prs: o.prs, seconds: o.seconds }).xp;

/** XP del entreno si se hacen `extra` series más a un ritmo real (lo que el servidor daría). */
export function projectedXp(o: XpState, extra: number) {
  const done = o.doneSets + extra;
  return workoutXp({ doneSets: done, totalSets: o.totalSets, prs: o.prs, seconds: Math.max(o.seconds, done * MIN_SET_SECONDS) }).xp;
}

/** Cuánto XP suma todavía terminar el entreno completo (series que faltan más el bono). */
export function finishValue(o: XpState) {
  const left = leftOf(o);
  const now = xpOf(o);
  const bonus = left && o.doneSets + left >= o.totalSets ? FULL_BONUS : 0;
  return { left, xp: left ? Math.max(0, projectedXp(o, left) - now) : 0, bonus };
}

export type LevelGoal = {
  /** Nivel con el XP de hoy incluido */
  level: ReturnType<typeof levelOf>;
  /** Series más que hacen falta para subir en este entreno (null si no alcanza o no quedan) */
  sets: number | null;
  /** true si para subir hace falta el bono de completo (es decir, terminar todo) */
  needsBonus: boolean;
  /** XP que suma terminar el entreno completo */
  finishXp: number;
};

/** Meta de nivel durante el entreno: cuánto falta y cuántas series lo consiguen, con las reglas reales de XP. */
export function levelGoal(base: number, o: XpState, sex?: string | null): LevelGoal {
  const now = xpOf(o);
  const level = levelOf(base + now, sex);
  const left = leftOf(o);
  const finishXp = left ? Math.max(0, projectedXp(o, left) - now) : 0;
  if (!level.next) return { level, sets: null, needsBonus: false, finishXp };
  for (let k = 1; k <= left; k++) {
    const x = projectedXp(o, k), full = o.doneSets + k >= o.totalSets;
    if (base + x >= level.next.xp) return { level, sets: k, needsBonus: full && base + x - FULL_BONUS < level.next.xp, finishXp };
  }
  return { level, sets: null, needsBonus: false, finishXp };
}

/** "Te faltan 80 XP para Plátano macho: 3 series más". */
export function levelGoalText(g: LevelGoal, unit = "series", L: Lang = ES_LANG) {
  const { t } = L;
  const { level } = g;
  if (!level.next) return t("Nivel máximo: {n}", { n: t(level.n) });
  const head = t("Te faltan {xp} XP para {n}", { xp: level.toNext, n: t(level.next.n) });
  if (g.sets != null) {
    const one = unit === "series" ? "serie" : "intervalo";
    if (g.needsBonus) return `${head}: ${g.sets === 1 ? t(`termina la última ${one} y el bono te sube`) : t("termina las {n} {unit} que quedan y el bono te sube", { n: g.sets, unit: t(unit) })}`;
    return `${head}: ${g.sets === 1 ? t(`1 ${one} más`) : t("{n} {unit} más", { n: g.sets, unit: t(unit) })}`;
  }
  return g.finishXp > 0 ? `${head}. ${t("Terminar hoy suma +{xp} XP", { xp: g.finishXp })}` : head;
}

/* ---------- Hitos ---------- */
export type Milestone = "q1" | "half" | "q3" | "last";
export const MILESTONES: Record<Milestone, { text: string; say: string }> = {
  q1: { text: "Un cuarto listo, ya entraste en ritmo", say: "Un cuarto listo." },
  half: { text: "Mitad hecha, lo difícil ya pasó", say: "Mitad hecha. Lo difícil ya pasó." },
  q3: { text: "Último empujón", say: "Último empujón." },
  last: { text: "Última serie: déjalo todo", say: "Última serie: déjalo todo." },
};
const ORDER: Milestone[] = ["last", "q3", "half", "q1"];

/** Hitos que ya se alcanzaron con `done` de `total` series. */
export function reachedMilestones(done: number, total: number): Milestone[] {
  if (total <= 0 || done <= 0) return [];
  const f = done / total;
  const out: Milestone[] = [];
  if (f >= 0.25) out.push("q1");
  if (f >= 0.5) out.push("half");
  if (f >= 0.75) out.push("q3");
  if (total >= 2 && total - done === 1) out.push("last");
  return out;
}

/**
 * Hito que toca mostrar al marcar una serie. Los ya vistos no se repiten (deshacer y volver a marcar no lo repite).
 * Si se cruzan varios a la vez se muestra el más cercano al final. Al terminar todo no se muestra (va el cierre).
 */
export function nextMilestone(done: number, total: number, seen: readonly string[]) {
  const fresh = reachedMilestones(done, total).filter((m) => !seen.includes(m));
  if (!fresh.length) return { show: null as Milestone | null, seen: [...seen] };
  const show = done >= total ? null : ORDER.find((m) => fresh.includes(m)) ?? null;
  return { show, seen: [...seen, ...fresh] };
}

/* ---------- Modo exprés al salir ---------- */
/**
 * Recorta lo pendiente a 1 serie por ejercicio sin empezar; los ejercicios ya empezados se quedan con lo hecho.
 * Devuelve null si no ahorra ninguna serie.
 */
export function expressRows(rows: Row[][]): Row[][] | null {
  const out = rows.map((r) => {
    const done = r.filter((s) => s.done);
    if (done.length === r.length) return r;
    return done.length ? done : r.slice(0, 1);
  });
  const pending = (x: Row[][]) => x.flat().filter((s) => !s.done).length;
  return pending(out) < pending(rows) ? out : null;
}

/* ---------- Datos del descanso ---------- */
/** Peso mínimo (múltiplo de `step`) que supera la mejor marca estimada con esas reps. */
export function kgToBeat(best: number, reps: number, step: number) {
  if (best <= 0 || reps <= 0 || step <= 0) return null;
  let kg = Math.ceil(best / (1 + reps / 30) / step) * step;
  while (e1(kg, reps) <= best + 0.01) kg += step;
  return Math.round(kg * 100) / 100;
}

/** Volumen de las mismas series de la última vez (solo ejercicios con historial). */
export function lastVolume(last: ({ kg: number | null; reps: number }[] | null)[]) {
  return Math.round(last.reduce((a, s) => a + (s ?? []).reduce((b, x) => b + (x.kg ?? 0) * x.reps, 0), 0));
}

export type FactInput = {
  next?: { name: string; best: number; reps: number; step: number; kg: boolean; last?: { kg: number | null; reps: number }[] | null } | null;
  /** Series hechas y volumen total de hoy (todos los ejercicios) */
  doneSets?: number; volTotal?: number;
  /** La racha ya se muestra en otra línea del descanso: no repetirla aquí */
  streakShown?: boolean;
  volToday: number; volLast: number;
  streak: number; todayDone: boolean;
  goal?: LevelGoal | null;
  finish?: { left: number; xp: number; bonus: number } | null;
  unit?: string;
};

/** Datos motivadores con números reales del usuario. Se rota uno por descanso. */
export function restFacts(o: FactInput, L: Lang = ES_LANG): string[] {
  const { t } = L;
  const out: string[] = [];
  const n = o.next;
  const vol = (v: number) => volumeText(v, L);
  const days = (d: number) => t(d === 1 ? "{n} día" : "{n} días", { n: d });
  if (n && n.kg && n.best > 0) {
    const kg = kgToBeat(n.best, n.reps, n.step);
    if (kg) out.push(t("Con {w} × {reps} superas tu récord en {name}.", { w: wFmt(kg, L), reps: n.reps, name: n.name }));
  }
  if (n?.last?.length) {
    const sets = n.last.map((x) => (x.kg ? `${wNum(x.kg, L)} × ${x.reps}` : String(x.reps))).join(", ");
    out.push(t("La última vez en {name} hiciste {sets}. Hoy toca igualarlo o superarlo.", { name: n.name, sets }));
  }
  if (o.volLast > 0 && o.volToday > 0) {
    out.push(o.volToday >= o.volLast
      ? t("Ya moviste {today}, más que los {last} de la última vez con estos ejercicios.", { today: vol(o.volToday), last: vol(o.volLast) })
      : t("Llevas {today} de los {last} que moviste la última vez con estos ejercicios.", { today: vol(o.volToday), last: vol(o.volLast) }));
  }
  else if (o.volTotal && o.doneSets) out.push(t(o.doneSets === 1 ? "Hoy llevas {n} serie y {vol} movidos." : "Hoy llevas {n} series y {vol} movidos.", { n: o.doneSets, vol: vol(o.volTotal) }));
  if (o.streakShown) { /* la racha ya está en pantalla */ }
  else if (o.todayDone && o.streak > 0) out.push(t("Tu racha de {days} ya está a salvo hoy.", { days: days(o.streak) }));
  else if (o.streak > 0) out.push(t("Guardar este entreno lleva tu racha a {days}.", { days: days(o.streak + 1) }));
  else out.push(t("Guardar este entreno empieza tu racha."));
  if (o.finish && o.finish.left > 0 && o.finish.xp > 0) {
    const what = o.finish.left === 1 ? t("Terminar la serie que queda") : t("Terminar las {n} {unit} que quedan", { n: o.finish.left, unit: t(o.unit ?? "series") });
    out.push(`${what} ${t("vale +{xp} XP", { xp: o.finish.xp })}${o.finish.bonus ? t(", con el bono de +{bonus}", { bonus: o.finish.bonus }) : ""}.`);
  }
  if (o.goal?.level.next) out.push(`${levelGoalText(o.goal, o.unit, L)}.`);
  return out;
}

/** Elige el dato del descanso `n` (rota entre los disponibles). */
export const pickFact = (facts: string[], n: number) => (facts.length ? facts[((n % facts.length) + facts.length) % facts.length] : null);

/** Volumen de hoy solo en los ejercicios que tienen historial (para comparar peras con peras). */
export function volumeWithHistory(rows: Row[][], hasLast: boolean[]) {
  let v = 0;
  rows.forEach((r, i) => { if (hasLast[i]) r.forEach((s) => { if (s.done) v += num(s.kg) * num(s.reps); }); });
  return Math.round(v);
}
