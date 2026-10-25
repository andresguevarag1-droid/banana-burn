// Temporadas deportivas: 8 semanas con fechas oficiales (todos viven la misma Temporada 1) para mejorar en un deporte.
// Módulo PURO (sin base ni servidor): fechas, inscripción, precios, cuestionario de inicio, armado de la semana alrededor
// del deporte, ajustes por lesiones, equipo y minutos, y el resumen de lo que gustó para la próxima temporada.
//
// Modelo:
//   - Cada temporada es un programa (challenges_catalog.kind = 'programa', slug `temporada-<deporte>-<n>`) con sus sesiones
//     en program_sessions: Hoy, Entrenar, la coach y la nutrición se transforman con el mecanismo de los programas.
//   - public.seasons guarda fechas, ventana de inscripción y precio (lo que la base hace cumplir). Aquí, la Temporada 1.
//   - started_on de la persona = inicio oficial de la temporada: la semana sigue el calendario aunque la pause.
//   - Una temporada no se repite: cada número se compra una sola vez. La siguiente se arma con lo que gustó (season_feedback).

export type SportId = "running" | "raquetas" | "cross";
export const SPORT_IDS: SportId[] = ["running", "raquetas", "cross"];

export type SportInfo = {
  id: SportId;
  name: string;
  /** Nombre del modo que toma la app. */
  mode: string;
  /** Color de acento (solo detalles: chips, anillos, insignia). Siempre sobre blanco o con texto blanco encima. */
  accent: string;
  /** Fondo suave del acento (chips y fondos de insignia). */
  accentSoft: string;
  /** Ícono de la app (lista ICONS de challenges.ts). */
  icon: string;
  /** Qué hace la persona en su deporte: "corres", "juegas". */
  verb: string;
  /** Días del deporte: "días que corres", "días de partido o clase". */
  daysLabel: string;
  tagline: string;
};

// Contraste (WCAG AA): los tres acentos pasan 4.5:1 con texto blanco encima y sobre blanco. Nunca texto de acento sobre
// el amarillo banana (lo comprueba seasons.test.ts).
export const SPORTS: Record<SportId, SportInfo> = {
  running: {
    id: "running", name: "Running", mode: "Modo Running", accent: "#C2410C", accentSoft: "#FFEDD5", icon: "run", verb: "corres",
    daysLabel: "Días que corres", tagline: "Corre más fuerte, más rápido y con menos lesiones.",
  },
  raquetas: {
    id: "raquetas", name: "Raquetas", mode: "Modo Raquetas", accent: "#0F766E", accentSoft: "#CCFBF1", icon: "target", verb: "juegas",
    daysLabel: "Días de partido o clase", tagline: "Tenis y pádel: más potencia, mejores desplazamientos y brazo sano.",
  },
  cross: {
    id: "cross", name: "Cross Training", mode: "Modo Cross Training", accent: "#475569", accentSoft: "#E2E8F0", icon: "bolt", verb: "entrenas en el box",
    daysLabel: "Días de box o clases", tagline: "Fuerza, técnica y acondicionamiento, con escalas para cada nivel.",
  },
};

/** Precio por temporada en centavos de USD. Lo pone el servidor, nunca el cliente. */
export const SEASON_PRICE_MINOR: Record<SportId, number> = { running: 1499, raquetas: 1699, cross: 1899 };

export type SeasonStatus = "preventa" | "activa" | "terminada";
export type SeasonInfo = {
  slug: string; sport: SportId; number: number; title: string;
  /** Lunes de la semana 1 (fecha de Costa Rica). */
  startsOn: string;
  /** Domingo de la semana 8. */
  endsOn: string;
  /** Último día para inscribirse (fin de la semana 2). */
  enrollUntil: string;
  priceMinor: number;
};

export const SEASON_WEEKS = 8;
export const seasonSlug = (sport: SportId, n: number) => `temporada-${sport}-${n}`;
export const SEASON_SLUG = /^temporada-(running|raquetas|cross)-(\d{1,3})$/;
export function parseSeasonSlug(slug: string): { sport: SportId; number: number } | null {
  const m = SEASON_SLUG.exec(slug);
  return m ? { sport: m[1] as SportId, number: Number(m[2]) } : null;
}
export const isSeasonSlug = (slug: string | null | undefined) => !!slug && SEASON_SLUG.test(slug);

