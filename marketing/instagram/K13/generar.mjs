// Carrusel K13 "Cuánto peso usar": 6 láminas de 1080 x 1350 en PNG, dibujadas en SVG y rasterizadas con resvg.
// Uso: cd marketing/instagram && npm install && npm run k13
// Reglas: solo Plus Jakarta Sans, solo paper/banana/ink/cream, sin emojis, sin rayas largas, sin "·".
// La captura de la lámina 5 es public/landing/entreno.png tal cual (real, sin tocar ningún número).
// Coach Banana es public/brand/mascota-sola.webp (el recurso oficial del repositorio), una sola vez. resvg no lee WebP,
// así que se usa su copia en PNG sin pérdida: recursos/coach-banana-oficial.png (convert mascota-sola.webp, sin retoques).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Resvg } from "@resvg/resvg-js";
import opentype from "opentype.js";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const require = createRequire(import.meta.url);
const fontDir = dirname(require.resolve("@expo-google-fonts/plus-jakarta-sans/package.json"));
const FONTS = {
  500: join(fontDir, "500Medium/PlusJakartaSans_500Medium.ttf"),
  700: join(fontDir, "700Bold/PlusJakartaSans_700Bold.ttf"),
  800: join(fontDir, "800ExtraBold/PlusJakartaSans_800ExtraBold.ttf"),
};
const faces = Object.fromEntries(Object.entries(FONTS).map(([w, f]) => [w, opentype.parse(readFileSync(f).buffer)]));

const W = 1080, H = 1350, PAD = 96;
const C = { banana: "#FFD60A", soft: "#FFF1A8", ink: "#1B1505", body: "#2E2818", paper: "#FFF8E3", cream: "#FFFBF0", line: "#EDE3C6", bananaInk: "#8A6200", muted: "#6A604B" };

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dataUri = (file, mime) => `data:${mime};base64,${readFileSync(join(repo, file)).toString("base64")}`;

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
 * Bloque de texto. `lines` es una lista de líneas; cada línea es un texto o una lista de tramos [{ t, hl }].
 * Los tramos con `hl` llevan un marcador de color detrás (la palabra clave resaltada).
 */
function text({ lines, x, y, size, lh, weight = 800, fill, track = 0, hl, hlText, anchor = "start" }) {
  let out = "";
  lines.forEach((line, i) => {
    const base = y + i * lh;
    const parts = (typeof line === "string" ? [line] : line).map((p) => (typeof p === "string" ? { t: p } : p));
    const startX = anchor === "middle" ? x - measure(parts.map((p) => p.t).join(""), size, weight, track) / 2 : x;
    let cx = startX;
    let spans = "";
    for (const p of parts) {
      const w = measure(p.t, size, weight, track);
      if (p.hl) out += `<rect x="${cx - size * 0.1}" y="${base - size * 0.8}" width="${w + size * 0.2 - track * size}" height="${size * 1.02}" rx="${size * 0.16}" fill="${hl}"/>`;
      spans += `<tspan fill="${p.hl && hlText ? hlText : fill}">${esc(p.t)}</tspan>`;
      cx += w;
    }
    out += `<text x="${startX}" y="${base}" font-family="Plus Jakarta Sans" font-weight="${weight}" font-size="${size}" letter-spacing="${track * size}" fill="${fill}" xml:space="preserve">${spans}</text>`;
  });
  return out;
}

const eyebrow = (t, x, y, fill) => text({ lines: [t.toUpperCase()], x, y, size: 26, lh: 26, weight: 700, fill, track: 0.14 });

/** Pie de cada lámina: la cuenta a la izquierda y el número de lámina a la derecha (cifras tabulares). */
function footer(n, fill) {
  return text({ lines: ["@bananaburnapp"], x: PAD, y: H - 72, size: 26, lh: 26, weight: 700, fill })
    + `<text x="${W - PAD}" y="${H - 72}" text-anchor="end" font-family="Plus Jakarta Sans" font-weight="800" font-size="26" fill="${fill}" font-variant-numeric="tabular-nums">${n}/6</text>`;
}

const LOGO = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 512})">
  <defs><linearGradient id="bbfl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#E89A00"/><stop offset=".55" stop-color="#FFD60A"/><stop offset="1" stop-color="#FFEC80"/></linearGradient>
  <linearGradient id="bbby" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#1B1505"/><stop offset="1" stop-color="#3A2E0C"/></linearGradient></defs>
  ${readFileSync(join(repo, "public/icons/logo.svg"), "utf8").replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<defs>[\s\S]*?<\/defs>/, "")}
</g>`;

const svg = (bg, body) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`;

