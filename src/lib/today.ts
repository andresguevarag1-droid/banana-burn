/** Zona horaria por defecto (la empresa opera desde Costa Rica) cuando el usuario aún no tiene una. */
export const DEFAULT_TZ = "America/Costa_Rica";

/** ¿Es un identificador IANA válido para Intl? */
export function validTz(tz: string | null | undefined): tz is string {
  if (!tz || tz.length > 64) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** Fecha local ("hoy") en la zona horaria dada. */
export function todayIn(tz: string = DEFAULT_TZ, now = new Date()) {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: validTz(tz) ? tz : DEFAULT_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const date = new Date(iso + "T12:00:00");
  return { iso, dow: date.getDay(), date };
}

/** "Hoy" del usuario (su zona horaria viaja en el Viewer/Athlete). */
export const todayFor = (x: { tz?: string } | null | undefined, now = new Date()) => todayIn(x?.tz ?? DEFAULT_TZ, now);

/** Fecha local de la operación (Costa Rica): reportes del panel y exportaciones. */
export const crToday = (now = new Date()) => todayIn(DEFAULT_TZ, now);
export function mondayOf(iso: string) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export const fmtDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-419", { day: "numeric", month: "short" });
