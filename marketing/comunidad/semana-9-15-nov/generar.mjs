// Genera las historias, los carruseles y las guías de revisión de la semana del 9 al 15 de noviembre. No publica nada.
// Arte v2 (7 nov 2026): Coach Banana en grande, capturas reales de la app (public/landing/campana-9nov) dentro de un
// celular y una sola idea por pieza. Colores y tipografía del libro de marca: banana #FFD60A, ink #1B1505, paper #FFF8E3,
// Plus Jakarta Sans 600/800. Sin emojis, sin mencionar IA y sin "sin tarjeta" en el arte.
// Uso, desde la raíz del repo y con Playwright instalado: node marketing/comunidad/semana-9-15-nov/generar.mjs
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const require = createRequire(join(root, "package.json"));
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = await import("playwright")); }

const b64 = (p) => readFileSync(join(root, p)).toString("base64");
const font = (w) => `@font-face{font-family:J;font-weight:${w};src:url(data:font/woff;base64,${b64(`src/app/og/jakarta-${w}.woff`)}) format("woff")}`;
const img = (p, mime = "image/png") => `data:${mime};base64,${b64(p)}`;
const COACH = img("public/brand/mascota-sola.webp", "image/webp");
const S = (n) => img(`public/landing/campana-9nov/${n}.png`);
const SCREEN = { gym: S("c6-guiado-gym"), casa: S("c2-guiado-casa"), tecnica: S("c8-como-se-hace"), descanso: S("c4-descanso"), hoy: S("c1-hoy-primer-dia"), resumen: S("c5-resumen") };
// Captura de cada tema: la pantalla real que prueba lo que dice la pieza.
const SCREEN_BY_THEME = {
  "¿Cuánto peso usar?": "gym", "Peso y técnica": "gym", "Tu primer entreno en casa": "casa", "¿Necesito ir al gym?": "casa",
  "Entrenar en español": "tecnica", "Tu primer entreno en el gym": "tecnica", "Cierra la semana empezando": "casa", "Condominios Costa Rica": "gym",
};

const data = JSON.parse(readFileSync(join(here, "contenido.json"), "utf8"));
for (const d of ["historias", "carruseles", "revision"]) mkdirSync(join(here, d), { recursive: true });
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

const BASE = `${font(600)}${font(800)}
*{box-sizing:border-box;margin:0}
body{font-family:J,sans-serif;color:#1B1505;-webkit-font-smoothing:antialiased}
.f{position:relative;overflow:hidden}
.chip{display:inline-block;border-radius:999px;padding:14px 28px;font-weight:800;font-size:30px;letter-spacing:.06em;text-transform:uppercase}
h1{font-weight:800;letter-spacing:-.035em;line-height:.98;text-wrap:balance}
p.b{font-weight:600;line-height:1.28;text-wrap:pretty}
.coach{position:absolute;filter:drop-shadow(0 24px 30px rgba(27,21,5,.28))}
.phone{position:absolute;border-radius:64px;background:#1B1505;padding:18px;box-shadow:0 40px 80px rgba(27,21,5,.35)}
.phone img{display:block;width:100%;border-radius:48px}
.url{font-weight:800;font-size:40px}
.pill{display:inline-flex;align-items:center;gap:18px;border-radius:999px;font-weight:800}
.guide{position:absolute;border:4px dashed #1B1505}
.mark{position:absolute;font-weight:800;font-size:26px;letter-spacing:.06em}`;

// Historias 1080 × 1920. Zonas libres: y 0–249 y 1570–1919. Sticker nativo: x 90, y 1160, 900 × 270.
const THEMES = {
  encuesta: { bg: "#FFF8E3", ink: "#1B1505", chipBg: "#1B1505", chipInk: "#FFD60A" },
  quiz: { bg: "#FFD60A", ink: "#1B1505", chipBg: "#1B1505", chipInk: "#FFD60A" },
  caja: { bg: "#1B1505", ink: "#FFF8E3", head: "#FFD60A", chipBg: "#FFD60A", chipInk: "#1B1505" },
  ninguno: { bg: "#FFF8E3", ink: "#1B1505", chipBg: "#FFD60A", chipInk: "#1B1505" },
  enlace: { bg: "#FFD60A", ink: "#1B1505", chipBg: "#1B1505", chipInk: "#FFD60A" },
};
const CHIP = { encuesta: "Encuesta", quiz: "Pon a prueba", caja: "Pregúntale a Coach", ninguno: "Así se ve en la app", enlace: "Tu primer entreno" };