// 1. Portada: el gancho grande, Coach Banana (recurso oficial) abajo a la derecha.
function portada() {
  const mascot = dataUri("marketing/instagram/recursos/coach-banana-oficial.png", "image/png");
  return svg(C.paper, `
    ${eyebrow("Entreno de fuerza", PAD, 170, C.bananaInk)}
    ${text({ lines: ["¿No sabes", ["cuánto ", { t: "peso", hl: true }], "usar?"], x: PAD, y: 330, size: 136, lh: 146, fill: C.ink, track: -0.03, hl: C.banana })}
    ${text({ lines: wrap("3 errores que frenan tu progreso en el gym.", 42, 500, 520), x: PAD, y: 700, size: 42, lh: 58, weight: 500, fill: C.body })}
    <rect x="${PAD}" y="1010" width="232" height="72" rx="36" fill="${C.ink}"/>
    ${text({ lines: ["Desliza"], x: PAD + 36, y: 1057, size: 30, lh: 30, weight: 700, fill: C.cream })}
    <path d="M${PAD + 168} 1046 h32 m-12 -12 l12 12 l-12 12" fill="none" stroke="${C.banana}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <image x="470" y="610" width="660" height="660" href="${mascot}" xlink:href="${mascot}"/>
    ${footer(1, C.muted)}`);
}

// 2 a 4. Los errores. Cada lámina: etiqueta, el error, por qué frena y una tarjeta "Mejor así" con lo que hace la app.
function error({ n, titulo, porque, mejor, bg }) {
  const dark = bg === C.ink;
  const fg = dark ? C.cream : C.ink;
  const cardBg = dark ? C.banana : C.ink;
  const cardFg = dark ? C.ink : C.cream;
  const cardLabel = dark ? C.ink : C.banana;
  const hl = bg === C.paper ? C.banana : bg === C.banana ? C.paper : null;
  const tituloLines = titulo.map((l) => (typeof l === "string" ? l : [{ t: l.t, hl: !!hl }]));
  const mejorLines = wrap(mejor, 44, 700, W - PAD * 2 - 112);
  const cardH = 150 + mejorLines.length * 60;
  const cardY = H - 150 - cardH;
  return svg(bg, `
    <rect x="${PAD}" y="118" width="250" height="60" rx="30" fill="none" stroke="${fg}" stroke-width="3"/>
    ${text({ lines: [`Error ${n} de 3`], x: PAD + 125, y: 158, size: 28, lh: 28, weight: 700, fill: fg, anchor: "middle" })}
    ${text({ lines: tituloLines, x: PAD, y: 360, size: 128, lh: 138, fill: dark && !hl ? C.banana : fg, track: -0.03, hl: hl ?? undefined })}
    ${text({ lines: wrap(porque, 44, 500, W - PAD * 2), x: PAD, y: 360 + titulo.length * 138 + 40, size: 44, lh: 62, weight: 500, fill: dark ? C.cream : C.body })}
    <rect x="${PAD}" y="${cardY}" width="${W - PAD * 2}" height="${cardH}" rx="32" fill="${cardBg}"/>
    ${eyebrow("Mejor así", PAD + 56, cardY + 82, cardLabel)}
    ${text({ lines: mejorLines, x: PAD + 56, y: cardY + 152, size: 44, lh: 60, weight: 700, fill: cardFg })}
    ${footer(n + 1, dark ? C.cream : bg === C.banana ? C.ink : C.muted)}`);
}

// 5. La captura real dentro de un marco de teléfono ink de radio 42, con un aro sobre el dato (sin tocar la imagen).
function captura() {
  const shot = dataUri("public/landing/entreno.png", "image/png");
  const sw = 780, sh = 1688; // tamaño real de la captura
  const ph = 780, pw = Math.round((ph * sw) / sh), bezel = 16;
  const px = W - PAD - pw - bezel * 2, py = 380;
  const k = ph / sh;
  // El bloque "10 a 12 repeticiones con 20 kg" en la captura original (px de la imagen).
  const ring = { x: 44, y: 1172, w: 660, h: 162 };
  const pasos = [
    ["1", "Te dice cuántas repeticiones y con cuánto peso."],
    ["2", "Anotas lo que hiciste en cada serie."],
    ["3", "Cuando ya puedes más, te sube el peso."],
  ];
  let y = 470;
  const steps = pasos.map(([num, t]) => {
    const lines = wrap(t, 36, 700, px - PAD - 48);
    const block = `<circle cx="${PAD + 26}" cy="${y - 12}" r="26" fill="${C.ink}"/>
      ${text({ lines: [num], x: PAD + 26, y: y, size: 30, lh: 30, weight: 800, fill: C.banana, anchor: "middle" })}
      ${text({ lines, x: PAD, y: y + 68, size: 36, lh: 48, weight: 700, fill: C.ink })}`;
    y += 68 + lines.length * 48 + 52;
    return block;
  }).join("");
  return svg(C.paper, `
    <defs><clipPath id="screen"><rect x="${px + bezel}" y="${py + bezel}" width="${pw}" height="${ph}" rx="30"/></clipPath>
    <filter id="lift" x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#1B1505" flood-opacity="0.22"/></filter></defs>
    ${eyebrow("Así lo resuelve Banana Burn", PAD, 150, C.bananaInk)}
    ${text({ lines: ["La app te dice", ["con cuánto ", { t: "peso", hl: true }, "."]], x: PAD, y: 245, size: 72, lh: 82, fill: C.ink, track: -0.02, hl: C.banana })}
    ${steps}
    <rect x="${px}" y="${py}" width="${pw + bezel * 2}" height="${ph + bezel * 2}" rx="42" fill="${C.ink}" filter="url(#lift)"/>
    <image x="${px + bezel}" y="${py + bezel}" width="${pw}" height="${ph}" href="${shot}" xlink:href="${shot}" clip-path="url(#screen)" preserveAspectRatio="xMidYMid slice"/>
    <rect x="${px + bezel + ring.x * k}" y="${py + bezel + ring.y * k}" width="${ring.w * k}" height="${ring.h * k}" rx="18" fill="none" stroke="${C.ink}" stroke-width="5"/>
    ${text({ lines: ["Captura real de la app"], x: px + bezel + pw / 2, y: py + ph + bezel * 2 + 48, size: 24, lh: 24, weight: 700, fill: C.ink, anchor: "middle" })}
    ${footer(5, C.muted)}`);
}

