// Carrusel K15 "Tu primer 5K con Banana Run" (1080 x 1350) hecho en código.
// Escribe la fuente editable en svg/ y las láminas finales en png/ (la variante B de la portada, en variante-b/).
// Solo paper #FFF8E3, banana #FFD60A, ink #1B1505 y cream #FFFBF0, Plus Jakarta Sans (las fuentes de src/app/og)
// y capturas reales de public/landing, recortadas sin cambiar ningún número.
//
// Uso, desde la raíz del repo (sharp solo lee las capturas WebP, que resvg no abre):
//   npm i --no-save --prefix /tmp/resvg @resvg/resvg-js@2 sharp@0.33
//   RESVG_DIR=/tmp/resvg node marketing/instagram/K15/generar.mjs
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const require = createRequire(process.env.RESVG_DIR ? join(process.env.RESVG_DIR, "noop.js") : import.meta.url);
const { Resvg } = require("@resvg/resvg-js");
const sharp = require("sharp");

const PAPER = "#FFF8E3";
const BANANA = "#FFD60A";
const INK = "#1B1505";
const CREAM = "#FFFBF0";
const BODY = "#2E2818";
const BANANA_INK = "#8A6200";
const W = 1080;
const H = 1350;
const M = 88; // margen
const FONT = "Plus Jakarta Sans";
const F800 = `'${FONT}', '${FONT} ExtraBold'`;
const F600 = `'${FONT}', '${FONT} SemiBold'`;

/** WOFF 1 a TTF: resvg no lee WOFF, y así se usan las mismas fuentes de la marca que ya están en el repo. */
function woffToSfnt(woff) {
  const n = woff.readUInt16BE(12);
  const tables = [];
  for (let i = 0; i < n; i++) {
    const e = 44 + i * 20;
    const tag = woff.toString("latin1", e, e + 4);
    const off = woff.readUInt32BE(e + 4);
    const comp = woff.readUInt32BE(e + 8);
    const orig = woff.readUInt32BE(e + 12);
    const raw = woff.subarray(off, off + comp);
    tables.push({ tag, sum: woff.readUInt32BE(e + 16), data: comp < orig ? inflateSync(raw) : raw });
  }
  let entry = 1;
  let log = 0;
  while (entry * 2 <= n) (entry *= 2), log++;
  const head = Buffer.alloc(12 + n * 16);
  head.writeUInt32BE(woff.readUInt32BE(4), 0);
  head.writeUInt16BE(n, 4);
  head.writeUInt16BE(entry * 16, 6);
  head.writeUInt16BE(log, 8);
  head.writeUInt16BE(n * 16 - entry * 16, 10);
  const parts = [head];
  let off = head.length;
  tables.forEach((t, i) => {
    const d = 12 + i * 16;
    head.write(t.tag, d, "latin1");
    head.writeUInt32BE(t.sum, d + 4);
    head.writeUInt32BE(off, d + 8);
    head.writeUInt32BE(t.data.length, d + 12);
    const pad = (4 - (t.data.length % 4)) % 4;
    parts.push(t.data, Buffer.alloc(pad));
    off += t.data.length + pad;
  });
  return Buffer.concat(parts);
}

const fontDir = mkdtempSync(join(tmpdir(), "bb-fuentes-"));
const fonts = ["jakarta-800", "jakarta-600"].map((f) => {
  const file = join(fontDir, `${f}.ttf`);
  writeFileSync(file, woffToSfnt(readFileSync(join(root, "src/app/og", `${f}.woff`))));
  return file;
});

/** Imagen del repo como data URI PNG (las capturas son WebP de 780 x 1688). */
async function asset(path) {
  return `data:image/png;base64,${(await sharp(join(root, path)).png().toBuffer()).toString("base64")}`;
}
const SHOTS = {
  plan: await asset("public/landing/running-plan.webp"),
  hub: await asset("public/landing/running-hub.webp"),
};
const COACH = await asset("public/brand/mascota-sola.webp");
const LOGO = `data:image/svg+xml;base64,${readFileSync(join(root, "src/app/icon.svg")).toString("base64")}`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Texto en varias líneas. `parts` permite resaltar: [["Tu primer ", null], ["5K", BANANA]]. */
function lines(x, y, size, lh, rows, { fill = INK, weight = 800, track = -0.025 } = {}) {
  const fam = weight === 800 ? F800 : F600;
  return rows
    .map((row, i) => {
      const parts = typeof row === "string" ? [[row, null]] : row;
      const spans = parts.map(([t, c]) => `<tspan${c ? ` fill="${c}"` : ""}>${esc(t)}</tspan>`).join("");
      return `<text x="${x}" y="${y + i * lh}" font-family="${fam}" font-weight="${weight}" font-size="${size}" letter-spacing="${size * track}" fill="${fill}">${spans}</text>`;
    })
    .join("\n  ");
}

