// Portadas de destacados de @bananaburnapp (1080 x 1920) hechas en código.
// Escribe la fuente editable en svg/ y la imagen final en png/, más la vista del perfil (vista-perfil.png).
// Solo usa paper #FFF8E3, banana #FFD60A e ink #1B1505, y Plus Jakarta Sans (las fuentes de src/app/og).
//
// Uso, desde la raíz del repo:
//   npm i --no-save --prefix /tmp/resvg @resvg/resvg-js@2
//   RESVG_DIR=/tmp/resvg node marketing/instagram/perfil/destacados/generar.mjs
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../../..");
const require = createRequire(process.env.RESVG_DIR ? join(process.env.RESVG_DIR, "noop.js") : import.meta.url);
const { Resvg } = require("@resvg/resvg-js");

const PAPER = "#FFF8E3";
const BANANA = "#FFD60A";
const INK = "#1B1505";
const W = 1080;
const H = 1920;
const FONT = "Plus Jakarta Sans";
// Las fuentes del repo traen la familia como "Plus Jakarta Sans ExtraBold/SemiBold"; en un editor con la fuente instalada manda la primera.
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

// resvg (Node) solo carga fuentes desde archivos: se escriben las TTF en una carpeta temporal.
const fontDir = mkdtempSync(join(tmpdir(), "bb-fuentes-"));
const fonts = ["jakarta-800", "jakarta-600"].map((f) => {
  const file = join(fontDir, `${f}.ttf`);
  writeFileSync(file, woffToSfnt(readFileSync(join(root, "src/app/og", `${f}.woff`))));
  return file;
});

/** Iconos en una cuadrícula de 100 x 100. `fg` dibuja, `bg` recorta huecos (el centro del pin). */
const ICONS = {
  empieza: (fg) => `<path d="M36 22 L80 50 L36 78 Z" fill="${fg}" stroke="${fg}" stroke-width="10" stroke-linejoin="round"/>`,
  condominios: (fg) => `
    <g fill="none" stroke="${fg}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
      <rect x="18" y="20" width="38" height="66" rx="4"/>
      <path d="M56 44 H78 a4 4 0 0 1 4 4 V86"/>
      <path d="M10 86 H90"/>
    </g>
    <g fill="${fg}">
      <rect x="27" y="31" width="8" height="8" rx="2"/><rect x="39" y="31" width="8" height="8" rx="2"/>
      <rect x="27" y="45" width="8" height="8" rx="2"/><rect x="39" y="45" width="8" height="8" rx="2"/>
      <rect x="27" y="59" width="8" height="8" rx="2"/><rect x="39" y="59" width="8" height="8" rx="2"/>
      <rect x="64" y="55" width="10" height="8" rx="2"/><rect x="64" y="69" width="10" height="8" rx="2"/>
      <rect x="32" y="72" width="10" height="14" rx="2"/>
    </g>`,
  glp1: (fg) => `
    <g fill="${fg}">
      <rect x="20" y="28" width="13" height="44" rx="5"/><rect x="67" y="28" width="13" height="44" rx="5"/>
      <rect x="9" y="37" width="9" height="26" rx="4"/><rect x="82" y="37" width="9" height="26" rx="4"/>
    </g>
    <path d="M33 50 H67" stroke="${fg}" stroke-width="8" stroke-linecap="round"/>`,
  running: (fg, bg) => `
    <path d="M22 84 C 22 64 52 72 52 58 S 74 54 76 48" fill="none" stroke="${fg}" stroke-width="7" stroke-linecap="round" stroke-dasharray="9 11"/>
    <circle cx="22" cy="84" r="7" fill="${fg}"/>
    <path d="M76 46 C 66 34 61 29 61 22 A15 15 0 0 1 91 22 C 91 29 86 34 76 46 Z" fill="${fg}"/>
    <circle cx="76" cy="22" r="6" fill="${bg}"/>`,
  temporadas: (fg) => `
    <g fill="none" stroke="${fg}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
      <rect x="14" y="22" width="72" height="64" rx="10"/>
      <path d="M14 40 H86"/><path d="M34 13 V29"/><path d="M66 13 V29"/>
    </g>
    <g fill="${fg}">
      <circle cx="32" cy="55" r="5"/><circle cx="50" cy="55" r="5"/><circle cx="68" cy="55" r="5"/>
      <circle cx="32" cy="71" r="5"/><circle cx="50" cy="71" r="5"/>
    </g>`,
};

