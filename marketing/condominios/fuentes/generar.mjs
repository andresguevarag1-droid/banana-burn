// Genera el one-pager (A4) y la presentación corta (6 diapositivas 16:9) para la junta directiva de un condominio.
// Uso: cd marketing/condominios/fuentes && npm install && npm run generar
// Salida: ../one-pager-junta.pdf y ../presentacion-junta.pdf
// Reglas (banana-burn-marca y banana-burn-harvey): solo Plus Jakarta Sans, banana #FFD60A, tinta #1B1505, de tú,
// sin emojis, sin rayas largas, sin hablar de inteligencia artificial, sin teléfonos ni WhatsApp, sin testimonios ni
// cifras inventadas. Las imágenes son capturas reales de la app (public/landing) y el icono real (assets/icon-only.png).
// La oferta no cambia: primer mes gratis para todos los residentes, la administración nunca paga, cada residente
// paga su plan después.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const OUT = path.resolve(HERE, "..");
const FONTS = path.join(HERE, "node_modules/@fontsource/plus-jakarta-sans/files");

// Tokens de src/app/globals.css
const C = {
  banana: "#FFD60A", bananaSoft: "#FFF1A8", ink: "#1B1505", body: "#2E2818", paper: "#FFF8E3", cream: "#FFFBF0",
  card: "#FFFFFF", muted: "#6A604B", line: "#EDE3C6", bananaInk: "#8A6200", emberInk: "#8A5300", peel: "#3F6B0E",
};

const SHOT = {
  hoy: path.join(ROOT, "public/landing/hoy2.png"),
  entreno: path.join(ROOT, "public/landing/entreno.png"),
  nutricion: path.join(ROOT, "public/landing/nutricion.png"),
  coach: path.join(ROOT, "public/landing/coach.png"),
};
const ICON = path.join(ROOT, "assets/icon-only.png");
const SHOT_RATIO = 1688 / 780;

// Textos compartidos por las dos piezas
const NO_PAGAN = "La administración y el condominio no pagan nada.";
const DECIDE = "Cada residente decide si sigue con su plan individual";
const LANDING = "bananaburn.app/condominios";
const CORREO = "hola@bananaburn.app";

const PROBLEMS = [
  ["Máquinas que nadie sabe usar", "La mayoría entra, ve los aparatos y no sabe por dónde empezar. Al final usan la caminadora o no vuelven."],
  ["Un entrenador cuesta caro", "Pagar un entrenador personal todos los meses no está al alcance de todos los residentes."],
  ["Sin plan, la gente deja de ir", "Entrenar sin saber qué hacer ni cuánto peso usar aburre rápido, y el gimnasio se queda vacío."],
];

const FEATURES = [
  ["Su plan de cada semana", "Series, repeticiones y el peso de cada serie. Si cumple, la próxima vez sube."],
  ["La técnica de cada ejercicio", "Animada por Coach Banana, con los pasos de cada movimiento."],
  ["Coach Banana a cualquier hora", "Un chat que conoce su plan y sus entrenos y responde sus dudas."],
  ["Plan de comidas", "Con lo que ya come, ajustado cada semana. Incluido durante el primer mes."],
  ["En el gimnasio o en casa", "Con máquinas, mancuernas, bandas o sin equipo."],
];

const STEPS = [
  ["Reunión virtual de 30 minutos", "Te mostramos la app por dentro y resolvemos las dudas de la administración o la junta.", "Te mostramos la app y resolvemos las dudas de la junta."],
  ["Activamos el condominio", "Te damos su enlace exclusivo, un afiche A4 con código QR y un mensaje listo para el grupo de residentes.", "Te damos su enlace, el afiche A4 con QR y el mensaje para los residentes."],
  ["Los residentes se registran", "Cada uno entra desde su celular con el enlace del condominio. Primer mes gratis, con todo incluido y sin tarjeta.", "Entran desde su celular con el enlace. Primer mes gratis y sin tarjeta."],
  ["Cada residente decide", "Al terminar el mes, quien quiera sigue con su plan y lo paga por su cuenta.", "Al terminar el mes, quien quiera sigue y paga su plan."],
];

const SEES = ["Cuántos residentes se unieron", "Cuántos entrenaron en la semana"];
const NEVER = ["Nombres ni datos personales", "Peso ni medidas", "Entrenamientos ni comidas"];

