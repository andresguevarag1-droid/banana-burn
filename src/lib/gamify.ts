// Gamificación Banana Burn: XP, niveles, rachas y logros.

export const LEVELS = [
  { xp: 0, n: "Banana verde", icon: "banana" },
  { xp: 300, n: "Banana pintona", icon: "banana" },
  { xp: 800, n: "Banana madura", icon: "peeled" },
  { xp: 1600, n: "Plátano macho", icon: "bunch" },
  { xp: 3000, n: "Mono fuerte", icon: "monkey" },
  { xp: 5000, n: "Gorila", icon: "gorilla" },
  { xp: 8000, n: "Rey de la selva", icon: "monkeyCrown" },
  { xp: 12000, n: "King Kong", icon: "monkeyCrown" },
];

export function levelOf(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
  const cur = LEVELS[i], next = LEVELS[i + 1];
  const into = xp - cur.xp, span = next ? next.xp - cur.xp : 1;
  return { idx: i + 1, ...cur, next: next ?? null, progress: next ? into / span : 1, toNext: next ? next.xp - xp : 0 };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const prev = (s: string) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() - 1); return iso(d); };

/** Racha: días consecutivos con actividad (entreno o check-in). Hoy cuenta si ya hay actividad; si no, no rompe la racha de ayer. */
export function streakOf(activeDays: Set<string>, today: string) {
  let d = activeDays.has(today) ? today : prev(today);
  let n = 0;
  while (activeDays.has(d)) { n++; d = prev(d); }
  return { days: n, todayDone: activeDays.has(today) };
}

export type Badge = { id: string; icon: string; n: string; d: string; got: boolean };

/** `tester`: fue tester de la beta alguna vez (0029). La medalla solo aparece para quien lo fue: nadie la ve bloqueada. */
export function badges(s: { workouts: number; streak: number; prs: number; weighIns: number; lostKg: number; tester?: boolean }): Badge[] {
  const extra: Badge[] = s.tester ? [{ id: "tester", icon: "flask", n: "Tester beta", d: "Ayudó a probar Banana Burn en la beta", got: true }] : [];
  return [
    ...extra,
    { id: "first", icon: "medal", n: "Primer entreno", d: "Completa tu primera sesión", got: s.workouts >= 1 },
    { id: "w10", icon: "barbell", n: "10 entrenos", d: "La constancia gana", got: s.workouts >= 10 },
    { id: "s7", icon: "streak", n: "Racha de 7", d: "7 días seguidos activo", got: s.streak >= 7 },
    { id: "s30", icon: "streak", n: "Racha de 30", d: "Un mes sin fallar", got: s.streak >= 30 },
    { id: "pr", icon: "trophy", n: "Récord personal", d: "Supera tu mejor marca", got: s.prs >= 1 },
    { id: "scale", icon: "scale", n: "Báscula fiel", d: "10 pesajes registrados", got: s.weighIns >= 10 },
    { id: "kg2", icon: "trendDown", n: "−2 kg", d: "Primeros 2 kg fuera", got: s.lostKg >= 2 },
    { id: "kg5", icon: "target", n: "−5 kg", d: "Medio camino a la meta", got: s.lostKg >= 5 },
  ];
}

/** Segundos mínimos razonables por serie (ejecución + algo de descanso). Debajo de eso, no se premia. */
export const MIN_SET_SECONDS = 25;
/** XP por serie hecha, por récord (máx. 3 por entreno) y bono por completar todas las series. */
export const SET_XP = 10;
export const PR_XP = 50;
export const FULL_BONUS = 30;

/**
 * XP de un entreno, calculado igual en el cliente y en el servidor.
 * Anti-trampa: si las series se registraron más rápido de lo físicamente posible, el entreno
 * cuenta para la racha pero casi no da XP ni récords.
 */
export function workoutXp(o: { doneSets: number; totalSets: number; prs: number; seconds: number }) {
  const done = Math.max(0, Math.min(Math.round(o.doneSets), 40));
  const rushed = done > 0 && o.seconds < done * MIN_SET_SECONDS;
  if (rushed) return { xp: 0, prs: 0, rushed: true }; // series demasiado rápidas: no suman XP (coincide con lo que dice la app)
  const prs = Math.max(0, Math.min(Math.round(o.prs), 3));
  const full = o.totalSets > 0 && done >= o.totalSets;
  return { xp: done * SET_XP + prs * PR_XP + (full ? FULL_BONUS : 0), prs, rushed: false };
}

/** Nivel nuevo si pasar de `xpBefore` a `xpAfter` cruza un umbral; si no, null. */
export function levelCrossed(xpBefore: number, xpAfter: number) {
  const a = levelOf(xpBefore), b = levelOf(xpAfter);
  return b.idx > a.idx ? b : null;
}

/** Entrenos que faltan para el próximo nivel si cada uno vale `perWorkout` XP. null si no aplica. */
export function workoutsToNext(xp: number, perWorkout: number) {
  const lv = levelOf(xp);
  if (!lv.next || perWorkout <= 0) return null;
  return Math.max(1, Math.ceil(lv.toNext / perWorkout));
}

// ───────────── XP por registrar comida ─────────────
/** Registrar cualquier comida (fit o no) suma XP: lo que cuenta es registrar. */
export const MEAL_XP = 10;
/** Registros con XP por día local; después se sigue registrando, pero sin XP (anti-farmeo). */
export const MEAL_XP_DAILY_MAX = 5;

/** XP que corresponde al siguiente registro de comida, según cuántos ya dieron XP hoy. */
export function mealXpFor(alreadyToday: number) {
  return Math.max(0, Math.floor(alreadyToday)) < MEAL_XP_DAILY_MAX ? MEAL_XP : 0;
}

