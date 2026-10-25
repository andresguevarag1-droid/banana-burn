// Recorrido de ingresos en modo demo (build de producción local sin Supabase): landing → registro → paso de tarjeta →
// Mi plan → muro de planes, en celular, también con el navegador de Instagram. Revisa errores, botones sin destino y que
// los precios coincidan con plans.ts y las reglas de la oferta (50 % solo en el primer mes mensual).
// Uso: BASE=http://localhost:3931 NODE_PATH=$(npm root -g) node scripts/smoke-ingresos.cjs
// eslint-disable-next-line @typescript-eslint/no-require-imports -- script de QA en CommonJS (playwright está instalado global)
const { chromium } = require("playwright");
const base = process.env.BASE || "http://localhost:3000";
const IG = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0 (iPhone14,5; iOS 17_5; es_CR; es-CR; scale=3.00; 1170x2532)";
const problems = [];
const ok = (cond, msg) => { if (!cond) problems.push(msg); };

async function visit(b, path, { ua, check } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "es-CR", timezoneId: "America/Costa_Rica", ...(ua ? { userAgent: ua } : {}) });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
  pg.on("response", (r) => { const u = r.url(); if (u.startsWith(base) && r.status() >= 400 && !/\/api\/(track|errores)/.test(u) && !/_next\/image\?url=https%3A%2F%2F/.test(u)) errs.push(`${r.status()} ${u.replace(base, "")}`); });
  const res = await pg.goto(base + path, { waitUntil: "networkidle" }).catch((e) => ({ status: () => 0, e }));
  ok(res.status() === 200, `${path}: estado ${res.status()}`);
  await pg.waitForTimeout(600);
  const text = await pg.evaluate(() => document.body.innerText);
  if (check) await check(pg, text);
  ok(errs.length === 0, `${path}${ua ? " (Instagram)" : ""}: ${errs.join(" | ")}`);
  await ctx.close();
}

(async () => {
  const b = await chromium.launch();
  for (const ua of [undefined, IG]) {
    await visit(b, "/", { ua, check: async (pg, t) => {
      const hrefs = await pg.$$eval("a[data-cta]", (as) => as.map((a) => [a.getAttribute("data-cta"), a.getAttribute("href")]));
      ok(hrefs.length > 3, "/: pocos botones con data-cta");
      for (const [cta, h] of hrefs) ok(h && h !== "#" && !h.startsWith("javascript"), `/: botón ${cta} sin destino (${h})`);
      ok(/\$9\.99/.test(t) && /\$14\.99/.test(t), "/: faltan precios mensuales");
      // El botón principal lleva al registro y el registro funciona.
      const hero = await pg.$('a[data-cta="hero"]');
      ok(!!hero, "/: no hay botón principal (data-cta=hero)");
      await hero.click(); await pg.waitForURL(/\/entrar/, { timeout: 15000 }).catch(() => {}); await pg.waitForLoadState("networkidle");
      ok(/\/entrar/.test(pg.url()), `/: el botón principal no lleva a /entrar (${pg.url()})`);
      // Con Supabase: correo y contraseña. En modo demo (build local sin Supabase) hay un botón para explorar la app.
      const pw = await pg.$('input[type="password"]');
      const demoBtn = await pg.$("text=/Explorar Banana Burn/");
      ok(!!pw || !!demoBtn, "registro: ni formulario ni botón de demo (callejón sin salida)");
      if (ua) { const g = await pg.$("text=/Google/i"); ok(!g || !(await g.isVisible()), "registro en Instagram: se ve el botón de Google"); }
    } });
  }
  // Tilopay en demo no corre (necesita una cuenta real); al menos que la ruta no falle sin sesión.
  {
    const r = await fetch(base + "/api/pagos/tilopay");
    ok(r.status < 500, `/api/pagos/tilopay sin sesión: ${r.status}`);
  }
  await visit(b, "/precios", { check: async (pg, t) => {
    for (const p of ["$9.99", "$14.99"]) ok(t.includes(p), `/precios: falta ${p}`);
    const anual = await pg.$("text=/^Anual/");
    if (anual) { await anual.click(); await pg.waitForTimeout(300); }
    const t2 = await pg.evaluate(() => document.body.innerText);
    ok(t2.includes("$59.99") && t2.includes("$89.99"), "/precios: faltan precios anuales");
    ok(/1 temporada deportiva gratis/i.test(t2), "/precios: el anual no dice 'Incluye 1 temporada deportiva gratis'");
  } });
  await visit(b, "/bienvenida?vista=tarjeta", { check: async (pg, t) => {
    ok(/\$4\.99/.test(t) && /\$7\.49/.test(t), "tarjeta: faltan $4.99/$7.49 del primer mes");
    ok(/Seguir sin tarjeta/.test(t), "tarjeta: falta 'Seguir sin tarjeta'");
    const anual = await pg.$("text=/^Anual/");
    if (anual) { await anual.click(); await pg.waitForTimeout(300); const t2 = await pg.evaluate(() => document.body.innerText); ok(!/\$29\.99|\$44\.99/.test(t2), "tarjeta: el anual muestra descuento"); ok(/\$59\.99|\$89\.99/.test(t2), "tarjeta: el anual no muestra su precio"); }
  } });
  for (const d of ["beta", "nueva", "vencida", "fallo", "procesando", "cancelado"]) {
    await visit(b, `/app/suscripcion?demo=${d}`, { check: async (pg, t) => {
      ok(!/\$5\.00|\$7\.50/.test(t), `Mi plan (${d}): precio redondeado mal`);
      if (d === "vencida") ok(/\$9\.99|\$4\.99/.test(t), "muro: sin precios");
    } });
  }
  await b.close();
  console.log(problems.length ? "PROBLEMAS:\n- " + problems.join("\n- ") : "OK: recorrido de ingresos sin problemas");
  process.exit(problems.length ? 1 : 0);
})();
