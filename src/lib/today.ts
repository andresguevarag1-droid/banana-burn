/** Fecha local de Costa Rica (UTC−6, sin horario de verano). */
export function crToday(now = new Date()) {
  const d = new Date(now.getTime() - 6 * 3600e3);
  const iso = d.toISOString().slice(0, 10);
  return { iso, dow: d.getUTCDay(), date: new Date(iso + "T12:00:00") };
}
export function mondayOf(iso: string) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export const fmtDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-CR", { day: "numeric", month: "short" });
