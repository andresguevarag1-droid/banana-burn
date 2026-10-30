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
const COACH = await loadImage(resolve(REPO, "public/brand/mascota-sola.webp"));
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

function telefono(ctx, x, y, anchoPantalla) {
  const b = 18, h = (anchoPantalla * CAPTURA.height) / CAPTURA.width;
  sombra(ctx, () => { ctx.fillStyle = C.ink; rrect(ctx, x - b, y - b, anchoPantalla + 2 * b, h + 2 * b, 42 + b); ctx.fill(); });
  ctx.save();
  rrect(ctx, x, y, anchoPantalla, h, 42);
  ctx.clip();
  ctx.drawImage(CAPTURA, x, y, anchoPantalla, h);
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

function icono(ctx, tipo, cx, cy, s) {
  ctx.save();
  ctx.fillStyle = C.banana;
  ctx.beginPath(); ctx.arc(cx, cy, s / 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink; ctx.lineWidth = s * 0.07; ctx.lineCap = "round";
  if (tipo === "proteina") {
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.03, s * 0.2, s * 0.27, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (tipo === "fuerza") {
    mancuerna(ctx, cx, cy, s * 0.55, C.ink);
  } else {
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const x = cx - s * 0.26 + (s * 0.52 * i) / 40, y = cy + Math.sin((i / 40) * Math.PI * 2) * s * 0.1;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
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
    hook(ctx, 1 + 0.04 * easeOut(t / dur));
  },

  pierdes(ctx, t) {
    fondo(ctx, C.ink);
    const [a, b, c] = ESCENAS.pierdes.texto;
    const ls = [{ t: a, size: 130, color: C.cream }, { t: b, size: 130, color: C.cream }];
    const y0 = 820 - alto(ls) / 2;
    conEntrada(ctx, entra(t), () => lineas(ctx, ls, y0));
    conEntrada(ctx, entra(t, 0.25), () => lineas(ctx, [{ t: c, size: 230, color: C.banana }], y0 + alto(ls) + 30));
  },

  proteina(ctx, t) {
    fondo(ctx, C.paper);
    const [a, b, c] = ESCENAS.proteina.texto;
    const top = [{ t: a, size: 110, color: C.ink }];
    const mid = [{ t: b, size: 190, color: C.ink, marca: C.banana }];
    const bot = [{ t: c, size: 110, color: C.ink }];
    const y0 = 900 - (alto(top) + alto(mid, 0.3) + alto(bot)) / 2;
    conEntrada(ctx, entra(t), () => lineas(ctx, top, y0));
    conEntrada(ctx, entra(t, 0.15), () => lineas(ctx, mid, y0 + alto(top) + 20, { gap: 0.3 }));
    conEntrada(ctx, entra(t, 0.3), () => lineas(ctx, bot, y0 + alto(top) + alto(mid, 0.3) + 20));
  },

  captura(ctx, t) {
    fondo(ctx, C.paper);
    const [a, b] = ESCENAS.captura.texto;
    conEntrada(ctx, entra(t), () => lineas(ctx, [{ t: a, size: 76, color: C.ink }, { t: b, size: 76, color: C.ink }], SAFE.top + 20));
    const ancho = 470, x = (W - ancho) / 2;
    conEntrada(ctx, entra(t, 0.1, 0.45), () => telefono(ctx, x, 520, ancho), 120);
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
    const [a, b, c] = ESCENAS.fuerza.texto;
    conEntrada(ctx, entra(t), () => lineas(ctx, [{ t: a, size: 104, color: C.cream }], 420));
    conEntrada(ctx, entra(t, 0.15), () => lineas(ctx, [{ t: b, size: 520, color: C.banana }], 560));
    conEntrada(ctx, entra(t, 0.3), () => lineas(ctx, [{ t: c, size: 104, color: C.cream }], 1180));
  },

  entrena(ctx, t, dur) {
    fondo(ctx, C.banana);
    conEntrada(ctx, entra(t), () => mancuerna(ctx, W / 2, 520, 360, C.ink, -0.12 + 0.12 * easeOut(t / dur)));
    const ls = ESCENAS.entrena.texto.map((s) => ({ t: s, size: 130, color: C.ink }));
    conEntrada(ctx, entra(t, 0.15), () => lineas(ctx, ls, 760));
  },

  shield(ctx, t) {
    fondo(ctx, C.paper);
    const [a, b] = ESCENAS.shield.texto;
    const s = 340 * (0.9 + 0.1 * entra(t, 0, 0.4));
    conEntrada(ctx, entra(t), () => escudo(ctx, W / 2, 620, s, C.banana, C.ink));
    conEntrada(ctx, entra(t, 0.15), () => lineas(ctx, [{ t: a, size: 140, color: C.ink }], 880));
    conEntrada(ctx, entra(t, 0.3), () => lineas(ctx, [{ t: b, size: 96, color: C.body }], 1060));
  },

  pilares(ctx, t) {
    fondo(ctx, C.paper);
    const tipos = ["proteina", "fuerza", "suave"];
    const altoCard = 250, gap = 44, y0 = (SAFE.top + SAFE.bottom) / 2 - (3 * altoCard + 2 * gap) / 2;
    ESCENAS.pilares.texto.forEach((txt, i) => {
      conEntrada(ctx, entra(t, i * 0.2), () => {
        const y = y0 + i * (altoCard + gap), x = 72, w = W - 144;
        sombra(ctx, () => { ctx.fillStyle = C.card; rrect(ctx, x, y, w, altoCard, 48); ctx.fill(); });
        ctx.strokeStyle = C.line; ctx.lineWidth = 3; rrect(ctx, x, y, w, altoCard, 48); ctx.stroke();
        icono(ctx, tipos[i], x + 70 + 70, y + altoCard / 2, 150);
        font(ctx, 92, 800);
        ctx.fillStyle = C.ink; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(txt, x + 260, y + altoCard / 2 + 6);
      }, 60);
    });
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
    // Coach Banana entra desde la izquierda
    const pc = entra(t, 0, 0.4);
    ctx.save();
    ctx.globalAlpha = pc;
    ctx.translate((1 - pc) * -160, 0);
    const s = 780;
    ctx.drawImage(COACH, W / 2 - s / 2, SAFE.top - 30, s, s);
    ctx.restore();
    conEntrada(ctx, entra(t, 0.2), () => {
      const x = 72, y = 1050, w = W - 144, h = 230;
      ctx.save(); ctx.shadowColor = "rgba(27,21,5,0.35)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
      ctx.fillStyle = C.ink; rrect(ctx, x, y, w, h, 999); ctx.fill(); ctx.restore();
      lineas(ctx, BOTON.map((b) => ({ t: b, size: 64, color: C.card })), y + h / 2 - alto([{ size: 64 }, { size: 64 }], 0.02) / 2, { gap: 0.02 });
    });
    conEntrada(ctx, entra(t, 0.35), () => logo(ctx, W / 2, 1380, 130));
  },
};

// ---------- Salidas ----------

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
