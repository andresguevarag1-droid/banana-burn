import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AUDIENCES, NOVEDADES, countLabel, isNewer, itemVisible, needsNudge, nudgeRelease, releaseDay, releaseIndex, releaseStart, releasesFor, unseenReleases, type Release } from "./novedades";
import { ICON_NAMES } from "@/components/icons/named";
import { CHALLENGE_ART } from "./challenge-art";

const ROOT = join(__dirname, "..", "app");
/** La ruta existe como página de la app (src/app/(app)/… o src/app/…). */
function routeExists(href: string) {
  const path = href.split("#")[0].split("?")[0];
  return [join(ROOT, "(app)", path, "page.tsx"), join(ROOT, path, "page.tsx")].some((f) => existsSync(f));
}
const texts = (r: Release) => [r.title, r.intro, ...r.items.flatMap((i) => [i.title, i.benefit, i.cta ?? ""])];
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

describe("historial de novedades", () => {
  it("ids únicos con el formato AAAA-MM-DD-tema y la fecha del id", () => {
    const ids = NOVEDADES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of NOVEDADES) {
      expect(r.id).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(r.id.length).toBeLessThanOrEqual(59);
      expect(r.id.slice(0, 10)).toBe(r.date);
      expect(Number.isFinite(releaseStart(r.date))).toBe(true);
    }
  });

  it("ordenado de la más nueva a la más vieja", () => {
    for (let i = 1; i < NOVEDADES.length; i++) expect(NOVEDADES[i - 1].date >= NOVEDADES[i].date).toBe(true);
  });

  it("cada item tiene beneficio, ícono válido, ruta existente y público válido", () => {
    for (const r of NOVEDADES) {
      expect(r.title.trim()).not.toBe("");
      expect(r.intro.trim().length).toBeGreaterThan(20);
      expect(r.items.length).toBeGreaterThan(0);
      for (const i of r.items) {
        expect(i.title.trim(), `${r.id}: ${i.title}`).not.toBe("");
        expect(i.benefit.trim().length, `${r.id}: ${i.title}`).toBeGreaterThan(40);
        expect(ICON_NAMES as string[]).toContain(i.icon);
        expect(i.href, `${r.id}: ${i.title}`).toMatch(/^\/(app|admin)(\/|$|#)/);
        expect(routeExists(i.href), `ruta ${i.href}`).toBe(true);
        if (i.audience) expect(AUDIENCES).toContain(i.audience);
        if (i.audience === "staff") expect(i.href.startsWith("/admin") || i.href.startsWith("/app")).toBe(true);
        if (i.image && "reto" in i.image) expect(CHALLENGE_ART[i.image.reto], i.image.reto).toBeTruthy();
        if (i.image && "nivel" in i.image) expect(i.image.nivel).toBeGreaterThanOrEqual(1);
        if (i.image && "src" in i.image) expect(existsSync(join(__dirname, "..", "..", "public", i.image.src))).toBe(true);
      }
    }
  });

  it("sin emojis, sin rayas largas, sin cadenas con punto medio, sin IA y con banana", () => {
    for (const t of NOVEDADES.flatMap(texts)) {
      expect(t).not.toMatch(EMOJI);
      expect(t).not.toMatch(/[—–]/);
      expect(t).not.toMatch(/·/);
      expect(t).not.toMatch(/\bIA\b|inteligencia artificial/i);
      expect(t).not.toMatch(/\bbanano\b/i);
    }
  });
});

const ctx = { nutrition: true, plan: "completo", program: false, staff: false };

describe("quién ve qué", () => {
  it("filtra por plan, programa y equipo", () => {
    expect(itemVisible(undefined, ctx)).toBe(true);
    expect(itemVisible("completo", ctx)).toBe(true);
    expect(itemVisible("entreno", ctx)).toBe(false);
    expect(itemVisible("entreno", { ...ctx, nutrition: false, plan: "entreno" })).toBe(true);
    expect(itemVisible("con-programa", ctx)).toBe(false);
    expect(itemVisible("con-programa", { ...ctx, program: true })).toBe(true);
    expect(itemVisible("staff", ctx)).toBe(false);
    expect(itemVisible("staff", { ...ctx, staff: true })).toBe(true);
  });

  it("Entreno no ve Banana Shield como propio, sí la invitación a Entreno + Nutrición", () => {
    const entreno = releasesFor({ ...ctx, nutrition: false, plan: "entreno" }).flatMap((r) => r.items);
    expect(entreno.some((i) => i.href === "/app/glp1")).toBe(false);
    expect(entreno.some((i) => i.audience === "entreno" && /Entreno \+ Nutrición/.test(i.benefit))).toBe(true);
    const completo = releasesFor(ctx).flatMap((r) => r.items);
    expect(completo.some((i) => i.href === "/app/glp1")).toBe(true);
    expect(completo.some((i) => i.audience === "entreno")).toBe(false);
  });

  it("una versión sin items para la persona no aparece", () => {
    const only: Release[] = [{ id: "2030-01-01-equipo", date: "2030-01-01", title: "Equipo", intro: "Solo para el equipo de Banana Burn.", items: [{ title: "x", benefit: "y", icon: "banana", href: "/app", audience: "staff" }] }];
    expect(releasesFor(ctx, only)).toEqual([]);
    expect(releasesFor({ ...ctx, staff: true }, only)).toHaveLength(1);
  });
});

describe("qué no vio todavía", () => {
  const all = NOVEDADES;
  it("con la última vista guardada: solo lo que está arriba de ella", () => {
    expect(unseenReleases(all, { seenId: all[0].id, seenAt: null, createdAt: null })).toEqual([]);
    expect(unseenReleases(all, { seenId: all[all.length - 1].id, seenAt: null, createdAt: null }).map((r) => r.id)).toEqual(all.slice(0, -1).map((r) => r.id));
  });
  it("el dispositivo y el servidor: cuenta la más nueva de las dos", () => {
    const last = all[all.length - 1].id;
    expect(unseenReleases(all, { seenId: last, seenAt: null, createdAt: null, localId: all[0].id })).toEqual([]);
    expect(unseenReleases(all, { seenId: all[0].id, seenAt: null, createdAt: null, localId: last })).toEqual([]);
  });
  it("cuenta nueva: lo publicado antes de crearla no es novedad", () => {
    const after = new Date(releaseStart(all[0].date) + 3600e3).toISOString();
    expect(unseenReleases(all, { seenId: null, seenAt: null, createdAt: after })).toEqual([]);
    const before = new Date(releaseStart(all[all.length - 1].date) - 864e5).toISOString();
    expect(unseenReleases(all, { seenId: null, seenAt: null, createdAt: before })).toHaveLength(all.length);
  });
  it("id desconocido: usa la fecha en que abrió Novedades", () => {
    const after = new Date(releaseStart(all[0].date) + 60e3).toISOString();
    expect(unseenReleases(all, { seenId: "2020-01-01-borrada", seenAt: after, createdAt: null })).toEqual([]);
  });
  it("sin datos (demo recién abierto): todo", () => {
    expect(unseenReleases(all, { seenId: null, seenAt: null, createdAt: null })).toHaveLength(all.length);
  });
  it("una pestaña vieja no baja la última vista", () => {
    expect(isNewer(all[0].id, null)).toBe(true);
    expect(isNewer(all[0].id, all[all.length - 1].id)).toBe(all.length > 1);
    expect(isNewer(all[all.length - 1].id, all[0].id)).toBe(false);
    expect(isNewer("2099-01-01-inventada", null)).toBe(false);
    expect(releaseIndex("nada")).toBe(-1);
  });
});

describe("aviso a quien no abre la app", () => {
  const r = NOVEDADES[0];
  const at = (days: number) => new Date(releaseStart(r.date) + days * 864e5);
  it("solo entre el día 3 y el 14 después de la versión", () => {
    expect(nudgeRelease(at(1))).toBeNull();
    expect(nudgeRelease(at(3))?.id).toBe(r.id);
    expect(nudgeRelease(at(13.9))?.id).toBe(r.id);
    expect(nudgeRelease(at(14))).toBeNull();
  });
  it("una versión solo para el equipo no avisa a nadie", () => {
    const staffOnly: Release[] = [{ ...r, items: r.items.map((i) => ({ ...i, audience: "staff" as const })) }];
    expect(nudgeRelease(at(4), staffOnly)).toBeNull();
  });
  it("no avisa a quien ya la vio ni a quien llegó después", () => {
    expect(needsNudge(r, { news_seen: r.id, news_seen_at: null, created_at: "2020-01-01T00:00:00Z" })).toBe(false);
    expect(needsNudge(r, { news_seen: null, news_seen_at: null, created_at: at(1).toISOString() })).toBe(false);
    expect(needsNudge(r, { news_seen: null, news_seen_at: null, created_at: "2020-01-01T00:00:00Z" })).toBe(true);
  });
});

describe("textos", () => {
  it("fecha y conteo en es-419", () => {
    expect(releaseDay("2026-10-23")).toBe("23 de octubre de 2026");
    expect(countLabel(1)).toBe("1 novedad");
    expect(countLabel(12)).toBe("12 novedades");
  });
});
