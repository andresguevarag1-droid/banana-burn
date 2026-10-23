import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { clamp01, fixThousands, frac, nfmt } from "./num";

describe("frac y clamp01", () => {
  it("no deja pasar NaN ni Infinity", () => {
    expect(frac(5, 0)).toBe(0);
    expect(frac(0, 0)).toBe(0);
    expect(frac(NaN, 3)).toBe(0);
    expect(frac(3, 4)).toBe(0.75);
    expect(clamp01(Infinity)).toBe(0);
    expect(clamp01(NaN, 0.02)).toBe(0.02);
    expect(clamp01(1.4)).toBe(1);
  });
});

describe("cifras de la marca", () => {
  it("coma decimal y punto de miles", () => {
    expect(nfmt(93.14)).toBe("93,1");
    expect(nfmt(1276)).toBe("1.276");
    expect(nfmt(2.5, 1, 1)).toBe("2,5");
  });
  it("arregla miles con coma en textos guardados sin tocar decimales", () => {
    expect(fixThousands("Camina 10,000 pasos hoy")).toBe("Camina 10.000 pasos hoy");
    expect(fixThousands("1,250,000 pasos")).toBe("1.250.000 pasos");
    expect(fixThousands("Sube 2,5 kg")).toBe("Sube 2,5 kg");
    expect(fixThousands("8 vasos, 3 comidas")).toBe("8 vasos, 3 comidas");
  });
  it("nadie formatea números con es-419 (da 1,276 y 93.1, contra la marca)", () => {
    const files = execSync("grep -rln --include=*.ts --include=*.tsx 'toLocaleString(\"es-419\"' src || true", { encoding: "utf8" }).split("\n").filter(Boolean);
    // Solo fechas pueden usar es-419 con toLocaleString (Date): post-card, soporte y admin.
    const allowed = ["src/components/post-card.tsx", "src/app/(app)/app/soporte/[id]/page.tsx", "src/lib/admin-format.ts", "src/lib/num.test.ts",
      // Siembras ya aplicadas en las migraciones 0018 y 0033: deben coincidir byte a byte; taskFor() corrige los miles al mostrar.
      "src/lib/challenge-seed.ts", "src/lib/catalog-0033.ts"];
    expect(files.filter((f) => !allowed.includes(f))).toEqual([]);
  });
});
