// Portadas de Reels (1080 x 1920): 3 de los Reels de anuncios ya publicados y R01 a R04 del kit de noviembre.
// Uso: cd marketing/instagram && npm install && npm run portadas
// Por cada portada escribe: fuentes/<id>.svg (editable), <id>.png (1080 x 1920) y recorte/<id>_recorte.png (1080 x 1350),
// más vista-grid.png con los 7 recortes como se ven en el perfil.
// El recorte del grid es el centro de la portada: de y = 285 a y = 1635. Todo el texto va además dentro de la zona
// segura del Reel (250 px arriba, 350 px abajo), o sea entre y = 325 y y = 1570. Si un texto se sale, el script falla.
// Reglas: solo Plus Jakarta Sans, solo paper/banana/ink/cream, sin emojis, sin rayas largas, sin "·", sin logo.
// Coach Banana es recursos/coach-banana-oficial.png (copia PNG sin pérdida de public/brand/mascota-sola.webp).
// El Nuevo no tiene recurso en el repositorio: si se guarda su PNG con fondo transparente en
// recursos/el-nuevo.png, la portada de "El Nuevo" lo pone sola. Nunca se redibuja.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Resvg } from "@resvg/resvg-js";
import opentype from "opentype.js";

const here = dirname(fileURLToPath(import.meta.url));
const recursos = join(here, "..", "recursos");
const require = createRequire(import.meta.url);
const fontDir = dirname(require.resolve("@expo-google-fonts/plus-jakarta-sans/package.json"));
const FONTS = {
  500: join(fontDir, "500Medium/PlusJakartaSans_500Medium.ttf"),
  700: join(fontDir, "700Bold/PlusJakartaSans_700Bold.ttf"),
  800: join(fontDir, "800ExtraBold/PlusJakartaSans_800ExtraBold.ttf"),
};
const faces = Object.fromEntries(Object.entries(FONTS).map(([w, f]) => [w, opentype.parse(readFileSync(f).buffer)]));

const W = 1080, H = 1920, PAD = 96;
const CROP = { y: 285, h: 1350 }; // recorte centrado 1080 x 1350
const SAFE = { top: Math.max(250, CROP.y) + 40, bottom: H - 350 }; // donde puede ir texto
const C = { banana: "#FFD60A", soft: "#FFF1A8", ink: "#1B1505", body: "#2E2818", paper: "#FFF8E3", cream: "#FFFBF0", bananaInk: "#8A6200", muted: "#6A604B" };

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pngUri = (file) => `data:image/png;base64,${readFileSync(file).toString("base64")}`;

/** Ancho real del texto con la fuente y el tracking (em) que se van a dibujar. */
function measure(text, size, weight, track = 0) {
  // Glifo por glifo: el ccmp de esta fuente rompe el modo con rasgos de opentype.js.
  const f = faces[weight];
  const glyphs = [...text].map((ch) => f.charToGlyph(ch));
  let units = 0;
  glyphs.forEach((g, i) => { units += g.advanceWidth + (i ? f.getKerningValue(glyphs[i - 1], g) : 0); });
  return (units * size) / f.unitsPerEm + track * size * text.length;
}

