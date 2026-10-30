// Render del Reel R04 en código: dibuja cada cuadro con @napi-rs/canvas y lo codifica con ffmpeg (H.264, 30 fps, sin audio).
// Uso: npm install && npm run render  (o: node render.mjs reel | anuncio | portada | hoja)
// Todo sale en la carpeta de arriba (marketing/videos/R04_temporada-1/).
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FPS, REEL, ANUNCIO, PRECIOS, linea, palabras } from "./escenas.mjs";

const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts, loadImage } = require("@napi-rs/canvas");

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(AQUI, "..");
const REPO = join(AQUI, "../../../..");

const W = 1080, H = 1920;
/** Zona segura de Reels: nada de texto en los 250 px de arriba ni en los 350 px de abajo. */
const SEGURA = { arriba: 250, abajo: H - 350 };

// Tokens de src/app/globals.css.
const C = {
  banana: "#FFD60A", bananaSoft: "#FFF1A8", ink: "#1B1505", body: "#2E2818", paper: "#FFF8E3", cream: "#FFFBF0",
  card: "#FFFFFF", line: "#EDE3C6", bananaInk: "#8A6200", emberInk: "#8A5300", white: "#FFFFFF",
};

GlobalFonts.registerFromPath(join(REPO, "src/app/og/jakarta-800.woff"), "Jakarta800");
GlobalFonts.registerFromPath(join(REPO, "src/app/og/jakarta-600.woff"), "Jakarta600");
const font = (peso, px) => `${peso} ${px}px ${peso >= 700 ? "Jakarta800" : "Jakarta600"}`;

// Capturas reales de la app (las mismas de la landing) y personaje. Sin retoques: solo se recortan y se acercan.
const img = async (ruta) => loadImage(readFileSync(join(REPO, ruta)));
/** Pose "señala" de Coach Banana: si alguien deja el PNG aquí, el cierre la usa; si no, va la pose de pie de la marca. */
const POSE_SENALA = join(AQUI, "../assets/coach-banana-senala.png");
const A = {
  temporadas: await img("public/landing/temporadas.webp"),
  running: await img("public/landing/running-hub.webp"),
  coach: existsSync(POSE_SENALA) ? await loadImage(readFileSync(POSE_SENALA)) : await img("public/brand/mascota-sola.webp"),
  coachSenala: existsSync(POSE_SENALA),
  logo: await img("public/icons/logo.svg"),
};

// Movimiento de la marca: ease-out cubic-bezier(0.23, 1, 0.32, 1); entrada 300 ms; nada aparece desde scale(0).
function bezier(x1, y1, x2, y2) {
  const f = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 30; i++) { t = (lo + hi) / 2; if (f(x1, x2, t) < x) lo = t; else hi = t; }
    return f(y1, y2, t);
  };
}
const easeOut = bezier(0.23, 1, 0.32, 1);
const easeInOut = bezier(0.77, 0, 0.175, 1);
const ENTRA = 0.3;
const prog = (t, desde, dura) => easeOut((t - desde) / dura);
const mix = (a, b, k) => a + (b - a) * k;

/** Dibuja `fn` con la entrada de la marca: sube 48 px y aparece en 300 ms desde `desde`. */
function entra(ctx, t, desde, fn) {
  const k = prog(t, desde, ENTRA);
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha *= k;
  ctx.translate(0, (1 - k) * 48);
  fn();
  ctx.restore();
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Texto que la escena declaró en escenas.mjs; si no está, el render falla (así el conteo de palabras es fiel). */
function dice(escena, s) {
  if (!escena.texto.includes(s)) throw new Error(`"${s}" no está en el texto declarado de la escena ${escena.id}`);
  return s;
}

/** Escribe una línea; si no cabe en `max`, baja el tamaño. Devuelve el ancho final. */
function linea1(ctx, s, x, y, { peso = 800, px, color, max = W - 180, align = "left", track = 0 }) {
  let size = px;
  ctx.font = font(peso, size);
  ctx.letterSpacing = `${track * size}px`;
  while (ctx.measureText(s).width > max && size > 20) { size -= 2; ctx.font = font(peso, size); ctx.letterSpacing = `${track * size}px`; }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
  const w = ctx.measureText(s).width;
  ctx.letterSpacing = "0px";
  return w;
}

function fondo(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
}

function calendario(ctx, cx, cy, s, color, grosor) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = grosor;
  ctx.lineCap = "round";
  rrect(ctx, cx - s / 2, cy - s * 0.38, s, s * 0.86, s * 0.16);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - s / 2, cy - s * 0.08); ctx.lineTo(cx + s / 2, cy - s * 0.08);
  for (const dx of [-0.24, 0.24]) { ctx.moveTo(cx + dx * s, cy - s * 0.52); ctx.lineTo(cx + dx * s, cy - s * 0.26); }
  ctx.moveTo(cx - s * 0.16, cy + s * 0.2); ctx.lineTo(cx - s * 0.03, cy + s * 0.32); ctx.lineTo(cx + s * 0.2, cy + s * 0.08);
  ctx.stroke();
  ctx.restore();
}

