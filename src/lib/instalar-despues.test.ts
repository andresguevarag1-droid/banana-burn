// #195: el aviso de instalar no se muestra antes del primer entreno ni saca a la gente de Instagram.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("aviso de instalar después del primer entreno (#195)", () => {
  it("la bienvenida ya no tiene el paso Instala tu LinkApp", () => {
    const w = src("app/bienvenida/wizard.tsx");
    expect(w).not.toContain("WelcomeInstall");
    expect(w).not.toContain("<InstallHelper");
  });

  it("Hoy solo muestra la tarjeta de instalar con al menos un entreno", () => {
    const hoy = src("app/(app)/app/page.tsx");
    expect(hoy).toMatch(/\(learnState\.workouts > 0 \|\| g\.trainedToday\) && <InstallCard \/>/);
    expect(src("components/primeros-pasos/first-steps.tsx")).toContain("server.workouts === 0) return null");
  });

  it("install_view se cuenta una vez por sesión y lugar", () => {
    const h = src("components/install/install-helper.tsx");
    expect(h).toContain("sessionStorage.getItem(k)");
    expect(h).toContain("bb.installView.${where}");
  });
});
