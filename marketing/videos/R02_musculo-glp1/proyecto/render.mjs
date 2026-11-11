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

function hook(ctx, escala = 1) {
  const [a, b, c] = ESCENAS.gancho.texto;
  const ls = [
    { t: a, size: 210, color: C.ink },
    { t: b, size: 210, color: C.ink },
    { t: c, size: 210, color: C.banana, marca: C.ink },
  ];
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(escala, escala);
  ctx.translate(-W / 2, -H / 2);
  lineas(ctx, ls, (SAFE.top + SAFE.bottom) / 2 - alto(ls, 0.12) / 2, { gap: 0.12 });
  ctx.restore();
}

const DIBUJO = {
  // Cuadro 0 ya trae el gancho completo: sin animación de entrada, solo un acercamiento lento.
  gancho(ctx, t, dur) {
    fondo(ctx, C.banana);
    franjas(ctx, t, C.bananaSoft, 90);
    // El texto está completo desde el cuadro 0; un golpe de cámara y un acercamiento lento le dan energía.
    ctx.save();
    sacude(ctx, t, 16, 0.28);
    ctx.translate(0, -170);
    hook(ctx, 1.04 - 0.04 * golpe(t, 0, 0.3) + 0.05 * easeOut(t / dur));
    ctx.restore();
    // Coach Banana sube desde abajo, se asoma y mira el texto
    coach(ctx, t, COACH, W - 250, H - 150, 760, { delay: 0.25, voltear: true, giro: -0.05 });
  },

  pierdes(ctx, t) {
    fondo(ctx, C.ink);
    const [a, b, c] = ESCENAS.pierdes.texto;
    const ls = [{ t: a, size: 130, color: C.cream }, { t: b, size: 130, color: C.cream }];
    const y0 = 820 - alto(ls) / 2;
    conEntrada(ctx, entra(t), () => lineas(ctx, ls, y0));
    conEntrada(ctx, entra(t, 0.25), () => lineas(ctx, [{ t: c, size: 230, color: C.banana }], y0 + alto(ls) + 30));
  },

  // 1. Entrena poco y constante: Coach Banana con la pantalla Hoy del primer entreno
  app(ctx, t) {
    fondo(ctx, C.banana);
    franjas(ctx, t, C.bananaSoft, 110);
    const [a, b, c] = ESCENAS.app.texto;
    conEntrada(ctx, entra(t), () => lineas(ctx, [{ t: a, size: 130, color: C.ink }], SAFE.top + 10));
    conEntrada(ctx, entra(t, 0.1), () => lineas(ctx, [{ t: b, size: 110, color: C.ink }], SAFE.top + 170));
    golpeTexto(ctx, golpe(t, 0.25), SAFE.top + 400, () => lineas(ctx, [{ t: c, size: 170, color: C.banana, marca: C.ink }], SAFE.top + 310));
    // Teléfono con Hoy del primer día, que sube con rebote
    // Tarjeta real "Tu primer entreno" (Hoy, primer día), grande y legible
    const ancho = 640, x = W - ancho - 60, y = 820, pt = golpe(t, 0.3, 0.45);
    ctx.save(); ctx.globalAlpha *= clamp(pt * 1.5);
    ctx.translate(0, (1 - pt) * 400); ctx.translate(x + ancho / 2, y + 260); ctx.rotate(0.04 + (1 - pt) * 0.15); ctx.translate(-(x + ancho / 2), -(y + 260));
    telefono(ctx, x, y, ancho, HOY);
    ctx.restore();
    coach(ctx, t, SENALA, 230, H - 30, 640, { delay: 0.15, desde: "izq", jab: 16 });
  },

  // 2. Cómo lo hace: una captura real por línea (peso sugerido, cómo se hace, descanso)
  como(ctx, t, dur) {
    fondo(ctx, C.paper);
    franjas(ctx, t, "rgba(255,214,10,0.16)", 70);
    const lin = ESCENAS.como.texto, pantallas = [GUIA, COMO, DESCANSO], paso = dur / 3;
    const k = Math.min(2, Math.floor(t / paso)), tk = t - k * paso;
    // Lista: la línea activa en negro con marcador banana, las anteriores en gris
    lin.forEach((l, i) => {
      if (i > k) return;
      const activa = i === k, y = SAFE.top + i * 110;
      const dibuja = () => lineas(ctx, [{ t: l, size: 88, color: activa ? C.ink : C.bananaInk, marca: activa ? C.banana : null }], y);
      if (activa) golpeTexto(ctx, golpe(tk, 0, 0.3), y + 50, dibuja); else dibuja();
    });
    // Teléfono que cambia de pantalla con un giro rápido en cada línea
    const ancho = 470, x = (W - ancho) / 2 + 110, giro = 1 - golpe(tk, 0, 0.32);
    ctx.save();
    ctx.translate(x + ancho / 2, 1200); ctx.rotate(giro * (k % 2 ? -0.18 : 0.18)); ctx.scale(1 - 0.12 * giro, 1 - 0.12 * giro);
    ctx.translate(-(x + ancho / 2), -1200);
    telefono(ctx, x, 620, ancho, pantallas[k]);
    ctx.restore();
    coach(ctx, t, SENALA, 140, H - 30, 640, { delay: 0.1, desde: "izq", jab: 14 });
  },

  captura(ctx, t) {
    fondo(ctx, C.paper);
    franjas(ctx, t, "rgba(255,214,10,0.16)", 70);
    const [a, b] = ESCENAS.captura.texto;
    conEntrada(ctx, entra(t), () => lineas(ctx, [{ t: a, size: 96, color: C.ink }], SAFE.top));
    golpeTexto(ctx, golpe(t, 0.15), SAFE.top + 170, () => lineas(ctx, [{ t: b, size: 110, color: C.ink, marca: C.banana }], SAFE.top + 110));
    const ancho = 450, x = (W - ancho) / 2 + 120;
    // El teléfono sube con rebote y se inclina apenas
    const pt = golpe(t, 0.08, 0.45);
    ctx.save();
    ctx.globalAlpha *= clamp(pt * 1.5);
    ctx.translate(x + ancho / 2, 520 + 500);
    ctx.rotate((1 - pt) * 0.12 + 0.015 * Math.sin(t * 3));
    ctx.translate(-(x + ancho / 2), -(520 + 500) + (1 - pt) * 300);
    telefono(ctx, x, 560, ancho);
    ctx.restore();
    // Coach Banana se asoma por la izquierda y señala la pantalla
    coach(ctx, t, SENALA, 150, H - 60, 700, { delay: 0.3, desde: "izq", jab: 14 });
  },

  zoom(ctx, t) {
    fondo(ctx, C.paper);
    conEntrada(ctx, entra(t), () => lineas(ctx, [{ t: ESCENAS.zoom.texto[0], size: 80, color: C.ink }], SAFE.top + 40));
    // Tarjeta "Te quedan" de la captura real, ampliada
    const src = { x: 34, y: 338, w: 712, h: 576 };
    const p = entra(t, 0, 0.45);
    const anchoFinal = 960, anchoIni = 470 * (src.w / 780);
    const w = anchoIni + (anchoFinal - anchoIni) * p, h = (w * src.h) / src.w;
    const x = (W - w) / 2, y = 960 - h / 2 + 40;
    sombra(ctx, () => { ctx.fillStyle = C.card; rrect(ctx, x, y, w, h, 48); ctx.fill(); });
    ctx.save();
    rrect(ctx, x, y, w, h, 48); ctx.clip();
    ctx.drawImage(CAPTURA, src.x, src.y, src.w, src.h, x, y, w, h);
    ctx.restore();
    // Anillo banana sobre "Te faltan... de proteína"
    const k = w / src.w, pulso = entra(t, 0.5);
    ctx.save();
    ctx.globalAlpha = pulso;
    ctx.strokeStyle = C.banana;
    ctx.lineWidth = 10;
    rrect(ctx, x + (74 - src.x) * k - 10, y + (704 - src.y) * k - 10, 632 * k + 20, 168 * k + 20, 40);
    ctx.stroke();
    ctx.restore();
  },

  fuerza(ctx, t) {
    fondo(ctx, C.ink);
    // Rayos tenues y mancuernas que caen girando
    rayos(ctx, W / 2, 760, t, "rgba(255,214,10,0.06)");
    [[170, 0.1, 1], [910, 0.22, -1], [820, 0.34, 1]].forEach(([mx, d, s], i) => {
      const pm = golpe(t, d, 0.5);
      ctx.save(); ctx.globalAlpha = clamp(pm * 1.5);
      mancuerna(ctx, mx, 330 + i * 40 + (1 - pm) * -500, 150, C.banana, s * (1 - pm) * 3 + s * 0.2 * Math.sin(t * 2));
      ctx.restore();
    });
    const [a, b, c] = ESCENAS.fuerza.texto;
    ctx.save();
    sacude(ctx, t - 0.15, 12, 0.25);
    conEntrada(ctx, entra(t), () => lineas(ctx, [{ t: a, size: 104, color: C.cream }], 440));
    golpeTexto(ctx, golpe(t, 0.15), 760, () => lineas(ctx, [{ t: b, size: 360, color: C.banana }], 580));
    conEntrada(ctx, entra(t, 0.3), () => lineas(ctx, [{ t: c, size: 104, color: C.cream }], 830));
    ctx.restore();
    // Coach Banana sube desde abajo, firme
    coach(ctx, t, COACH, W / 2, H + 120, 760, { delay: 0.35 });
  },

  shield(ctx, t) {
    fondo(ctx, C.paper);
    rayos(ctx, W / 2, 620, t, "rgba(255,214,10,0.22)", 12, 900);
    const [a, b, c] = ESCENAS.shield.texto;
    // Coach Banana detrás del escudo, que aparece de golpe con un destello
    coach(ctx, t, COACH, W / 2, 1000, 760, { delay: 0 });
    const ps = golpe(t, 0.12, 0.4);
    const s = 360 * ps;
    if (ps > 0) {
      const anillo = clamp((t - 0.2) / 0.35);
      ctx.save(); ctx.globalAlpha = 1 - anillo; ctx.strokeStyle = C.banana; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.arc(W / 2, 640, 160 + anillo * 260, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      escudo(ctx, W / 2, 640, s, C.banana, C.ink);
    }
    ctx.save(); ctx.translate(0, 120);
    // Placa paper detrás del texto para que se lea sobre Coach Banana
    conEntrada(ctx, entra(t, 0.1), () => {
      ctx.fillStyle = C.cream; rrect(ctx, 72, 840, W - 144, 440, 48); ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 3; rrect(ctx, 72, 840, W - 144, 440, 48); ctx.stroke();
      lineas(ctx, [{ t: a, size: 96, color: C.ink }], 870);
    });
    golpeTexto(ctx, golpe(t, 0.2), 1040, () => lineas(ctx, [{ t: b, size: 104, color: C.ink, marca: C.banana }], 985));
    conEntrada(ctx, entra(t, 0.35), () => lineas(ctx, [{ t: c, size: 80, color: C.body }], 1135));
    ctx.restore();
  },

  aviso(ctx, t) {
    fondo(ctx, C.ink);
    conEntrada(ctx, entra(t), () => escudo(ctx, W / 2, 560, 300, C.banana, C.ink));
    // El aviso entra casi de inmediato (en 0.2 s ya es legible) y se queda toda la escena.
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
    // Coach Banana (pose "señala") entra con rebote y señala el botón
    coach(ctx, t, SENALA, 400, 1040, 820, { delay: 0, desde: "izq", jab: 22, giro: 0.04 });
    // El botón late una vez que está en su lugar
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

const COLOR_CORTE = { gancho: C.ink, pierdes: C.banana, app: C.ink, como: C.banana, fuerza: C.banana, captura: C.ink, zoom: C.ink, shield: C.ink, aviso: C.banana };
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
  return CORTES[corte].map(([id, dur]) => { const e = { id, dur, inicio }; inicio += dur; return e; });
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
    DIBUJO[e.id](ctx, seg - e.inicio, e.dur);
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
  DIBUJO[e.id](ctx, seg - e.inicio, e.dur);
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
