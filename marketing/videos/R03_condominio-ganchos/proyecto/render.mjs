// Render de R03a, R03b y R03c en código: dibuja cada cuadro con @napi-rs/canvas y lo codifica con ffmpeg (H.264, 30 fps).
// Uso: npm install && npm run render  (o: node render.mjs videos | portadas | hoja)
// El cuerpo común (s 3 a 15) y la pista de audio se codifican UNA vez y se pegan sin recodificar detrás de cada gancho,
// así las 3 versiones solo cambian en los primeros 3 s. Todo sale en la carpeta de arriba (R03_condominio-ganchos/).
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FPS, DURACION, CORTE, CUERPO, VERSIONES, linea, palabras } from "./escenas.mjs";
import { pista } from "./audio.mjs";

const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts, loadImage } = require("@napi-rs/canvas");

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(AQUI, "..");
const TMP = join(AQUI, ".tmp");
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
  hoy: await img("public/landing/hoy2.png"),
  entreno: await img("public/landing/entreno.png"),
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

/** Acercamiento lento (3 % en toda la escena) alrededor de y = `cy`. */
function empuja(ctx, e, t, cy, fn) {
  const z = 1 + 0.03 * Math.min(1, t / (e.fin - e.inicio));
  ctx.save();
  ctx.translate(W / 2, cy); ctx.scale(z, z); ctx.translate(-W / 2, -cy);
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

/** Bloque ink con texto banana, como el resaltado de los carruseles. */
function bloque(ctx, e, s, y, alto, px) {
  rrect(ctx, 70, y, 940, alto, 48);
  ctx.fillStyle = C.ink; ctx.fill();
  linea1(ctx, dice(e, s), W / 2, y + alto / 2 + px * 0.36, { px, color: C.banana, align: "center", max: 860, track: -0.03 });
}

function mancuerna(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.fillStyle = color;
  rrect(ctx, cx - s * 0.5, cy - s * 0.045, s, s * 0.09, s * 0.045); ctx.fill();
  for (const lado of [-1, 1]) {
    rrect(ctx, cx + lado * s * 0.3 - s * 0.06, cy - s * 0.24, s * 0.12, s * 0.48, s * 0.04); ctx.fill();
    rrect(ctx, cx + lado * s * 0.42 - s * 0.05, cy - s * 0.16, s * 0.1, s * 0.32, s * 0.04); ctx.fill();
  }
  ctx.restore();
}

/** El gym del edificio en línea: ventana con plantas, rack de mancuernas y banca. Caja de 800 x 520, sin personas. */
function gym(ctx, x, y, s, color, acento) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.lineJoin = "round";
  // Ventana.
  ctx.save();
  rrect(ctx, 40, 20, 300, 300, 28); ctx.clip();
  ctx.fillStyle = acento;
  for (const [cx, cy, r] of [[90, 300, 70], [170, 270, 60], [260, 310, 80], [320, 250, 50]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  rrect(ctx, 40, 20, 300, 300, 28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(190, 20); ctx.lineTo(190, 320); ctx.moveTo(40, 170); ctx.lineTo(340, 170); ctx.stroke();
  // Rack.
  ctx.beginPath();
  ctx.moveTo(440, 200); ctx.lineTo(440, 500); ctx.moveTo(760, 200); ctx.lineTo(760, 500);
  ctx.moveTo(420, 300); ctx.lineTo(780, 300); ctx.moveTo(420, 420); ctx.lineTo(780, 420);
  ctx.stroke();
  for (const fy of [270, 390]) for (const fx of [505, 600, 695]) mancuerna(ctx, fx, fy, 80, color);
  // Banca.
  rrect(ctx, 50, 392, 340, 44, 22); ctx.fill();
  ctx.beginPath(); ctx.moveTo(110, 436); ctx.lineTo(110, 500); ctx.moveTo(330, 436); ctx.lineTo(330, 500); ctx.stroke();
  // Piso.
  ctx.beginPath(); ctx.moveTo(0, 506); ctx.lineTo(800, 506); ctx.stroke();
  ctx.restore();
}

// ── Ganchos (primeros 3 s; lo único que cambia entre versiones) ───────────────────────────────────────────────

/** Todos los ganchos están completos desde el cuadro 0 (sin entrada), solo con el acercamiento lento. */
function planGancho(ctx, e, t) {
  fondo(ctx, C.paper);
  empuja(ctx, e, t, 960, () => {
    linea1(ctx, dice(e, "Tu condominio"), 90, 620, { px: 128, color: C.ink, max: 900, track: -0.03 });
    linea1(ctx, dice(e, "tiene gym."), 90, 760, { px: 128, color: C.ink, max: 900, track: -0.03 });
    bloque(ctx, e, "¿Y tu plan?", 830, 240, 150);
    gym(ctx, 240, 1170, 0.75, C.ink, C.banana);
  });
}

function planPregunta(ctx, e, t) {
  fondo(ctx, C.banana);
  empuja(ctx, e, t, 900, () => {
    entra(ctx, t, 0, () => gym(ctx, 140, 380, 1, C.ink, C.bananaSoft));
    linea1(ctx, dice(e, "¿Y tu plan?"), W / 2, 1260, { px: 200, color: C.ink, align: "center", max: 940, track: -0.03 });
  });
}

function pagasGancho(ctx, e, t) {
  fondo(ctx, C.banana);
  empuja(ctx, e, t, 960, () => {
    linea1(ctx, dice(e, "Lo pagas en"), 90, 820, { px: 150, color: C.ink, max: 900, track: -0.03 });
    bloque(ctx, e, "el mantenimiento", 900, 240, 128);
  });
}

function pagasRecibo(ctx, e, t) {
  fondo(ctx, C.paper);
  ctx.save();
  ctx.shadowColor = "rgba(27,21,5,0.18)"; ctx.shadowBlur = 48; ctx.shadowOffsetY = 24;
  rrect(ctx, 90, 330, 900, 800, 48); ctx.fillStyle = C.card; ctx.fill();
  ctx.restore();
  rrect(ctx, 90, 330, 900, 800, 48); ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.stroke();
  linea1(ctx, dice(e, "Mantenimiento").toUpperCase(), 160, 450, { peso: 700, px: 40, color: C.bananaInk, track: 0.14 });
  const filas = ["Agua", "Seguridad", "Gimnasio"];
  filas.forEach((f, i) => entra(ctx, t, 0.1 * i, () => {
    const y = 510 + i * 190, gym = f === "Gimnasio";
    if (gym) { rrect(ctx, 120, y, 840, 160, 32); ctx.fillStyle = C.bananaSoft; ctx.fill(); }
    ctx.beginPath(); ctx.arc(210, y + 80, 42, 0, Math.PI * 2);
    if (gym) { ctx.strokeStyle = C.ink; ctx.lineWidth = 8; ctx.stroke(); }
    else {
      ctx.fillStyle = C.ink; ctx.fill();
      ctx.strokeStyle = C.banana; ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(190, y + 82); ctx.lineTo(205, y + 97); ctx.lineTo(232, y + 66); ctx.stroke();
    }
    linea1(ctx, dice(e, f), 290, y + 106, { px: 76, color: C.ink, max: 640, track: -0.02 });
    if (i < filas.length - 1) { ctx.fillStyle = C.line; ctx.fillRect(160, y + 174, 760, 3); }
  }));
  entra(ctx, t, 0.45, () => linea1(ctx, dice(e, "y no lo usas"), W / 2, 1380, { px: 150, color: C.ink, align: "center", max: 920, track: -0.03 }));
}

function povGancho(ctx, e, t) {
  fondo(ctx, C.paper);
  empuja(ctx, e, t, 900, () => {
    rrect(ctx, 90, 300, 220, 104, 999); ctx.fillStyle = C.ink; ctx.fill();
    linea1(ctx, dice(e, "POV:"), 200, 372, { px: 60, color: C.banana, align: "center", track: -0.01 });
    linea1(ctx, dice(e, "el gym del"), 90, 560, { px: 124, color: C.ink, max: 900, track: -0.03 });
    linea1(ctx, dice(e, "edificio siempre"), 90, 695, { px: 124, color: C.ink, max: 900, track: -0.03 });
    linea1(ctx, dice(e, "está vacío"), 90, 830, { px: 124, color: C.ink, max: 900, track: -0.03 });
    gym(ctx, 180, 950, 0.9, C.ink, C.banana);
  });
}

function povVacio(ctx, e, t) {
  fondo(ctx, C.ink);
  empuja(ctx, e, t, 700, () => {
    entra(ctx, t, 0, () => gym(ctx, 100, 320, 1.1, C.cream, C.banana));
    linea1(ctx, dice(e, "siempre"), W / 2, 1180, { px: 170, color: C.banana, align: "center", max: 920, track: -0.03 });
    linea1(ctx, dice(e, "está vacío"), W / 2, 1360, { px: 170, color: C.banana, align: "center", max: 920, track: -0.03 });
  });
}

// ── Cuerpo común (s 3 a 15) ───────────────────────────────────────────────────────────────────────────────────

// Teléfono: marco ink de radio 42 con la captura real adentro (780 px de ancho).
const TEL = { x: 230, y: 540, w: 620, h: 1010, borde: 16 };
const ESCALA_CAPTURA = (TEL.w - TEL.borde * 2) / 780;

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

/** Aro por fuera del dato (banana con filo ink), encima de la captura y sin tocarla. */
function aro(ctx, m, desdeY, z, k) {
  if (k <= 0) return;
  const s = ESCALA_CAPTURA, x = TEL.x + TEL.borde + m.x * s, y = TEL.y + TEL.borde + (m.y - desdeY) * s;
  ctx.save();
  ctx.globalAlpha *= k;
  rrect(ctx, x - 8, y - 8, m.w * s + 16, m.h * s + 16, m.r * s + 8);
  ctx.strokeStyle = C.banana; ctx.lineWidth = 14 / z; ctx.stroke();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 4 / z; ctx.stroke();
  ctx.restore();
}

function leyenda(ctx, e) {
  // Franja de fondo para que la leyenda se lea aunque el teléfono acercado pase por detrás.
  const g = ctx.createLinearGradient(0, 0, 0, 560);
  g.addColorStop(0, C.paper); g.addColorStop(0.82, C.paper); g.addColorStop(1, "rgba(255,248,227,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 560);
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

function escenaTelefono(ctx, e, t) {
  fondo(ctx, C.paper);
  const [y0, y1] = e.desde;
  const desdeY = mix(y0, y1, Math.min(1, t / (e.fin - e.inicio)));
  const k = prog(t, 0, ENTRA);
  ctx.save();
  // Entra desde abajo (120 px) para que el cambio de pantalla se note.
  ctx.globalAlpha = k;
  ctx.translate(0, (1 - k) * 120);
  if (e.acerca) {
    // Se acerca al dato entre 0.35 y 0.85 s, recortado a una tarjeta de 520 a 1540 px (dentro de la zona segura).
    const kz = easeInOut((t - 0.35) / 0.5);
    const z = mix(1, e.acerca, kz);
    const fy = TEL.y + TEL.borde + (e.marca.y + e.marca.h / 2 - desdeY) * ESCALA_CAPTURA;
    const cx = TEL.x + TEL.borde + (e.marca.x + e.marca.w / 2) * ESCALA_CAPTURA;
    rrect(ctx, mix(TEL.x, 40, kz), 520, mix(TEL.w, W - 80, kz), 1020, 42);
    ctx.clip();
    ctx.translate(mix(cx, W / 2, kz), mix(fy, 1040, kz));
    ctx.scale(z, z);
    ctx.translate(-cx, -fy);
    telefono(ctx, e.captura, desdeY);
    aro(ctx, e.marca, desdeY, z, prog(t, 0.85, ENTRA));
  } else {
    telefono(ctx, e.captura, desdeY);
    aro(ctx, e.marca, desdeY, 1, prog(t, 0.4, ENTRA));
  }
  ctx.restore();
  entra(ctx, t, 0.08, () => leyenda(ctx, e));
}

function equipo(ctx, e, t) {
  fondo(ctx, C.ink);
  entra(ctx, t, 0, () => mancuerna(ctx, W / 2, 600, 420, C.banana));
  entra(ctx, t, 0.08, () => linea1(ctx, dice(e, "Con el equipo"), W / 2, 960, { px: 116, color: C.cream, align: "center", track: -0.03 }));
  entra(ctx, t, 0.2, () => linea1(ctx, dice(e, "de tu gym"), W / 2, 1150, { px: 170, color: C.banana, align: "center", track: -0.03 }));
}

function tarjeta(ctx, e, t) {
  fondo(ctx, C.banana);
  entra(ctx, t, 0, () => linea1(ctx, dice(e, "7 días gratis,"), 90, 800, { px: 140, color: C.ink, max: 900, track: -0.03 }));
  entra(ctx, t, 0.15, () => bloque(ctx, e, "sin tarjeta", 880, 260, 160));
}

/** Cierre de 3 s: Coach Banana, botón ink "Empieza 7 días gratis en bananaburn.app" y logo. */
function cierre(ctx, e, t) {
  fondo(ctx, C.paper);
  const lado = 720;
  entra(ctx, t, 0, () => ctx.drawImage(A.coach, (W - lado) / 2, 290, lado, lado));
  // Botón: entra a los 0.4 s y cede a scale(.97) a los 1.6 s, como al presionarlo (la campana del audio cae ahí).
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

const DIBUJA = { planGancho, planPregunta, pagasGancho, pagasRecibo, povGancho, povVacio, telefono: escenaTelefono, equipo, tarjeta, cierre };

// ── Render ─────────────────────────────────────────────────────────────────────────────────────────────────────

function revisa(escenas, duracion) {
  const tramo = linea(escenas, duracion);
  for (const e of tramo) {
    const n = palabras(e.texto), d = e.fin - e.inicio;
    if (n > 8) throw new Error(`${e.id}: ${n} palabras (máximo 8)`);
    if (e.tipo === "cierre" ? d !== 3 : d < 1.5 || d > 2.5) throw new Error(`${e.id}: dura ${d} s`);
  }
  return tramo;
}

const GANCHOS = Object.fromEntries(VERSIONES.map((v) => [v.id, revisa(v.escenas, CORTE)]));
const CUERPO_ESCENAS = revisa(CUERPO, DURACION - CORTE);

function cuadro(escenas, i) {
  const t = i / FPS;
  const e = escenas[escenas.findLastIndex((x) => t >= x.inicio)];
  const canvas = createCanvas(W, H);
  DIBUJA[e.tipo](canvas.getContext("2d"), e, t - e.inicio);
  return canvas;
}

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return require("@ffmpeg-installer/ffmpeg").path; } catch { return "ffmpeg"; }
}

function ffmpeg(args, entrada) {
  const ff = spawn(ffmpegPath(), ["-y", "-loglevel", "error", ...args], { stdio: [entrada ? "pipe" : "ignore", "inherit", "inherit"] });
  const fin = new Promise((ok, mal) => ff.on("close", (c) => (c === 0 ? ok() : mal(new Error(`ffmpeg salió con ${c}`)))));
  return { ff, fin };
}

/** Codifica un tramo de video sin audio. Ganchos y cuerpo usan exactamente los mismos ajustes para poder pegarse. */
async function tramo(escenas, duracion, out) {
  const total = Math.round(duracion * FPS);
  const { ff, fin } = ffmpeg([
    "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-",
    "-an", "-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow",
    "-bf", "0", "-r", String(FPS), out,
  ], true);
  for (let i = 0; i < total; i++) {
    const data = cuadro(escenas, i).getContext("2d").getImageData(0, 0, W, H).data;
    if (!ff.stdin.write(Buffer.from(data.buffer))) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await fin;
}

async function videos() {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(join(TMP, "pista.wav"), pista(DURACION));
  await ffmpeg(["-i", join(TMP, "pista.wav"), "-c:a", "aac", "-b:a", "192k", "-ar", "48000", join(TMP, "pista.m4a")]).fin;
  await tramo(CUERPO_ESCENAS, DURACION - CORTE, join(TMP, "cuerpo.mp4"));
  console.log(`cuerpo común: ${(DURACION - CORTE) * FPS} cuadros`);
  for (const v of VERSIONES) {
    const gancho = join(TMP, `${v.id}_gancho.mp4`), lista = join(TMP, `${v.id}.txt`);
    await tramo(GANCHOS[v.id], CORTE, gancho);
    writeFileSync(lista, `file '${gancho}'\nfile '${join(TMP, "cuerpo.mp4")}'\n`);
    // Se pega sin recodificar: el cuerpo y el audio son los mismos bytes en las 3 versiones.
    await ffmpeg([
      "-f", "concat", "-safe", "0", "-i", lista, "-i", join(TMP, "pista.m4a"),
      "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-movflags", "+faststart", join(SALIDA, `${v.archivo}.mp4`),
    ]).fin;
    console.log(`${v.archivo}.mp4: ${DURACION * FPS} cuadros, ${DURACION} s`);
  }
}

/** Portadas 1080x1920: cada gancho tal como se ve en el cuadro 0. */
function portadas() {
  for (const v of VERSIONES) {
    writeFileSync(join(SALIDA, `${v.archivo}_portada.png`), cuadro(GANCHOS[v.id], 0).toBuffer("image/png"));
    console.log(`${v.archivo}_portada.png`);
  }
}

/** Hoja de revisión: arriba las 2 pantallas de cada gancho, abajo el cuerpo común; zona segura en rojo y recorte 1080x1350 en verde. */
function hoja() {
  const celdas = [
    ...VERSIONES.flatMap((v) => GANCHOS[v.id].map((e) => ({ v: v.id, e, desde: 0 }))),
    ...CUERPO_ESCENAS.map((e) => ({ v: "común", e, desde: CORTE })),
  ];
  const s = 0.25, cw = W * s, ch = H * s, cols = 6, pad = 24, rot = 44;
  const filas = Math.ceil(celdas.length / cols);
  const c = createCanvas(cols * (cw + pad) + pad, filas * (ch + pad + rot) + pad);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, c.width, c.height);
  celdas.forEach(({ v, e, desde }, j) => {
    const escenas = desde ? CUERPO_ESCENAS : GANCHOS[v];
    const primero = !desde && e.inicio === 0;
    const i = primero ? 0 : Math.round((e.inicio + Math.min(1.2, (e.fin - e.inicio) - 0.2)) * FPS);
    const x = pad + (j % cols) * (cw + pad), y = pad + Math.floor(j / cols) * (ch + pad + rot) + rot;
    ctx.drawImage(cuadro(escenas, i), x, y, cw, ch);
    ctx.strokeStyle = "rgba(198,42,47,0.9)"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y + SEGURA.arriba * s, cw, (SEGURA.abajo - SEGURA.arriba) * s);
    if (primero) { ctx.strokeStyle = "rgba(63,107,14,0.9)"; ctx.strokeRect(x, y + 285 * s, cw, 1350 * s); }
    ctx.setLineDash([]);
    ctx.fillStyle = C.ink; ctx.font = font(600, 18); ctx.textAlign = "left";
    ctx.fillText(`${v}  ${(desde + e.inicio).toFixed(1)}-${(desde + e.fin).toFixed(1)} s  ${e.id}  (${palabras(e.texto)} pal.)`, x, y - 14);
  });
  writeFileSync(join(SALIDA, "R03_hoja-revision.png"), c.toBuffer("image/png"));
  console.log("R03_hoja-revision.png");
}

const que = process.argv[2] ?? "todo";
if (!A.coachSenala) console.warn("Aviso: falta assets/coach-banana-senala.png; el cierre usa la pose de pie de public/brand/mascota-sola.webp.");
if (que === "videos" || que === "todo") await videos();
if (que === "portadas" || que === "todo") portadas();
if (que === "hoja" || que === "todo") hoja();
