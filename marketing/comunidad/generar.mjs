// Bases editables de historias; los stickers se añaden en cada plataforma.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(process.env.RESVG_DIR || "/tmp/resvg", "noop.js"));
const { Resvg } = require("@resvg/resvg-js");
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
const fonts = mkdtempSync(join(tmpdir(), "bb-community-"));
for (const weight of [600, 800]) {
  writeFileSync(join(fonts, `jakarta-${weight}.ttf`), woffToSfnt(readFileSync(join(here, `../../src/app/og/jakarta-${weight}.woff`))));
}
const out = join(here, "historias");
mkdirSync(out, { recursive: true });
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
for (const file of readdirSync(out).filter((f) => f.endsWith(".json"))) {
  const d = JSON.parse(readFileSync(join(out, file), "utf8"));
  const text = (s, y, size, weight = 600) => `<text x="90" y="${y}" fill="#1B1505" font-family="Plus Jakarta Sans ${weight === 800 ? "ExtraBold" : "SemiBold"}" font-weight="${weight}" font-size="${size}">${esc(s)}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><title>${esc(d.title)}</title><rect width="1080" height="1920" fill="#FFD60A"/>${text("BANANA BURN", 340, 32, 800)}${text(d.lines[0], 540, 62, 800)}${text(d.lines[1], 625, 62, 800)}${text(d.sub, 760, 34)}${text("bananaburn.app", 1530, 30)}</svg>`;
  const name = file.slice(0, -5);
  writeFileSync(join(out, `${name}.svg`), svg);
  const png = new Resvg(svg, { font: { loadSystemFonts: false, fontDirs: [fonts] } }).render().asPng();
  writeFileSync(join(out, `${name}.png`), png);
}