const DAY = 864e5;
const t = (iso: string) => Date.parse(iso.slice(0, 10) + "T12:00:00Z");
export const addDaysIso = (iso: string, n: number) => new Date(t(iso) + n * DAY).toISOString().slice(0, 10);
export const daysBetweenIso = (a: string, b: string) => Math.round((t(b) - t(a)) / DAY);

/** Temporada 1: del lunes 9 de noviembre de 2026 al domingo 3 de enero de 2027 (8 semanas). */
export const T1_START = "2026-11-09";
export function makeSeason(sport: SportId, n: number, startsOn: string, title?: string): SeasonInfo {
  return {
    slug: seasonSlug(sport, n), sport, number: n, title: title ?? `Temporada ${n}: ${SPORTS[sport].name}`,
    startsOn, endsOn: addDaysIso(startsOn, SEASON_WEEKS * 7 - 1), enrollUntil: addDaysIso(startsOn, 13), priceMinor: SEASON_PRICE_MINOR[sport],
  };
}
export const SEASONS_T1: SeasonInfo[] = SPORT_IDS.map((s) => makeSeason(s, 1, T1_START));
export const SEASON_BY_SLUG: Record<string, SeasonInfo> = Object.fromEntries(SEASONS_T1.map((s) => [s.slug, s]));

export function seasonStatus(s: Pick<SeasonInfo, "startsOn" | "endsOn">, today: string): SeasonStatus {
  if (today < s.startsOn) return "preventa";
  if (today > s.endsOn) return "terminada";
  return "activa";
}
/** ¿Se puede comprar o canjear hoy? Desde la preventa hasta el fin de la semana 2. */
export const canEnroll = (s: Pick<SeasonInfo, "enrollUntil">, today: string) => today <= s.enrollUntil;
/** Semana de la temporada (1 a 8) según el calendario oficial; 0 antes de empezar, 9 al terminar. */
export function seasonWeek(s: Pick<SeasonInfo, "startsOn">, today: string) {
  const d = daysBetweenIso(s.startsOn, today);
  if (d < 0) return 0;
  return Math.min(SEASON_WEEKS + 1, Math.floor(d / 7) + 1);
}
/** Días que faltan para empezar (0 si ya empezó). */
export const daysToStart = (s: Pick<SeasonInfo, "startsOn">, today: string) => Math.max(0, daysBetweenIso(today, s.startsOn));

/** La temporada vigente o la próxima de un deporte (la de número mayor que todavía no terminó). */
export function currentSeason(list: SeasonInfo[], sport: SportId, today: string): SeasonInfo | null {
  const mine = list.filter((s) => s.sport === sport && s.endsOn >= today).sort((a, b) => a.number - b.number);
  return mine[0] ?? null;
}

const fmt = new Intl.DateTimeFormat("es-419", { day: "numeric", month: "long", timeZone: "UTC" });
export const longDate = (iso: string) => fmt.format(new Date(iso.slice(0, 10) + "T12:00:00Z"));

// ───────────── Compra y canje ─────────────

export type OwnedSeason = { slug: string; source: string };
/** ¿Puede comprar esta temporada? Razón en texto si no. Sin repetir: cada número se compra una sola vez. */
export function purchaseBlock(s: SeasonInfo, o: { owned: boolean; today: string; hasAccess: boolean }): string | null {
  if (o.owned) return "Ya tienes esta temporada.";
  if (!canEnroll(s, o.today)) return "Las inscripciones de esta temporada cerraron. Te avisamos cuando abra la próxima.";
  if (!o.hasAccess) return "Necesitas un plan activo o tu prueba gratis para sumar una temporada.";
  return null;
}

/** Suscripción como la lee la regla del plan anual. */
export type AnnualSub = { id: number | string; billing: string | null; status: string; current_period_start: string | null; current_period_end: string | null; plan: string | null };
/**
 * Plan anual pagado vigente: incluye 1 temporada gratis por periodo anual (se renueva con el plan). Nunca durante la
 * prueba (todavía no hay suscripción activa) ni con un plan mensual. Devuelve la clave del periodo o null.
 */
