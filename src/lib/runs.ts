// Carreras con GPS (/app/correr, 0048). Puro: lo usan el navegador (en vivo) y el servidor (que recalcula todo y no
// confía en lo que manda el cliente). Sin dependencias.

export type GeoPoint = { t: number; lat: number; lng: number; acc: number };
/** Tramos: un tramo nuevo empieza en cada pausa o señal perdida; nunca se dibuja una recta entre tramos. */
export type Track = GeoPoint[][];

export const MAX_ACCURACY_M = 30;
export const MAX_SPEED_MS = 25 / 3.6;
/** Sin puntos por más de esto, se toma como pausa (túnel, pantalla bloqueada sin permiso). */
export const GAP_MS = 30_000;
export const PRIVACY_TRIM_M = 200;
export const MAX_POINTS = 6000;

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;
export function haversine(a: Pick<GeoPoint, "lat" | "lng">, b: Pick<GeoPoint, "lat" | "lng">): number {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const okPoint = (p: GeoPoint) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && Number.isFinite(p.t) && Number.isFinite(p.acc);

/** ¿Se acepta un punto nuevo después de `prev`? Fuera: precisión peor que 30 m o un salto a más de 25 km/h. */
export function acceptPoint(prev: GeoPoint | null, p: GeoPoint): boolean {
  if (!okPoint(p) || p.acc > MAX_ACCURACY_M) return false;
  if (!prev) return true;
  const dt = (p.t - prev.t) / 1000;
  if (dt <= 0) return false;
  return haversine(prev, p) / dt <= MAX_SPEED_MS;
}

/** Limpia un tramo: filtra y suaviza poco (media de 3 puntos), sin mover los extremos. */
export function cleanSegment(seg: GeoPoint[]): GeoPoint[] {
  const out: GeoPoint[] = [];
  for (const p of [...seg].sort((a, b) => a.t - b.t)) if (acceptPoint(out[out.length - 1] ?? null, p)) out.push(p);
  return out.map((p, i) => (i === 0 || i === out.length - 1 ? p : { ...p, lat: (out[i - 1].lat + p.lat + out[i + 1].lat) / 3, lng: (out[i - 1].lng + p.lng + out[i + 1].lng) / 3 }));
}

/** Corta un tramo donde falta señal por más de GAP_MS. */
export function splitGaps(seg: GeoPoint[]): GeoPoint[][] {
  const out: GeoPoint[][] = [];
  let cur: GeoPoint[] = [];
  for (const p of seg) {
    if (cur.length && p.t - cur[cur.length - 1].t > GAP_MS) { out.push(cur); cur = []; }
    cur.push(p);
  }
  if (cur.length) out.push(cur);
  return out;
}

export const segDistance = (seg: GeoPoint[]) => seg.reduce((d, p, i) => (i ? d + haversine(seg[i - 1], p) : 0), 0);
export const segMoving = (seg: GeoPoint[]) => (seg.length > 1 ? (seg[seg.length - 1].t - seg[0].t) / 1000 : 0);

export type Split = { km: number; seconds: number };
export type RunStats = { distanceM: number; movingS: number; paceSKm: number | null; splits: Split[] };

/** Distancia, tiempo en movimiento, ritmo promedio y parciales de 1 km (el último, parcial, va con su fracción). */
export function runStats(track: Track): RunStats {
  let dist = 0, moving = 0, nextKm = 1000, lastSplitAt = 0;
  const splits: Split[] = [];
  for (const seg of track) {
    for (let i = 1; i < seg.length; i++) {
      const d = haversine(seg[i - 1], seg[i]);
      const dt = (seg[i].t - seg[i - 1].t) / 1000;
      while (d > 0 && dist + d >= nextKm) {
        const f = (nextKm - dist) / d;
        const at = moving + dt * f;
        splits.push({ km: splits.length + 1, seconds: Math.round(at - lastSplitAt) });
        lastSplitAt = at;
        nextKm += 1000;
      }
      dist += d; moving += dt;
    }
  }
  const rest = dist - (nextKm - 1000);
  if (rest >= 100) splits.push({ km: Math.round((splits.length + rest / 1000) * 100) / 100, seconds: Math.round(moving - lastSplitAt) });
  return { distanceM: Math.round(dist), movingS: Math.round(moving), paceSKm: dist >= 50 ? Math.round(moving / (dist / 1000)) : null, splits };
}

/** Ritmo actual: últimos ~200 m o 30 s del tramo en curso. */
export function currentPace(seg: GeoPoint[]): number | null {
  if (seg.length < 2) return null;
  const end = seg[seg.length - 1];
  let d = 0, i = seg.length - 1;
  while (i > 0 && d < 200 && end.t - seg[i - 1].t <= 30_000) { d += haversine(seg[i - 1], seg[i]); i--; }
  const dt = (end.t - seg[i].t) / 1000;
  return d >= 20 && dt > 0 ? Math.round(dt / (d / 1000)) : null;
}

/** Privacidad: quita los primeros y últimos 200 m del recorrido (para no mostrar dónde vives) del mapa guardado. */
export function privacyTrim(track: Track, m = PRIVACY_TRIM_M): Track {
  const flat = track.flatMap((seg, si) => seg.map((p) => ({ p, si })));
  if (flat.length < 2) return [];
  const cum: number[] = [0];
  for (let i = 1; i < flat.length; i++) cum.push(cum[i - 1] + (flat[i].si === flat[i - 1].si ? haversine(flat[i - 1].p, flat[i].p) : 0));
  const total = cum[cum.length - 1];
  if (total <= 2 * m) return [];
  const keep = flat.filter((_, i) => cum[i] >= m && cum[i] <= total - m);
  const out: Track = [];
  let last = -1;
  for (const k of keep) { if (k.si !== last) { out.push([]); last = k.si; } out[out.length - 1].push(k.p); }
  return out.filter((s) => s.length > 1);
}

/** Reduce puntos para guardar (uno cada ~5 m como mínimo, tope MAX_POINTS). */
export function thin(track: Track, minM = 5, max = MAX_POINTS): Track {
  let out = track.map((seg) => seg.filter((p, i) => i === 0 || i === seg.length - 1 || haversine(seg[i - 1], p) >= minM));
  const n = out.reduce((a, s) => a + s.length, 0);
  if (n > max) { const step = Math.ceil(n / max); out = out.map((s) => s.filter((_, i) => i % step === 0 || i === s.length - 1)); }
  return out;
}

/** Del navegador al servidor: tramos de puntos, validados y recalculados. Devuelve null si no es plausible. */
export function processUpload(raw: unknown): { track: Track; stats: RunStats; startedAt: number; endedAt: number } | null {
  if (!Array.isArray(raw) || raw.length > 500) return null;
  let count = 0;
  const segs: Track = [];
  for (const s of raw) {
    if (!Array.isArray(s)) return null;
    const pts: GeoPoint[] = [];
    for (const x of s) {
      if (++count > 40_000) return null;
      const o = x as Record<string, unknown>;
      const p = { t: Number(o.t), lat: Number(o.lat), lng: Number(o.lng), acc: Number(o.acc) };
      if (okPoint(p)) pts.push(p);
    }
    for (const g of splitGaps(cleanSegment(pts))) if (g.length > 1) segs.push(g);
  }
  if (!segs.length) return null;
  const stats = runStats(segs);
  const startedAt = segs[0][0].t, endedAt = segs[segs.length - 1][segs[segs.length - 1].length - 1].t;
  if (stats.distanceM < 100 || stats.movingS < 30 || stats.distanceM > 200_000 || endedAt - startedAt > 24 * 3600_000) return null;
  if (stats.distanceM / stats.movingS > MAX_SPEED_MS) return null;
  return { track: thin(segs), stats, startedAt, endedAt };
}

export const fmtPace = (s: number | null) => (s == null || !Number.isFinite(s) || s <= 0 || s > 3600 ? "--:--" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
export function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
}
export const fmtKm = (m: number) => (m / 1000).toFixed(2);

/** Km por semana (lunes a domingo, fecha local `YYYY-MM-DD` de cada carrera). Las últimas `weeks` semanas hasta `today`. */
export function weeklyKm(runs: { day: string; distanceM: number }[], today: string, weeks = 8): { weekStart: string; km: number }[] {
  const t = (iso: string) => Date.parse(iso + "T12:00:00Z");
  const dow = (new Date(t(today)).getUTCDay() + 6) % 7;
  const monday = t(today) - dow * 864e5;
  return Array.from({ length: weeks }, (_, k) => {
    const start = monday - (weeks - 1 - k) * 7 * 864e5;
    const km = runs.filter((r) => t(r.day) >= start && t(r.day) < start + 7 * 864e5).reduce((a, r) => a + r.distanceM, 0) / 1000;
    return { weekStart: new Date(start).toISOString().slice(0, 10), km: Math.round(km * 10) / 10 };
  });
}

/** Una carrera larga fuera del plan (temporada de running): 60 min o más, o 12 km o más, en un día que no era de carrera larga. */
export const isLongRun = (r: { distanceM: number; movingS: number }) => r.movingS >= 3600 || r.distanceM >= 12_000;

/** Línea de carreras recientes para la coach (solo números, sin lugares). */
export function runsForCoach(runs: { day: string; distanceM: number; movingS: number; paceSKm: number | null }[]): string | null {
  if (!runs.length) return null;
  return "Carreras recientes con GPS: " + runs.slice(0, 5).map((r) => `${r.day}: ${fmtKm(r.distanceM)} km en ${fmtDuration(r.movingS)} (ritmo ${fmtPace(r.paceSKm)}/km)`).join("; ") + ".";
}

/**
 * Temporada de running: una carrera larga fuera de plan (ayer u hoy, en un día que no era el de la carrera larga)
 * mueve la siguiente sesión pesada de piernas (fuerza o potencia) 1 día: hoy toca recuperación o descanso.
 * `days` son los días de la semana del plan (0 = lunes) con su sesión.
 */
export function longRunShift(
  days: { dow: number; session: string | null }[], runs: { day: string; distanceM: number; movingS: number }[], today: string, longRunDow: number | null,
): { run: { day: string; distanceM: number }; moved: string; to: number } | null {
  const t = Date.parse(today + "T12:00:00Z");
  const dowOf = (iso: string) => (new Date(Date.parse(iso + "T12:00:00Z")).getUTCDay() + 6) % 7;
  const recent = runs.find((r) => { const d = (t - Date.parse(r.day + "T12:00:00Z")) / 864e5; return d >= 0 && d <= 1 && isLongRun(r) && dowOf(r.day) !== longRunDow; });
  if (!recent) return null;
  const todayDow = dowOf(today);
  const heavy = days.find((d) => (d.dow === todayDow || d.dow === (todayDow + 1) % 7) && (d.session === "fuerza" || d.session === "potencia"));
  if (!heavy) return null;
  return { run: recent, moved: heavy.session!, to: (heavy.dow + 1) % 7 };
}
