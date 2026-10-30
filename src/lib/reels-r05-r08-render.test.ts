import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Geometría y formato de salida de render.mjs frente al kit (1080 x 1920, 30 fps, zona segura).
const slugs = ["R05_sin-reloj", "R06_proteina-primero", "R07_gym-edificio", "R08_bascula"];
const SAFE = { top: 250, bottom: 1570, left: 60, right: 1020 };

for (const slug of slugs) {
  const dir = `marketing/videos/${slug}`;
  const render = readFileSync(`${dir}/proyecto/render.mjs`, "utf8");

  describe(`${slug}: render.mjs`, () => {
    it("codifica 1080 x 1920 a 30 fps en H.264, sin audio", () => {
      expect(render).toContain("const W = 1080, H = 1920;");
      expect(render).toMatch(/'-s', '1080x1920', '-r', '30'/);
      expect(render).toContain("'-an', '-c:v', 'libx264'");
      expect(readFileSync(`${dir}/proyecto/escenas.mjs`, "utf8")).toContain("export const FPS = 30;");
    });

    it("recorta todo el contenido a la zona segura del kit", () => {
      const { top, bottom, left, right } = SAFE;
      expect(render).toContain(`ctx.rect(${left}, ${top}, ${right - left}, ${bottom - top}); ctx.clip();`);
      expect(render).toContain(`y >= ${top} && y + lines.length * size * 1.2 <= ${bottom}`);
    });

    it("cada bloque de texto, en su altura máxima, queda dentro de la zona segura", () => {
      const calls = [...render.matchAll(/texto\(ctx, [^,]+, (\d+), (\d+), \d+, C\.\w+, (\d+)\)/g)];
      expect(calls.length).toBe(4);
      for (const [call, y, ancho, maxAlto] of calls) {
        expect(Number(y), call).toBeGreaterThanOrEqual(SAFE.top);
        expect(Number(y) + Number(maxAlto), call).toBeLessThanOrEqual(SAFE.bottom);
        expect(Number(ancho), call).toBeLessThanOrEqual(SAFE.right - SAFE.left);
      }
    });

    it("falla sin la pose oficial en vez de usar otra", () => {
      expect(render).toContain("const pose = join(salida, 'assets/coach-banana-senala.png');");
      expect(render).toContain("assert.ok(existsSync(pose),");
    });
  });
}