export function annualPeriodKey(subs: AnnualSub[], now = new Date()): { subId: string; periodStart: string } | null {
  const live = subs.filter((s) => s.billing === "anual" && s.status === "active" && s.current_period_start && s.current_period_end && Date.parse(s.current_period_end) > now.getTime() && Date.parse(s.current_period_start) <= now.getTime());
  live.sort((a, b) => Date.parse(b.current_period_start!) - Date.parse(a.current_period_start!));
  const s = live[0];
  return s ? { subId: String(s.id), periodStart: s.current_period_start!.slice(0, 10) } : null;
}
/** ¿Le queda el canje del plan anual en este periodo? */
export function canRedeemAnnual(subs: AnnualSub[], redemptions: { sub_id: string; period_start: string }[], now = new Date()) {
  const k = annualPeriodKey(subs, now);
  if (!k) return null;
  return redemptions.some((r) => r.sub_id === k.subId && r.period_start.slice(0, 10) === k.periodStart) ? null : k;
}

// ───────────── Cuestionario de inicio ─────────────

export type Level = "empezando" | "recreativo" | "competitivo";
export type Place = "gym" | "gym_basico" | "casa";
export type TimeOfDay = "manana" | "mediodia" | "tarde" | "noche";
export type Area = "cuello" | "hombro" | "codo" | "muneca" | "espalda_alta" | "espalda_baja" | "cadera" | "rodilla" | "tobillo" | "pie";
export const AREAS: Area[] = ["cuello", "hombro", "codo", "muneca", "espalda_alta", "espalda_baja", "cadera", "rodilla", "tobillo", "pie"];
export const AREA_LABEL: Record<Area, string> = {
  cuello: "Cuello", hombro: "Hombro", codo: "Codo", muneca: "Muñeca", espalda_alta: "Espalda alta", espalda_baja: "Espalda baja",
  cadera: "Cadera", rodilla: "Rodilla", tobillo: "Tobillo", pie: "Pie o planta",
};
export const LEVEL_LABEL: Record<Level, string> = { empezando: "Empezando", recreativo: "Recreativo", competitivo: "Competitivo" };
export const PLACE_LABEL: Record<Place, string> = { gym: "Gimnasio completo", gym_basico: "Gimnasio básico", casa: "Casa con poco equipo" };
export const TIME_LABEL: Record<TimeOfDay, string> = { manana: "Mañana", mediodia: "Mediodía", tarde: "Tarde", noche: "Noche" };
export const EQUIPMENT = ["mancuernas", "kettlebell", "banda", "barra_dominadas", "cajon", "cuerda", "balon_medicinal", "barra_discos", "poleas"] as const;
export type EquipmentItem = (typeof EQUIPMENT)[number];
export const EQUIPMENT_LABEL: Record<EquipmentItem, string> = {
  mancuernas: "Mancuernas", kettlebell: "Kettlebell", banda: "Banda elástica", barra_dominadas: "Barra de dominadas", cajon: "Cajón o escalón firme",
  cuerda: "Cuerda para saltar", balon_medicinal: "Balón medicinal", barra_discos: "Barra y discos", poleas: "Poleas o máquinas",
};
export const DOW_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const DOW_LONG = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export const GOALS: Record<SportId, { id: string; label: string }[]> = {
  running: [
    { id: "marca", label: "Bajar mi tiempo" }, { id: "distancia", label: "Correr más distancia" }, { id: "lesiones", label: "No lesionarme" }, { id: "terminar", label: "Terminar mi primera carrera" },
  ],
  raquetas: [
    { id: "potencia", label: "Más potencia en el golpe" }, { id: "desplazamiento", label: "Moverme más rápido" }, { id: "aguante", label: "Aguantar partidos largos" }, { id: "brazo", label: "Cuidar codo y hombro" },
  ],
  cross: [
    { id: "fuerza", label: "Ganar fuerza" }, { id: "tecnica", label: "Mejorar la técnica" }, { id: "motor", label: "Más resistencia en los WOD" }, { id: "gimnasticos", label: "Lograr movimientos gimnásticos" },
  ],
};

export type RunningAnswers = {
  runDays: number[]; longRunDay: number | null; kmWeek: number; paceDist: "5k" | "10k" | null; paceTime: string | null;
  target: "5k" | "10k" | "21k" | "42k" | "trail"; surface: ("calle" | "pista" | "montana")[]; watch: "no" | "reloj" | "strava" | "ambos";
};
export type RacketAnswers = {
  which: "tenis" | "padel" | "ambos"; playDays: number[]; competitiveDays: number[]; hand: "derecha" | "izquierda";
  category: string; matchMin: number; pains: ("codo" | "hombro" | "muneca" | "rodilla" | "tobillo")[];
};
export type CrossAnswers = {
  boxDays: number[]; oly: "nada" | "basica" | "solida"; gymnastics: "nada" | "basica" | "solida"; benchWod: string | null; squat1rm: number | null; avoid: AvoidId[];
};
export type SeasonIntake = {
  level: Level; years: number; trainDays: number[]; time: TimeOfDay; sessions: 2 | 3 | 4; minutes: 30 | 45 | 60;
  place: Place; equipment: EquipmentItem[]; injuries: Area[]; goal: string; eventDate: string | null; eventType: string | null;
  running?: RunningAnswers; raquetas?: RacketAnswers; cross?: CrossAnswers;
};

