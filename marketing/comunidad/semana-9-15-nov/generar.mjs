// Genera bases publicables y guías separadas para revisión. No publica.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const require = createRequire(join(process.env.RESVG_DIR || "/tmp/resvg", "noop.js"));
const { Resvg } = require("@resvg/resvg-js");
const sharp = require("sharp");
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

const fonts = mkdtempSync(join(tmpdir(), "bb-274-"));
for (const weight of [600, 800]) writeFileSync(join(fonts, `jakarta-${weight}.ttf`), woffToSfnt(readFileSync(join(root, `src/app/og/jakarta-${weight}.woff`))));
const mascot = (await sharp(join(root, "public/brand/mascota-sola.webp")).png().toBuffer()).toString("base64");
const data = JSON.parse(readFileSync(join(here, "contenido.json"), "utf8"));
for (const dir of ["historias", "carruseles", "revision"]) mkdirSync(join(here, dir), {recursive:true});
const esc = s => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
function lines(s, max) {
  const a = [""];
  for (const w of s.split(" ")) {
    if ((a.at(-1) + " " + w).trim().length > max) a.push(w);
    else a[a.length-1] = (a.at(-1) + " " + w).trim();
  }
  return a;
}
function text(s, y, size, max, weight=600, color="#1B1505") {
 return lines(s,max).map((l,i)=>`<text x="90" y="${y+i*size*1.25}" fill="${color}" font-family="Plus Jakarta Sans ${weight===800?"ExtraBold":"SemiBold"}" font-size="${size}" font-weight="${weight}">${esc(l)}</text>`).join("");
}
function save(path, svg) {
 writeFileSync(join(here,path+".png"),new Resvg(svg,{font:{loadSystemFonts:false,fontDirs:[fonts]}}).render().asPng());
}
function art(title,body,story,label,yellow,guide=false,sticker=false) {
 const h = story?1920:1350;
 const bg=yellow?"#FFD60A":"#FFF8E3";
 const headingY=story?480:300;
 const titleLines=lines(title,22).length;
 const bodyY=headingY+titleLines*83+50;
 const bodyLines=lines(body,39).length;
 if (bodyY+(bodyLines-1)*47.5 > (story?1080:870)) throw Error("Copy overflow: "+title);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${h}" viewBox="0 0 1080 ${h}"><title>${esc(title)}</title><rect width="1080" height="${h}" fill="${bg}"/>${text("BANANA BURN",story?330:130,28,40,800)}${text(label,story?385:185,22,65)}${text(title,headingY,66,22,800)}${text(body,bodyY,38,39)}<image href="data:image/png;base64,${mascot}" x="740" y="${story?1440:965}" width="240" height="${story?125:220}" preserveAspectRatio="xMidYMid meet"/>${text("bananaburn.app",story?1535:1245,30,40,800)}${guide?`<rect x="25" y="250" width="1030" height="1320" fill="none" stroke="#1B1505" stroke-width="3" stroke-dasharray="12 12"/>${sticker?'<rect x="90" y="1160" width="900" height="270" rx="24" fill="none" stroke="#1B1505" stroke-width="4" stroke-dasharray="10 10"/>'+text("ZONA DEL STICKER NATIVO",1300,26,45):""}`:""}</svg>`;
}
for (const s of data.stories) {
 const label=s.audience==="Solo Costa Rica"?"COSTA RICA":"TU PRIMER ENTRENO";
 save(`historias/${s.id}`,art(s.title,s.body,true,label,s.kind==="enlace"));
 save(`revision/${s.id}-guia`,art(s.title,s.body,true,label,s.kind==="enlace",true,s.kind!=="ninguno"));
}
for (const c of data.carousels) c.slides.forEach(([t,b],i)=>save(`carruseles/${c.id}-${i+1}`,art(t,b,false,`${c.id==="cr"?"COSTA RICA":c.id==="usa"?"EN ESPAÑOL":"PASO A PASO"} / ${i+1} DE ${c.slides.length}`,i===0||i===c.slides.length-1)));
console.log(`${data.stories.length} historias, ${data.carousels.length} carruseles y guías generadas.`);
