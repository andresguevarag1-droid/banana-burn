// Genera las láminas del carrusel K14 (1080 × 1350) y las portadas alternativas.
// Uso (las dependencias van fuera del repo para no tocar package.json de la app):
//   mkdir -p /tmp/bb-render && cd /tmp/bb-render && npm init -y && npm i @resvg/resvg-js opentype.js wawoff2 @fontsource/plus-jakarta-sans
//   RENDER_DEPS=/tmp/bb-render node marketing/instagram/K14/generar.mjs
// Captura de la lámina 5: deja la captura real de Nutrición con Banana Shield activo en
// marketing/instagram/K14/captura-nutricion-shield.png y vuelve a correr el script. Sin ella sale el marcador [PENDIENTE].
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../..");
const DEPS = process.env.RENDER_DEPS || "/tmp/bb-render";
const req = createRequire(join(DEPS, "package.json"));
const { Resvg } = req("@resvg/resvg-js");
const opentype = req("opentype.js");
const wawoff2 = req("wawoff2");

const C = { banana: "#FFD60A", soft: "#FFF1A8", ink: "#1B1505", body: "#2E2818", paper: "#FFF8E3", cream: "#FFFBF0", card: "#FFFFFF", muted: "#6A604B", line: "#EDE3C6", bananaInk: "#8A6200", emberInk: "#8A5300" };
const W = 1080, H = 1350, M = 88;