/** Parte un párrafo en líneas que caben en `max` px. */
function wrap(text, size, weight, max, track = 0) {
  const lines = [];
  let cur = "";
  for (const word of text.split(" ")) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && measure(next, size, weight, track) > max) { lines.push(cur); cur = word; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Bloque de texto. Cada línea es un texto o una lista de tramos [{ t, hl }]; los tramos con `hl` llevan un marcador
 * de color detrás. Guarda la caja de cada línea en `boxes` para comprobar que todo cae dentro del recorte.
 */
function text(boxes, { lines, x, y, size, lh, weight = 800, fill, track = 0, hl, hlText }) {
  let out = "";
  lines.forEach((line, i) => {
    const base = y + i * lh;
    const parts = (typeof line === "string" ? [line] : line).map((p) => (typeof p === "string" ? { t: p } : p));
    let cx = x;
    let spans = "";
    for (const p of parts) {
      const w = measure(p.t, size, weight, track);
      if (p.hl) out += `<rect x="${cx - size * 0.1}" y="${base - size * 0.8}" width="${w + size * 0.2 - track * size}" height="${size * 1.02}" rx="${size * 0.16}" fill="${hl}"/>`;
      spans += `<tspan fill="${p.hl && hlText ? hlText : fill}">${esc(p.t)}</tspan>`;
      cx += w;
    }
    boxes.push({ t: parts.map((p) => p.t).join(""), x0: x - (parts.some((p) => p.hl) ? size * 0.1 : 0), x1: cx + (parts.at(-1).hl ? size * 0.1 : 0), y0: base - size * 0.8, y1: base + size * 0.25 });
    out += `<text x="${x}" y="${base}" font-family="Plus Jakarta Sans" font-weight="${weight}" font-size="${size}" letter-spacing="${track * size}" fill="${fill}" xml:space="preserve">${spans}</text>`;
  });
  return out;
}

// Iconos de línea (trazo redondo, como el calendario de R04). Caja de 150 x 150.
const ICONS = {
  calendario: (c) => `<rect x="10" y="30" width="130" height="112" rx="26" fill="none" stroke="${c}" stroke-width="13"/><path d="M10 72 h130 M45 10 v34 M105 10 v34 M50 100 l20 20 l34 -36" fill="none" stroke="${c}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`,
  mancuerna: (c) => `<path d="M42 75 h66" stroke="${c}" stroke-width="14" stroke-linecap="round"/><rect x="14" y="38" width="30" height="74" rx="12" fill="none" stroke="${c}" stroke-width="13"/><rect x="106" y="38" width="30" height="74" rx="12" fill="none" stroke="${c}" stroke-width="13"/><path d="M4 60 v30 M146 60 v30" stroke="${c}" stroke-width="13" stroke-linecap="round"/>`,
  edificio: (c) => `<rect x="30" y="12" width="90" height="128" rx="14" fill="none" stroke="${c}" stroke-width="13"/><path d="M56 44 h10 M84 44 h10 M56 74 h10 M84 74 h10 M62 140 v-30 h26 v30" fill="none" stroke="${c}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`,
  bascula: (c) => `<rect x="10" y="22" width="130" height="116" rx="28" fill="none" stroke="${c}" stroke-width="13"/><path d="M48 64 a32 32 0 0 1 54 0 M75 66 l12 -16" fill="none" stroke="${c}" stroke-width="13" stroke-linecap="round"/>`,
  mochila: (c) => `<rect x="24" y="40" width="102" height="100" rx="28" fill="none" stroke="${c}" stroke-width="13"/><path d="M52 40 v-10 a23 23 0 0 1 46 0 v10 M50 96 h50 v26 h-50 z" fill="none" stroke="${c}" stroke-width="13" stroke-linejoin="round"/>`,
};

/** Paleta de cada fondo: texto, eyebrow, marcador de la palabra clave y texto sobre el marcador. */
const THEMES = {
  paper: { bg: C.paper, fg: C.ink, sub: C.body, eyebrow: C.bananaInk, hl: C.banana, hlText: C.ink, note: C.muted },
  banana: { bg: C.banana, fg: C.ink, sub: C.ink, eyebrow: C.ink, hl: C.ink, hlText: C.banana, note: C.ink },
  ink: { bg: C.ink, fg: C.cream, sub: C.cream, eyebrow: C.banana, hl: C.banana, hlText: C.ink, note: C.cream },
};

/**
 * Una portada. El bloque de texto (icono, eyebrow, gancho y apoyo) se centra en el alto del recorte si no hay
 * personaje; con personaje, el texto va arriba y el personaje abajo a la derecha, sin tocarse.
 */
function portada({ tema, icono, eyebrow, gancho, apoyo, personaje, nota }) {
  const th = THEMES[tema];
  const boxes = [];
  const size = 124, lh = 134, max = W - PAD * 2;
  // En el SVG editable el personaje es un enlace a recursos/ (relativo a fuentes/); se incrusta solo al dibujar.
  const img = personaje && existsSync(join(recursos, personaje)) ? `../../recursos/${personaje}` : null;
  const apoyoSize = 46, apoyoLh = 62;
  const apoyoLines = apoyo ? wrap(apoyo, apoyoSize, 500, img ? 470 : max) : [];
  // Alto del bloque para centrarlo.
  const iconH = icono ? 150 + 70 : 0;
  const blockH = iconH + 26 + 70 + gancho.length * lh + (apoyoLines.length ? 40 + apoyoLines.length * apoyoLh : 0);
  const top = img ? CROP.y + 150 : Math.round(CROP.y + (CROP.h - blockH) / 2);
  let y = top;
  let body = "";
  if (icono) { body += `<g transform="translate(${PAD} ${y})">${ICONS[icono](th.fg)}</g>`; y += iconH; }
  body += text(boxes, { lines: [eyebrow.toUpperCase()], x: PAD, y: y + 26, size: 30, lh: 30, weight: 700, fill: th.eyebrow, track: 0.14 });
  y += 26 + 70 + size * 0.8;
  body += text(boxes, { lines: gancho, x: PAD, y, size, lh, fill: th.fg, track: -0.03, hl: th.hl, hlText: th.hlText });
  y += (gancho.length - 1) * lh + size * 0.25;
  if (apoyoLines.length) body += text(boxes, { lines: apoyoLines, x: PAD, y: y + 40 + apoyoSize * 0.8, size: apoyoSize, lh: apoyoLh, weight: 500, fill: th.sub });
  if (img) body += `<image x="450" y="${SAFE.bottom - 640}" width="640" height="640" href="${img}" xlink:href="${img}"/>`;
  if (nota) body += text(boxes, { lines: [nota], x: PAD, y: SAFE.bottom - 20, size: 30, lh: 30, weight: 500, fill: th.note });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${th.bg}"/>${body}</svg>`;
  return { svg, boxes, conPersonaje: !!img };
}

// Los ganchos. Los de R01 a R04 son los del plan de marketing/kit-reels-noviembre-2026.md, palabra por palabra.
// Los de los 3 Reels de anuncios ya publicados no están en el repositorio: son propuestas y se listan en el README.
const PORTADAS = [
  {
    id: "anuncio_cuanto-peso", tema: "paper", eyebrow: "Entreno de fuerza", personaje: "coach-banana-oficial.png",
    gancho: ["¿No sabes", ["cuánto ", { t: "peso", hl: true }], "usar?"],
    apoyo: "Tu entrenador te lo dice en cada serie.",
  },
  {
    id: "anuncio_el-nuevo", tema: "banana", icono: "mochila", eyebrow: "El Nuevo", personaje: "el-nuevo.png",
    gancho: ["POV: tu", [{ t: "primer día", hl: true }], "en el gym"],
    apoyo: "Coach Banana te dice qué hacer.",
  },
  {
    id: "anuncio_gym-condominio", tema: "ink", icono: "edificio", eyebrow: "Condominios",
    gancho: ["Tu edificio", "tiene gym.", ["Te falta ", { t: "el plan", hl: true }, "."]],
    apoyo: "La rutina de hoy, con peso y repeticiones.",
  },
  {
    id: "R01_cuanto-peso", tema: "banana", icono: "mancuerna", eyebrow: "Principiantes",
    gancho: ["Cuando no", "sabes cuánto", [{ t: "peso usar", hl: true }]],
  },
  {
    id: "R02_musculo-glp1", tema: "ink", icono: "bascula", eyebrow: "GLP-1 y bajada rápida",
    gancho: ["Bajaste", "rápido…", ["¿y tu ", { t: "músculo?", hl: true }]],
    nota: "No sustituye la indicación de tu médico.",
  },
  {
    id: "R03_condominio-gym", tema: "paper", eyebrow: "Condominios", personaje: "coach-banana-oficial.png",
    gancho: ["Tu condominio", "tiene gym.", [{ t: "¿Y tu plan?", hl: true }]],
  },
  {
    id: "R04_temporada-1", tema: "banana", icono: "calendario", eyebrow: "Temporada 1",
    gancho: ["La Temporada 1", "empieza el", [{ t: "9 de noviembre", hl: true }]],
  },
];

const fontFiles = Object.values(FONTS);
/** Cambia los enlaces a recursos/ por la imagen incrustada, para que resvg no dependa de la carpeta. */
const incrustar = (svg) => svg.replace(/"\.\.\/\.\.\/recursos\/([^"]+)"/g, (_, f) => `"${pngUri(join(recursos, f))}"`);
const render = (svg, width) => new Resvg(incrustar(svg), { fitTo: { mode: "width", value: width }, font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Plus Jakarta Sans" } }).render().asPng();
/** El mismo dibujo visto solo en la franja del recorte (viewBox de 1080 x 1350 desde y = 285). */
const recorte = (svg) => svg.replace(`height="${H}" viewBox="0 0 ${W} ${H}"`, `height="${CROP.h}" viewBox="0 ${CROP.y} ${W} ${CROP.h}"`);

for (const dir of ["fuentes", "recorte"]) mkdirSync(join(here, dir), { recursive: true });
const errores = [];
const tiles = [];
for (const p of PORTADAS) {
  const { svg, boxes, conPersonaje } = portada(p);
  for (const b of boxes) {
    if (b.x0 < PAD - 14 || b.x1 > W - PAD + 14 || b.y0 < SAFE.top || b.y1 > SAFE.bottom) {
      errores.push(`${p.id}: "${b.t}" se sale del recorte o de la zona segura (x ${Math.round(b.x0)} a ${Math.round(b.x1)}, y ${Math.round(b.y0)} a ${Math.round(b.y1)})`);
    }
  }
  writeFileSync(join(here, "fuentes", `${p.id}.svg`), svg);
  writeFileSync(join(here, `${p.id}.png`), render(svg, W));
  const crop = recorte(svg);
  writeFileSync(join(here, "recorte", `${p.id}_recorte.png`), render(crop, W));
  tiles.push(crop);
  console.log(`${p.id}.png${p.personaje && !conPersonaje ? `  (sin ${p.personaje}: falta en recursos/)` : ""}`);
}

// Vista del grid: los recortes en filas de 3, como en el perfil (el más nuevo arriba a la izquierda).
const TW = 360, TH = 450, GAP = 4;
const orden = [...tiles].reverse();
const filas = Math.ceil(orden.length / 3);
const GW = TW * 3 + GAP * 2, GH = filas * TH + (filas - 1) * GAP;
const grid = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${GW}" height="${GH}" viewBox="0 0 ${GW} ${GH}"><rect width="${GW}" height="${GH}" fill="#FFFFFF"/>${orden.map((t, i) => {
  const inner = t.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return `<svg x="${(i % 3) * (TW + GAP)}" y="${Math.floor(i / 3) * (TH + GAP)}" width="${TW}" height="${TH}" viewBox="0 ${CROP.y} ${W} ${CROP.h}">${inner}</svg>`;
}).join("")}</svg>`;
writeFileSync(join(here, "vista-grid.png"), render(grid, GW * 2));
console.log("vista-grid.png");

if (errores.length) {
  console.error(errores.join("\n"));
  process.exit(1);
}
console.log(`Todo el texto de las ${PORTADAS.length} portadas cae dentro del recorte de 1080 x ${CROP.h} y de la zona segura.`);
