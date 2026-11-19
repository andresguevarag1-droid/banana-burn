// Rescate del paso de la tarjeta de la bienvenida (#325). Desde CARD_REQUIRED_FROM la prueba empieza al dejar la tarjeta en
// el último paso de la bienvenida; quien llega ahí y se va recibe hasta dos correos. Reglas puras (tarjeta-rescate.test.ts);
// el envío lo hace sendCardRescueEmails en notify-run.ts, dentro del cron de recordatorios.
//
// - T1 (tarjeta_rescate_1): de 1 h a 24 h después de ver el paso (primer card_ask_view "bienvenida") sin guardarla.
// - T2 (tarjeta_rescate_2): a las 7:00 de su hora local del primer día en que esa hora cae 24 h o más después de ver el paso
//   (la primera corrida desde esa hora; si las 7:00 caen en sus horas de silencio, al terminar el silencio ese día).
// - Las horas salen de la llamada de cada hora al cron (.github/workflows/recordatorios-cada-hora.yml), como el checkout
//   abandonado: este paso corre en cada corrida sin importar NOTIFY_CRON_MODE.
// - Solo cuentas creadas desde CARD_REQUIRED_FROM. Una vez por cuenta y por correo, máximo uno de los dos por día local.
// - Se corta al guardar la tarjeta (o tener un cobro de la prueba abierto, o un plan pagado). Con email_reminders y fuera de
//   las horas de silencio. Las direcciones suprimidas (0072) las descarta sendEmail.
// - El botón abre /bienvenida?e=<kind>: la bienvenida abre directo en el paso de la tarjeta y cuenta email_click.
//
// Embudo: tarjeta guardada (bienvenida). Se mide con card_saved where "bienvenida" cruzado con notification_log
// (kind tarjeta_rescate_1/2) y con email_click e=tarjeta_rescate_1/2.
import { cardRequiredFor, CARD_REQUIRED_FROM } from "./card-required";
import { cardOnFile, paidSince, type PaidSub } from "./checkout-abandonado";
import { inQuietHours, localClock } from "./notify";

export const RESCUE_KINDS = ["tarjeta_rescate_1", "tarjeta_rescate_2"] as const;
export type RescueKind = (typeof RESCUE_KINDS)[number];
export const isRescueKind = (x: unknown): x is RescueKind => (RESCUE_KINDS as readonly unknown[]).includes(x);

const HOUR = 36e5;
export const RESCUE_T1_AFTER_MS = HOUR;
export const RESCUE_T2_AFTER_MS = 24 * HOUR;
/** Hora local de T2. */
export const RESCUE_T2_HOUR = 7;
/** El cron solo lee los pasos vistos en estas últimas horas: T2 siempre cae antes de 48 h, más el margen del silencio. */
export const RESCUE_LOOKBACK_MS = 72 * HOUR;

/** El enlace del botón: directo al paso de la tarjeta, con el correo de origen para email_click. */
export const rescuePath = (kind: RescueKind) => `/bienvenida?e=${kind}`;

export type RescueInput = {
  now: Date;
  /** profiles.created_at */
  createdAt: string | null;
  /** Cuándo vio por primera vez el paso de la tarjeta de la bienvenida (card_ask_view "bienvenida"). */
  stepAt: string;
  subs: PaidSub[];
  chargeStatuses: string[];
  /** Tarjetas activas en payment_methods. */
  cards: number;
  emailReminders: boolean;
  timezone: string;
  quietStart: string | null;
  quietEnd: string | null;
  /** Lo ya reclamado en notification_log: qué correo y en qué día local. */
  sent: { kind: string; local_day: string }[];
  from?: string;
};

/** El instante de hoy (día local) a las 7:00 en punto. */
function sevenToday(now: Date, tz: string): number {
  const c = localClock(now, tz);
  return Math.floor(now.getTime() / 60_000) * 60_000 - ((c.hour - RESCUE_T2_HOUR) * 60 + c.minute) * 60_000;
}

/** El correo de rescate que toca en esta corrida, o null. */
export function cardRescueDue(i: RescueInput): RescueKind | null {
  if (!i.emailReminders || !cardRequiredFor(i.createdAt, i.from ?? CARD_REQUIRED_FROM)) return null;
  const step = Date.parse(i.stepAt);
  if (!Number.isFinite(step)) return null;
  const age = i.now.getTime() - step;
  if (age < RESCUE_T1_AFTER_MS || age >= RESCUE_LOOKBACK_MS) return null;
  if (cardOnFile(i.cards, i.chargeStatuses) || paidSince(i.subs, i.chargeStatuses, i.stepAt)) return null;
  const c = localClock(i.now, i.timezone);
  if (inQuietHours(c, i.quietStart, i.quietEnd)) return null;
  // Uno por día local entre los dos.
  if (i.sent.some((s) => isRescueKind(s.kind) && s.local_day === c.iso)) return null;
  const has = (k: RescueKind) => i.sent.some((s) => s.kind === k);
  if (has("tarjeta_rescate_2")) return null;
  if (age < RESCUE_T2_AFTER_MS) return has("tarjeta_rescate_1") ? null : "tarjeta_rescate_1";
  // T2: el primer día cuyas 7:00 locales caen 24 h o más después del paso. Antes de las 7:00 todavía no; después, solo ese día.
  if (c.hour < RESCUE_T2_HOUR) return null;
  const seven = sevenToday(i.now, i.timezone);
  if (seven - step < RESCUE_T2_AFTER_MS) return null;
  if (seven - step >= 2 * RESCUE_T2_AFTER_MS) return null;
  return "tarjeta_rescate_2";
}

/** Llave de idempotencia de Resend: una por cuenta y correo. */
export const rescueIdemKey = (userId: string, kind: RescueKind) => `${kind}/${userId}`;