// Plus Jakarta Sans (fontsource woff2 → ttf para resvg y para medir)
const FONT_DIR = join(DEPS, "node_modules/@fontsource/plus-jakarta-sans/files");
const fontFiles = [], fonts = {};
for (const w of [400, 600, 700, 800]) {
  const ttf = join(DEPS, `pjs-${w}.ttf`);
  if (!existsSync(ttf)) writeFileSync(ttf, Buffer.from(await wawoff2.decompress(readFileSync(join(FONT_DIR, `plus-jakarta-sans-latin-${w}-normal.woff2`)))));
  fontFiles.push(ttf);
  const buf = readFileSync(ttf);
  fonts[w] = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const tracking = (size, weight) => (weight === 800 ? (size >= 56 ? -0.03 : -0.02) * size : 0);
function measure(s, size, weight) {
  const f = fonts[weight], gs = [...s].map((ch) => f.charToGlyph(ch));
  let u = 0;
  gs.forEach((g, i) => { u += g.advanceWidth + (i < gs.length - 1 ? f.getKerningValue(g, gs[i + 1]) : 0); });
  return (u * size) / f.unitsPerEm + tracking(size, weight) * s.length;
}

/**
 * Texto con salto de línea automático. "**palabra**" se resalta: fondo banana sobre claro,
 * píldora ink con texto banana sobre banana, texto banana sobre ink. "\n" fuerza salto.
 * Devuelve { svg, bottom }.
 */
function text(src, { x = M, y, size, weight = 800, fill = C.ink, maxW = W - 2 * M, lh = 1.12, hl = "light", anchor = "start" }) {
  const words = [];
  let on = false;
  for (const part of src.split(/(\*\*|\n)/)) {
    if (part === "**") { on = !on; continue; }
    if (part === "\n") { words.push({ br: true }); continue; }
    for (const w of part.split(" ")) if (w) words.push({ t: w, hl: on });
  }
  const lines = [[]];
  for (const w of words) {
    if (w.br) { lines.push([]); continue; }
    const cur = lines[lines.length - 1];
    const trial = [...cur, w].map((p) => p.t).join(" ");
    const extra = [...cur, w].filter((p) => p.hl).length * size * 0.3;
    if (cur.length && measure(trial, size, weight) + extra > maxW) lines.push([w]); else cur.push(w);
  }
  const ls = tracking(size, weight);
  let out = "", base = y + size * 0.8;
  for (const line of lines) {
    const full = line.map((p) => p.t).join(" ");
    let cx = anchor === "middle" ? x - measure(full, size, weight) / 2 : x;
    for (let i = 0; i < line.length; i++) {
      const p = line[i], t = p.t + (i < line.length - 1 ? " " : "");
      if (p.hl && i > 0 && hl !== "onInk") cx += size * 0.12;
      const wWord = measure(p.t, size, weight);
      let color = fill;
      if (p.hl) {
        if (hl === "light") out += `<rect x="${cx - size * 0.12}" y="${base - size * 0.82}" width="${wWord + size * 0.24}" height="${size * 1.04}" rx="${size * 0.16}" fill="${C.banana}"/>`;
        if (hl === "onBanana") { out += `<rect x="${cx - size * 0.14}" y="${base - size * 0.84}" width="${wWord + size * 0.28}" height="${size * 1.08}" rx="${size * 0.2}" fill="${C.ink}"/>`; color = C.banana; }
        if (hl === "onInk") color = C.banana;
      }
      out += `<text x="${cx}" y="${base}" font-family="Plus Jakarta Sans" font-size="${size}" font-weight="${weight}" letter-spacing="${ls}" fill="${color}" xml:space="preserve">${esc(t)}</text>`;
      cx += measure(t, size, weight) + (p.hl && hl !== "onInk" ? size * 0.18 : 0);
    }
    base += size * lh;
  }
  return { svg: out, bottom: y + size * lh * lines.length - size * (lh - 1) };
}

const eyebrow = (s, y, fill = C.bananaInk, x = M) =>
  `<text x="${x}" y="${y + 22}" font-family="Plus Jakarta Sans" font-size="26" font-weight="700" letter-spacing="${26 * 0.14}" fill="${fill}">${esc(s.toUpperCase())}</text>`;

const LOGO = readFileSync(join(ROOT, "public/icons/logo.svg"), "utf8").replace("<svg ", "<svg x=\"{X}\" y=\"{Y}\" width=\"{S}\" height=\"{S}\" ");
const logo = (x, y, s) => LOGO.replace("{X}", x).replace("{Y}", y).replaceAll("{S}", s);

function header(n, dark) {
  const banana = dark ? C.cream : C.ink;
  const w1 = measure("Banana", 34, 800);
  return logo(M, 64, 60) +
    `<text x="${M + 76}" y="${64 + 42}" font-family="Plus Jakarta Sans" font-size="34" font-weight="800" letter-spacing="${-0.02 * 34}" fill="${banana}">Banana</text>` +
    `<text x="${M + 76 + w1}" y="${64 + 42}" font-family="Plus Jakarta Sans" font-size="34" font-weight="800" letter-spacing="${-0.02 * 34}" fill="${dark ? C.banana : C.emberInk}">Burn</text>` +
    `<text x="${W - M}" y="${64 + 42}" text-anchor="end" font-family="Plus Jakarta Sans" font-size="28" font-weight="700" fill="${dark ? C.cream : C.ink}" style="font-variant-numeric: tabular-nums">${n}/6</text>`;
}

const footer = (fill) =>
  `<text x="${M}" y="${H - 64}" font-family="Plus Jakarta Sans" font-size="26" font-weight="600" fill="${fill}">No sustituye la indicación de tu médico.</text>`;

const shadow = `<filter id="soft" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#1B1505" flood-opacity="0.10"/></filter>
<filter id="lift" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="26" stdDeviation="24" flood-color="#1B1505" flood-opacity="0.20"/></filter>`;

const card = (x, y, w, h, fill = C.card) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="${fill}" stroke="${C.line}" stroke-width="2" filter="url(#soft)"/>`;

const svgDoc = (bg, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${shadow}</defs><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`;

const dataUri = (file) => {
  const png = file.endsWith(".png") ? readFileSync(file) : execFileSync("convert", [file, "png:-"]);
  return `data:image/png;base64,${png.toString("base64")}`;
};
const MASCOT = dataUri(join(ROOT, "public/brand/mascota-sola.webp"));

// Lista numerada en tarjetas: [título, detalle]
function cardList(items, y0, { gap = 30, numFill = C.banana, numText = C.ink } = {}) {
  let out = "", y = y0;
  items.forEach(([t, d], i) => {
    const tx = M + 132, maxW = W - 2 * M - 132 - 40;
    const tt = text(t, { x: tx, y: y + 44, size: 44, weight: 800, maxW, lh: 1.15 });
    const dd = text(d, { x: tx, y: tt.bottom + 14, size: 32, weight: 400, fill: C.body, maxW, lh: 1.35 });
    const h = dd.bottom - y + 48;
    out += card(M, y, W - 2 * M, h) +
      `<circle cx="${M + 66}" cy="${y + 66}" r="38" fill="${numFill}"/>` +
      `<text x="${M + 66}" y="${y + 66 + 15}" text-anchor="middle" font-family="Plus Jakarta Sans" font-size="40" font-weight="800" fill="${numText}">${i + 1}</text>` +
      tt.svg + dd.svg;
    y += h + gap;
  });
  return { svg: out, bottom: y - gap };
}

// ---------- Láminas ----------

function cover(title, sub, n = 1) {
  const t = text(title, { y: 250, size: 104, weight: 800, maxW: W - 2 * M, lh: 1.06, hl: "onBanana" });
  const s = text(sub, { y: t.bottom + 40, size: 38, weight: 600, fill: C.body, maxW: 560, lh: 1.3 });
  return svgDoc(C.banana,
    header(n, false) + eyebrow("GLP-1 y poco apetito", 184, C.ink) + t.svg + s.svg +
    `<image href="${MASCOT}" x="${W - 600}" y="${H - 690}" width="620" height="620"/>` +
    `<rect x="${M}" y="${H - 210}" width="250" height="72" rx="36" fill="${C.ink}"/>` +
    `<text x="${M + 48}" y="${H - 210 + 46}" font-family="Plus Jakarta Sans" font-size="28" font-weight="700" fill="${C.cream}">Desliza</text>` +
    `<path d="M${M + 186} ${H - 174}h28m-11 -11l11 11l-11 11" fill="none" stroke="${C.cream}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<text x="${M}" y="${H - 64}" font-family="Plus Jakarta Sans" font-size="26" font-weight="600" fill="${C.ink}">No sustituye la indicación de tu médico.</text>`);
}

function slide2() {
  const big = text("1.2 a 1.6 g", { y: 280, size: 176, weight: 800 });
  const sub = text("de **proteína** por cada kg de peso, al día", { y: big.bottom + 30, size: 58, weight: 800, lh: 1.15 });
  const y = sub.bottom + 90;
  const c1 = text("Saca tu rango", { x: M + 48, y: y + 48, size: 42, weight: 800 });
  const c1b = text("Multiplica tu peso en kg por 1.2 y por 1.6. Tu meta del día cae entre esos dos números.", { x: M + 48, y: c1.bottom + 14, size: 34, weight: 400, fill: C.body, maxW: W - 2 * M - 96, lh: 1.35 });
  const c2 = text("Si tienes mucho peso por bajar, se calcula con un peso de referencia, no con tu peso actual. Banana Shield lo hace por ti.", { x: M + 48, y: c1b.bottom + 30, size: 34, weight: 400, fill: C.body, maxW: W - 2 * M - 96, lh: 1.35 });
  const h = c2.bottom - y + 48;
  const src = text("Rango del consenso de nutrición 2025 para personas en tratamiento con GLP-1 (ACLM, ASN, OMA y The Obesity Society).", { y: y + h + 44, size: 26, weight: 400, fill: C.muted, lh: 1.4 });
  return svgDoc(C.paper, header(2, false) + eyebrow("La regla", 184) + big.svg + sub.svg + card(M, y, W - 2 * M, h) + c1.svg + c1b.svg + c2.svg + src.svg + footer(C.muted));
}

function slide3() {
  const t = text("Con poco apetito, **proteína** primero", { y: 236, size: 80, weight: 800, lh: 1.08 });
  const list = cardList([
    ["Empieza el plato por la proteína", "Si te llenas rápido, que sea con lo importante."],
    ["Come poco, cada 3 a 4 horas", "Comidas pequeñas, despacio, y para al primer signo de llenura."],
    ["Si un día no llegas", "Un batido de proteína o un yogur griego te acercan a tu meta."],
  ], t.bottom + 64);
  return svgDoc(C.paper, header(3, false) + eyebrow("Cómo comerla", 184) + t.svg + list.svg + footer(C.muted));
}

function slide4() {
  const t = text("3 ideas **latinas** en porción pequeña", { y: 236, size: 80, weight: 800, lh: 1.08 });
  const list = cardList([
    ["Huevos pericos con queso fresco", "Huevo y queso: dos proteínas en un desayuno pequeño."],
    ["Tortilla con pollo y frijoles", "Una sola tortilla, con el pollo desmenuzado al frente."],
    ["Ceviche de pescado", "Pescado sin fritura, si lo grasoso te cae mal."],
  ], t.bottom + 64, { numFill: C.ink, numText: C.banana });
  return svgDoc(C.paper, header(4, false) + eyebrow("Qué comer", 184) + t.svg + list.svg + footer(C.muted));
}

function slide5() {
  const colW = 470;
  const t = text("Tu **proteína** del día, calculada", { y: 236, size: 66, weight: 800, maxW: colW, lh: 1.1 });
  let y = t.bottom + 44, items = "";
  for (const s of ["Gramos al día y cuánto va en cada comida.", "Un piso de calorías: nunca te recomienda comer de menos.", "Fuerza 3 días o más por semana, con modo suave después de la inyección."]) {
    const b = text(s, { x: M + 40, y, size: 31, weight: 600, fill: C.body, maxW: colW - 40, lh: 1.33 });
    items += `<circle cx="${M + 12}" cy="${y + 21}" r="9" fill="${C.ink}"/>` + b.svg;
    y = b.bottom + 30;
  }
  const chipW = measure("Incluido en Entreno + Nutrición", 24, 700) + 48;
  const chip = `<rect x="${M}" y="${y + 10}" width="${chipW}" height="52" rx="26" fill="${C.soft}"/><text x="${M + 24}" y="${y + 10 + 35}" font-family="Plus Jakarta Sans" font-size="24" font-weight="700" fill="${C.bananaInk}">Incluido en Entreno + Nutrición</text>`;

  // Teléfono ink, radio 42, captura sin tocar sus números.
  const pw = 420, ph = Math.round(pw * 1688 / 780), px = W - M - pw + 20, py = 200, bz = 14;
  const shot = join(HERE, "captura-nutricion-shield.png");
  let screen;
  if (existsSync(shot)) {
    screen = `<clipPath id="scr"><rect x="${px + bz}" y="${py + bz}" width="${pw - 2 * bz}" height="${ph - 2 * bz}" rx="30"/></clipPath>` +
      `<image href="${dataUri(shot)}" x="${px + bz}" y="${py + bz}" width="${pw - 2 * bz}" height="${ph - 2 * bz}" preserveAspectRatio="xMidYMin slice" clip-path="url(#scr)"/>`;
  } else {
    const cx = px + pw / 2;
    screen = `<rect x="${px + bz}" y="${py + bz}" width="${pw - 2 * bz}" height="${ph - 2 * bz}" rx="30" fill="${C.cream}"/>` +
      `<rect x="${px + 44}" y="${py + ph / 2 - 150}" width="${pw - 88}" height="300" rx="24" fill="none" stroke="${C.bananaInk}" stroke-width="3" stroke-dasharray="14 10"/>` +
      `<text x="${cx}" y="${py + ph / 2 - 60}" text-anchor="middle" font-family="Plus Jakarta Sans" font-size="36" font-weight="800" fill="${C.ink}">[PENDIENTE]</text>` +
      text("Captura real de Nutrición con Banana Shield activo", { x: cx, y: py + ph / 2 - 20, size: 24, weight: 600, fill: C.body, maxW: pw - 140, lh: 1.35, anchor: "middle" }).svg;
  }
  const phone = `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="42" fill="${C.ink}" filter="url(#lift)"/>` + screen;
  return svgDoc(C.paper, phone + header(5, false) + eyebrow("Banana Shield", 184) + t.svg + items + chip + footer(C.muted));
}

function slide6() {
  const t = text("Come poco, pero que **cuente**", { y: 330, size: 96, weight: 800, fill: C.cream, lh: 1.06, hl: "onInk" });
  const s = text("Banana Shield te dice cuánta proteína comer y te acompaña con tu entreno de fuerza.", { y: t.bottom + 40, size: 36, weight: 400, fill: C.cream, maxW: 820, lh: 1.35 });
  const by = s.bottom + 70, label = "Empieza 7 días gratis en bananaburn.app", bw = measure(label, 34, 700) + 96;
  const btn = `<rect x="${M}" y="${by}" width="${bw}" height="104" rx="52" fill="${C.banana}"/><text x="${M + bw / 2}" y="${by + 64}" text-anchor="middle" font-family="Plus Jakarta Sans" font-size="34" font-weight="700" fill="${C.ink}">${label}</text>`;
  const nt = text("Sin tarjeta.", { y: by + 136, size: 30, weight: 600, fill: C.cream });
  const dy = H - 300;
  const disc = `<rect x="${M}" y="${dy}" width="${W - 2 * M}" height="150" rx="24" fill="none" stroke="${C.cream}" stroke-opacity=".35" stroke-width="2"/>` +
    text("No sustituye la indicación de tu médico.", { x: M + 40, y: dy + 34, size: 38, weight: 800, fill: C.cream }).svg +
    text("Banana Burn no da indicaciones sobre dosis ni medicamentos.", { x: M + 40, y: dy + 90, size: 26, weight: 400, fill: C.cream }).svg;
  return svgDoc(C.ink, header(6, true) + eyebrow("Tu siguiente paso", 254, C.banana) + t.svg + s.svg + btn + nt.svg + disc);
}

// ---------- Salida ----------

const render = (svg, file) => {
  const png = new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Plus Jakarta Sans" } }).render().asPng();
  writeFileSync(file, png);
  console.log("ok", file.replace(ROOT + "/", ""));
};

const slides = [
  ["K14_01_portada.png", cover("Poco apetito: cómo comer **proteína** suficiente", "Si comes menos, que cada bocado cuide tu músculo.")],
  ["K14_02_regla.png", slide2()],
  ["K14_03_proteina-primero.png", slide3()],
  ["K14_04_ideas-latinas.png", slide4()],
  ["K14_05_banana-shield.png", slide5()],
  ["K14_06_cta.png", slide6()],
];
for (const [f, svg] of slides) render(svg, join(HERE, f));

mkdirSync(join(HERE, "variantes"), { recursive: true });
render(cover("¿Comes poco con GLP-1? Así llegas a tu **proteína**", "Una regla, 3 ideas latinas y cómo te ayuda la app."), join(HERE, "variantes/K14_01_portada_B.png"));
render(cover("Si te llenas rápido, empieza por **esto**", "Lo que va primero en el plato cuando el apetito baja."), join(HERE, "variantes/K14_01_portada_C.png"));