const DAYS = (x: unknown) => [...new Set((Array.isArray(x) ? x : []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) as number[])].sort((a, b) => a - b);
const pick = <T extends string>(x: unknown, opts: readonly T[], d: T): T => (opts.includes(x as T) ? (x as T) : d);
const picks = <T extends string>(x: unknown, opts: readonly T[]): T[] => [...new Set((Array.isArray(x) ? x : []).filter((v) => opts.includes(v as T)) as T[])];
const num = (x: unknown, a: number, b: number, d: number) => (typeof x === "number" && Number.isFinite(x) ? Math.min(b, Math.max(a, Math.round(x))) : d);
const str = (x: unknown, max: number) => (typeof x === "string" ? x.trim().replace(/\s+/g, " ").slice(0, max) : "");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const AVOID_OPTIONS = ["saltos", "olimpicos", "colgarse", "sobre_cabeza", "correr", "burpees"] as const;
export type AvoidId = (typeof AVOID_OPTIONS)[number];
export const AVOID_LABEL: Record<(typeof AVOID_OPTIONS)[number], string> = {
  saltos: "Saltos", olimpicos: "Levantamientos olímpicos", colgarse: "Colgarme de la barra", sobre_cabeza: "Peso sobre la cabeza", correr: "Correr", burpees: "Burpees",
};

/** Sanea el cuestionario que llega del navegador. null si falta lo indispensable. */
export function parseIntake(x: unknown, sport: SportId): SeasonIntake | null {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const trainDays = DAYS(o.trainDays);
  if (!trainDays.length) return null;
  const sessions = num(o.sessions, 2, 4, 3) as 2 | 3 | 4;
  const minutes = ([30, 45, 60] as const).includes(o.minutes as 30) ? (o.minutes as 30 | 45 | 60) : 45;
  const goalIds = GOALS[sport].map((g) => g.id);
  const eventDate = typeof o.eventDate === "string" && ISO.test(o.eventDate) ? o.eventDate : null;
  const out: SeasonIntake = {
    level: pick(o.level, ["empezando", "recreativo", "competitivo"] as const, "recreativo"),
    years: num(o.years, 0, 60, 0), trainDays, time: pick(o.time, ["manana", "mediodia", "tarde", "noche"] as const, "tarde"), sessions, minutes,
    place: pick(o.place, ["gym", "gym_basico", "casa"] as const, "gym"), equipment: picks(o.equipment, EQUIPMENT), injuries: picks(o.injuries, AREAS),
    goal: pick(o.goal, goalIds, goalIds[0]), eventDate, eventType: eventDate ? str(o.eventType, 60) || null : null,
  };
  const s = (o[sport] && typeof o[sport] === "object" ? o[sport] : {}) as Record<string, unknown>;
  if (sport === "running") {
    const runDays = DAYS(s.runDays);
    const long = Number.isInteger(s.longRunDay) && runDays.includes(s.longRunDay as number) ? (s.longRunDay as number) : null;
    const paceDist = s.paceDist === "5k" || s.paceDist === "10k" ? s.paceDist : null;
    const paceTime = paceDist && typeof s.paceTime === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(s.paceTime.trim()) ? s.paceTime.trim() : null;
    out.running = {
      runDays, longRunDay: long, kmWeek: num(s.kmWeek, 0, 250, 15), paceDist: paceTime ? paceDist : null, paceTime,
      target: pick(s.target, ["5k", "10k", "21k", "42k", "trail"] as const, "10k"), surface: picks(s.surface, ["calle", "pista", "montana"] as const),
      watch: pick(s.watch, ["no", "reloj", "strava", "ambos"] as const, "no"),
    };
  } else if (sport === "raquetas") {
    const playDays = DAYS(s.playDays);
    out.raquetas = {
      which: pick(s.which, ["tenis", "padel", "ambos"] as const, "padel"), playDays, competitiveDays: DAYS(s.competitiveDays).filter((d) => playDays.includes(d)),
      hand: pick(s.hand, ["derecha", "izquierda"] as const, "derecha"), category: str(s.category, 40), matchMin: num(s.matchMin, 30, 240, 90),
      pains: picks(s.pains, ["codo", "hombro", "muneca", "rodilla", "tobillo"] as const),
    };
  } else {
    out.cross = {
      boxDays: DAYS(s.boxDays), oly: pick(s.oly, ["nada", "basica", "solida"] as const, "nada"), gymnastics: pick(s.gymnastics, ["nada", "basica", "solida"] as const, "nada"),
      benchWod: str(s.benchWod, 60) || null, squat1rm: typeof s.squat1rm === "number" && s.squat1rm > 0 ? num(s.squat1rm, 1, 400, 0) : null, avoid: picks(s.avoid, AVOID_OPTIONS),
    };
  }
  return out;
}