// ───────────── Niveles como juego: recompensas, racha multiplicadora, meta semanal ─────────────

/** XP de las fuentes de siempre (las mismas que usan las acciones del servidor y el guard de xp_events). */
export const CHECKIN_XP = 15;
export const WEIGH_XP = 10;
export const CHALLENGE_DAY_XP = 10;
/** Hitos de reto: días 7 y 14 cumplidos (los otorga el servidor una sola vez por reto). */
export const MILESTONE_XP = 25;
export const MILESTONE_DAYS = [7, 14] as const;

/** Recompensa real que se desbloquea al llegar a cada nivel (índice 1-based = nivel). */
export type Perk = { kind: "inicio" | "marco" | "comodin" | "descuento"; text: string; frame?: string };
export const LEVEL_PERKS: Perk[] = [
  { kind: "inicio", text: "Tu camino empieza aquí" },
  { kind: "marco", text: "Marco verde Pintona para tu perfil", frame: "pintona" },
  { kind: "comodin", text: "+1 comodín en cada reto que empieces" },
  { kind: "marco", text: "Marco dorado para tu perfil", frame: "dorado" },
  { kind: "descuento", text: "10% de descuento en retos Premium" },
  { kind: "comodin", text: "+1 comodín más en tus retos (2 en total)" },
  { kind: "descuento", text: "15% de descuento en retos Premium y marco con corona", frame: "corona" },
  { kind: "descuento", text: "20% de descuento en retos Premium y marco King Kong", frame: "kong" },
];

/** Umbrales de XP que dan comodines extra (los repite public._level_bonus_grace en 0018). */
export const GRACE_LEVEL_XP = [LEVELS[2].xp, LEVELS[5].xp] as const;

/** Beneficios acumulados a un nivel: comodines extra, % de descuento en la tienda y marco de perfil. */
export function perksAt(idx: number) {
  const i = Math.max(1, Math.min(LEVELS.length, Math.floor(idx)));
  const xp = LEVELS[i - 1].xp;
  const extraGrace = GRACE_LEVEL_XP.filter((t) => xp >= t).length;
  const discountPct = i >= 8 ? 20 : i >= 7 ? 15 : i >= 5 ? 10 : 0;
  let frame: string | null = null;
  for (let k = 0; k < i; k++) if (LEVEL_PERKS[k].frame) frame = LEVEL_PERKS[k].frame!;
  return { extraGrace, discountPct, frame };
}

/** Lo que trae el próximo nivel, para mostrarlo ("Te faltan 80 XP para Banana madura"). */
export function nextUnlock(xp: number) {
  const lv = levelOf(xp);
  if (!lv.next) return null;
  return { name: lv.next.n, idx: lv.idx + 1, xpLeft: lv.toNext, perk: LEVEL_PERKS[lv.idx] };
}

/**
 * Multiplicador por racha. Se paga como un bono aparte (`streak_bonus`) sobre el XP ganado ese día,
 * así el historial muestra exactamente cuánto vino de la racha.
 */
export const STREAK_TIERS = [
  { days: 30, mult: 1.5 },
  { days: 14, mult: 1.3 },
  { days: 7, mult: 1.2 },
  { days: 3, mult: 1.1 },
] as const;
/** Tope del bono de racha por día (protege contra abusos y mantiene el tope diario de 1.500 XP). */
export const STREAK_BONUS_MAX = 150;
/** Tipos que no suman a la base del bono: premios de reto completo, el propio bono y la bienvenida. */
export const BONUS_EXCLUDED = new Set(["challenge", "streak_bonus", "onboard", "challenge_milestone"]);

export function streakMultiplier(streakDays: number) {
  const d = Math.max(0, Math.floor(streakDays));
  return STREAK_TIERS.find((t) => d >= t.days)?.mult ?? 1;
}

/** Próximo escalón de la racha (o null si ya está en el máximo). */
export function nextStreakTier(streakDays: number) {
  const d = Math.max(0, Math.floor(streakDays));
  const up = [...STREAK_TIERS].reverse().find((t) => t.days > d);
  return up ? { days: up.days, mult: up.mult, left: up.days - d } : null;
}

/** Bono de racha del día: (multiplicador - 1) por el XP base del día, redondeado hacia abajo y con tope. */
export function streakBonus(baseXpToday: number, streakDays: number) {
  const base = Math.max(0, Math.floor(baseXpToday));
  const m = streakMultiplier(streakDays);
  return Math.min(STREAK_BONUS_MAX, Math.floor(base * (m - 1) + 1e-9));
}

/** Meta semanal de XP: crece con el nivel (una semana con 3 o 4 entrenos y registros la cumple). */
export function weeklyGoalFor(idx: number) {
  const i = Math.max(1, Math.min(LEVELS.length, Math.floor(idx)));
  return [400, 500, 600, 700, 800, 900, 1000, 1000][i - 1];
}

/** Día local (YYYY-MM-DD) de un instante en una zona horaria. */
export function localDay(at: string | Date, tz: string) {
  const d = typeof at === "string" ? new Date(at) : at;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export type XpEvent = { kind: string; xp: number; created_at: string };

/** XP por día local para los días pedidos, separando el bono de racha. */
export function xpByDay(events: XpEvent[], days: string[], tz: string) {
  const out = new Map(days.map((d) => [d, { day: d, xp: 0, bonus: 0, base: 0 }]));
  for (const e of events) {
    const row = out.get(localDay(e.created_at, tz));
    if (!row) continue;
    const x = Math.max(0, Math.round(e.xp));
    row.xp += x;
    if (e.kind === "streak_bonus") row.bonus += x;
    else if (!BONUS_EXCLUDED.has(e.kind)) row.base += x;
  }
  return days.map((d) => out.get(d)!);
}
