// Renderiza R02 en MP4 (H.264, 1080x1920, 30 fps, sin audio) y la portada en PNG.
// Uso: npm install && npm run render   (o: node render.mjs portada | R02_musculo-glp1 | R02_musculo-glp1_15s)
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { AVISO, BOTON, CORTES, ESCENAS, FPS, H, SAFE, W } from "./escenas.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = resolve(AQUI, "..");
const REPO = resolve(AQUI, "../../../..");

// Tokens de src/app/globals.css
const C = {
  banana: "#FFD60A", bananaSoft: "#FFF1A8", ink: "#1B1505", body: "#2E2818", paper: "#FFF8E3",
  cream: "#FFFBF0", card: "#FFFFFF", line: "#EDE3C6", bananaInk: "#8A6200", ember: "#F2A100", emberInk: "#8A5300",
};

GlobalFonts.registerFromPath(resolve(REPO, "src/app/og/jakarta-800.woff"), "Jakarta800");
GlobalFonts.registerFromPath(resolve(REPO, "src/app/og/jakarta-600.woff"), "Jakarta600");

// Captura real de Nutrición (sin tocar) y Coach Banana. Cuando llegue la pose "señala" del kit,
// cambia COACH por su ruta: es la que pide el cierre estándar.
const CAPTURA = await loadImage(resolve(REPO, "public/landing/nutricion.png"));
// Capturas reales del entreno (campaña del 9 nov, sin tocar): primer entreno, peso sugerido, cómo se hace, descanso.
const CAP = (f) => loadImage(resolve(REPO, `public/landing/campana-9nov/${f}`));
// De la tarjeta de Hoy solo se usa la parte de arriba (hasta "Empezar en casa · unos 12 min"): la llamada de noviembre es siempre 12 min.
const HOY = await CAP("c1-hoy-primer-dia.png").then((img) => {
  const alto = Number(process.env.HOY_ALTO ?? 425), c = createCanvas(img.width, alto);
  c.getContext("2d").drawImage(img, 0, 0, img.width, alto, 0, 0, img.width, alto);
  return c;
});
const GUIA = await CAP("c6-guiado-gym.png");
const COMO = await CAP("c8-como-se-hace.png");
const DESCANSO = await CAP("c4-descanso.png");
const COACH = await loadImage(resolve(REPO, "public/brand/mascota-sola.webp"));
// Pose oficial "señala" (la que pide el cierre estándar), la misma de E03.
const SENALA = await loadImage(resolve(REPO, "marketing/videos/E03_todos-te-miran/assets/coach-banana-senala.png"));
const LOGO = await loadImage(Buffer.from(readFileSync(resolve(REPO, "public/icons/logo.svg"), "utf8").replace("<svg ", '<svg width="512" height="512" ')));

// Curvas de la marca
function bezier(x1, y1, x2, y2) {
  const f = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 30; i++) { t = (lo + hi) / 2; if (f(x1, x2, t) < x) lo = t; else hi = t; }
    return f(y1, y2, t);
  };
}
const easeOut = bezier(0.23, 1, 0.32, 1);
const clamp = (v) => Math.min(1, Math.max(0, v));
/** Progreso de una entrada de 300 ms que empieza en `delay`. */
const entra = (t, delay = 0, dur = 0.3) => easeOut(clamp((t - delay) / dur));