// ───────────── La semana: dónde va cada sesión ─────────────

/**
 * Las sesiones de cada temporada, en orden de prioridad (si eliges 2 por semana, van las dos primeras):
 *   1 Fuerza (piernas pesadas)  2 Potencia y agilidad  3 Tren superior y core (piernas ligeras)  4 Recuperación y movilidad
 */
export type SessionKind = "fuerza" | "potencia" | "superior" | "recuperacion";
export const SESSION_ORDER: SessionKind[] = ["fuerza", "potencia", "superior", "recuperacion"];
export const SESSION_DAY: Record<SessionKind, number> = { fuerza: 1, potencia: 2, superior: 3, recuperacion: 4 };
const HEAVY: SessionKind[] = ["fuerza", "potencia"];

export type DayPlan = { dow: number; session: SessionKind | null; sport: "clave" | "normal" | null };
export type WeekPlan = { days: DayPlan[]; /** dow (0 = lunes) de cada sesión elegida, en el orden de SESSION_ORDER. */ slots: { kind: SessionKind; dow: number }[]; warnings: string[]; dropped: SessionKind[] };

/** Días del deporte: los "clave" son la carrera larga, los partidos competitivos y los días de box; el resto, normales. */
export function sportDays(sport: SportId, i: SeasonIntake): { key: number[]; normal: number[] } {
  if (sport === "running" && i.running) {
    const key = i.running.longRunDay !== null ? [i.running.longRunDay] : [];
    return { key, normal: i.running.runDays.filter((d) => !key.includes(d)) };
  }
  if (sport === "raquetas" && i.raquetas) {
    const comp = i.raquetas.competitiveDays;
    // Sin partidos marcados como competitivos, todos los días de juego cuentan como clave (no se llega cansado a jugar).
    const key = comp.length ? comp : i.raquetas.playDays;
    return { key, normal: i.raquetas.playDays.filter((d) => !key.includes(d)) };
  }
  if (sport === "cross" && i.cross) return { key: [], normal: i.cross.boxDays };
  return { key: [], normal: [] };
}

const mod7 = (n: number) => ((n % 7) + 7) % 7;

/**
 * Arma la semana. Reglas (probadas en seasons.test.ts):
 *   - Fuerza y potencia (piernas pesadas) a 48 h o más de un día clave: nunca el mismo día ni el día anterior.
 *   - En Cross Training la fuerza no va el mismo día que el box.
 *   - Recuperación y movilidad, de preferencia el día después de un día clave.
 *   - Solo en los días que la persona puede entrenar, y tantas sesiones como eligió.
 *   - Si sus días no permiten cumplir las reglas, no las rompe: quita la sesión que no cabe y lo dice en `warnings`.
 */