function story(s, guide) {
  const t = THEMES[s.kind];
  const cr = s.audience === "Solo Costa Rica";
  const label = cr ? "Costa Rica" : CHIP[s.kind];
  const head = `<div style="position:absolute;left:90px;top:290px;right:90px">
      <span class="chip" style="background:${t.chipBg};color:${t.chipInk}">${esc(label)}</span>
      <h1 style="margin-top:44px;font-size:${s.title.length > 30 ? 104 : 120}px;color:${t.head ?? t.ink}">${esc(s.title)}</h1>
      <p class="b" style="margin-top:36px;font-size:48px;color:${t.ink};max-width:${s.kind === "ninguno" || s.kind === "enlace" ? 900 : 640}px">${esc(s.body)}</p>
    </div>`;
  let art = "";
  if (s.kind === "ninguno" || s.kind === "enlace") {
    // Captura real en un celular, con Coach Banana al lado. Todo termina antes de y 1570.
    const screen = SCREEN[SCREEN_BY_THEME[s.theme] ?? "casa"];
    art = `<div class="phone" style="left:420px;top:900px;width:520px;height:1080px;transform:rotate(-4deg)"><img src="${screen}" alt=""></div>
      <img class="coach" src="${COACH}" alt="" style="left:30px;top:1060px;width:480px">`;
    if (s.kind === "enlace") art = `<div class="pill" style="position:absolute;left:90px;top:${s.body.length > 50 ? 860 : 800}px;background:#1B1505;color:#FFD60A;font-size:40px;padding:26px 44px;z-index:2">bananaburn.app &rarr;</div>` + art.replace("top:900px", "top:1000px").replace("top:1060px", "top:1130px");
    // El celular y Coach se cortan en y 1570: debajo va la interfaz de Instagram.
    art = `<div style="position:absolute;inset:0 0 350px 0;overflow:hidden">${art}</div>`;
  } else {
    // Con sticker: Coach grande a la derecha, arriba del sticker. El sticker va en la zona marcada.
    art = `<img class="coach" src="${COACH}" alt="" style="right:-40px;top:${s.body.length > 50 ? 760 : 700}px;width:460px">`;
  }
  const foot = s.kind === "enlace" || s.kind === "ninguno" ? "" : `<div class="url" style="position:absolute;left:90px;top:1478px;color:${t.ink}">bananaburn.app</div>`;
  const g = guide ? `<div class="guide" style="left:25px;top:250px;width:1030px;height:1320px"></div>
      ${s.kind !== "ninguno" ? `<div class="guide" style="left:90px;top:1160px;width:900px;height:270px;border-radius:24px;background:rgba(255,255,255,.35)"></div><div class="mark" style="left:120px;top:1278px;color:#1B1505">ZONA DEL STICKER NATIVO</div>` : ""}` : "";
  return `<div class="f" style="width:1080px;height:1920px;background:${t.bg}">${head}${art}${foot}${g}</div>`;
}

