// Render de E03 en código: dibuja cada cuadro con @napi-rs/canvas y lo codifica con ffmpeg (H.264, 30 fps, sin audio).
// Uso: npm install && npm run render  (o: node render.mjs reel | anuncio | portada | storyboard)
// Las tomas son imágenes fijas de Higgsfield en tomas/T1.png a T6.png. Mientras falte alguna, esa toma se dibuja como
// cuadro de referencia (dónde va cada mono) y los videos salen con "_animatic" en el nombre: sirven para revisar
// tiempos y textos, no se publican. Todo sale en la carpeta de arriba (marketing/videos/E03_todos-te-miran/).
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FPS, REEL, ANUNCIO, TOMAS, linea, palabras } from "./escenas.mjs";

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
  banana: "#FFD60A", ink: "#1B1505", body: "#2E2818", paper: "#FFF8E3", cream: "#FFFBF0", card: "#FFFFFF",
  line: "#EDE3C6", muted: "#6A604B", bananaInk: "#8A6200", emberInk: "#8A5300", white: "#FFFFFF",
};

GlobalFonts.registerFromPath(join(REPO, "src/app/og/jakarta-800.woff"), "Jakarta800");
GlobalFonts.registerFromPath(join(REPO, "src/app/og/jakarta-600.woff"), "Jakarta600");
const font = (peso, px) => `${peso} ${px}px ${peso >= 700 ? "Jakarta800" : "Jakarta600"}`;

const img = async (ruta) => loadImage(readFileSync(ruta));
/** La toma de Higgsfield si ya está en tomas/ (png, jpg o webp); si no, null y se dibuja el cuadro de referencia. */
async function toma(id) {
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const ruta = join(AQUI, "tomas", `${id}.${ext}`);
    if (existsSync(ruta)) return img(ruta);
  }
  return null;
}
/** Pose "señala" de Coach Banana: si alguien deja el PNG aquí, el cierre la usa; si no, va la pose de pie de la marca. */
const POSE_SENALA = join(AQUI, "../assets/coach-banana-senala.png");
const A = {
  tomas: Object.fromEntries(await Promise.all(Object.keys(TOMAS).map(async (id) => [id, await toma(id)]))),
  // Captura real de la app (la misma de la landing), sin retoques: solo se recorta y se desplaza.
  entreno: await img(join(REPO, "public/landing/entreno.png")),
  coach: existsSync(POSE_SENALA) ? await img(POSE_SENALA) : await img(join(REPO, "public/brand/mascota-sola.webp")),
  coachSenala: existsSync(POSE_SENALA),
  logo: await img(join(REPO, "public/icons/logo.svg")),
};
const faltan = Object.keys(TOMAS).filter((id) => !A.tomas[id]);
const nombre = (base) => `${base}${faltan.length ? "_animatic" : ""}`;

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

/** Parte el texto en una línea si cabe, o en dos de ancho parejo (text-wrap: balance). */
function lineas(ctx, s, px, max) {
  ctx.font = font(800, px);
  if (ctx.measureText(s).width <= max) return [s];
  const partes = s.split(" ");
  let mejor = null;
  for (let i = 1; i < partes.length; i++) {
    const a = partes.slice(0, i).join(" "), b = partes.slice(i).join(" ");
    const d = Math.abs(ctx.measureText(a).width - ctx.measureText(b).width);
    if (!mejor || d < mejor.d) mejor = { a, b, d };
  }
  return [mejor.a, mejor.b];
}

function fondo(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
}

// ── Tomas y cámara ─────────────────────────────────────────────────────────────────────────────────────────────