/** Rebote con sobrepaso (entra, se pasa un poco y regresa): da peso a Coach Banana y a los golpes de texto. */
const back = (x) => { const c = 1.9; x = clamp(x); return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
/** Golpe de entrada: progreso con rebote de una entrada que empieza en `delay`. */
const golpe = (t, delay = 0, dur = 0.38) => back((t - delay) / dur);

/**
 * Coach Banana con vida: entra con rebote desde un lado, aterriza con un aplastón, respira y se balancea.
 * `img`: pose; (cx, pie): centro horizontal y línea de los pies; `alto`: altura en px.
 * `desde`: "abajo" | "izq" | "der"; `voltear`: espejo; `jab`: empuja el brazo que señala (px).
 */
function coach(ctx, t, img, cx, pie, alto, { delay = 0, desde = "abajo", voltear = false, jab = 0, giro = 0 } = {}) {
  const tt = t - delay;
  if (tt < 0) return;
  const p = golpe(t, delay, 0.42);
  const ancho = (alto * img.width) / img.height;
  let dx = 0, dy = 0;
  if (desde === "abajo") dy = (1 - p) * (alto * 0.9);
  if (desde === "izq") dx = (1 - p) * -(ancho + 200);
  if (desde === "der") dx = (1 - p) * (ancho + 200);
  // Aplastón al aterrizar (0.42 a 0.62 s) y respiración después
  const aterriza = tt > 0.42 && tt < 0.62 ? Math.sin(((tt - 0.42) / 0.2) * Math.PI) : 0;
  const resp = Math.sin(tt * Math.PI * 2 * 1.3);
  const sy = 1 - 0.07 * aterriza + 0.012 * resp, sx = 1 + 0.06 * aterriza - 0.006 * resp;
  const bob = -6 * Math.sin(tt * Math.PI * 2 * 0.9);
  const empuje = jab ? jab * Math.max(0, Math.sin(tt * Math.PI * 2 * 1.6)) ** 3 : 0;
  ctx.save();
  ctx.translate(cx + dx + (voltear ? -empuje : empuje), pie + dy + bob);
  ctx.rotate(giro + 0.025 * Math.sin(tt * Math.PI * 2 * 0.7));
  ctx.scale(voltear ? -sx : sx, sy);
  ctx.drawImage(img, -ancho / 2, -alto, ancho, alto);
  ctx.restore();
}

/** Líneas que entran de golpe: escala de 1.35 a 1 con rebote alrededor del centro de la línea. */
function golpeTexto(ctx, p, cy, dibujar) {
  ctx.save();
  ctx.globalAlpha *= clamp(p * 1.6);
  const s = 1.35 - 0.35 * p;
  ctx.translate(W / 2, cy); ctx.scale(s, s); ctx.translate(-W / 2, -cy);
  dibujar();
  ctx.restore();
}

/** Sacudida corta de cámara que se apaga en `dur` segundos. */
function sacude(ctx, t, fuerza = 14, dur = 0.3) {
  if (t > dur) return;
  const k = (1 - t / dur) * fuerza;
  ctx.translate(Math.sin(t * 90) * k, Math.cos(t * 70) * k * 0.6);
}

/** Rayos que giran detrás de Coach Banana (fondo de celebración). */
function rayos(ctx, cx, cy, t, color, n = 14, r = 1400) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.35);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a, a + Math.PI / n); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/** Franjas diagonales que se desplazan: movimiento de fondo en las escenas banana y paper. */
function franjas(ctx, t, color, vel = 120) {
  ctx.save();
  ctx.fillStyle = color;
  const paso = 160, off = (t * vel) % paso;
  ctx.translate(W / 2, H / 2); ctx.rotate(-0.5); ctx.translate(-W * 1.2, -H);
  for (let x = -paso + off; x < W * 2.4; x += paso) ctx.fillRect(x, 0, paso / 2.6, H * 2);
  ctx.restore();
}

/** Cortinilla diagonal entre escenas: cubre en los últimos 0.14 s y descubre en los primeros 0.14 s. */
function cortinilla(ctx, p, color) {
  if (p <= 0) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const x = -600 + p * (W + 1200);
  ctx.moveTo(x - 600, 0); ctx.lineTo(x + 300, 0); ctx.lineTo(x - 300, H); ctx.lineTo(x - 1200, H);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function font(ctx, size, weight = 800) {
  ctx.font = `${size}px ${weight === 800 ? "Jakarta800" : "Jakarta600"}`;
  ctx.letterSpacing = `${(weight === 800 ? -0.03 : -0.01) * size}px`;
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
}

/** Tamaño de letra que hace caber `texto` en `max` px. */
function cabe(ctx, texto, size, max, weight = 800) {
  font(ctx, size, weight);
  const w = ctx.measureText(texto).width;
  return w > max ? Math.floor((size * max) / w) : size;
}

/**
 * Dibuja líneas centradas. Cada línea: { t, size, color, weight, marca } donde `marca` es el color
 * del resaltado detrás de la palabra (el marcador amarillo de los carruseles).
 */
function lineas(ctx, lista, yTop, { gap = 0.08, x = W / 2 } = {}) {
  let y = yTop;
  for (const l of lista) {
    const size = cabe(ctx, l.t, l.size, W - 144, l.weight);
    font(ctx, size, l.weight);
    const w = ctx.measureText(l.t).width;
    if (l.marca) {
      ctx.fillStyle = l.marca;
      rrect(ctx, x - w / 2 - size * 0.18, y - size * 0.02, w + size * 0.36, size * 1.12, size * 0.22);
      ctx.fill();
    }
    ctx.fillStyle = l.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(l.t, x, y + size * 0.06);
    y += size * (1.12 + gap);
  }
  return y;
}

const alto = (lista, gap = 0.08) => lista.reduce((s, l) => s + l.size * (1.12 + gap), 0);

function fondo(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
}

/** Envuelve un dibujo con opacidad y subida de 40 px según el progreso `p`. */
function conEntrada(ctx, p, dibujar, dy = 40) {
  ctx.save();
  ctx.globalAlpha *= p;
  ctx.translate(0, (1 - p) * dy);
  dibujar();
  ctx.restore();
}

function sombra(ctx, fn) {
  ctx.save();
  ctx.shadowColor = "rgba(27,21,5,0.18)";
  ctx.shadowBlur = 64;
  ctx.shadowOffsetY = 32;
  fn();
  ctx.restore();
}

function telefono(ctx, x, y, anchoPantalla, img = CAPTURA) {
  const b = 18, h = (anchoPantalla * img.height) / img.width;
  sombra(ctx, () => { ctx.fillStyle = C.ink; rrect(ctx, x - b, y - b, anchoPantalla + 2 * b, h + 2 * b, 42 + b); ctx.fill(); });
  ctx.save();
  rrect(ctx, x, y, anchoPantalla, h, 42);
  ctx.clip();
  ctx.drawImage(img, x, y, anchoPantalla, h);
  ctx.restore();
  return h + 2 * b;
}

function escudo(ctx, cx, cy, s, relleno, borde) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s / 100, s / 100);
  ctx.beginPath();
  ctx.moveTo(0, -50);
  ctx.bezierCurveTo(16, -38, 30, -34, 42, -34);
  ctx.bezierCurveTo(42, 4, 34, 32, 0, 52);
  ctx.bezierCurveTo(-34, 32, -42, 4, -42, -34);
  ctx.bezierCurveTo(-30, -34, -16, -38, 0, -50);
  ctx.closePath();
  ctx.fillStyle = relleno;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.lineJoin = "round";
  ctx.strokeStyle = borde;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-17, 2);
  ctx.lineTo(-4, 15);
  ctx.lineTo(19, -12);
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