function newDoc(size) {
  const doc = new PDFDocument({ size, margin: 0, autoFirstPage: false, info: { Title: "", Author: "Banana Burn", Creator: "Banana Burn" } });
  for (const [name, w] of [["R", 400], ["SB", 600], ["B", 700], ["XB", 800]]) {
    doc.registerFont(name, path.join(FONTS, `plus-jakarta-sans-latin-${w}-normal.woff`));
  }
  return doc;
}

// Texto con tracking en em, como en el libro de marca
function text(doc, str, x, y, { font = "R", size = 11, color = C.body, width, track = 0, lineGap = 0, align = "left", tnum = false, continued = false } = {}) {
  doc.font(font).fontSize(size).fillColor(color);
  const opts = { width, align, lineGap, characterSpacing: track * size, continued, height: 5000 };
  if (tnum) opts.features = ["tnum"];
  doc.text(str, x, y, opts);
  return doc.y;
}

function box(doc, x, y, w, h, r, fill, stroke) {
  doc.save().roundedRect(x, y, w, h, r);
  if (fill && stroke) doc.lineWidth(1).fillAndStroke(fill, stroke);
  else if (fill) doc.fill(fill);
  else doc.lineWidth(1).stroke(stroke);
  doc.restore();
}

function logo(doc, x, y, s, { onDark = false } = {}) {
  doc.save().roundedRect(x, y, s, s, s * 0.24).clip().image(ICON, x, y, { width: s, height: s }).restore();
  const size = s * 0.5;
  doc.font("XB").fontSize(size).fillColor(onDark ? "#FFFFFF" : C.ink)
    .text("Banana", x + s * 1.3, y + (s - size * 1.26) / 2, { continued: true, characterSpacing: -0.02 * size })
    .fillColor(onDark ? C.banana : C.emberInk).text("Burn", { characterSpacing: -0.02 * size });
}

function chip(doc, str, x, y, { fill = C.ink, color = C.banana, size = 9, right = false } = {}) {
  doc.font("B").fontSize(size);
  const w = doc.widthOfString(str) + size * 2.4;
  const h = size * 2.6;
  const left = right ? x - w : x;
  box(doc, left, y, w, h, h / 2, fill);
  text(doc, str, left, y + (h - size * 1.26) / 2, { font: "B", size, color, width: w, align: "center" });
  return w;
}

function eyebrow(doc, str, x, y, color = C.bananaInk, size = 8.5) {
  return text(doc, str.toUpperCase(), x, y, { font: "B", size, color, track: 0.14 });
}

// Teléfono: marco tinta con la captura real recortada en esquinas redondas
function phone(doc, src, x, y, w) {
  const h = w * SHOT_RATIO;
  const pad = w * 0.035;
  const r = w * 0.15;
  doc.save().fillOpacity(0.10).roundedRect(x + 2, y + 6, w + pad * 2, h + pad * 2, r).fill(C.ink).restore();
  box(doc, x, y, w + pad * 2, h + pad * 2, r, C.ink);
  doc.save().roundedRect(x + pad, y + pad, w, h, r - pad).clip().image(src, x + pad, y + pad, { width: w, height: h }).restore();
  return { w: w + pad * 2, h: h + pad * 2 };
}

function numberDot(doc, n, x, y, d, { fill = C.ink, color = C.banana } = {}) {
  doc.save().circle(x + d / 2, y + d / 2, d / 2).fill(fill).restore();
  const size = d * 0.48;
  text(doc, String(n), x, y + (d - size * 1.26) / 2, { font: "XB", size, color, width: d, align: "center", tnum: true });
}

function check(doc, x, y, d, { fill = C.ink, color = C.banana } = {}) {
  doc.save().circle(x + d / 2, y + d / 2, d / 2).fill(fill).restore();
  doc.save().lineWidth(d * 0.13).lineCap("round").lineJoin("round").strokeColor(color)
    .moveTo(x + d * 0.3, y + d * 0.52).lineTo(x + d * 0.44, y + d * 0.66).lineTo(x + d * 0.71, y + d * 0.36).stroke().restore();
}