/** Medidas de la toma (el cuadro de referencia mide 1080x1920) y la cámara en el instante t de la escena. */
function camara(e, t) {
  const im = A.tomas[e.toma];
  const iw = im?.width ?? W, ih = im?.height ?? H;
  const { de, a, golpe } = e.camara;
  const k = golpe ? 0.9 * easeOut(t / 0.3) + 0.1 * Math.min(1, t / (e.fin - e.inicio)) : easeInOut(Math.min(1, t / (e.fin - e.inicio)));
  const z = mix(de[2], a[2], k);
  const s = Math.max(W / iw, H / ih) * z;
  // El centro no deja ver los bordes de la imagen.
  const hx = W / (2 * iw * s), hy = H / (2 * ih * s);
  const cx = Math.min(1 - hx, Math.max(hx, mix(de[0], a[0], k)));
  const cy = Math.min(1 - hy, Math.max(hy, mix(de[1], a[1], k)));
  return { iw, ih, s, cx, cy, punto: ([x, y]) => [W / 2 + (x - cx) * iw * s, H / 2 + (y - cy) * ih * s] };
}

function dibujaToma(ctx, e, cam) {
  const im = A.tomas[e.toma];
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(cam.s, cam.s);
  ctx.translate(-cam.cx * cam.iw, -cam.cy * cam.ih);
  if (im) ctx.drawImage(im, 0, 0);
  else referencia(ctx, e.toma);
  ctx.restore();
}

const NOMBRE = { nuevo: "El Nuevo", coach: "Coach Banana", platanita: "Coach Platanita" };
/** Cuadro de referencia de una toma que aún no existe: fondo line, un círculo por mono donde va su cabeza y el título. */
function referencia(ctx, id) {
  ctx.fillStyle = C.line; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(27,21,5,0.08)"; ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 120) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (const [quien, [x, y]] of Object.entries(TOMAS[id].personajes)) {
    ctx.beginPath(); ctx.arc(x * W, y * H, 90, 0, Math.PI * 2);
    ctx.fillStyle = quien === "platanita" ? "#F6C9DE" : quien === "coach" ? C.banana : "#B9B4AA"; ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x * W - 70, y * H + 100, 140, 380, 60); ctx.strokeStyle = "rgba(27,21,5,0.35)"; ctx.stroke();
    linea1(ctx, NOMBRE[quien], x * W, y * H + 150, { peso: 600, px: 32, color: C.ink, align: "center", max: 300 });
  }
  linea1(ctx, `${id}: ${TOMAS[id].titulo}`, W / 2, H - 250, { peso: 600, px: 40, color: C.muted, align: "center", max: W - 120 });
  linea1(ctx, "Falta la imagen de Higgsfield", W / 2, H - 190, { peso: 600, px: 34, color: C.muted, align: "center" });
}

// ── Textos ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Gancho POV: tarjeta banana arriba, completa desde el cuadro 0 (sin entrada) para que se lea en el segundo 0 a 1. */
function pov(ctx, e, x) {
  ctx.save();
  ctx.shadowColor = "rgba(27,21,5,0.18)"; ctx.shadowBlur = 48; ctx.shadowOffsetY = 24;
  rrect(ctx, 60, 290, W - 120, 470, 40); ctx.fillStyle = C.banana; ctx.fill();
  ctx.restore();
  const [primera, ...resto] = dice(e, x.texto).split(" ");
  linea1(ctx, primera, 110, 400, { px: 88, color: C.ink, track: -0.02 });
  const [a, b] = lineas(ctx, resto.join(" "), 116, 860);
  linea1(ctx, a, 110, 550, { px: 116, color: C.ink, max: 860, track: -0.03 });
  if (b) linea1(ctx, b, 110, 690, { px: 116, color: C.ink, max: 860, track: -0.03 });
}

/** Tarjeta de texto arriba (y = 300). Devuelve su caja para que el globo ponga la cola. */
function tarjeta(ctx, s, { fondoColor, borde, color }) {
  const px = 72, alto = 96;
  const ls = lineas(ctx, s, px, 860);
  ctx.font = font(800, px);
  const ancho = Math.max(...ls.map((l) => ctx.measureText(l).width)) + 112;
  const caja = { x: (W - ancho) / 2, y: 300, w: ancho, h: ls.length * alto + 72 };
  ctx.save();
  ctx.shadowColor = "rgba(27,21,5,0.18)"; ctx.shadowBlur = 48; ctx.shadowOffsetY = 24;
  rrect(ctx, caja.x, caja.y, caja.w, caja.h, 40); ctx.fillStyle = fondoColor; ctx.fill();
  ctx.restore();
  if (borde) { rrect(ctx, caja.x, caja.y, caja.w, caja.h, 40); ctx.strokeStyle = borde; ctx.lineWidth = 6; ctx.stroke(); }
  ls.forEach((l, i) => linea1(ctx, l, W / 2, caja.y + 36 + 74 + i * alto, { px, color, align: "center", max: 860, track: -0.02 }));
  return caja;
}