export function planWeek(sport: SportId, i: SeasonIntake): WeekPlan {
  const { key, normal } = sportDays(sport, i);
  const want = SESSION_ORDER.slice(0, i.sessions);
  const avail = i.trainDays;
  const heavyOk = (d: number) => !key.includes(d) && !key.includes(mod7(d + 1)) && (sport !== "cross" || !normal.includes(d));
  const allowed = (k: SessionKind, d: number) => (HEAVY.includes(k) ? heavyOk(d) : k === "superior" ? !key.includes(d) : true);
  const score = (k: SessionKind, d: number) => {
    let s = 0;
    if (normal.includes(d)) s += k === "recuperacion" ? 1 : 3; // mejor no doblar con el deporte
    if (k === "recuperacion" && key.includes(mod7(d - 1))) s -= 4; // el día después de la carrera larga o el partido
    if (k === "superior" && key.includes(mod7(d + 1))) s += 1;
    return s;
  };
  let best: { kinds: SessionKind[]; days: number[]; cost: number } | null = null;
  // Prueba todas las combinaciones (como mucho 7 días y 4 sesiones): primero con todas las sesiones, luego quitando la de
  // menor prioridad hasta que todo cumple las reglas.
  for (let n = want.length; n >= 1 && !best; n--) {
    const kinds = want.slice(0, n);
    const rec = (idx: number, used: number[], cost: number) => {
      if (idx === kinds.length) {
        let c = cost;
        // Fuerza y potencia separadas por al menos un día.
        const hd = kinds.map((k, j) => (HEAVY.includes(k) ? used[j] : -1)).filter((d) => d >= 0).sort((a, b) => a - b);
        for (let j = 1; j < hd.length; j++) if (hd[j] - hd[j - 1] < 2) c += 2;
        if (hd.length === 2 && 7 - (hd[1] - hd[0]) < 2) c += 2;
        if (!best || c < best.cost) best = { kinds, days: [...used], cost: c };
        return;
      }
      for (const d of avail) if (!used.includes(d) && allowed(kinds[idx], d)) rec(idx + 1, [...used, d], cost + score(kinds[idx], d));
    };
    rec(0, [], 0);
  }
  const chosen = best as { kinds: SessionKind[]; days: number[] } | null;
  const slots = chosen ? chosen.kinds.map((k, j) => ({ kind: k, dow: chosen.days[j] })) : [];
  const dropped = want.filter((k) => !slots.some((s) => s.kind === k));
  const warnings: string[] = [];
  if (!slots.length) warnings.push("Con los días que elegiste no hay un día seguro para entrenar fuerza: todos caen el día de tu deporte o el anterior. Suma un día libre que no sea víspera de un día clave.");
  else if (dropped.length) {
    const free = [0, 1, 2, 3, 4, 5, 6].filter((d) => heavyOk(d) && !avail.includes(d));
    const tip = free.length ? ` Si puedes entrenar el ${DOW_LONG[free[0]]}, cabe completa.` : "";
    warnings.push(`Con tus días caben ${slots.length} de las ${want.length} sesiones sin entrenar piernas pesadas antes de un día clave.${tip}`);
  }
  const days: DayPlan[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    dow: d, session: slots.find((s) => s.dow === d)?.kind ?? null, sport: key.includes(d) ? "clave" : normal.includes(d) ? "normal" : null,
  }));
  return { days, slots: [...slots].sort((a, b) => SESSION_DAY[a.kind] - SESSION_DAY[b.kind]), warnings, dropped };
}

/** Desplazamientos (0 = lunes) de las sesiones elegidas en el orden de su número de día: lo que usa el calendario. */
export const slotOffsets = (p: WeekPlan) => p.slots.map((s) => s.dow);

/**
 * Semanas de descarga: la 4 siempre. Si hay un evento dentro de la temporada, la semana del evento y la anterior (si el
 * evento cae en sus primeros 3 días, para cubrir los 7 a 10 días previos) se vuelven de afinamiento.
 */
export function taperWeeks(s: Pick<SeasonInfo, "startsOn" | "endsOn">, eventDate: string | null): number[] {
  const out = new Set([4]);
  if (eventDate && eventDate >= s.startsOn && eventDate <= addDaysIso(s.endsOn, 7)) {
    const w = Math.min(SEASON_WEEKS, Math.floor(daysBetweenIso(s.startsOn, eventDate) / 7) + 1);
    const dayInWeek = daysBetweenIso(s.startsOn, eventDate) % 7;
    if (w >= 1) out.add(w);
    if (w >= 2 && dayInWeek <= 2) out.add(w - 1);
  }
  return [...out].sort((a, b) => a - b);
}

/** Ejercicios por sesión según los minutos elegidos. */
export const EX_PER_MINUTES: Record<30 | 45 | 60, number> = { 30: 4, 45: 5, 60: 7 };

/**
 * Cambios por molestias: nunca un diagnóstico, solo evitar lo que suele cargar esa zona. La clave es el ejercicio del
 * programa; el valor, el reemplazo (o null para quitarlo).
 */