function mancuerna(ctx, cx, cy, s, color, giro = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(giro);
  ctx.scale(s / 100, s / 100);
  ctx.fillStyle = color;
  rrect(ctx, -34, -5, 68, 10, 5); ctx.fill();
  for (const sx of [-1, 1]) {
    rrect(ctx, sx * 34 - (sx > 0 ? 0 : 12), -26, 12, 52, 5); ctx.fill();
    rrect(ctx, sx * 48 - (sx > 0 ? 0 : 9), -17, 9, 34, 4); ctx.fill();
  }
  ctx.restore();
}

function logo(ctx, cx, y, s) {
  font(ctx, s * 0.62, 800);
  const wb = ctx.measureText("Banana").width, wr = ctx.measureText("Burn").width, gap = s * 0.25;
  const total = s + gap + wb + wr, x0 = cx - total / 2;
  ctx.drawImage(LOGO, x0, y, s, s);
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.fillStyle = C.ink; ctx.fillText("Banana", x0 + s + gap, y + s / 2 + s * 0.03);
  ctx.fillStyle = C.emberInk; ctx.fillText("Burn", x0 + s + gap + wb, y + s / 2 + s * 0.03);
}

// ---------- Escenas: (ctx, t, dur) con t en segundos desde el inicio de la escena ----------

/** Segundos desde el paso `k` de la escena (negativo si todavía no llega). */
const desde = (t, pasos, k) => t - (pasos?.[k] ?? 0);
/** Índice del paso en curso. */
const pasoActual = (t, pasos) => (pasos ?? [0]).reduce((k, p, i) => (t >= p ? i : k), 0);

/** Tarjeta de texto cream con borde, para que el texto se lea sobre Coach Banana o capturas. */
function placa(ctx, y, h, color = C.cream) {
  ctx.fillStyle = color; rrect(ctx, 72, y, W - 144, h, 48); ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = 3; rrect(ctx, 72, y, W - 144, h, 48); ctx.stroke();
}