// Carruseles 1080 × 1350: portada banana con Coach, láminas paper con la captura y cierre ink con la llamada.
function slide(c, i, [title, body]) {
  const n = c.slides.length;
  const tag = c.id === "cr" ? "Costa Rica" : c.id === "usa" ? "En español" : "Paso a paso";
  const count = `<div style="position:absolute;right:90px;top:96px;font-weight:800;font-size:30px;letter-spacing:.06em">${i + 1} / ${n}</div>`;
  if (i === 0) {
    return `<div class="f" style="width:1080px;height:1350px;background:#FFD60A">
      <div style="position:absolute;left:90px;top:90px"><span class="chip" style="background:#1B1505;color:#FFD60A">${tag}</span></div>${count}
      <h1 style="position:absolute;left:90px;top:230px;width:900px;font-size:${title.length > 22 ? 118 : 138}px">${esc(title)}</h1>
      <p class="b" style="position:absolute;left:90px;top:${title.length > 22 ? 640 : 560}px;width:500px;font-size:46px">${esc(body)}</p>
      <img class="coach" src="${COACH}" alt="" style="right:-70px;bottom:-60px;width:640px">
      <div class="pill" style="position:absolute;left:90px;bottom:90px;background:#1B1505;color:#FFD60A;font-size:32px;padding:20px 34px">Desliza &rarr;</div>
    </div>`;
  }
  if (i === n - 1) {
    return `<div class="f" style="width:1080px;height:1350px;background:#1B1505;color:#FFF8E3">${count.replace("right:90px", "right:90px;color:#FFD60A")}
      <h1 style="position:absolute;left:90px;top:200px;width:900px;font-size:128px;color:#FFD60A">${esc(title)}</h1>
      <p class="b" style="position:absolute;left:90px;top:520px;width:560px;font-size:46px">${esc(body)}</p>
      <div class="pill" style="position:absolute;left:90px;top:${body.length > 70 ? 860 : 780}px;background:#FFD60A;color:#1B1505;font-size:44px;padding:30px 48px">bananaburn.app &rarr;</div>
      <p class="b" style="position:absolute;left:90px;bottom:90px;font-size:32px;color:#FFF8E3;opacity:.8">Enlace en el perfil</p>
      <img class="coach" src="${COACH}" alt="" style="right:-60px;bottom:-40px;width:520px">
    </div>`;
  }
  const keys = c.id === "usa" ? ["casa", "tecnica", "casa"] : c.id === "cr" ? ["gym", "tecnica", "gym"] : ["gym", "tecnica", "casa"];
  const screen = SCREEN[keys[(i - 1) % keys.length]];
  return `<div class="f" style="width:1080px;height:1350px;background:#FFF8E3">${count}
    <div style="position:absolute;left:90px;top:90px;width:110px;height:110px;border-radius:999px;background:#FFD60A;display:grid;place-items:center;font-weight:800;font-size:54px">${i + 1}</div>
    <h1 style="position:absolute;left:90px;top:260px;width:470px;font-size:${title.length > 26 ? 72 : 84}px">${esc(title)}</h1>
    <p class="b" style="position:absolute;left:90px;top:${title.length > 26 ? 620 : 560}px;width:450px;font-size:${body.length > 90 ? 36 : 42}px">${esc(body)}</p>
    <div class="phone" style="left:610px;top:200px;width:420px;transform:rotate(3deg)"><img src="${screen}" alt=""></div>
    <div class="url" style="position:absolute;left:90px;bottom:90px;font-size:34px">bananaburn.app</div>
  </div>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function shot(html, w, h, out) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${BASE}</style></head><body>${html}</body></html>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  // Control: ningún texto se sale de su pieza ni entra en la zona baja de las historias.
  const over = await page.evaluate((story) => [...document.querySelectorAll("h1,p.b")].some((el) => {
    const r = el.getBoundingClientRect();
    return r.right > 1080 - 40 || (story && r.bottom > 1150 && !el.closest("[data-ok]"));
  }), h === 1920);
  if (over) console.warn("Revisar desborde:", out);
  await page.screenshot({ path: join(here, out), clip: { x: 0, y: 0, width: w, height: h } });
}
for (const s of data.stories) {
  await shot(story(s, false), 1080, 1920, `historias/${s.id}.png`);
  await shot(story(s, true), 1080, 1920, `revision/${s.id}-guia.png`);
}
for (const c of data.carousels) for (const [i, sl] of c.slides.entries()) await shot(slide(c, i, sl), 1080, 1350, `carruseles/${c.id}-${i + 1}.png`);
await browser.close();
console.log(`${data.stories.length} historias, ${data.carousels.length} carruseles y sus guías generadas.`);