// 6. CTA: fondo banana, botón ink "Empieza 7 días gratis en bananaburn.app" y logo, como el cierre de los Reels.
function cta() {
  const btnText = "Empieza 7 días gratis en bananaburn.app";
  const bw = measure(btnText, 38, 700) + 112;
  return svg(C.banana, `
    ${LOGO(PAD, 120, 112)}
    ${text({ lines: [["Banana", { t: "Burn", hl: true }]], x: PAD + 140, y: 195, size: 48, lh: 48, fill: C.ink, hlText: "#8A5300", track: -0.02, hl: "transparent" })}
    ${text({ lines: ["Deja de", ["adivinar", "."].map((t, i) => ({ t, hl: i === 0 }))], x: PAD, y: 470, size: 136, lh: 146, fill: C.ink, track: -0.03, hl: C.paper })}
    ${text({ lines: wrap("Banana Burn te dice qué entrenar, con cuánto peso y cuántas repeticiones. Tu entrenador personal en el celular.", 44, 500, W - PAD * 2), x: PAD, y: 720, size: 44, lh: 62, weight: 500, fill: C.body })}
    <rect x="${PAD}" y="980" width="${bw}" height="120" rx="60" fill="${C.ink}" filter="url(#btn)"/>
    ${text({ lines: [btnText], x: PAD + bw / 2, y: 1053, size: 38, lh: 38, weight: 700, fill: C.cream, anchor: "middle" })}
    ${text({ lines: ["Sin tarjeta."], x: PAD, y: 1160, size: 32, lh: 32, weight: 500, fill: C.ink })}
    <defs><filter id="btn" x="-10%" y="-20%" width="120%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#1B1505" flood-opacity="0.35"/></filter></defs>
    ${footer(6, C.ink)}`);
}

const SLIDES = [
  ["01_portada", portada()],
  ["02_error-adivinar", error({
    n: 1, bg: C.banana, titulo: [{ t: "Adivinar" }],
    porque: "Tomas una mancuerna al azar. Si es muy liviana, no avanzas. Si es muy pesada, se rompe la técnica.",
    mejor: "Usa un peso con el que termines la serie sintiendo que podías hacer 2 repeticiones más.",
  })],
  ["03_error-copiar", error({
    n: 2, bg: C.paper, titulo: ["Copiar al", { t: "de al lado" }],
    porque: "Su peso viene de su cuerpo y de sus meses de entreno. Lo que a esa persona le sirve, a ti te puede lastimar.",
    mejor: "Empieza liviano y anota lo que hiciste de verdad. La técnica va primero que el peso.",
  })],
  ["04_error-no-subir", error({
    n: 3, bg: C.ink, titulo: ["No subir", "nunca"],
    porque: "Meses con la misma mancuerna. Tu cuerpo ya se acostumbró y deja de cambiar.",
    mejor: "Cuando llegas al tope de repeticiones en todas las series, sube el peso y vuelve al mínimo del rango.",
  })],
  ["05_captura-peso-sugerido", captura()],
  ["06_cta", cta()],
];

const fontFiles = Object.values(FONTS);
for (const [name, markup] of SLIDES) {
  const png = new Resvg(markup, { fitTo: { mode: "width", value: W }, font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Plus Jakarta Sans" } }).render().asPng();
  writeFileSync(join(here, `${name}.png`), png);
  console.log(`${name}.png`);
}
