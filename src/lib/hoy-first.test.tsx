import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FIRST_DAY_CARD_MIN_DAY, isFirstDay } from "./hoy-first";
import { DAY_MS, scheduleFor } from "./trial";
import { TrialCardNotice } from "@/components/trial-card-notice";
import type { Entitlements } from "./entitlements";

const page = readFileSync("src/app/(app)/app/page.tsx", "utf8");
const base = { program: false, demo: false, workouts: 0, trainedToday: false };
// El retorno del primer día y el de Hoy completo, por separado.
const firstIndex = page.indexOf("if (first) return (");
const fullIndex = page.indexOf("const kgLost");
expect(firstIndex, "debe existir el retorno del primer día").toBeGreaterThan(-1);
expect(fullIndex, "el retorno completo debe seguir al inicial").toBeGreaterThan(firstIndex);
const firstReturn = page.slice(firstIndex, fullIndex);
const fullReturn = page.slice(fullIndex);

describe("Hoy del primer día", () => {
  it("es primer día solo con 0 entrenos guardados, sin programa y sin entreno hoy", () => {
    expect(isFirstDay(base)).toBe(true);
    expect(isFirstDay({ ...base, workouts: 1 })).toBe(false);
    expect(isFirstDay({ ...base, trainedToday: true })).toBe(false);
    expect(isFirstDay({ ...base, program: true })).toBe(false);
    expect(isFirstDay({ ...base, demo: true })).toBe(false);
    expect(isFirstDay({ ...base, demo: true, workouts: 3, primera: "1" })).toBe(true);
  });

  it("un primer entreno guardado a medias (#246) es un entreno guardado: Hoy sale del primer día y muestra su cierre", () => {
    expect(isFirstDay({ ...base, workouts: 1, trainedToday: true })).toBe(false);
    expect(fullReturn).toContain("<FirstPartialCard");
    expect(firstReturn).not.toContain("FirstPartialCard");
  });

  it("con 0 entrenos muestra solo el saludo, el primer entreno, el banner de días gratis (#280) y el aviso del día 7", () => {
    const tags = [...firstReturn.matchAll(/<([A-Z]\w*)/g)].map((m) => m[1]);
    expect(tags).toEqual(["FunnelTracker", "HoyCardBanner", "TrialCardNotice"]);
    // El banner va debajo del primer entreno: lo primero que ve sigue siendo su entreno.
    expect(firstReturn.indexOf("{hero}")).toBeLessThan(firstReturn.indexOf("<HoyCardBanner"));
    expect(firstReturn).toContain("{header}");
    expect(firstReturn).toContain("{hero}");
    expect(firstReturn).toContain("minDay={FIRST_DAY_CARD_MIN_DAY}");
    expect(firstReturn).toMatch(/view="hoy_view" props=\{\{ first,/);
    // La opción en casa (#194) va dentro del hero (WorkoutHero home), no como enlace aparte.
    expect(firstReturn).not.toContain("expres=10");
  });

  it("con 1 entreno guardado vuelve todo lo de antes", () => {
    for (const c of ["PageTour", "FirstSteps", "InstallCard", "PushWhenReady", "AnnouncementBanner", "LoMejor", "SeasonHoy", "RunHoy", "TodayPanel", "WeekCard", "ChallengesFolded", "WeighIn", "Glp1Card", "AnnualUpsell", "TrialCardNotice", "HoyCardBanner", "ExpressCard"])
      expect(fullReturn, c).toContain(`<${c} `);
    expect(fullReturn).toContain("{header}");
    expect(fullReturn).toContain(": hero}");
  });

  it("el aviso grande de tarjeta en Hoy sale solo el día 7 (del 1 al 6 va el banner)", () => {
    const start = new Date("2026-11-02T18:30:00Z");
    const schedule = scheduleFor("prueba", start, undefined, 7, start.toISOString());
    const ent = { access: "trial", trial: { endsAt: schedule.chargeAt, daysLeft: 3 }, card: null, charge: null, cardStep: "trial" } as unknown as Entitlements;
    const html = (elapsed: number, minDay?: number) => renderToStaticMarkup(<TrialCardNotice ent={ent} tz="America/Costa_Rica" screen="hoy" now={new Date(+start + elapsed * DAY_MS)} minDay={minDay} />);
    expect(html(4)).toContain("Día 5 de 7");
    expect(html(4, FIRST_DAY_CARD_MIN_DAY)).toBe("");
    expect(html(5, FIRST_DAY_CARD_MIN_DAY)).toBe("");
    expect(html(6, FIRST_DAY_CARD_MIN_DAY)).toContain("Día 7 de 7");
    expect(fullReturn).toContain("minDay={FIRST_DAY_CARD_MIN_DAY}");
  });

  it("Continuar sin tarjeta tiene un destino en la vista del primer día", () => {
    const ent = { access: "trial", trial: { endsAt: "2026-11-09T18:30:00Z" }, card: null, charge: null, cardStep: "trial" } as unknown as Entitlements;
    const html = renderToStaticMarkup(<TrialCardNotice ent={ent} tz="America/Costa_Rica" screen="hoy" now={new Date("2026-11-08T18:30:00Z")} minDay={FIRST_DAY_CARD_MIN_DAY} />);
    const target = html.match(/href="#([^"]+)"/);
    expect(target, "el aviso urgente ofrece continuar sin tarjeta").not.toBeNull();
    expect(firstReturn).toContain(`id="${target![1]}"`);
  });
});
