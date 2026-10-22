"use client";
// Tarjeta para historias (1080×1920) dibujada en el teléfono con canvas: sin servidor, funciona sin conexión.

export type StoryData = {
  title: string; date: Date; time: string; sets: string; volume: string; xp: string;
  streak: number; level: string; prs: string[]; bananas: { got: number; total: number };
};

const INK = "#1B1505", BANANA = "#FFD60A", EMBER = "#FF5A1F", PAPER = "#FFF8E3";
const FONT = '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
// Mismas formas que los íconos de marca (retícula 256)
const P_BANANA = "M196 64c24 62 6 128-48 156-34 18-78 18-112 0 40-4 78-20 102-50 24-30 32-68 26-104z";
const P_STEM = "M166 66l10-30h18l2 28";
const P_FLAME = "M128 232c-48 0-80-32-80-76 0-56 56-80 56-136 32 18 64 54 64 92 10-8 18-22 20-36 18 20 20 44 20 80 0 44-32 76-80 76z";
const P_FLAME_IN = "M156 132c10 34-4 62-40 72 10 8 30 8 42 0 18-14 22-44-2-72z";

function icon(c: CanvasRenderingContext2D, x: number, y: number, size: number, draw: (c: CanvasRenderingContext2D) => void) {
  c.save(); c.translate(x, y); c.scale(size / 256, size / 256); c.lineCap = "round"; c.lineJoin = "round"; draw(c); c.restore();
}
const banana = (fill: string, stroke: string) => (c: CanvasRenderingContext2D) => {
  const b = new Path2D(P_BANANA);
  c.fillStyle = fill; c.fill(b); c.strokeStyle = stroke; c.lineWidth = 16; c.stroke(b); c.stroke(new Path2D(P_STEM));
};
const flame = (c: CanvasRenderingContext2D) => {
  const f = new Path2D(P_FLAME);
  c.fillStyle = EMBER; c.fill(f); c.strokeStyle = INK; c.lineWidth = 16; c.stroke(f);
  c.fillStyle = INK; c.fill(new Path2D(P_FLAME_IN));
};