/** Globo de diálogo: tarjeta blanca con borde ink y una cola que apunta a la cabeza de quien habla. */
function globo(ctx, e, x, cam) {
  const s = dice(e, x.texto);
  // La cola se dibuja primero y la tarjeta la tapa por arriba: queda una sola forma.
  const [hx, hy] = cam.punto(TOMAS[e.toma].personajes[x.quien]);
  ctx.font = font(800, 72);
  const n = lineas(ctx, s, 72, 860).length;
  const base = 300 + n * 96 + 72;
  const punta = { x: Math.min(W - 120, Math.max(120, hx)), y: Math.max(base + 60, Math.min(hy - 150, base + 220)) };
  const bx = Math.min(W - 260, Math.max(260, punta.x * 0.6 + (W / 2) * 0.4));
  ctx.beginPath();
  ctx.moveTo(bx - 44, base - 8); ctx.lineTo(punta.x, punta.y); ctx.lineTo(bx + 44, base - 8); ctx.closePath();
  ctx.fillStyle = C.card; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.lineJoin = "round"; ctx.stroke();
  tarjeta(ctx, s, { fondoColor: C.card, borde: C.ink, color: C.ink });
  ctx.fillStyle = C.card; ctx.fillRect(bx - 40, base - 9, 80, 6);
}

/** Rótulo del narrador: tarjeta ink con letra cream. */
function rotulo(ctx, e, x) {
  tarjeta(ctx, dice(e, x.texto), { fondoColor: C.ink, color: C.cream });
}

function textos(ctx, e, t, cam) {
  for (const x of e.textos) {
    if (x.tipo === "pov") pov(ctx, e, x);
    else if (x.tipo === "globo") entra(ctx, t, 0.12, () => globo(ctx, e, x, cam));
    else if (x.tipo === "rotulo") entra(ctx, t, 0.12, () => rotulo(ctx, e, x));
  }
}

// ── Escenas ────────────────────────────────────────────────────────────────────────────────────────────────────

function escenaToma(ctx, e, t) {
  fondo(ctx, C.ink);
  const cam = camara(e, t);
  dibujaToma(ctx, e, cam);
  textos(ctx, e, t, cam);
}

// Teléfono: marco ink de radio 42 con la captura real adentro.
const TEL = { x: 230, y: 560, w: 620, h: 1000, borde: 16 };
const ESCALA_CAPTURA = (TEL.w - TEL.borde * 2) / 780;
/** La tarjeta "Serie 2 de 3 / 10 a 12 repeticiones con 20 kg" en la captura original (px de entreno.png). */
const DATO = { x: 34, y: 1036, w: 712, h: 300 };