const COVERS = [
  { id: "01-empieza", icon: "empieza", label: "Empieza" },
  { id: "02-condominios", icon: "condominios", label: "Condominios" },
  { id: "03-glp-1", icon: "glp1", label: "GLP-1", note: "No sustituye la indicación de tu médico." },
  { id: "04-running", icon: "running", label: "Running" },
  { id: "05-temporadas", icon: "temporadas", label: "Temporadas" },
];

/** A: banana con dibujo ink (la apuesta). B: ink con dibujo banana. El anillo es paper en A y banana en B; nada usa transparencias. */
const VARIANTS = {
  a: { bg: BANANA, fg: INK, ring: PAPER },
  b: { bg: INK, fg: BANANA, ring: BANANA },
};

const ICON = 540; // lado del icono; queda dentro del círculo que recorta Instagram (centro de 1080 x 1080)

function cover({ icon, label, note }, { bg, fg, ring }) {
  const x = (W - ICON) / 2;
  const y = (H - ICON) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <circle cx="${W / 2}" cy="${H / 2}" r="430" fill="none" stroke="${ring}" stroke-width="12"/>
  <g transform="translate(${x} ${y}) scale(${ICON / 100})">${ICONS[icon](fg, bg)}</g>
  <text x="${W / 2}" y="330" text-anchor="middle" font-family="${F800}" font-weight="800" font-size="40" letter-spacing="6" fill="${fg}">BANANA BURN</text>
  <text x="${W / 2}" y="1620" text-anchor="middle" font-family="${F800}" font-weight="800" font-size="120" letter-spacing="-2.4" fill="${fg}">${label}</text>
  ${note ? `<text x="${W / 2}" y="1700" text-anchor="middle" font-family="${F600}" font-weight="600" font-size="38" fill="${fg}">${note}</text>` : ""}
</svg>
`;
}

function render(svg, width) {
  return new Resvg(svg, {
    fitTo: width ? { mode: "width", value: width } : { mode: "original" },
    font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: FONT },
  }).render().asPng();
}

/** Cómo se ven los 5 círculos en el perfil (recorte central de 1080 x 1080), sobre fondo paper. */
function preview(pngs, variant) {
  const size = 170;
  const gap = 44;
  const pad = 60;
  const width = pad * 2 + COVERS.length * size + (COVERS.length - 1) * gap;
  const items = COVERS.map((c, i) => {
    const cx = pad + i * (size + gap) + size / 2;
    const href = `data:image/png;base64,${pngs[i].toString("base64")}`;
    const scale = size / W;
    return `
    <clipPath id="c${i}"><circle cx="${cx}" cy="${pad + size / 2}" r="${size / 2}"/></clipPath>
    <image href="${href}" x="${cx - size / 2}" y="${pad + size / 2 - (H * scale) / 2}" width="${size}" height="${H * scale}" clip-path="url(#c${i})"/>
    <text x="${cx}" y="${pad + size + 46}" text-anchor="middle" font-family="${F600}" font-weight="600" font-size="24" fill="${INK}">${c.label}</text>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${pad * 2 + size + 60}">
  <rect width="100%" height="100%" fill="${PAPER}"/>${items}
  <text x="${width - pad / 2}" y="34" text-anchor="end" font-family="${F800}" font-weight="800" font-size="20" fill="${INK}">Variante ${variant.toUpperCase()}</text>
</svg>`;
  return render(svg);
}

for (const [v, colors] of Object.entries(VARIANTS)) {
  const svgDir = join(here, v, "svg");
  const pngDir = join(here, v, "png");
  mkdirSync(svgDir, { recursive: true });
  mkdirSync(pngDir, { recursive: true });
  const pngs = COVERS.map((c) => {
    const svg = cover(c, colors);
    writeFileSync(join(svgDir, `${c.id}.svg`), svg);
    const png = render(svg);
    writeFileSync(join(pngDir, `${c.id}.png`), png);
    return png;
  });
  writeFileSync(join(here, `vista-perfil-${v}.png`), preview(pngs, v));
  console.log(`Variante ${v}: ${pngs.length} portadas`);
}
