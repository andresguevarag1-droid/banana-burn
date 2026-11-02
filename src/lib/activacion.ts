// Activación del día (#200): registro > primer entreno en 72 h > tarjeta > pago. Reglas puras, sin base ni red.
// activacion-server.ts lee las filas y esto las cuenta; docs/metas/activacion.sql usa las mismas definiciones
// (lo verifica activacion.test.ts sobre las migraciones reales).
import { nfmt } from "@/lib/num";

export const ACTIVATION_HOURS = 72;
/** La cohorte que se mide es la que se registró hace 3 días: a esa ya le tocaron (casi) sus 72 h. */
export const COHORT_DAYS_AGO = 3;
/** Meta del plan de conversión (1 nov 2026): 30 % de los registrados termina su primer entreno en 72 h. */
export const ACTIVATION_GOAL_PCT = 30;

export type Activation = {
  /** Cuentas creadas en el día. */
  registros: number;
  /** Cuentas creadas hace 3 días y cuántas de ellas terminaron un entreno dentro de sus primeras 72 h. */
  cohorte: number;
  cohorteActivada: number;
  /** Personas distintas del día: abrieron un entreno, se salieron sin terminar ninguno, terminaron uno. */
  abiertos: number;
  abandonados: number;
  terminados: number;
  /** Tarjetas guardadas en el día (filas nuevas de trial_charges). */
  tarjetas: number;
  /** Personas cuyo primer pago cae en el día (cobro de la prueba o primera suscripción ONVO/Tilopay). */
  pagos: number;
};

export type ActivationRows = {
  signups: number;
  cohort: { id: string; created_at: string }[];
  /** Entrenos terminados de la cohorte (cualquier fecha). */
  cohortWorkouts: { user_id: string; finished_at: string | null }[];
  /** workout_open y workout_leave del día. */
  events: { user_id: string | null; name: string }[];
  /** Entrenos terminados en el día. */
  finished: { user_id: string }[];
  cards: number;
  /** Cobros de la prueba con status 'succeeded'. */
  trialPaid: { user_id: string; last_attempt_at: string | null; updated_at: string }[];
  /** Suscripciones ONVO/Tilopay creadas antes del fin del día. */
  subs: { user_id: string; created_at: string }[];
};

const ms = (iso: string) => new Date(iso).getTime();

/** Cuenta la activación de un día [start, end) de Costa Rica, observada en `now`. */
export function computeActivation(r: ActivationRows, range: { start: string; end: string }, now: Date): Activation {
  const start = ms(range.start), end = ms(range.end), seen = now.getTime();
  const inDay = (iso: string | null) => iso != null && ms(iso) >= start && ms(iso) < end;

  const firstFinish = new Map<string, number>();
  for (const w of r.cohortWorkouts) {
    if (!w.finished_at || ms(w.finished_at) > seen) continue;
    const t = ms(w.finished_at), prev = firstFinish.get(w.user_id);
    if (prev === undefined || t < prev) firstFinish.set(w.user_id, t);
  }
  const cohorteActivada = r.cohort.filter((p) => {
    const t = firstFinish.get(p.id);
    return t !== undefined && t >= ms(p.created_at) && t <= ms(p.created_at) + ACTIVATION_HOURS * 3600_000;
  }).length;

  const people = (name: string) => new Set(r.events.filter((e) => e.name === name && e.user_id).map((e) => e.user_id!));
  const done = new Set(r.finished.map((w) => w.user_id));
  const left = [...people("workout_leave")].filter((id) => !done.has(id));

  // Fecha del primer pago, como en rentabilidad-semanal.sql: el cobro de la prueba si lo hubo; si no, la primera suscripción.
  const charged = new Set(r.trialPaid.map((t) => t.user_id));
  const paidToday = new Set(r.trialPaid.filter((t) => inDay(t.last_attempt_at ?? t.updated_at)).map((t) => t.user_id));
  const firstSub = new Map<string, number>();
  for (const s of r.subs) firstSub.set(s.user_id, Math.min(firstSub.get(s.user_id) ?? Infinity, ms(s.created_at)));
  for (const [id, t] of firstSub) if (!charged.has(id) && t >= start && t < end) paidToday.add(id);

  return {
    registros: r.signups,
    cohorte: r.cohort.length,
    cohorteActivada,
    abiertos: people("workout_open").size,
    abandonados: left.length,
    terminados: done.size,
    tarjetas: r.cards,
    pagos: paidToday.size,
  };
}

/** % de la cohorte que terminó su primer entreno en 72 h; null sin cohorte. Redondeado a entero. */
export const activationPct = (a: Pick<Activation, "cohorte" | "cohorteActivada">): number | null =>
  a.cohorte ? Math.round((100 * a.cohorteActivada) / a.cohorte) : null;

/** Línea para el resumen diario del dueño. */
export function activationText(a: Activation): string {
  const pct = activationPct(a);
  const first = pct === null
    ? "primer entreno en 72 h: sin registros hace 3 días"
    : `primer entreno en 72 h: ${pct} % (${nfmt(a.cohorteActivada)} de ${nfmt(a.cohorte)}, meta ${ACTIVATION_GOAL_PCT} %)`;
  const n = (x: number, one: string, many: string) => `${nfmt(x)} ${x === 1 ? one : many}`;
  return `${first}; entrenos: ${n(a.abiertos, "abierto", "abiertos")}, ${n(a.abandonados, "abandonado", "abandonados")}, ${n(a.terminados, "terminado", "terminados")}`;
}