function escenaTelefono(ctx, e, t) {
  fondo(ctx, C.paper);
  const { x, y, w, h, borde } = TEL;
  const k = prog(t, 0, ENTRA);
  const desdeY = mix(0, 400, easeInOut(Math.min(1, t / 1.2)));
  ctx.save();
  ctx.globalAlpha = k;
  ctx.translate(0, (1 - k) * 120);
  ctx.save();
  ctx.shadowColor = "rgba(27,21,5,0.18)"; ctx.shadowBlur = 48; ctx.shadowOffsetY = 24;
  rrect(ctx, x, y, w, h, 42); ctx.fillStyle = C.ink; ctx.fill();
  ctx.restore();
  ctx.save();
  rrect(ctx, x + borde, y + borde, w - borde * 2, h - borde * 2, 30);
  ctx.clip();
  ctx.fillStyle = C.cream; ctx.fillRect(x, y, w, h);
  const visible = (h - borde * 2) / ESCALA_CAPTURA;
  ctx.drawImage(A.entreno, 0, desdeY, 780, visible, x + borde, y + borde, w - borde * 2, visible * ESCALA_CAPTURA);
  // Aro banana alrededor del dato, por encima de la captura y sin tocarla.
  const kk = prog(t, 1.2, ENTRA);
  if (kk > 0) {
    ctx.globalAlpha = kk;
    ctx.strokeStyle = C.banana; ctx.lineWidth = 8;
    rrect(ctx, x + borde + DATO.x * ESCALA_CAPTURA - 6, y + borde + (DATO.y - desdeY) * ESCALA_CAPTURA - 6, DATO.w * ESCALA_CAPTURA + 12, DATO.h * ESCALA_CAPTURA + 12, 24);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
  textos(ctx, e, t, null);
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
    rrect(ctx, 80, 1020, 920, 230, 115); ctx.fillStyle = C.ink; ctx.fill();
    ctx.restore();
    linea1(ctx, dice(e, "Empieza 7 días gratis"), W / 2, 1118, { px: 70, color: C.banana, align: "center", max: 820 });
    linea1(ctx, dice(e, "en bananaburn.app"), W / 2, 1200, { peso: 600, px: 54, color: C.white, align: "center", max: 820 });
    ctx.restore();
  });
  entra(ctx, t, 0.9, () => {
    const icono = 120, marca = dice(e, "BananaBurn");
    ctx.font = font(800, 84);
    const wb = ctx.measureText("Banana").width, wt = wb + ctx.measureText("Burn").width;
    const x0 = (W - (icono + 28 + wt)) / 2;
    ctx.drawImage(A.logo, x0, 1320, icono, icono);
    linea1(ctx, marca.slice(0, 6), x0 + icono + 28, 1410, { px: 84, color: C.ink });
    linea1(ctx, marca.slice(6), x0 + icono + 28 + wb, 1410, { px: 84, color: C.emberInk });
  });
}

function dibuja(ctx, e, t) {
  if (e.id === "cierre") return cierre(ctx, e, t);
  if (e.captura) return escenaTelefono(ctx, e, t);
  return escenaToma(ctx, e, t);
}

// ── Render ─────────────────────────────────────────────────────────────────────────────────────────────────────

function revisa(version) {
  const escenas = linea(version);
  for (const e of escenas) {
    const n = palabras(e.texto), d = e.fin - e.inicio;
    if (n > 8) throw new Error(`${e.id}: ${n} palabras (máximo 8)`);
    if (e.id === "cierre" ? d !== 3 : d < 1.5 || d > 2.5) throw new Error(`${e.id}: dura ${d} s`);
  }
  if (escenas[0].textos[0].tipo !== "pov") throw new Error("La primera escena tiene que ser el gancho POV");
  return escenas;
}

function cuadro(escenas, i) {
  const t = i / FPS;
  const e = escenas.findLast((x) => t >= x.inicio);
  const canvas = createCanvas(W, H);
  dibuja(canvas.getContext("2d"), e, t - e.inicio);
  return canvas;
}

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return require("@ffmpeg-installer/ffmpeg").path; } catch { return "ffmpeg"; }
}