const DIBUJO = {
  // Cuadro 0 ya trae el gancho completo. En el segundo paso ("pero, ¿y tu músculo?") la última línea da un golpe.
  gancho(ctx, t, dur, pasos) {
    fondo(ctx, C.banana);
    franjas(ctx, t, C.bananaSoft, 90);
    const [a, b, c] = ESCENAS.gancho.texto, t2 = desde(t, pasos, 1);
    ctx.save();
    sacude(ctx, t, 16, 0.28);
    if (t2 >= 0) sacude(ctx, t2, 14, 0.25);
    ctx.translate(0, -170);
    const esc = 1.04 - 0.04 * golpe(t, 0, 0.3) + 0.04 * easeOut(t / dur);
    ctx.translate(W / 2, H / 2); ctx.scale(esc, esc); ctx.translate(-W / 2, -H / 2);
    const ls = [{ t: a, size: 210, color: C.ink }, { t: b, size: 210, color: C.ink }];
    const y0 = (SAFE.top + SAFE.bottom) / 2 - alto([...ls, { size: 210 }], 0.12) / 2;
    lineas(ctx, ls, y0, { gap: 0.12 });
    const yc = y0 + alto(ls, 0.12);
    const pulso = t2 >= 0 ? 1 + 0.18 * (1 - golpe(t2, 0, 0.35)) : 1;
    ctx.save(); ctx.translate(W / 2, yc + 118); ctx.scale(pulso, pulso); ctx.translate(-W / 2, -(yc + 118));
    lineas(ctx, [{ t: c, size: 210, color: C.banana, marca: C.ink }], yc, { gap: 0.12 });
    ctx.restore();
    ctx.restore();
    coach(ctx, t, COACH, W - 250, H - 150, 760, { delay: 0.25, voltear: true, giro: -0.05 });
  },

  pierdes(ctx, t, dur, pasos) {
    fondo(ctx, C.ink);
    rayos(ctx, W / 2, 900, t, "rgba(255,214,10,0.05)");
    const [a, b, c] = ESCENAS.pierdes.texto, t2 = desde(t, pasos, 1);
    const ls = [{ t: a, size: 130, color: C.cream }, { t: b, size: 130, color: C.cream }];
    const y0 = 700 - alto(ls) / 2;
    conEntrada(ctx, entra(t), () => lineas(ctx, ls, y0));
    if (t2 >= 0) {
      ctx.save(); sacude(ctx, t2, 12, 0.25);
      golpeTexto(ctx, golpe(t2), y0 + alto(ls) + 150, () => lineas(ctx, [{ t: c, size: 220, color: C.banana }], y0 + alto(ls) + 30));
      ctx.restore();
    }
    // Coach Banana, serio, asoma desde abajo
    coach(ctx, t, COACH, W / 2, H + 260, 760, { delay: 0.2 });
  },

  // Entrena poco, pero constante, con Banana Burn: una línea por frase y la tarjeta real del primer entreno
  app(ctx, t, dur, pasos) {
    fondo(ctx, C.banana);
    franjas(ctx, t, C.bananaSoft, 110);
    const [a, b, c] = ESCENAS.app.texto;
    const yA = SAFE.top + 10, yB = SAFE.top + 160, yC = SAFE.top + 320;
    conEntrada(ctx, entra(t), () => lineas(ctx, [{ t: a, size: 130, color: C.ink }], yA));
    const t2 = desde(t, pasos, 1), t3 = desde(t, pasos, 2);
    if (t2 >= 0) golpeTexto(ctx, golpe(t2), yB + 70, () => lineas(ctx, [{ t: b, size: 120, color: C.ink, marca: C.cream }], yB));
    if (t3 >= 0) golpeTexto(ctx, golpe(t3), yC + 80, () => lineas(ctx, [{ t: c, size: 130, color: C.banana, marca: C.ink }], yC));
    // Tarjeta real "Tu primer entreno" (Hoy, primer día)
    const ancho = 640, x = W - ancho - 60, y = 900, pt = golpe(t, 0.3, 0.45);
    ctx.save(); ctx.globalAlpha *= clamp(pt * 1.5);
    ctx.translate(0, (1 - pt) * 400); ctx.translate(x + ancho / 2, y + 260); ctx.rotate(0.04 + (1 - pt) * 0.15 + 0.01 * Math.sin(t * 2)); ctx.translate(-(x + ancho / 2), -(y + 260));
    telefono(ctx, x, y, ancho, HOY);
    ctx.restore();
    coach(ctx, t, SENALA, 230, H - 30, 640, { delay: 0.15, desde: "izq", jab: 16 });
  },

  // La app que no tienes que descargar: se abre desde el navegador
  web(ctx, t, dur, pasos) {
    fondo(ctx, C.paper);
    franjas(ctx, t, "rgba(255,214,10,0.18)", 80);
    const [a, b, url] = ESCENAS.web.texto, t2 = desde(t, pasos, 1);
    conEntrada(ctx, entra(t), () => lineas(ctx, [{ t: a, size: 120, color: C.ink }], SAFE.top + 10));
    if (t2 >= 0) golpeTexto(ctx, golpe(t2), SAFE.top + 250, () => lineas(ctx, [{ t: b, size: 104, color: C.ink, marca: C.banana }], SAFE.top + 180));
    // Barra de dirección: la URL se escribe sola y un toque la abre
    const y = 820, h = 170, x = 110, w = W - 220, pb = golpe(t, 0.1, 0.4);
    conEntrada(ctx, clamp(pb), () => {
      sombra(ctx, () => { ctx.fillStyle = C.card; rrect(ctx, x, y, w, h, 999); ctx.fill(); });
      ctx.strokeStyle = C.ink; ctx.lineWidth = 6; rrect(ctx, x, y, w, h, 999); ctx.stroke();
      const n = Math.round(clamp((t - 0.25) / 0.6) * url.length);
      font(ctx, 84, 800); ctx.fillStyle = C.ink; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      const tx = x + 70;
      ctx.fillText(url.slice(0, n), tx, y + h / 2 + 4);
      if (n < url.length && Math.floor(t * 4) % 2 === 0) { const cw = ctx.measureText(url.slice(0, n)).width; ctx.fillRect(tx + cw + 6, y + 45, 8, h - 90); }
    }, 60);
    // Toque al terminar de escribir
    const tt = t - 1.0;
    if (tt > 0 && tt < 0.5) {
      ctx.save(); ctx.globalAlpha = 1 - tt / 0.5; ctx.strokeStyle = C.ink; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(W - 220, y + h / 2, 40 + tt * 160, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    coach(ctx, t, SENALA, 300, H - 40, 680, { delay: 0.2, desde: "izq", jab: 16, giro: -0.04 });
  },

  // Qué hacer, con cuánto peso y cuánto descansar: una captura real por frase de la voz
  como(ctx, t, dur, pasos) {
    fondo(ctx, C.paper);
    franjas(ctx, t, "rgba(255,214,10,0.16)", 70);
    const lin = ESCENAS.como.texto, pantallas = [GUIA, GUIA, DESCANSO];
    const k = pasoActual(t, pasos), tk = desde(t, pasos, k);
    lin.forEach((l, i) => {
      if (i > k) return;
      const activa = i === k, y = SAFE.top + i * 110;
      const dibuja = () => lineas(ctx, [{ t: l, size: 88, color: activa ? C.ink : C.bananaInk, marca: activa ? C.banana : null }], y);
      if (activa) golpeTexto(ctx, golpe(tk, 0, 0.3), y + 50, dibuja); else dibuja();
    });
    const ancho = 470, x = (W - ancho) / 2 + 110, giro = k === 1 ? 0 : 1 - golpe(tk, 0, 0.32);
    ctx.save();
    ctx.translate(x + ancho / 2, 1200); ctx.rotate(giro * (k % 2 ? -0.18 : 0.18)); ctx.scale(1 - 0.12 * giro, 1 - 0.12 * giro);
    ctx.translate(-(x + ancho / 2), -1200);
    telefono(ctx, x, 620, ancho, pantallas[k]);
    ctx.restore();
    // En "con cuánto peso", anillo banana sobre el peso sugerido de la captura (6 kg · Sugerido)
    if (k === 1) {
      const s = ancho / GUIA.width, p = golpe(tk, 0, 0.35);
      ctx.save(); ctx.globalAlpha = clamp(p * 1.4); ctx.strokeStyle = C.banana; ctx.lineWidth = 12;
      rrect(ctx, x + 32 * s - 12, 620 + 1138 * s - 12, 716 * s + 24, 127 * s + 24, 30); ctx.stroke(); ctx.restore();
    }
    coach(ctx, t, SENALA, 140, H - 30, 640, { delay: 0.1, desde: "izq", jab: 14 });
  },

  fuerza(ctx, t, dur, pasos) {
    fondo(ctx, C.ink);
    rayos(ctx, W / 2, 760, t, "rgba(255,214,10,0.06)");
    [[170, 0.1, 1], [910, 0.22, -1], [820, 0.34, 1]].forEach(([mx, d, s], i) => {
      const pm = golpe(t, d, 0.5);
      ctx.save(); ctx.globalAlpha = clamp(pm * 1.5);
      mancuerna(ctx, mx, 300 + i * 40 + (1 - pm) * -500, 150, C.banana, s * (1 - pm) * 3 + s * 0.2 * Math.sin(t * 2));
      ctx.restore();
    });
    const [a, b, c] = ESCENAS.fuerza.texto, t2 = desde(t, pasos, 1);
    conEntrada(ctx, entra(t), () => lineas(ctx, [{ t: a, size: 96, color: C.cream }], 440));
    if (t2 >= 0) {
      ctx.save(); sacude(ctx, t2, 12, 0.25);
      golpeTexto(ctx, golpe(t2), 680, () => lineas(ctx, [{ t: b, size: 200, color: C.banana }], 570));
      conEntrada(ctx, entra(t2, 0.15), () => lineas(ctx, [{ t: c, size: 110, color: C.cream }], 820));
      ctx.restore();
    }
    coach(ctx, t, COACH, W / 2, H + 120, 760, { delay: 0.35 });
  },

  captura(ctx, t) {
    fondo(ctx, C.paper);
    franjas(ctx, t, "rgba(255,214,10,0.16)", 70);
    const [a, b] = ESCENAS.captura.texto;
    conEntrada(ctx, entra(t), () => lineas(ctx, [{ t: a, size: 96, color: C.ink }], SAFE.top));
    golpeTexto(ctx, golpe(t, 0.15), SAFE.top + 170, () => lineas(ctx, [{ t: b, size: 110, color: C.ink, marca: C.banana }], SAFE.top + 110));
    const ancho = 450, x = (W - ancho) / 2 + 120, pt = golpe(t, 0.08, 0.45);
    ctx.save(); ctx.globalAlpha *= clamp(pt * 1.5);
    ctx.translate(x + ancho / 2, 1020); ctx.rotate((1 - pt) * 0.12 + 0.015 * Math.sin(t * 3)); ctx.translate(-(x + ancho / 2), -1020 + (1 - pt) * 300);
    telefono(ctx, x, 560, ancho);
    ctx.restore();
    coach(ctx, t, SENALA, 150, H - 60, 700, { delay: 0.3, desde: "izq", jab: 14 });
  },

  // Sabemos cuánta proteína te falta hoy: zoom a "Te quedan" de la captura real
  zoom(ctx, t, dur, pasos) {
    fondo(ctx, C.paper);
    const [a, b] = ESCENAS.zoom.texto, t2 = desde(t, pasos, 1);
    conEntrada(ctx, entra(t), () => lineas(ctx, [{ t: a, size: 104, color: C.ink }], SAFE.top));
    if (t2 >= 0) golpeTexto(ctx, golpe(t2), SAFE.top + 200, () => lineas(ctx, [{ t: b, size: 110, color: C.ink, marca: C.banana }], SAFE.top + 140));
    const src = { x: 34, y: 338, w: 712, h: 576 };
    const p = entra(t, 0, 0.45);
    const anchoFinal = 960, anchoIni = 470 * (src.w / 780);
    const w = anchoIni + (anchoFinal - anchoIni) * p + 12 * Math.sin(t * 1.5), h = (w * src.h) / src.w;
    const x = (W - w) / 2, y = 1000 - h / 2 + 40;
    sombra(ctx, () => { ctx.fillStyle = C.card; rrect(ctx, x, y, w, h, 48); ctx.fill(); });
    ctx.save(); rrect(ctx, x, y, w, h, 48); ctx.clip();
    ctx.drawImage(CAPTURA, src.x, src.y, src.w, src.h, x, y, w, h);
    ctx.restore();
    const k = w / src.w, pulso = t2 >= 0 ? clamp(golpe(t2, 0, 0.35) * 1.4) : 0;
    if (pulso > 0) {
      ctx.save(); ctx.globalAlpha = pulso; ctx.strokeStyle = C.banana; ctx.lineWidth = 12;
      rrect(ctx, x + (74 - src.x) * k - 10, y + (704 - src.y) * k - 10, 632 * k + 20, 168 * k + 20, 40); ctx.stroke(); ctx.restore();
    }
  },

  shield(ctx, t) {
    fondo(ctx, C.paper);
    rayos(ctx, W / 2, 620, t, "rgba(255,214,10,0.22)", 12, 900);
    const [a, b] = ESCENAS.shield.texto;
    coach(ctx, t, COACH, W / 2, 1000, 760, { delay: 0 });
    const ps = golpe(t, 0.12, 0.4);
    if (ps > 0) {
      const anillo = clamp((t - 0.2) / 0.35);
      ctx.save(); ctx.globalAlpha = 1 - anillo; ctx.strokeStyle = C.banana; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.arc(W / 2, 640, 160 + anillo * 260, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      escudo(ctx, W / 2, 640, 360 * ps, C.banana, C.ink);
    }
    conEntrada(ctx, entra(t, 0.1), () => { placa(ctx, 960, 330); lineas(ctx, [{ t: a, size: 100, color: C.ink }], 990); });
    golpeTexto(ctx, golpe(t, 0.25), 1180, () => lineas(ctx, [{ t: b, size: 104, color: C.ink, marca: C.banana }], 1120));
  },

  // Y cuida tu músculo mientras bajas: Coach Banana al centro, firme, con su escudo
  cuida(ctx, t) {
    fondo(ctx, C.ink);
    rayos(ctx, W / 2, 1100, t, "rgba(255,214,10,0.08)", 14, 1500);
    const [a, b] = ESCENAS.cuida.texto;
    conEntrada(ctx, entra(t), () => lineas(ctx, [{ t: a, size: 112, color: C.cream }], SAFE.top + 20));
    golpeTexto(ctx, golpe(t, 0.2), SAFE.top + 220, () => lineas(ctx, [{ t: b, size: 130, color: C.ink, marca: C.banana }], SAFE.top + 150));
    coach(ctx, t, COACH, W / 2, H - 40, 980, { delay: 0.05 });
    const pe = golpe(t, 0.45, 0.35);
    if (pe > 0) escudo(ctx, W / 2 + 270, 1180, 200 * pe, C.banana, C.ink);
  },

  // Anuncio: Tu nutrición, el plan completo: Banana Shield (una frase por paso)
  plan(ctx, t, dur, pasos) {
    fondo(ctx, C.paper);
    franjas(ctx, t, "rgba(255,214,10,0.16)", 70);
    const [a, b, c] = ESCENAS.plan.texto, t2 = desde(t, pasos, 1), t3 = desde(t, pasos, 2);
    conEntrada(ctx, entra(t), () => lineas(ctx, [{ t: a, size: 104, color: C.ink }], SAFE.top));
    if (t2 >= 0) golpeTexto(ctx, golpe(t2), SAFE.top + 180, () => lineas(ctx, [{ t: b, size: 96, color: C.ink, marca: C.cream }], SAFE.top + 130));
    if (t3 >= 0) golpeTexto(ctx, golpe(t3), SAFE.top + 320, () => lineas(ctx, [{ t: c, size: 120, color: C.ink, marca: C.banana }], SAFE.top + 255));
    const ancho = 430, x = (W - ancho) / 2 + 130, pt = golpe(t, 0.08, 0.45);
    ctx.save(); ctx.globalAlpha *= clamp(pt * 1.5);
    ctx.translate(x + ancho / 2, 1100); ctx.rotate((1 - pt) * 0.12 + 0.015 * Math.sin(t * 3)); ctx.translate(-(x + ancho / 2), -1100 + (1 - pt) * 300);
    telefono(ctx, x, 700, ancho);
    ctx.restore();
    if (t3 >= 0) {
      const ps = golpe(t3, 0.05, 0.4), anillo = clamp((t3 - 0.1) / 0.35);
      ctx.save(); ctx.globalAlpha = 1 - anillo; ctx.strokeStyle = C.banana; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.arc(x + ancho / 2, 1150, 140 + anillo * 240, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      escudo(ctx, x + ancho / 2, 1150, 300 * ps, C.banana, C.ink);
    }
    coach(ctx, t, SENALA, 150, H - 40, 680, { delay: 0.2, desde: "izq", jab: 14 });
  },

  aviso(ctx, t) {
    fondo(ctx, C.ink);
    conEntrada(ctx, entra(t), () => escudo(ctx, W / 2, 560, 300, C.banana, C.ink));
    conEntrada(ctx, entra(t, 0.05), () => {
      const x = 72, y = 820, w = W - 144, h = 560;
      ctx.fillStyle = C.cream; rrect(ctx, x, y, w, h, 48); ctx.fill();
      const p = AVISO.split(" ");
      const ls = [p.slice(0, 2), p.slice(2, 4), p.slice(4)].map((l) => ({ t: l.join(" "), size: 112, color: C.ink }));
      lineas(ctx, ls, y + h / 2 - alto(ls) / 2);
    });
  },

  cierre(ctx, t) {
    fondo(ctx, C.banana);
    rayos(ctx, 360, 640, t, C.bananaSoft, 16, 1600);
    coach(ctx, t, SENALA, 400, 1040, 820, { delay: 0, desde: "izq", jab: 22, giro: 0.04 });
    const late = t > 0.9 ? 1 + 0.035 * Math.max(0, Math.sin((t - 0.9) * Math.PI * 2 * 1.2)) : 1;
    ctx.save(); ctx.translate(W / 2, 1165); ctx.scale(late, late); ctx.translate(-W / 2, -1165);
    golpeTexto(ctx, golpe(t, 0.25), 1165, () => {
      const x = 72, y = 1050, w = W - 144, h = 230;
      ctx.save(); ctx.shadowColor = "rgba(27,21,5,0.35)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
      ctx.fillStyle = C.ink; rrect(ctx, x, y, w, h, 999); ctx.fill(); ctx.restore();
      lineas(ctx, BOTON.map((b) => ({ t: b, size: 64, color: C.card })), y + h / 2 - alto([{ size: 64 }, { size: 64 }], 0.02) / 2, { gap: 0.02 });
    });
    ctx.restore();
    conEntrada(ctx, entra(t, 0.35), () => logo(ctx, W / 2, 1380, 130));
  },
};

// ---------- Salidas ----------

const COLOR_CORTE = { gancho: C.ink, pierdes: C.banana, app: C.ink, web: C.banana, como: C.ink, fuerza: C.banana, captura: C.ink, zoom: C.banana, shield: C.ink, cuida: C.banana, plan: C.ink, aviso: C.banana };
const T_CORTE = 0.14;
/** Cortinilla entre escenas: cubre en los últimos T_CORTE s de una y descubre en los primeros de la siguiente. El aviso no se tapa. */
function pasoDeEscena(ctx, escenas, e, seg) {
  const i = escenas.indexOf(e), t = seg - e.inicio;
  const sale = t > e.dur - T_CORTE && i < escenas.length - 1 && !ESCENAS[e.id].aviso;
  const entraDe = i > 0 && t < T_CORTE && !ESCENAS[e.id].aviso ? escenas[i - 1] : null;
  if (sale) cortinilla(ctx, ((t - (e.dur - T_CORTE)) / T_CORTE) * 0.5, COLOR_CORTE[e.id] ?? C.ink);
  else if (entraDe) cortinilla(ctx, 0.5 + (t / T_CORTE) * 0.5, COLOR_CORTE[entraDe.id] ?? C.ink);
}

function lineaDeTiempo(corte) {
  let inicio = 0;
  return CORTES[corte].map(([id, dur, pasos]) => { const e = { id, dur, pasos, inicio }; inicio += dur; return e; });
}

async function video(corte) {
  const escenas = lineaDeTiempo(corte);
  const total = escenas.at(-1).inicio + escenas.at(-1).dur;
  const cuadros = Math.round(total * FPS);
  const ffmpeg = process.env.FFMPEG ?? (await import("@ffmpeg-installer/ffmpeg").then((m) => m.default.path).catch(() => "ffmpeg"));
  const out = resolve(SALIDA, `${corte}.mp4`);
  const proc = spawn(ffmpeg, [
    "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-",
    "-an", "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-r", String(FPS), "-movflags", "+faststart", "-metadata", "title=R02 Bajaste rápido... ¿y tu músculo?", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const fin = new Promise((ok, mal) => proc.on("close", (c) => (c ? mal(new Error(`ffmpeg salió con ${c}`)) : ok())));
  const canvas = createCanvas(W, H), ctx = canvas.getContext("2d");
  for (let f = 0; f < cuadros; f++) {
    const seg = f / FPS;
    const e = escenas.findLast((x) => seg >= x.inicio - 1e-9);
    ctx.save();
    DIBUJO[e.id](ctx, seg - e.inicio, e.dur, e.pasos);
    ctx.restore();
    pasoDeEscena(ctx, escenas, e, seg);
    const px = ctx.getImageData(0, 0, W, H).data;
    if (!proc.stdin.write(Buffer.from(px.buffer, px.byteOffset, px.byteLength))) await new Promise((r) => proc.stdin.once("drain", r));
  }
  proc.stdin.end();
  await fin;
  console.log(`${corte}.mp4: ${cuadros} cuadros, ${total} s`);
}

function portada() {
  const canvas = createCanvas(W, H), ctx = canvas.getContext("2d");
  fondo(ctx, C.banana);
  // Todo vive dentro del recorte 1080x1350 centrado (y de 285 a 1635).
  const ls = ESCENAS.gancho.texto.map((t, i) => ({ t, size: 150, color: i === 2 ? C.banana : C.ink, marca: i === 2 ? C.ink : null }));
  lineas(ctx, ls, 330, { gap: 0.1 });
  const s = 640;
  ctx.drawImage(COACH, W / 2 - s / 2, 870, s, s);
  font(ctx, 46, 600);
  ctx.fillStyle = C.ink; ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText(AVISO, W / 2, 1545);
  writeFileSync(resolve(SALIDA, "R02_musculo-glp1_portada.png"), canvas.toBuffer("image/png"));
  console.log("R02_musculo-glp1_portada.png");
}

/** Cuadros sueltos en PNG para revisar: node render.mjs cuadro <corte> <segundo> */
function cuadro(corte, seg) {
  const e = lineaDeTiempo(corte).findLast((x) => seg >= x.inicio - 1e-9);
  const canvas = createCanvas(W, H), ctx = canvas.getContext("2d");
  DIBUJO[e.id](ctx, seg - e.inicio, e.dur, e.pasos);
  pasoDeEscena(ctx, lineaDeTiempo(corte), e, seg);
  const out = resolve(process.env.TMPDIR ?? "/tmp", `R02_${corte}_${seg}.png`);
  writeFileSync(out, canvas.toBuffer("image/png"));
  console.log(out);
}

const [, , que = "todo", ...resto] = process.argv;
if (que === "cuadro") cuadro(resto[0], Number(resto[1]));
else {
  if (que === "todo" || que === "portada") portada();
  for (const corte of Object.keys(CORTES)) if (que === "todo" || que === corte) await video(corte);
}