function round(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function wrap(c: CanvasRenderingContext2D, text: string, max: number, lines: number) {
  const words = text.split(/\s+/), out: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (c.measureText(t).width <= max || !cur) cur = t; else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  if (out.length > lines) { out.length = lines; let l = out[lines - 1]; while (l && c.measureText(`${l}…`).width > max) l = l.slice(0, -1); out[lines - 1] = `${l.trimEnd()}…`; }
  return out;
}
/** Ajusta el tamaño de letra para que una sola línea quepa en `max`. */
function fit(c: CanvasRenderingContext2D, text: string, weight: number, size: number, max: number) {
  let s = size;
  c.font = `${weight} ${s}px ${FONT}`;
  while (c.measureText(text).width > max && s > 28) { s -= 4; c.font = `${weight} ${s}px ${FONT}`; }
  return s;
}

export async function drawStory(d: StoryData): Promise<Blob> {
  const W = 1080, H = 1920, M = 88;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  if (!c) throw new Error("canvas");
  try { await Promise.all([800, 700].map((w) => document.fonts.load(`${w} 64px "Plus Jakarta Sans Variable"`))); } catch { /* usa la fuente del sistema */ }
  c.textBaseline = "alphabetic";

  // Fondo banana con una banana gigante recortada, en tinta muy suave
  c.fillStyle = BANANA; c.fillRect(0, 0, W, H);
  c.save(); c.globalAlpha = 0.09; icon(c, 380, -120, 1000, banana(INK, INK)); c.restore();

  // Marca
  round(c, M, 96, 112, 112, 32); c.fillStyle = INK; c.fill();
  icon(c, M + 14, 110, 84, banana(BANANA, BANANA));
  c.fillStyle = INK; c.font = `800 52px ${FONT}`; c.fillText("Banana Burn", M + 140, 172);

  // Fecha y título (el título se achica si es largo para que el resto quepa siempre)
  const date = d.date.toLocaleDateString("es-419", { weekday: "long", day: "numeric", month: "long" });
  c.font = `700 40px ${FONT}`; c.fillStyle = "rgba(27,21,5,.72)";
  c.fillText(date[0].toUpperCase() + date.slice(1), M, 330);
  c.font = `800 44px ${FONT}`; c.fillStyle = INK; c.fillText("Entreno completado", M, 396);
  let ts = 128, lines: string[] = [];
  for (; ts >= 88; ts -= 8) { c.font = `800 ${ts}px ${FONT}`; lines = wrap(c, d.title, W - M * 2, 2); if (!lines.at(-1)?.endsWith("…")) break; }
  const lh = Math.round(ts * 1.06);
  lines.forEach((l, i) => c.fillText(l, M, 396 + 40 + ts * 0.9 + i * lh));
  let y = 396 + 40 + ts * 0.9 + (lines.length - 1) * lh + 72;

  // Panel de estadísticas
  const top = y, ph = 520;
  round(c, M - 8, top, W - (M - 8) * 2, ph, 64); c.fillStyle = INK; c.fill();
  const stats: [string, string][] = [[d.time, "Tiempo"], [d.sets, "Series"], [d.volume, "Volumen"], [d.xp, "XP ganados"]];
  const cw = (W - M * 2) / 2;
  stats.forEach(([v, l], i) => {
    const x = M + 56 + (i % 2) * cw, sy = top + 170 + Math.floor(i / 2) * 250;
    const s = fit(c, v, 800, 112, cw - 90);
    c.fillStyle = i === 3 ? BANANA : "#FFFFFF"; c.font = `800 ${s}px ${FONT}`; c.fillText(v, x, sy);
    c.fillStyle = "rgba(255,255,255,.62)"; c.font = `700 36px ${FONT}`; c.fillText(l, x, sy + 58);
  });
  c.fillStyle = "rgba(255,255,255,.14)"; c.fillRect(W / 2, top + 64, 2, ph - 128); c.fillRect(M + 40, top + ph / 2, W - M * 2 - 80, 2);
  y = top + ph + 64;

  // Racha
  icon(c, M, y, 96, flame);
  c.fillStyle = INK; c.font = `800 60px ${FONT}`;
  c.fillText(d.streak === 1 ? "1 día de racha" : `${d.streak} días de racha`, M + 120, y + 72);
  y += 140;

  // Bananas del día, con el texto al lado
  const bw = 76, gap = 14, n = Math.min(d.bananas.total, 8);
  for (let i = 0; i < n; i++) {
    const got = i < d.bananas.got;
    c.save(); if (!got) c.globalAlpha = 0.28; icon(c, M + i * (bw + gap), y, bw, banana(got ? PAPER : BANANA, INK)); c.restore();
  }
  c.font = `700 36px ${FONT}`; c.fillStyle = "rgba(27,21,5,.78)";
  const bl = `${d.bananas.got} de ${d.bananas.total} ejercicios`;
  const bx = M + n * (bw + gap) + 16;
  if (bx + c.measureText(bl).width < W - M) c.fillText(bl, bx, y + 52); else c.fillText(bl, M, y + bw + 48);
  y += bw + (bx + c.measureText(bl).width < W - M ? 48 : 96);

  // Récords
  if (d.prs.length && y + 96 < H - 190) {
    const t = d.prs.length === 1 ? `Récord personal en ${d.prs[0]}` : `${d.prs.length} récords personales`;
    c.font = `800 42px ${FONT}`;
    const tw = Math.min(W - M * 2, c.measureText(t).width + 80);
    round(c, M, y, tw, 92, 46); c.fillStyle = PAPER; c.fill();
    c.fillStyle = INK; c.fillText(wrap(c, t, tw - 80, 1)[0], M + 40, y + 60);
  }

  // Pie
  c.fillStyle = "rgba(27,21,5,.14)"; c.fillRect(M, H - 172, W - M * 2, 2);
  c.fillStyle = INK; c.font = `800 38px ${FONT}`;
  c.fillText(d.level, M, H - 104);
  c.fillStyle = "rgba(27,21,5,.72)"; c.font = `700 32px ${FONT}`;
  c.fillText("Entreno guiado por Banana Burn", M, H - 56);

  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
}

/** Comparte con la hoja nativa si se puede enviar archivos; si no, descarga el PNG. */
export async function shareStory(blob: Blob, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], "banana-burn-entreno.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title, text: `${title} en Banana Burn` }); return "shared"; }
    catch (e) { if ((e as DOMException)?.name === "AbortError") return "cancelled"; }
  }
  downloadBlob(blob);
  return "downloaded";
}
export function downloadBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "banana-burn-entreno.png";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