/** Resaltado banana detrás de una palabra (como Marker en la landing). El ancho se ajusta a ojo por palabra. */
const marker = (x, y, w, size) => `<rect x="${x - 10}" y="${y - size * 0.8}" width="${w + 20}" height="${size * 1.02}" rx="14" fill="${BANANA}"/>`;

const eyebrow = (x, y, t, fill = BANANA_INK) =>
  `<text x="${x}" y="${y}" font-family="${F800}" font-weight="800" font-size="28" letter-spacing="4" fill="${fill}">${esc(t)}</text>`;

/** Lista con viñeta cuadrada redondeada. */
function bullets(x, y, rows, { fill = BODY, dot = INK, size = 34, gap = 64 } = {}) {
  let cy = y;
  return rows
    .map((r) => {
      const ls = Array.isArray(r) ? r : [r];
      const out = `<rect x="${x}" y="${cy - 22}" width="16" height="16" rx="5" fill="${dot}"/>\n  ${lines(x + 40, cy, size, size * 1.3, ls, { fill, weight: 600, track: 0 })}`;
      cy += gap + (ls.length - 1) * size * 1.3;
      return out;
    })
    .join("\n  ");
}

/** Pie de cada lámina: número y usuario. */
const foot = (n, fill = INK) => `
  <text x="${M}" y="${H - 60}" font-family="${F600}" font-weight="600" font-size="26" fill="${fill}">@bananaburnapp</text>
  <text x="${W - M}" y="${H - 60}" text-anchor="end" font-family="${F800}" font-weight="800" font-size="26" fill="${fill}">${n}/5</text>`;

/**
 * Recorte de una captura real dentro de un marco de teléfono ink (radio 42). Se escala sin cambiar nada:
 * `y0` e `y1` son la franja de la captura (en px de la captura de 780 de ancho) que se ve.
 */
function phone(id, src, x, y, w, y0, y1) {
  const pad = 14;
  const s = w / 780;
  const h = (y1 - y0) * s;
  return `<g>
    <rect x="${x - pad}" y="${y - pad}" width="${w + pad * 2}" height="${h + pad * 2}" rx="42" fill="${INK}"/>
    <clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="30"/></clipPath>
    <image href="${src}" x="${x}" y="${y - y0 * s}" width="${w}" height="${1688 * s}" clip-path="url(#${id})"/>
  </g>`;
}

/** Etiqueta de lo que viene con la Temporada Running (no con el plan base): plan, ritmos de entrenamiento y fuerza. */
const seasonChip = (bg) => {
  const w = 290;
  const [fill, text] = bg === INK ? [BANANA, INK] : ["#FFF1A8", BANANA_INK];
  return `<rect x="${W - M - w}" y="112" width="${w}" height="52" rx="26" fill="${fill}"/>
  <text x="${W - M - w / 2}" y="147" text-anchor="middle" font-family="${F800}" font-weight="800" font-size="24" fill="${text}">Temporada Running</text>`;
};