export const INJURY_SWAPS: Record<Area, Record<string, string | null>> = {
  rodilla: { jumpsquat: "glutebridge", "ds:3361": "ds:0628", "ds:2612": "ds:1373", bulgarian: "ds:3561", "ds:1410": "ds:0628", lunge: "glutebridge", "ds:0381": "glutebridge", "ds:0431": "ds:3561", "ds:0696": "ds:0586", burpee: "mountain" },
  tobillo: { jumpsquat: "glutebridge", "ds:3361": "ds:0628", "ds:2612": "ds:0628", burpee: "mountain", "ds:0417": "ds:1379" },
  pie: { jumpsquat: "glutebridge", "ds:3361": "ds:0628", "ds:2612": "ds:0628", burpee: "mountain" },
  espalda_baja: { deadlift: "glutebridge", rdl: "glutebridge", dbrdl: "glutebridge", "ds:0549": "glutebridge", "ds:0535": "ds:3561", squat: "goblet", "ds:1354": "ds:0979", row: "dbrow" },
  hombro: { ohp: "ds:0235", dbpress: "ds:0235", "ds:1700": "ds:0235", "ds:0550": "goblet", pullup: "lat", "ds:0970": "lat", pikepush: "ds:0235", dips: "pushup", "ds:1354": "ds:0979", burpee: "mountain" },
  codo: { "ds:1016": null, "ds:0994": null, pullup: "lat", "ds:0970": "lat", dips: "pushup" },
  muneca: { pushup: "ds:0979", "ds:1016": null, "ds:0994": null, frontsquat: "goblet", "ds:0535": "ds:0549", burpee: "mountain", mountain: "ds:0276", planktap: "ds:0276" },
  cadera: { "ds:3361": "ds:0628", "ds:1410": "ds:0628", bulgarian: "glutebridge" },
  cuello: { carry: "ds:0979" },
  espalda_alta: { row: "dbrow" },
};
/** En Cross Training, lo que la persona no puede o no quiere hacer. */
export const AVOID_SWAPS: Record<(typeof AVOID_OPTIONS)[number], Record<string, string | null>> = {
  saltos: { jumpsquat: "goblet", "ds:3361": "ds:0628", "ds:2612": "ds:2142", burpee: "mountain" },
  olimpicos: { "ds:0535": "ds:0549", "ds:1700": "dbpress" },
  colgarse: { pullup: "invrow", "ds:0970": "invrow", kneeraise: "legraisef", "ds:0688": "ytw" },
  sobre_cabeza: { ohp: "ds:0235", dbpress: "ds:0235", "ds:1700": "ds:0235", "ds:0550": "goblet", pikepush: "pushup" },
  correr: {},
  burpees: { burpee: "mountain" },
};

// ───────────── Lo que gustó: base de la próxima temporada ─────────────

export type FeedbackRow = { exercise_id: string; week: number; liked: boolean | null; difficulty: "dificil" | "facil" | null; skipped: boolean; completed: boolean };
export type ExerciseStat = { id: string; votes: number; likes: number; dislikes: number; likeRate: number | null; skips: number; skipRate: number; done: number; hard: number; easy: number; seen: number };

/** Resumen por ejercicio (sin datos personales). */
export function aggregateFeedback(rows: FeedbackRow[]): ExerciseStat[] {
  const m = new Map<string, ExerciseStat>();
  for (const r of rows) {
    const s = m.get(r.exercise_id) ?? { id: r.exercise_id, votes: 0, likes: 0, dislikes: 0, likeRate: null, skips: 0, skipRate: 0, done: 0, hard: 0, easy: 0, seen: 0 };
    s.seen++;
    if (r.liked === true) { s.likes++; s.votes++; }
    if (r.liked === false) { s.dislikes++; s.votes++; }
    if (r.skipped) s.skips++;
    if (r.completed) s.done++;
    if (r.difficulty === "dificil") s.hard++;
    if (r.difficulty === "facil") s.easy++;
    m.set(r.exercise_id, s);
  }
  return [...m.values()].map((s) => ({ ...s, likeRate: s.votes ? s.likes / s.votes : null, skipRate: s.seen ? s.skips / s.seen : 0 })).sort((a, b) => (b.likeRate ?? -1) - (a.likeRate ?? -1) || b.votes - a.votes);
}
/** Ejercicios a cambiar en la próxima temporada: no gustan (menos de 50 % con 5 votos o más) o se saltan mucho (30 % o más). */
export const toReplace = (stats: ExerciseStat[]) => stats.filter((s) => (s.votes >= 5 && (s.likeRate ?? 1) < 0.5) || (s.seen >= 5 && s.skipRate >= 0.3)).map((s) => s.id);

