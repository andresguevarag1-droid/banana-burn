import { describe, expect, it } from "vitest";
import { canFeature, flairLabel, howToGrow, insigniaMeta, isBadgeId, nextTier, pointsFor, sortInsignias, tierByIdx, tierFor, TIERS, toFlair, toInsignia, type Insignia, type PowerStats } from "./profile-power";

const base: PowerStats = { premiumOwned: 0, certs: 0, retosDone: 0, levelIdx: 1, bestStreak: 0, verified: false };

describe("puntos del perfil (misma regla que public._power_points en 0030)", () => {
  it("una cuenta nueva tiene 0 puntos y es Semilla", () => {
    expect(pointsFor(base)).toBe(0);
    expect(tierFor(0).name).toBe("Semilla");
  });
  it("comprar programas Premium es lo que más rápido sube el perfil", () => {
    expect(pointsFor({ ...base, premiumOwned: 1 })).toBe(20);
    expect(pointsFor({ ...base, premiumOwned: 2, certs: 1, levelIdx: 2 })).toBe(70); // igual que la prueba SQL de B
    expect(pointsFor({ ...base, premiumOwned: 4, certs: 1, retosDone: 1, levelIdx: 4, bestStreak: 11, verified: true })).toBe(140);
    expect(pointsFor({ ...base, premiumOwned: 4, certs: 1, retosDone: 1, levelIdx: 4, bestStreak: 11 })).toBe(130); // el Andrés del demo: Cosecha
  });
  it("los retos gratis topan en 10 medallas y la racha suma por escalones", () => {
    expect(pointsFor({ ...base, retosDone: 25 })).toBe(50);
    expect(pointsFor({ ...base, bestStreak: 6 })).toBe(0);
    expect(pointsFor({ ...base, bestStreak: 7 })).toBe(5);
    expect(pointsFor({ ...base, bestStreak: 30 })).toBe(15);
  });
  it("datos raros no inventan puntos (negativos, NaN, nivel fuera de rango)", () => {
    expect(pointsFor({ premiumOwned: -3, certs: Number.NaN, retosDone: -1, levelIdx: 99, bestStreak: null, verified: false })).toBe(35);
    expect(pointsFor({ ...base, levelIdx: 0 })).toBe(0);
  });
});