async function video(version) {
  const escenas = revisa(version);
  const total = Math.round(version.duracion * FPS);
  const archivo = `${nombre(version.archivo)}.mp4`;
  const ff = spawn(ffmpegPath(), [
    "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-",
    "-an", "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow",
    "-r", String(FPS), "-movflags", "+faststart", join(SALIDA, archivo),
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const fin = new Promise((ok, mal) => ff.on("close", (c) => (c === 0 ? ok() : mal(new Error(`ffmpeg salió con ${c}`)))));
  for (let i = 0; i < total; i++) {
    const data = cuadro(escenas, i).getContext("2d").getImageData(0, 0, W, H).data;
    if (!ff.stdin.write(Buffer.from(data.buffer))) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await fin;
  console.log(`${archivo}: ${total} cuadros, ${version.duracion} s`);
}

/** Portada 1080x1920: el gancho tal como se ve en el cuadro 0. Solo con la toma T1 real. */
function portada() {
  if (!A.tomas.T1) return console.warn("Portada: falta tomas/T1.png; no se genera.");
  writeFileSync(join(SALIDA, "E03_todos-te-miran_portada.png"), cuadro(revisa(REEL), 0).toBuffer("image/png"));
  console.log("E03_todos-te-miran_portada.png");
}

/** Storyboard: un cuadro de cada escena del Reel con tiempo, toma, texto y palabras; zona segura en rojo y recorte 1080x1350 en verde. */
function storyboard() {
  const escenas = revisa(REEL);
  const s = 0.25, cw = W * s, ch = H * s, cols = 4, pad = 28, rot = 92, cab = 90;
  const filas = Math.ceil(escenas.length / cols);
  const c = createCanvas(cols * (cw + pad) + pad, cab + filas * (ch + pad + rot) + pad);
  const ctx = c.getContext("2d");
  ctx.fillStyle = C.white; ctx.fillRect(0, 0, c.width, c.height);
  linea1(ctx, "E03 Sientes que todos te miran: storyboard (23 s)", pad, 50, { px: 30, color: C.ink, max: c.width - pad * 2 });
  linea1(ctx, faltan.length ? `Cuadros grises: faltan ${faltan.join(", ")} de Higgsfield. No se publica.` : "Revisión interna. No se publica.", pad, 80, { peso: 600, px: 18, color: C.muted, max: c.width - pad * 2 });
  escenas.forEach((e, j) => {
    const i = e.id === "gancho" ? 0 : Math.round((e.inicio + Math.min(1.4, e.fin - e.inicio - 0.2)) * FPS);
    const x = pad + (j % cols) * (cw + pad), y = cab + Math.floor(j / cols) * (ch + pad + rot);
    ctx.fillStyle = C.ink; ctx.font = font(800, 18); ctx.textAlign = "left";
    ctx.fillText(`${e.inicio.toFixed(1)} a ${e.fin.toFixed(1)} s   ${e.toma ?? (e.captura ? "captura real" : "cierre")}`, x, y + 22);
    ctx.font = font(600, 15); ctx.fillStyle = C.body;
    const [a, b] = lineas(ctx, `${e.texto} (${palabras(e.texto)} pal.)`, 15, cw);
    ctx.font = font(600, 15);
    ctx.fillText(a, x, y + 48); if (b) ctx.fillText(b, x, y + 70);
    ctx.drawImage(cuadro(escenas, i), x, y + rot - 8, cw, ch);
    ctx.strokeStyle = "rgba(198,42,47,0.9)"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y + rot - 8 + SEGURA.arriba * s, cw, (SEGURA.abajo - SEGURA.arriba) * s);
    if (e.id === "gancho") { ctx.strokeStyle = "rgba(63,107,14,0.9)"; ctx.strokeRect(x, y + rot - 8 + 285 * s, cw, 1350 * s); }
    ctx.setLineDash([]);
  });
  writeFileSync(join(SALIDA, "E03_todos-te-miran_storyboard.png"), c.toBuffer("image/png"));
  console.log("E03_todos-te-miran_storyboard.png");
}

const que = process.argv[2] ?? "todo";
if (faltan.length) console.warn(`Aviso: faltan las tomas ${faltan.join(", ")} en tomas/; salen cuadros de referencia y los videos llevan "_animatic".`);
if (!A.coachSenala) console.warn("Aviso: falta assets/coach-banana-senala.png; el cierre usa la pose de pie de public/brand/mascota-sola.webp.");
if (que === "reel" || que === "todo") await video(REEL);
if (que === "anuncio" || que === "todo") await video(ANUNCIO);
if (que === "portada" || que === "todo") portada();
if (que === "storyboard" || que === "todo") storyboard();