/** Personas que siguen activas por semana (retención). `weeks` = semanas con al menos una sesión hecha, por persona. */
export function retention(perUserWeeks: number[][], weeks = SEASON_WEEKS): { week: number; users: number; pct: number }[] {
  const total = perUserWeeks.length;
  return Array.from({ length: weeks }, (_, k) => {
    const w = k + 1;
    const users = perUserWeeks.filter((ws) => ws.includes(w)).length;
    return { week: w, users, pct: total ? users / total : 0 };
  });
}

/** Resumen anónimo de las respuestas del cuestionario (para el panel y el borrador de la próxima temporada). */
export function intakeSummary(list: SeasonIntake[], sport: SportId) {
  const count = <T extends string | number>(xs: T[]) => {
    const m = new Map<T, number>();
    xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k: String(k), n, pct: list.length ? n / list.length : 0 }));
  };
  const base = {
    total: list.length,
    level: count(list.map((i) => i.level)), goal: count(list.map((i) => i.goal)), place: count(list.map((i) => i.place)),
    sessions: count(list.map((i) => i.sessions)), minutes: count(list.map((i) => i.minutes)), injuries: count(list.flatMap((i) => i.injuries)),
    withEvent: list.filter((i) => i.eventDate).length,
  };
  if (sport === "running") return { ...base, target: count(list.flatMap((i) => (i.running ? [i.running.target] : []))), watch: count(list.flatMap((i) => (i.running ? [i.running.watch] : []))) };
  if (sport === "raquetas") return { ...base, which: count(list.flatMap((i) => (i.raquetas ? [i.raquetas.which] : []))), pains: count(list.flatMap((i) => i.raquetas?.pains ?? [])) };
  return { ...base, oly: count(list.flatMap((i) => (i.cross ? [i.cross.oly] : []))), avoid: count(list.flatMap((i) => i.cross?.avoid ?? [])) };
}

/** Línea para el contexto de la coach (sin datos sensibles más allá de las respuestas de la propia persona). */
export function intakeForCoach(sport: SportId, i: SeasonIntake, today: string): string {
  const parts = [`Temporada de ${SPORTS[sport].name}. Nivel ${LEVEL_LABEL[i.level].toLowerCase()}, ${i.years} años practicándolo.`,
    `Objetivo: ${GOALS[sport].find((g) => g.id === i.goal)?.label ?? i.goal}.`, `Entrena fuerza ${i.sessions} veces por semana, ${i.minutes} min, en ${PLACE_LABEL[i.place].toLowerCase()}.`];
  if (i.injuries.length) parts.push(`Molestias que reportó (no son diagnóstico, solo evita cargarlas): ${i.injuries.map((a) => AREA_LABEL[a].toLowerCase()).join(", ")}.`);
  if (i.eventDate) parts.push(`Próximo evento: ${i.eventType ?? "competencia"} el ${longDate(i.eventDate)}${i.eventDate >= today ? ` (faltan ${daysBetweenIso(today, i.eventDate)} días)` : ""}.`);
  if (sport === "running" && i.running) parts.push(`Corre ${i.running.runDays.map((d) => DOW_LONG[d]).join(", ") || "sin días fijos"}${i.running.longRunDay !== null ? `, carrera larga el ${DOW_LONG[i.running.longRunDay]}` : ""}; unos ${i.running.kmWeek} km por semana; prepara ${i.running.target.toUpperCase()}${i.running.paceTime ? `; su ${i.running.paceDist?.toUpperCase()} actual: ${i.running.paceTime}` : ""}.`);
  if (sport === "raquetas" && i.raquetas) parts.push(`Juega ${i.raquetas.which === "ambos" ? "tenis y pádel" : i.raquetas.which}, ${i.raquetas.playDays.map((d) => DOW_LONG[d]).join(", ") || "sin días fijos"}; mano ${i.raquetas.hand}; partidos de ${i.raquetas.matchMin} min${i.raquetas.pains.length ? `; molestias típicas: ${i.raquetas.pains.join(", ")}` : ""}.`);
  if (sport === "cross" && i.cross) parts.push(`Experiencia en olímpicos: ${i.cross.oly}; en gimnásticos: ${i.cross.gymnastics}${i.cross.avoid.length ? `; evita: ${i.cross.avoid.map((a) => AVOID_LABEL[a].toLowerCase()).join(", ")}` : ""}.`);
  return parts.join(" ");
}
