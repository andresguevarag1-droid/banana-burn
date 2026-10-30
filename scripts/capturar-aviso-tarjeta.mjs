// Requiere Playwright y Chromium instalados. Ejecutar contra next dev sin Supabase (demo).
// BB_CAPTURE_BASE=http://localhost:3000 node scripts/capturar-aviso-tarjeta.mjs
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const dir = 'docs/qa/issue-70/capturas';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    for (const [screen, route] of [['hoy', '/app'], ['mi-plan', '/app/suscripcion']]) {
      for (const state of ['dia5', 'dia6', 'dia7', 'tarjeta-lista']) {
        await page.goto(`${process.env.BB_CAPTURE_BASE || 'http://localhost:3000'}${route}?demo=${state}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const notice = page.getByRole('complementary', { name: 'Guardar tarjeta es opcional' });
        const expected = state === 'tarjeta-lista' ? 0 : 1;
        if (await notice.count() !== expected) throw new Error(`Estado incorrecto: ${screen}/${state}`);
        if (expected) {
          await notice.getByRole('link', { name: 'Continuar sin tarjeta' }).waitFor({ state: 'visible' });
        }
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Desborde: ${screen}/${state}/${width}`);
        await page.screenshot({ path: `${dir}/${screen}-${state}-${width}.png`, fullPage: true });
      }
    }
    await page.close();
  }
} finally { await browser.close(); }
