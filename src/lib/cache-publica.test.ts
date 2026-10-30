// Caché de lo público: las páginas de (marketing) son ISR y no leen nada de la persona; las animaciones de técnica
// salen de /_next/image con la caché larga de next.config.ts (images.minimumCacheTTL), que no se puede poner en una ruta.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRAMES_HOST } from "./exercise-frames";
import { config } from "../middleware";

const root = join(__dirname, "..");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const marketing = join(root, "app/(marketing)");
const pages = walk(marketing).filter((f) => f.endsWith("/page.tsx"));

describe("caché de las páginas públicas", () => {
  it("la landing, /running y /temporadas están entre las páginas revisadas", () => {
    const rel = pages.map((p) => p.slice(marketing.length));
    expect(rel).toEqual(expect.arrayContaining(["/page.tsx", "/running/page.tsx", "/temporadas/page.tsx"]));
  });

  for (const p of pages) {
    const rel = p.slice(marketing.length);
    it(`${rel} declara revalidate y no depende de la persona`, () => {
      const src = readFileSync(p, "utf8");
      expect(src).toMatch(/^export const revalidate = \d+;$/m);
      expect(src).not.toMatch(/\b(cookies|headers|getViewer|createClient)\(|export const dynamic = "force-dynamic"/);
    });
  }

  it("el middleware no toca las páginas públicas (pondría no-store)", () => {
    for (const path of ["/", "/running", "/temporadas", "/precios", "/glp1"]) expect(config.matcher).not.toContain(path);
  });
});

describe("caché de las animaciones de técnica", () => {
  it("las hojas del CDN pasan por /_next/image con un mes de caché (next.config.ts)", () => {
    const cfg = readFileSync(join(root, "../next.config.ts"), "utf8");
    expect(cfg).toContain(`hostname: "${new URL(FRAMES_HOST).hostname}"`);
    const ttl = Number(cfg.match(/minimumCacheTTL:\s*(\d+)/)?.[1]);
    expect(ttl).toBeGreaterThanOrEqual(30 * 86400);
  });
});