// ── Escenas ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Gancho: completo desde el cuadro 0 (sin entrada), solo un acercamiento lento. */
function gancho(ctx, e, t) {
  fondo(ctx, C.banana);
  const z = 1 + 0.03 * Math.min(1, t / (e.fin - e.inicio));
  ctx.save();
  ctx.translate(W / 2, 960); ctx.scale(z, z); ctx.translate(-W / 2, -960);
  calendario(ctx, 162, 560, 140, C.ink, 14);
  linea1(ctx, dice(e, "La Temporada 1"), 90, 820, { px: 132, color: C.ink, track: -0.03 });
  linea1(ctx, dice(e, "empieza el"), 90, 970, { px: 132, color: C.ink, track: -0.03 });
  rrect(ctx, 70, 1040, 940, 200, 40);
  ctx.fillStyle = C.ink; ctx.fill();
  linea1(ctx, dice(e, "9 de noviembre"), W / 2, 1185, { px: 128, color: C.banana, align: "center", max: 880, track: -0.03 });
  ctx.restore();
}

// Teléfono: marco ink de radio 42 con la captura real adentro.
const TEL = { x: 230, y: 540, w: 620, h: 1010, borde: 16 };
const ESCALA_CAPTURA = (TEL.w - TEL.borde * 2) / 780;
/** Desde qué altura de la captura (px de la imagen original) se ve cada vista. */
const VISTA = {
  temporadas: { arriba: [0, 50], fecha: [0, 0] },
  running: { arriba: [210, 300] },
};
/** La línea "Temporada 1: del 9 de noviembre al 3 de enero" en la captura original. */
const LINEA_FECHA = { x: 26, y: 640, w: 706, h: 58 };

function telefono(ctx, captura, desdeY) {
  const { x, y, w, h, borde } = TEL;
  ctx.save();
  ctx.shadowColor = "rgba(27,21,5,0.18)"; ctx.shadowBlur = 48; ctx.shadowOffsetY = 24;
  rrect(ctx, x, y, w, h, 42); ctx.fillStyle = C.ink; ctx.fill();
  ctx.restore();
  ctx.save();
  rrect(ctx, x + borde, y + borde, w - borde * 2, h - borde * 2, 30);
  ctx.clip();
  ctx.fillStyle = C.cream; ctx.fillRect(x, y, w, h);
  const visible = (h - borde * 2) / ESCALA_CAPTURA;
  ctx.drawImage(A[captura], 0, desdeY, 780, visible, x + borde, y + borde, w - borde * 2, visible * ESCALA_CAPTURA);
  ctx.restore();
}

