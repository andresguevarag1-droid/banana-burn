// Carga varias veces las páginas públicas en un build de producción y cuenta errores de hidratación de React (#418 y
// parecidos). Sirve para errores intermitentes que no salen en desarrollo (oct 2026: el Meta Pixel en ~5 % de cargas).
// Uso: npm run build && npx next start -p 3931 & ; BASE=http://localhost:3931 N=30 node scripts/hydration-loop.cjs
// Sale con código 1 si encuentra alguno.
const { chromium } = require("playwright"); // global en el entorno de QA (no es dependencia del proyecto)

const base = process.env.BASE || "http://localhost:3000";
const pages = (process.env.PAGES || "/,/precios,/glp1,/terminos,/temporadas,/entrar").split(",");
const N = Number(process.env.N || 20);

(async () => {
const browser = await chromium.launch();
let bad = 0;
for (const p of pages) {
  let errs = 0;
  for (let i = 0; i < N; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-CR", timezoneId: "America/Costa_Rica" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => { if (/#4(18|19|23|25)|[Hh]ydrat/.test(e.message)) errs++; });
    await page.goto(base + p, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(400);
    await ctx.close();
  }
  console.log(`${p}: ${errs} errores de hidratación en ${N} cargas`);
  bad += errs;
}
await browser.close();
process.exit(bad ? 1 : 0);

})();