function cross(doc, x, y, d, { fill = C.line, color = C.ink } = {}) {
  doc.save().circle(x + d / 2, y + d / 2, d / 2).fill(fill).restore();
  doc.save().lineWidth(d * 0.12).lineCap("round").strokeColor(color)
    .moveTo(x + d * 0.34, y + d * 0.34).lineTo(x + d * 0.66, y + d * 0.66)
    .moveTo(x + d * 0.66, y + d * 0.34).lineTo(x + d * 0.34, y + d * 0.66).stroke().restore();
}

function finish(doc, file) {
  return new Promise((resolve) => {
    const stream = fs.createWriteStream(path.join(OUT, file));
    stream.on("finish", resolve);
    doc.pipe(stream);
    doc.end();
  });
}

/* ------------------------------------------------------------------ */
/* One-pager A4                                                        */
/* ------------------------------------------------------------------ */
function onePager() {
  const doc = newDoc("A4");
  doc.info.Title = "Banana Burn para condominios: resumen para la junta directiva";
  doc.addPage();
  const W = doc.page.width;
  const H = doc.page.height;
  const M = 36;
  const inner = W - M * 2;
  const gap = 14;
  const half = (inner - gap) / 2;
  const pad = 15;

  doc.rect(0, 0, W, H).fill(C.paper);

  // Portada en banana con dos capturas reales
  const bandH = 250;
  doc.rect(0, 0, W, bandH).fill(C.banana);
  logo(doc, M, 26, 28);
  chip(doc, "Para la junta directiva", W - M, 29, { right: true, size: 8.5 });

  const colW = 310;
  let y = text(doc, "Banana Burn para condominios", M, 80, { font: "B", size: 10, color: C.ink });
  y = text(doc, "Un entrenador personal para cada residente, sin contratar a nadie.", M, y + 6, { font: "XB", size: 25, color: C.ink, width: colW, track: -0.025, lineGap: -2 });
  y = text(doc, "Banana Burn le da uso real al gimnasio del condominio: cada residente recibe su plan, la técnica de cada ejercicio y a Coach Banana en su celular.", M, y + 8, { size: 10, color: C.ink, width: colW - 10, lineGap: 1.5 });
  const pw = 82;
  phone(doc, SHOT.hoy, W - M - pw * 2 - 18, 62, pw);
  phone(doc, SHOT.entreno, W - M - pw - 6, 72, pw);

  // El reto y lo que recibe cada residente
  y = bandH + 16;
  const rowH = 214;
  box(doc, M, y, half, rowH, 18, C.card, C.line);
  let cy = eyebrow(doc, "El reto", M + pad, y + pad, C.bananaInk, 8);
  cy = text(doc, "El gimnasio está ahí, pero casi nadie lo usa.", M + pad, cy + 4, { font: "XB", size: 13, color: C.ink, width: half - pad * 2, track: -0.015 });
  cy += 8;
  for (const [t, d] of PROBLEMS) {
    cy = text(doc, t, M + pad, cy, { font: "XB", size: 9, color: C.ink, width: half - pad * 2 });
    cy = text(doc, d, M + pad, cy + 1, { size: 8.3, color: C.body, width: half - pad * 2, lineGap: 0.5 }) + 6;
  }

  const fx = M + half + gap;
  box(doc, fx, y, half, rowH, 18, C.ink);
  cy = eyebrow(doc, "Lo que recibe cada residente", fx + pad, y + pad, C.banana, 8);
  cy += 6;
  for (const [t, d] of FEATURES) {
    check(doc, fx + pad, cy + 0.5, 10, { fill: C.banana, color: C.ink });
    const tx = fx + pad + 16;
    const tw = half - pad * 2 - 16;
    cy = text(doc, t, tx, cy, { font: "XB", size: 8.8, color: "#FFFFFF", width: tw });
    cy = text(doc, d, tx, cy + 0.5, { size: 8, color: C.cream, width: tw, lineGap: 0.3 }) + 5;
  }
  y += rowH + 16;

  // Cómo se activa en 4 pasos
  y = eyebrow(doc, "Cómo se activa en 4 pasos", M, y, C.bananaInk, 8) + 7;
  const stepGap = 10;
  const stepW = (inner - stepGap * 3) / 4;
  const stepH = 106;
  STEPS.forEach(([t, , short], i) => {
    const sx = M + i * (stepW + stepGap);
    box(doc, sx, y, stepW, stepH, 16, C.card, C.line);
    numberDot(doc, i + 1, sx + 11, y + 11, 18);
    const ty = text(doc, t, sx + 11, y + 35, { font: "XB", size: 8.8, color: C.ink, width: stepW - 22 });
    text(doc, short, sx + 11, ty + 2, { size: 8, color: C.body, width: stepW - 22, lineGap: 0.3 });
  });
  y += stepH + 14;

  // Quién paga y privacidad
  const payH = 112;
  box(doc, M, y, half, payH, 18, C.bananaSoft);
  cy = eyebrow(doc, "Quién paga", M + pad, y + pad, C.bananaInk, 8);
  cy = text(doc, NO_PAGAN, M + pad, cy + 4, { font: "XB", size: 12, color: C.ink, width: half - pad * 2, track: -0.01 });
  text(doc, `El primer mes es gratis para todos los residentes, con todo incluido y sin tarjeta. ${DECIDE}: Entreno $9.99 o Entreno + Nutrición $14.99 al mes, que paga por su cuenta.`, M + pad, cy + 5, { size: 8.3, color: C.ink, width: half - pad * 2, lineGap: 0.8, tnum: true });

  box(doc, fx, y, half, payH, 18, C.card, C.line);
  cy = eyebrow(doc, "Privacidad", fx + pad, y + pad, C.bananaInk, 8);
  cy = text(doc, "Los datos de cada residente son privados.", fx + pad, cy + 4, { font: "XB", size: 12, color: C.ink, width: half - pad * 2, track: -0.01 });
  text(doc, "La administración solo ve cuántos residentes se unieron y cuántos entrenaron en la semana. Nunca datos personales ni entrenamientos.", fx + pad, cy + 5, { size: 8.3, color: C.body, width: half - pad * 2, lineGap: 0.8 });
  y += payH + 14;

  // Siguiente paso
  const nextH = 54;
  box(doc, M, y, inner, nextH, 18, C.ink);
  cy = eyebrow(doc, "Siguiente paso", M + 18, y + 12, C.banana, 8);
  text(doc, "Agenda una reunión virtual de 30 minutos con Andrés.", M + 18, cy + 4, { font: "XB", size: 11.5, color: "#FFFFFF", width: 320, track: -0.01 });
  const rx = W - M - 18 - 200;
  text(doc, "Andrés Guevara, Fundador, Banana Burn", rx, y + 9, { font: "B", size: 8.5, color: C.banana, width: 200, align: "right" });
  text(doc, LANDING, rx, y + 22, { font: "XB", size: 10.5, color: "#FFFFFF", width: 200, align: "right" });
  text(doc, CORREO, rx, y + 36, { font: "SB", size: 9, color: C.cream, width: 200, align: "right" });

  text(doc, "Banana Burn es un producto de Atlas Resources SRL, Costa Rica. Capturas reales de la app.", M, H - 20, { size: 7, color: C.muted, width: inner, align: "center" });
  return finish(doc, "one-pager-junta.pdf");
}