function leyenda(ctx, e, k = 1) {
  // Franja de fondo para que la leyenda se lea aunque el teléfono acercado pase por detrás.
  ctx.save();
  ctx.globalAlpha = k;
  const g = ctx.createLinearGradient(0, 0, 0, 560);
  g.addColorStop(0, C.paper); g.addColorStop(0.82, C.paper); g.addColorStop(1, "rgba(255,248,227,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 560);
  ctx.restore();
  const partes = dice(e, e.texto).split(" ");
  // Dos líneas parejas, en Jakarta 800.
  let mejor = null;
  for (let i = 1; i < partes.length; i++) {
    const a = partes.slice(0, i).join(" "), b = partes.slice(i).join(" ");
    ctx.font = font(800, 84);
    const d = Math.abs(ctx.measureText(a).width - ctx.measureText(b).width);
    if (!mejor || d < mejor.d) mejor = { a, b, d };
  }
  linea1(ctx, mejor.a, W / 2, 360, { px: 84, color: C.ink, align: "center", max: 920, track: -0.02 });
  linea1(ctx, mejor.b, W / 2, 460, { px: 84, color: C.ink, align: "center", max: 920, track: -0.02 });
}

function escenaTelefono(ctx, e, t, anterior) {
  fondo(ctx, C.paper);
  const dura = e.fin - e.inicio;
  const [y0, y1] = VISTA[e.captura][e.vista];
  if (e.vista === "fecha") {
    // Viene de la vista de arriba de la misma captura: el teléfono no vuelve a entrar, se acerca a la fecha.
    const k = easeInOut(Math.min(1, t / 0.5));
    const z = mix(1, 1.62, k);
    const fy = TEL.y + TEL.borde + (LINEA_FECHA.y + LINEA_FECHA.h / 2) * ESCALA_CAPTURA;
    const destino = 1030;
    ctx.save();
    // El acercamiento queda dentro de la zona segura: se recorta a una tarjeta de 520 a 1540 px.
    rrect(ctx, mix(TEL.x, 40, k), 520, mix(TEL.w, W - 80, k), 1020, 42);
    ctx.clip();
    const cx = TEL.x + TEL.w / 2;
    ctx.translate(cx, mix(fy, destino, k));
    ctx.scale(z, z);
    ctx.translate(-cx, -fy);
    telefono(ctx, e.captura, mix(VISTA.temporadas.arriba[1], y0, k));
    // Marco banana alrededor del dato, sin tocar la captura.
    const kk = prog(t, 0.5, ENTRA);
    if (kk > 0) {
      ctx.save();
      ctx.globalAlpha = kk;
      ctx.strokeStyle = C.banana; ctx.lineWidth = 5 / z * 1.6;
      const lx = TEL.x + TEL.borde + LINEA_FECHA.x * ESCALA_CAPTURA - 8, ly = fy - LINEA_FECHA.h * ESCALA_CAPTURA / 2 - 8;
      rrect(ctx, lx, ly, LINEA_FECHA.w * ESCALA_CAPTURA + 16, LINEA_FECHA.h * ESCALA_CAPTURA + 16, 14);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    entra(ctx, t, 0, () => leyenda(ctx, e));
    return;
  }
  const pan = mix(y0, y1, Math.min(1, t / dura));
  const continua = anterior?.tipo === "telefono";
  const k = prog(t, 0, ENTRA);
  ctx.save();
  // Entra desde abajo (120 px) para que el cambio de pantalla se note.
  ctx.globalAlpha = continua ? 1 : k;
  ctx.translate(0, (1 - k) * 120);
  telefono(ctx, e.captura, pan);
  ctx.restore();
  entra(ctx, t, 0.08, () => leyenda(ctx, e));
}

function precios(ctx, e, t) {
  fondo(ctx, C.paper);
  linea1(ctx, dice(e, "Precios").toUpperCase(), W / 2, 560, { peso: 700, px: 44, color: C.bananaInk, align: "center", track: 0.14 });
  const alto = 250, gap = 40, y0 = 630;
  PRECIOS.slice(0, e.filas).forEach((p, i) => {
    const actual = i === e.filas - 1;
    const pinta = () => {
      const y = y0 + i * (alto + gap);
      ctx.save();
      if (actual) { ctx.shadowColor = "rgba(27,21,5,0.35)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; }
      rrect(ctx, 90, y, 900, alto, 48);
      ctx.fillStyle = actual ? C.ink : C.card; ctx.fill();
      ctx.restore();
      if (!actual) { rrect(ctx, 90, y, 900, alto, 48); ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.stroke(); }
      const ancho = linea1(ctx, dice(e, p.precio), 940, y + alto / 2 + 40, { px: 116, color: actual ? C.banana : C.ink, align: "right", max: 470, track: -0.02 });
      linea1(ctx, dice(e, p.deporte), 140, y + alto / 2 + 22, { px: 64, color: actual ? C.cream : C.ink, max: 900 - 120 - ancho, track: -0.02 });
    };
    if (actual) entra(ctx, t, 0, pinta); else pinta();
  });
}

function inscripciones(ctx, e, t) {
  fondo(ctx, C.ink);
  entra(ctx, t, 0, () => calendario(ctx, W / 2, 560, 230, C.banana, 18));
  entra(ctx, t, 0.08, () => {
    linea1(ctx, dice(e, "Inscripciones"), W / 2, 860, { px: 104, color: C.cream, align: "center", track: -0.02 });
    linea1(ctx, dice(e, "hasta el"), W / 2, 990, { px: 104, color: C.cream, align: "center", track: -0.02 });
  });
  entra(ctx, t, 0.2, () => linea1(ctx, dice(e, "22 nov"), W / 2, 1270, { px: 250, color: C.banana, align: "center", track: -0.03 }));
}

function anual(ctx, e, t) {
  fondo(ctx, C.banana);
  entra(ctx, t, 0, () => {
    linea1(ctx, dice(e, "El plan anual"), 90, 700, { px: 120, color: C.ink, track: -0.03 });
    linea1(ctx, dice(e, "incluye"), 90, 840, { px: 120, color: C.ink, track: -0.03 });
  });
  entra(ctx, t, 0.15, () => {
    rrect(ctx, 70, 920, 940, 420, 48); ctx.fillStyle = C.ink; ctx.fill();
    linea1(ctx, dice(e, "1 temporada"), W / 2, 1100, { px: 132, color: C.banana, align: "center", max: 860, track: -0.03 });
    linea1(ctx, dice(e, "gratis"), W / 2, 1250, { px: 132, color: C.banana, align: "center", max: 860, track: -0.03 });
  });
}

/** Cierre de 3 s: Coach Banana, botón ink "Empieza 7 días gratis en bananaburn.app" y logo. */
function cierre(ctx, e, t) {
  fondo(ctx, C.paper);
  const lado = 720;
  entra(ctx, t, 0, () => ctx.drawImage(A.coach, (W - lado) / 2, 290, lado, lado));
  // Botón: entra a los 0.4 s y cede a scale(.97) a los 1.6 s, como al presionarlo.
  entra(ctx, t, 0.4, () => {
    const p = t - 1.6;
    const s = p > 0 && p < 0.28 ? 1 - 0.03 * Math.sin((p / 0.28) * Math.PI) : 1;
    ctx.save();
    ctx.translate(W / 2, 1125); ctx.scale(s, s); ctx.translate(-W / 2, -1125);
    ctx.save();
    ctx.shadowColor = "rgba(27,21,5,0.35)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
    rrect(ctx, 60, 1060, 960, 130, 999); ctx.fillStyle = C.ink; ctx.fill();
    ctx.restore();
    linea1(ctx, dice(e, "Empieza 7 días gratis en bananaburn.app"), W / 2, 1141, { peso: 600, px: 46, color: C.white, align: "center", max: 880 });
    ctx.restore();
  });
  entra(ctx, t, 0.9, () => {
    const icono = 120, nombre = dice(e, "BananaBurn");
    ctx.font = font(800, 84);
    const wb = ctx.measureText("Banana").width, wt = wb + ctx.measureText("Burn").width;
    const x0 = (W - (icono + 28 + wt)) / 2;
    ctx.drawImage(A.logo, x0, 1300, icono, icono);
    linea1(ctx, nombre.slice(0, 6), x0 + icono + 28, 1390, { px: 84, color: C.ink });
    linea1(ctx, nombre.slice(6), x0 + icono + 28 + wb, 1390, { px: 84, color: C.emberInk });
  });
}

const DIBUJA = { gancho, telefono: escenaTelefono, precios, inscripciones, anual, cierre };

// ── Render ─────────────────────────────────────────────────────────────────────────────────────────────────────

function revisa(version) {
  const escenas = linea(version);
  for (const e of escenas) {
    const n = palabras(e.texto), d = e.fin - e.inicio;
    if (n > 8) throw new Error(`${e.id}: ${n} palabras (máximo 8)`);
    if (e.tipo === "cierre" ? d !== 3 : d < 1.5 || d > 2.5) throw new Error(`${e.id}: dura ${d} s`);
  }
  return escenas;
}

function cuadro(escenas, i) {
  const t = i / FPS;
  const n = escenas.findLastIndex((e) => t >= e.inicio);
  const e = escenas[n];
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  DIBUJA[e.tipo](ctx, e, t - e.inicio, escenas[n - 1]);
  return canvas;
}

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return require("@ffmpeg-installer/ffmpeg").path; } catch { return "ffmpeg"; }
}

async function video(version) {
  const escenas = revisa(version);
  const total = Math.round(version.duracion * FPS);
  const out = join(SALIDA, version.archivo);
  const ff = spawn(ffmpegPath(), [
    "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-",
    "-an", "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow",
    "-r", String(FPS), "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const fin = new Promise((ok, mal) => ff.on("close", (c) => (c === 0 ? ok() : mal(new Error(`ffmpeg salió con ${c}`)))));
  for (let i = 0; i < total; i++) {
    const data = cuadro(escenas, i).getContext("2d").getImageData(0, 0, W, H).data;
    if (!ff.stdin.write(Buffer.from(data.buffer))) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await fin;
  console.log(`${version.archivo}: ${total} cuadros, ${version.duracion} s`);
}

/** Portada 1080x1920: el gancho tal como se ve en el cuadro 0. */
function portada() {
  writeFileSync(join(SALIDA, "R04_temporada-1_portada.png"), cuadro(revisa(REEL), 0).toBuffer("image/png"));
  console.log("R04_temporada-1_portada.png");
}

/** Hoja de revisión: un cuadro de cada escena del Reel con la zona segura y el recorte 1080x1350 de la portada marcados. */
function hoja() {
  const escenas = revisa(REEL);
  const s = 0.25, cw = W * s, ch = H * s, cols = 5, pad = 24, rot = 44;
  const filas = Math.ceil(escenas.length / cols);
  const c = createCanvas(cols * (cw + pad) + pad, filas * (ch + pad + rot) + pad);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, c.width, c.height);
  escenas.forEach((e, j) => {
    const i = e.id === "gancho" ? 0 : Math.round((e.inicio + Math.min(1.2, (e.fin - e.inicio) - 0.2)) * FPS);
    const x = pad + (j % cols) * (cw + pad), y = pad + Math.floor(j / cols) * (ch + pad + rot) + rot;
    ctx.drawImage(cuadro(escenas, i), x, y, cw, ch);
    ctx.strokeStyle = "rgba(198,42,47,0.9)"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y + SEGURA.arriba * s, cw, (SEGURA.abajo - SEGURA.arriba) * s);
    if (e.id === "gancho") { ctx.strokeStyle = "rgba(63,107,14,0.9)"; ctx.strokeRect(x, y + 285 * s, cw, 1350 * s); }
    ctx.setLineDash([]);
    ctx.fillStyle = C.ink; ctx.font = font(600, 18); ctx.textAlign = "left";
    ctx.fillText(`${e.inicio.toFixed(1)}-${e.fin.toFixed(1)} s  ${e.id}  (${palabras(e.texto)} pal.)`, x, y - 14);
  });
  writeFileSync(join(SALIDA, "R04_temporada-1_hoja-revision.png"), c.toBuffer("image/png"));
  console.log("R04_temporada-1_hoja-revision.png");
}

const que = process.argv[2] ?? "todo";
if (!A.coachSenala) console.warn("Aviso: falta assets/coach-banana-senala.png; el cierre usa la pose de pie de public/brand/mascota-sola.webp.");
if (que === "reel" || que === "todo") await video(REEL);
if (que === "anuncio" || que === "todo") await video(ANUNCIO);
if (que === "portada" || que === "todo") portada();
if (que === "hoja" || que === "todo") hoja();