describe("niveles de perfil", () => {
  it("umbrales explícitos: 30, 80, 150 y 250", () => {
    expect([0, 29, 30, 79, 80, 149, 150, 249, 250, 9999].map((p) => tierFor(p).idx)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(TIERS.map((t) => t.name)).toEqual(["Semilla", "Racimo", "Cosecha", "Platanal", "Banana de oro"]);
  });
  it("avance al próximo nivel y nada en el máximo", () => {
    expect(nextTier(140)).toMatchObject({ tier: { name: "Platanal" }, left: 10 });
    expect(nextTier(140)!.progress).toBeCloseTo(60 / 70);
    expect(nextTier(300)).toBeNull();
  });
  it("tierByIdx acota el índice", () => {
    expect(tierByIdx(0).idx).toBe(1);
    expect(tierByIdx(9).idx).toBe(5);
    expect(tierByIdx(null).idx).toBe(1);
  });
  it("Cómo subir tu perfil: la racha solo aparece cuando la conoces (tu perfil)", () => {
    expect(howToGrow({ ...base, bestStreak: 3 }).some((r) => r.id === "streak")).toBe(true);
    expect(howToGrow({ ...base, bestStreak: null }).some((r) => r.id === "streak")).toBe(false);
  });
});

describe("insignias", () => {
  it("formato del id igual al CHECK de la base", () => {
    expect(isBadgeId("prog:abdomen-marcado")).toBe(true);
    expect(isBadgeId("nivel")).toBe(true);
    expect(isBadgeId("Prog:X")).toBe(false);
    expect(isBadgeId("<script>")).toBe(false);
    expect(isBadgeId("a".repeat(81))).toBe(false);
    expect(isBadgeId(42)).toBe(false);
  });
  it("solo se puede destacar una insignia ganada (o ninguna)", () => {
    const earned = [{ id: "nivel" }, { id: "prog:banana-girl" }];
    expect(canFeature(earned, "prog:banana-girl")).toBe(true);
    expect(canFeature(earned, null)).toBe(true);
    expect(canFeature(earned, "verificado")).toBe(false);
    expect(canFeature(earned, "prog:banana-girl ")).toBe(false);
    expect(canFeature([{ id: "racha7", kind: "racha" }], "racha7")).toBe(false); // la racha solo la ves tú
  });
  it("fila cruda a insignia: nivel con su nombre, fijas con su texto, catálogo con su nombre", () => {
    expect(toInsignia({ id: "nivel" }, 4)).toMatchObject({ label: "Plátano macho", kind: "nivel" });
    expect(toInsignia({ id: "verificado", at: "2026-10-01T00:00:00Z" }, 1)).toMatchObject({ label: "Verificado", kind: "verificado", at: "2026-10-01T00:00:00Z" });
    expect(toInsignia({ id: "prog:abdomen-marcado", label: "Core de acero", detail: "Abdomen marcado", icon: "target", cover: "sky", kind: "certificado" }, 1)).toMatchObject({ label: "Core de acero", cover: "sky", kind: "certificado" });
    expect(toInsignia({ id: "prog:x", label: "" }, 1)).toBeNull();
    expect(toInsignia({ id: "DROP TABLE" }, 1)).toBeNull();
    expect(toInsignia({ id: "reto:x", label: "X", cover: "rojo" }, 1)!.cover).toBeNull();
  });
  it("orden del muro: certificados primero", () => {
    const xs = [{ id: "w10", kind: "logro" }, { id: "nivel", kind: "nivel" }, { id: "prog:a", kind: "certificado" }, { id: "verificado", kind: "verificado" }].map((x) => ({ ...x, label: x.id, detail: null, icon: "medal", cover: null, at: null })) as Insignia[];
    expect(sortInsignias(xs).map((x) => x.id)).toEqual(["prog:a", "verificado", "nivel", "w10"]);
  });
  it("la insignia de nivel ajena necesita el XP visible", () => {
    expect(insigniaMeta("nivel", { xp: null })).toBeNull();
    expect(insigniaMeta("nivel", { xp: 900 })).toMatchObject({ label: "Banana madura" });
    expect(insigniaMeta("reto:x")).toBeNull();
  });
});

describe("insignias junto al nombre (community_flair)", () => {
  it("sin acceso al nivel: solo el verificado", () => {
    const f = toFlair({ verified: true, tier: null, total_xp: null, featured: null });
    expect(f).toEqual({ verified: true, tier: null, featured: null });
    expect(flairLabel(f)).toBe("Verificado");
  });
  it("con todo: verificado, perfil y la insignia destacada", () => {
    const f = toFlair({ verified: true, tier: 3, total_xp: 2400, featured: "prog:abdomen-marcado", featured_label: "Core de acero", featured_icon: "target", featured_cover: "sky" });
    expect(f.featured).toEqual({ id: "prog:abdomen-marcado", label: "Core de acero", icon: "target", cover: "sky" });
    expect(flairLabel(f)).toBe("Verificado. Perfil Cosecha. Insignia: Core de acero");
  });
  it("el perfil Semilla no se anuncia y un id inválido no se muestra", () => {
    expect(flairLabel(toFlair({ verified: false, tier: 1, total_xp: 10, featured: "nope!" }))).toBe("");
    expect(toFlair({ tier: 42 }).tier).toBe(5);
  });
});

describe("insignia de tester (0029)", () => {
  it("se muestra y se puede destacar si la ganó", () => {
    expect(toInsignia({ id: "tester" }, 1)).toMatchObject({ label: "Tester de la beta", icon: "flask", kind: "logro" });
    expect(canFeature([{ id: "tester", kind: "logro" }], "tester")).toBe(true);
    expect(canFeature([{ id: "nivel", kind: "nivel" }], "tester")).toBe(false);
    expect(toFlair({ verified: false, tier: 2, total_xp: 100, featured: "tester" }).featured).toMatchObject({ label: "Tester de la beta" });
  });
});