const svg = (bg, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  ${body}
</svg>
`;

/** Portada: fondo ink, Coach Banana con ropa de correr, palabra clave en banana. `title` cambia entre variantes. */
const cover = (title) =>
  svg(INK, `
  <image href="${COACH}" x="430" y="560" width="760" height="760"/>
  ${eyebrow(M, 170, "BANANA RUN", BANANA)}
  ${lines(M, 300, 120, 126, title, { fill: CREAM })}
  ${lines(M, 300 + (title.length - 1) * 126 + 128, 40, 54, ["Tu plan, tu ritmo por km", "con GPS y tu fuerza."], { fill: CREAM, weight: 600, track: 0 })}
  <rect x="${M}" y="${H - 190}" width="250" height="72" rx="36" fill="${BANANA}"/>
  <text x="${M + 40}" y="${H - 143}" font-family="${F800}" font-weight="800" font-size="30" fill="${INK}">Desliza</text>
  <path d="M${M + 168} ${H - 154} H${M + 208} M${M + 192} ${H - 168} L${M + 208} ${H - 154} L${M + 192} ${H - 140}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`);

const SLIDES = [
  {
    id: "01-portada",
    svg: cover([[["Tu primer ", null], ["5K,", BANANA]], "semana a", "semana"]),
    variantB: cover([[["De 0 a tu", null]], [["primer ", null], ["5K", BANANA]]]),
  },
  {
    id: "02-semanas",
    svg: svg(PAPER, `
  ${eyebrow(M, 150, "1. LAS SEMANAS")}
  ${seasonChip(PAPER)}
  ${marker(M, 250, 268, 84)}
  ${lines(M, 250, 84, 92, ["Tu plan,", "semana a semana"])}
  ${bullets(M + 4, 410, [
    "Eliges tu carrera, la fecha y tu nivel.",
    ["Los km suben poco a poco, con", "semanas de descarga."],
    ["La última semana baja para que", "llegues fresco a tu 5K."],
  ])}
  ${phone("plan", SHOTS.plan, (W - 740) / 2, 700, 740, 140, 612)}
  <text x="${W / 2}" y="${H - 108}" text-anchor="middle" font-family="${F600}" font-weight="600" font-size="24" fill="${BODY}">Captura real de la app. Plan de ejemplo: el tuyo sale de tu carrera.</text>
  ${foot(2)}`),
  },
  {
    id: "03-ritmos-gps",
    svg: svg(PAPER, `
  ${eyebrow(M, 150, "2. TU RITMO")}
  ${marker(M + 166, 342, 168, 84)}
  ${lines(M, 250, 84, 92, ["Tu ritmo por km", "con GPS en todos", "los planes"])}
  ${lines(M, 530, 36, 48, ["Sin reloj: distancia, tiempo y ritmo por km", "con el teléfono que ya tienes."], { fill: BODY, weight: 600, track: 0 })}
  ${phone("hub", SHOTS.hub, M + 40, 680, W - M * 2 - 80, 600, 1040)}
  <text x="${W / 2}" y="${H - 108}" text-anchor="middle" font-family="${F600}" font-weight="600" font-size="24" fill="${BODY}">Captura real de la app.</text>
  ${foot(3)}`),
  },
  {
    id: "04-fuerza",
    svg: svg(INK, `
  ${eyebrow(M, 150, "3. TU FUERZA", BANANA)}
  ${seasonChip(INK)}
  ${lines(M, 250, 84, 92, [[["Fuerza ", BANANA], ["2 veces", null]], "por semana"], { fill: CREAM })}
  ${bullets(M + 4, 410, [
    ["Tú eliges: 2, 3 o 4 sesiones", "de 30, 45 o 60 minutos."],
    ["Nunca piernas pesadas el día de tus", "series o tu larga, ni el día antes."],
    "En casa o en el gimnasio.",
  ], { fill: CREAM, dot: BANANA })}
  <rect x="${M + 40}" y="790" width="${W - M * 2 - 80}" height="380" rx="42" fill="none" stroke="${BANANA}" stroke-width="4" stroke-dasharray="18 14"/>
  ${lines(W / 2, 950, 44, 56, ["[PENDIENTE]"], { fill: BANANA })}
  ${lines(W / 2, 1020, 30, 42, ["Captura real de una sesión de fuerza", "de la Temporada Running"], { fill: CREAM, weight: 600, track: 0 })}
  ${foot(4, CREAM)}`).replace(/<text x="540"/g, '<text text-anchor="middle" x="540"'),
  },
  {
    id: "05-cta",
    svg: svg(BANANA, `
  <image href="${LOGO}" x="${M}" y="110" width="120" height="120"/>
  <text x="${M + 150}" y="190" font-family="${F800}" font-weight="800" font-size="52" letter-spacing="-1.3" fill="${INK}">Banana<tspan fill="#8A5300">Burn</tspan></text>
  ${lines(M, 420, 104, 112, ["Empieza tu", "primer 5K"])}
  ${lines(M, 640, 38, 52, ["Prueba 7 días gratis. El GPS con tu ritmo", "por km viene en todos los planes."], { fill: INK, weight: 600, track: 0 })}
  <rect x="${M}" y="790" width="${W - M * 2}" height="120" rx="60" fill="${INK}" style="filter:none"/>
  <text x="${W / 2}" y="868" text-anchor="middle" font-family="${F800}" font-weight="800" font-size="46" fill="#FFFFFF">bananaburn.app/running</text>
  ${lines(M, 1030, 30, 42, ["Plan de 5K, ritmos y fuerza: Temporada Running,", "$14.99 pago único. Incluida en el plan anual."], { fill: INK, weight: 600, track: 0 })}
  ${foot(5)}`),
  },
];

/** Vista de las 5 láminas en fila, para revisar el carrusel de un vistazo. */
function strip(pngs) {
  const w = 300;
  const h = (H * w) / W;
  const gap = 24;
  const width = gap + pngs.length * (w + gap);
  const items = pngs.map((p, i) => `<image href="data:image/png;base64,${p.toString("base64")}" x="${gap + i * (w + gap)}" y="${gap}" width="${w}" height="${h}"/>`).join("");
  return render(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h + gap * 2}"><rect width="100%" height="100%" fill="#EDE3C6"/>${items}</svg>`);
}

function render(s) {
  return new Resvg(s, { font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: FONT } }).render().asPng();
}

for (const d of ["svg", "png", "variante-b"]) mkdirSync(join(here, d), { recursive: true });
const pngs = SLIDES.map((s) => {
  writeFileSync(join(here, "svg", `${s.id}.svg`), s.svg);
  const png = render(s.svg);
  writeFileSync(join(here, "png", `${s.id}.png`), png);
  if (s.variantB) {
    writeFileSync(join(here, "variante-b", `${s.id}.svg`), s.variantB);
    writeFileSync(join(here, "variante-b", `${s.id}.png`), render(s.variantB));
  }
  return png;
});
writeFileSync(join(here, "vista-carrusel.png"), strip(pngs));
console.log(`K15: ${pngs.length} láminas`);