/* ------------------------------------------------------------------ */
/* Presentación 16:9, 6 diapositivas                                   */
/* ------------------------------------------------------------------ */
function presentation() {
  const doc = newDoc([960, 540]);
  doc.info.Title = "Banana Burn para condominios: presentación para la junta directiva";
  const W = 960;
  const H = 540;
  const M = 56;
  const TOTAL = 6;

  function slide(n, bg = C.paper) {
    doc.addPage();
    doc.rect(0, 0, W, H).fill(bg);
    const dark = bg === C.ink;
    logo(doc, M, 34, 28, { onDark: dark });
    text(doc, `${n} de ${TOTAL}`, W - M - 120, 42, { font: "B", size: 10, color: dark ? C.cream : C.ink, width: 120, align: "right", tnum: true });
    text(doc, LANDING, M, H - 40, { font: "SB", size: 9.5, color: dark ? C.cream : bg === C.banana ? C.ink : C.muted });
  }

  function title(str, y, { width = 560, size = 40, color = C.ink } = {}) {
    return text(doc, str, M, y, { font: "XB", size, color, width, track: -0.03, lineGap: -size * 0.12 });
  }

  // 1. El problema del gimnasio sin uso
  slide(1, C.banana);
  chip(doc, "Banana Burn para condominios", M, 104, { size: 10 });
  let y = title("El gimnasio está ahí, pero casi nadie lo usa.", 148, { width: 430, size: 46 });
  text(doc, "Banana Burn lo convierte en el amenity más usado del condominio: cada residente recibe un entrenador personal en su celular.", M, y + 18, { size: 15, color: C.ink, width: 400, lineGap: 3 });
  const cx = 540;
  const cw = W - M - cx;
  let cy = 104;
  PROBLEMS.forEach(([t, d], i) => {
    const h = 106;
    box(doc, cx, cy, cw, h, 22, C.card);
    numberDot(doc, i + 1, cx + 20, cy + 20, 28);
    const ty = text(doc, t, cx + 62, cy + 22, { font: "XB", size: 15, color: C.ink, width: cw - 84, track: -0.01 });
    text(doc, d, cx + 62, ty + 4, { size: 11, color: C.body, width: cw - 84, lineGap: 2 });
    cy += h + 14;
  });

  // 2. Qué recibe cada residente
  slide(2);
  eyebrow(doc, "Lo que recibe cada residente", M, 98, C.bananaInk, 10);
  y = title("Todo lo que haría un entrenador personal, en su celular.", 116, { width: 430, size: 32 });
  y += 16;
  for (const [t, d] of FEATURES) {
    check(doc, M, y + 1, 16);
    const ty = text(doc, t, M + 26, y, { font: "XB", size: 12.5, color: C.ink, width: 390 });
    y = text(doc, d, M + 26, ty + 1, { size: 10.5, color: C.body, width: 390, lineGap: 1 }) + 9;
  }
  const shots = [[SHOT.entreno, "Entreno guiado"], [SHOT.nutricion, "Comida de hoy"], [SHOT.coach, "Coach Banana"]];
  const pw = 120;
  const sx0 = W - M - (pw + 8.4) * 3 - 24;
  shots.forEach(([src, cap], i) => {
    const px = sx0 + i * (pw + 8.4 + 12);
    const py = 92 + (i === 1 ? 0 : 16);
    const { w, h } = phone(doc, src, px, py, pw);
    text(doc, cap, px, py + h + 10, { font: "B", size: 10, color: C.ink, width: w, align: "center" });
  });

  // 3. Cómo se activa en 4 pasos
  slide(3);
  eyebrow(doc, "Cómo se activa", M, 98, C.bananaInk, 10);
  title("De la reunión a residentes entrenando, en 4 pasos.", 116, { width: 700, size: 36 });
  const gap = 16;
  const sw = (W - M * 2 - gap * 3) / 4;
  const sy = 214;
  const sh = 210;
  STEPS.forEach(([t, d], i) => {
    const x = M + i * (sw + gap);
    box(doc, x, sy, sw, sh, 24, i === 3 ? C.ink : C.card, i === 3 ? undefined : C.line);
    numberDot(doc, i + 1, x + 20, sy + 20, 36, i === 3 ? { fill: C.banana, color: C.ink } : {});
    const ty = text(doc, t, x + 20, sy + 74, { font: "XB", size: 15, color: i === 3 ? "#FFFFFF" : C.ink, width: sw - 40, track: -0.01 });
    text(doc, d, x + 20, ty + 6, { size: 11, color: i === 3 ? C.cream : C.body, width: sw - 40, lineGap: 2 });
  });
  text(doc, "Banana Burn hace la implementación. La parte de la administración es compartir el enlace con los residentes y colocar el afiche.", M, sy + sh + 22, { font: "SB", size: 12, color: C.ink, width: W - M * 2 });

  // 4. Quién paga
  slide(4);
  eyebrow(doc, "Quién paga", M, 98, C.bananaInk, 10);
  title(NO_PAGAN, 116, { width: 760, size: 36 });
  const pgap = 16;
  const pcw = (W - M * 2 - pgap * 2) / 3;
  const py = 214;
  const ph = 200;
  box(doc, M, py, pcw, ph, 24, C.banana);
  text(doc, "Primer mes", M + 24, py + 24, { font: "B", size: 12, color: C.ink });
  text(doc, "$0", M + 24, py + 44, { font: "XB", size: 52, color: C.ink, tnum: true, track: -0.03 });
  text(doc, "Para todos los residentes, con la app completa y sin tarjeta.", M + 24, py + 116, { font: "SB", size: 12, color: C.ink, width: pcw - 48, lineGap: 2 });
  [["Entreno", "$9.99", "Plan de entreno, técnica y Coach Banana."], ["Entreno + Nutrición", "$14.99", "Plan de entreno y plan de comidas."]].forEach(([n, p, d], i) => {
    const x = M + (i + 1) * (pcw + pgap);
    box(doc, x, py, pcw, ph, 24, C.card, C.line);
    text(doc, "Plan individual del residente", x + 24, py + 24, { font: "B", size: 10.5, color: C.muted });
    text(doc, n, x + 24, py + 42, { font: "XB", size: 18, color: C.ink, track: -0.01 });
    text(doc, p, x + 24, py + 70, { font: "XB", size: 30, color: C.ink, tnum: true, track: -0.02 });
    doc.font("XB").fontSize(30);
    const pwid = doc.widthOfString(p, { characterSpacing: -0.6, features: ["tnum"] });
    text(doc, "al mes", x + 24 + pwid + 6, py + 70 + 30 * 0.92 - 12 * 0.92, { font: "SB", size: 12, color: C.muted });
    text(doc, d, x + 24, py + 116, { font: "SB", size: 12, color: C.ink, width: pcw - 48, lineGap: 2 });
    text(doc, "Solo si el residente decide seguir.", x + 24, py + ph - 34, { size: 10.5, color: C.muted, width: pcw - 48 });
  });
  text(doc, `${DECIDE} y lo paga por su cuenta. No hay cobro automático: nadie deja tarjeta durante el mes gratis.`, M, py + ph + 22, { font: "SB", size: 12, color: C.ink, width: W - M * 2 });

  // 5. Privacidad
  slide(5);
  eyebrow(doc, "Privacidad", M, 98, C.bananaInk, 10);
  title("Los datos de cada residente son privados.", 116, { width: 760, size: 36 });
  text(doc, "Su peso, sus entrenos y su comida solo los ve esa persona.", M, 168, { size: 14, color: C.body, width: 700 });
  const vw = (W - M * 2 - 16) / 2;
  const vy = 214;
  const vh = 210;
  box(doc, M, vy, vw, vh, 24, C.ink);
  text(doc, "Lo que ve la administración", M + 28, vy + 28, { font: "XB", size: 17, color: C.banana, track: -0.01 });
  SEES.forEach((t, i) => {
    check(doc, M + 28, vy + 76 + i * 40, 22, { fill: C.banana, color: C.ink });
    text(doc, t, M + 62, vy + 78 + i * 40, { font: "SB", size: 14, color: "#FFFFFF", width: vw - 90 });
  });
  text(doc, "Solo números del condominio, para mostrar el uso a la junta.", M + 28, vy + vh - 46, { size: 11, color: C.cream, width: vw - 56 });
  const nx = M + vw + 16;
  box(doc, nx, vy, vw, vh, 24, C.card, C.line);
  text(doc, "Lo que nunca ve", nx + 28, vy + 28, { font: "XB", size: 17, color: C.ink, track: -0.01 });
  NEVER.forEach((t, i) => {
    cross(doc, nx + 28, vy + 76 + i * 40, 22);
    text(doc, t, nx + 62, vy + 78 + i * 40, { font: "SB", size: 14, color: C.ink, width: vw - 90 });
  });

  // 6. Siguiente paso
  slide(6, C.banana);
  eyebrow(doc, "Siguiente paso", M, 104, C.ink, 10);
  y = title("Agendemos una reunión virtual de 30 minutos.", 122, { width: 520, size: 44 });
  y = text(doc, "Andrés te muestra la app por dentro y cómo se implementa en el condominio. Puedes invitar a la junta directiva a la misma reunión.", M, y + 16, { size: 14, color: C.ink, width: 470, lineGap: 3 });
  y += 22;
  doc.font("XB").fontSize(14);
  const bw = doc.widthOfString(LANDING) + 48;
  box(doc, M, y, bw, 48, 24, C.ink);
  text(doc, LANDING, M, y + 15, { font: "XB", size: 14, color: "#FFFFFF", width: bw, align: "center" });
  y += 68;
  text(doc, "Andrés Guevara, Fundador, Banana Burn", M, y, { font: "XB", size: 13, color: C.ink });
  text(doc, CORREO, M, y + 20, { font: "SB", size: 12, color: C.ink });
  phone(doc, SHOT.hoy, W - M - 150 - 40, 70, 150);

  return finish(doc, "presentacion-junta.pdf");
}

await onePager();
await presentation();
console.log("Listo: one-pager-junta.pdf y presentacion-junta.pdf");
