// Revisión de accesibilidad con axe-core (WCAG 2.1 A y AA) sobre un build de producción en modo demo.
// Uso: npm run build && npx next start -p 3941 & ; BASE=http://localhost:3941 node scripts/a11y-scan.cjs
// Opcional: PAGES=/app,/app/entrenar  PERSONAS=chico,chica  WIDTH=390 (ancho de la ventana).
// Imprime cada problema con la página, la regla, el impacto y los elementos. Sale con código 1 si hay problemas
// "serious" o "critical" (los "moderate" y "minor" se reportan, pero no fallan).
// eslint-disable-next-line @typescript-eslint/no-require-imports -- script de QA en CommonJS (playwright está instalado global)
const { chromium } = require("playwright"); // global en el entorno de QA (no es dependencia del proyecto)
const axePath = require.resolve("axe-core/axe.min.js");

const base = process.env.BASE || "http://localhost:3000";
const pages = (process.env.PAGES || "/,/app,/app/entrenar,/app/progreso,/app/nutricion,/app/coach,/app/perfil,/app/suscripcion,/app/entreno").split(",");
const personas = (process.env.PERSONAS || "chico,chica").split(",");
const width = Number(process.env.WIDTH || 390);
// Partes que no son de la app: el aviso del modo demo y widgets de terceros.
const EXCLUDE = [["[data-demo]"], ["iframe"]];

(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  for (const who of personas) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 800, hasTouch: width < 800 });
    const page = await ctx.newPage();
    // La persona del demo se elige con un parámetro (queda en una cookie para el resto de las páginas).
    await page.goto(`${base}/app?persona=${who}${who === "chica" ? "&programa=banana-girl" : "&programa=no"}`, { waitUntil: "networkidle" }).catch(() => {});
    for (const path of pages) {
      await page.goto(base + path, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(800);
      await page.addScriptTag({ path: axePath });
      const res = await page.evaluate(async (exclude) => {
        const r = await axe.run({ exclude }, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] });
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 5).map((n) => n.target.join(" ") + (n.failureSummary ? ` :: ${n.failureSummary.split("\n").slice(1, 2).join(" ").trim()}` : "")), count: v.nodes.length }));
      }, EXCLUDE);
      for (const v of res) {
        if (v.impact === "serious" || v.impact === "critical") bad++;
        console.log(`[${who}] ${path}  ${v.impact}  ${v.id} (${v.count}): ${v.help}`);
        for (const n of v.nodes) console.log(`    ${n}`);
      }
      if (!res.length) console.log(`[${who}] ${path}  sin problemas`);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(bad ? `\n${bad} problemas serios o críticos.` : "\nSin problemas serios ni críticos.");
  process.exit(bad ? 1 : 0);
})();
