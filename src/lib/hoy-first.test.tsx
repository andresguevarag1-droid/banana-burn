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
const firstReturn = page.slice(page.indexOf("if (first) return ("), page.indexOf("const kgLost"));
const fullReturn = page.slice(page.indexOf("const kgLost"));

describe("Hoy del primer día", () => {
  it("es primer día solo con 0 entrenos guardados, sin programa y sin entreno hoy", () => {
    expect(isFirstDay(base)).toBe(true);
    expect(isFirstDay({ ...base, workouts: 1 })).toBe(false);
    expect(isFirstDay({ ...base, trainedToday: true })).toBe(false);
    expect(isFirstDay({ ...base, program: true })).toBe(false);
    expect(isFirstDay({ ...base, demo: true })).toBe(false);
    expect(isFirstDay({ ...base, demo: true, workouts: 3, primera: "1" })).toBe(true);
  });

  it("con 0 entrenos muestra solo el saludo, el primer entreno y el aviso de tarjeta urgente", () => {
    const tags = [...firstReturn.matchAll(/<([A-Z]\w*)/g)].map((m) => m[1]);
    expect(tags).toEqual(["FunnelTracker", "TrialCardNotice"]);
    expect(firstReturn).toContain("{header}");
    expect(firstReturn).toContain("{hero}");
    expect(firstReturn).toContain("minDay={FIRST_DAY_CARD_MIN_DAY}");
    expect(firstReturn).toMatch(/view="hoy_view" props=\{\{ first,/);
  });

  it("con 1 entreno guardado vuelve todo lo de antes", () => {
    for (const c of ["PageTour", "FirstSteps", "InstallCard", "PushWhenReady", "AnnouncementBanner", "LoMejor", "SeasonHoy", "RunHoy", "TodayPanel", "WeekCard", "ChallengeCard", "WeighIn", "Glp1Card", "AnnualUpsell", "TrialCardNotice", "WeekLine", "ExpressCard"])
      expect(fullReturn, c).toContain(`<${c} `);
    expect(fullReturn).toContain("{header}");
    expect(fullReturn).toContain(": hero}");
  });

  it("el aviso de tarjeta del primer día sale solo si faltan 2 días o menos para el cobro", () => {
    const start = new Date("2026-11-02T18:30:00Z");
    const schedule = scheduleFor("prueba", start, undefined, 7, start.toISOString());
    const ent = { access: "trial", trial: { endsAt: schedule.chargeAt, daysLeft: 3 }, card: null, charge: null, cardStep: "trial" } as unknown as Entitlements;
    const html = (elapsed: number, minDay?: number) => renderToStaticMarkup(<TrialCardNotice ent={ent} tz="America/Costa_Rica" screen="hoy" now={new Date(+start + elapsed * DAY_MS)} minDay={minDay} />);
    expect(html(4)).toContain("Día 5 de 7");
    expect(html(4, FIRST_DAY_CARD_MIN_DAY)).toBe("");
    expect(html(5, FIRST_DAY_CARD_MIN_DAY)).toContain("Día 6 de 7");
    expect(html(6, FIRST_DAY_CARD_MIN_DAY)).toContain("Día 7 de 7");
  });
});
