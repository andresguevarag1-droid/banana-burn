// #280: cada pedido de tarjeta se mide (card_ask_view con `where`, y el mismo `where` en card_saved), el banner de Hoy del
// día 1 al 6, la línea tras la primera serie y el beneficio en dólares en la bienvenida.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/analytics", () => ({ FunnelTracker: ({ view, props }: { view: string; props?: Record<string, string> }) => <span data-view={view} data-where={props?.where} /> }));
import { CARD_ASK_WHERE, cleanEvent } from "@/app/api/track/event";
import { askWhere, cardOfferLabel, hoyCardBanner, withDesde } from "./card-ask";
import { DAY_MS, PROMO_ID, firstChargeMinor, scheduleFor } from "./trial";
import { HoyCardBanner } from "@/components/card-banner";
import { FirstSetCardLine, FirstSetCardSheet } from "@/components/workout/first-set-card-ask";
import type { Entitlements } from "./entitlements";

const read = (p: string) => readFileSync(p, "utf8");
const start = new Date("2026-11-02T18:30:00Z");
const schedule = scheduleFor("prueba", start, undefined, 7, start.toISOString());
const ent = { access: "trial", trial: { endsAt: schedule.chargeAt, daysLeft: 7 }, card: null, charge: null, cardStep: "trial" } as unknown as Entitlements;
const at = (days: number) => new Date(+start + days * DAY_MS);

describe("card_ask_view", () => {
  it("acepta solo los pedidos conocidos y nada más que `where`", () => {
    for (const where of ["bienvenida", "hoy-banner", "primer-entreno", "salida", "mi-plan", "muro", "dia6"]) expect(CARD_ASK_WHERE).toContain(where);
    expect(cleanEvent({ name: "card_ask_view", props: { where: "hoy-banner", path: "/app", correo: "ana@x.com" } })).toEqual({ name: "card_ask_view", props: { where: "hoy-banner", path: "/app" } });
    expect(cleanEvent({ name: "card_ask_view", props: { where: "otro" } })).toBeNull();
    expect(cleanEvent({ name: "card_ask_view", props: {} })).toBeNull();
  });

  it("card_saved guarda el `where` del pedido", () => {
    expect(cleanEvent({ name: "card_saved", props: { step: "trial", where: "primera-serie" } })?.props.where).toBe("primera-serie");
    expect(read("src/app/(app)/app/suscripcion/card-panel.tsx")).toMatch(/view="card_saved" props=\{\{[^}]*where \}\}/);
    expect(read("src/app/bienvenida/wizard.tsx")).toMatch(/track\("card_saved", \{[^}]*where: "bienvenida" \}\)/);
    expect(read("src/app/(app)/app/entreno/player.tsx")).toMatch(/track\("card_saved", \{[^}]*where: "primera-serie" \}\)/);
  });

  it("?desde lleva el pedido hasta Mi plan, sin texto libre", () => {
    expect(askWhere("dia6")).toBe("dia6");
    expect(askWhere("ana@x.com")).toBeNull();
    expect(askWhere(undefined)).toBeNull();
    expect(withDesde("/app/suscripcion#tarjeta", "muro")).toBe("/app/suscripcion?desde=muro#tarjeta");
    expect(withDesde("/app/suscripcion?plan=entreno", "muro")).toBe("/app/suscripcion?plan=entreno&desde=muro");
    expect(read("src/app/(app)/app/suscripcion/page.tsx")).toContain('where={askWhere(sp.desde) ?? "mi-plan"}');
    expect(read("src/app/(app)/app/suscripcion/plan-wall.tsx")).toContain('href="/app/suscripcion?desde=muro#tarjeta"');
    expect(read("src/app/(app)/app/suscripcion/plan-wall.tsx")).toContain('props={{ where: "muro" }}');
    expect(read("src/lib/email/templates.ts")).toContain('path: "/app/suscripcion?desde=dia6"');
  });
});

describe("banner de Hoy (días 1 a 6)", () => {
  it("cuenta los días que de verdad quedan y sale del día 1 al 6", () => {
    expect(hoyCardBanner(ent, at(0))).toMatchObject({ day: 1, left: 7 });
    expect(hoyCardBanner(ent, at(5))).toMatchObject({ day: 6, left: 2 });
    expect(hoyCardBanner(ent, at(6))).toBeNull();
    expect(hoyCardBanner(ent, at(7))).toBeNull();
  });

  it("no sale con tarjeta, cobro, beta ni fuera de la prueba", () => {
    expect(hoyCardBanner({ ...ent, card: { active: true, brand: "visa", last4: "4242", expMonth: 1, expYear: 2030 } }, at(1))).toBeNull();
    expect(hoyCardBanner({ ...ent, charge: {} as NonNullable<Entitlements["charge"]> }, at(1))).toBeNull();
    expect(hoyCardBanner({ ...ent, trial: { ...ent.trial!, beta: true } }, at(1))).toBeNull();
    expect(hoyCardBanner({ ...ent, access: "subscription", cardStep: "none" }, at(1))).toBeNull();
  });

  it("dice los días, el precio exacto del primer mes con el 50 % y Dejar mi tarjeta", () => {
    const h = renderToStaticMarkup(<HoyCardBanner ent={ent} now={at(3)} />);
    expect(h).toContain("Te quedan 4 días gratis.");
    expect(h).toContain(`$${(firstChargeMinor("entreno", "mes", PROMO_ID) / 100).toFixed(2)}`);
    expect(h).toContain("$4.99");
    expect(h).toContain("$9.99");
    expect(h).toContain("Hoy no se cobra nada");
    expect(h).toContain("Dejar mi tarjeta");
    expect(h).toContain('href="/app/suscripcion?plan=entreno&amp;pago=mes&amp;desde=hoy-banner#tarjeta"');
    expect(h).toContain('data-view="card_ask_view" data-where="hoy-banner"');
    expect(h).not.toMatch(/\p{Extended_Pictographic}|\bIA\b|cupos|últimos/iu);
    expect(renderToStaticMarkup(<HoyCardBanner ent={ent} now={at(6)} />)).toBe("");
  });

  it("en Hoy no se repite el aviso de la prueba del layout", () => {
    expect(read("src/app/(app)/app/layout.tsx")).toContain('<HideOnPath path={hoyAsk ? "/app" : ""}><TrialBanner');
  });
});

describe("tras la primera serie", () => {
  it("una línea en el descanso con el texto pedido, que se puede cerrar", () => {
    const h = renderToStaticMarkup(<FirstSetCardLine onOpen={() => {}} onClose={() => {}} />);
    expect(h.replace(/<[^>]+>/g, "")).toContain("Tu primer mes a $4.99 si dejas tu tarjeta hoy. Hoy no se cobra nada.");
    expect(h).toContain("Dejar mi tarjeta");
    expect(h).toContain('aria-label="Cerrar"');
  });

  it("el formulario se abre encima del entreno, con Entreno mensual y sin cobro hoy", () => {
    const h = renderToStaticMarkup(<FirstSetCardSheet onClose={() => {}} onSaved={() => {}} />);
    expect(h).toContain("Tu primer mes a $4.99 si dejas tu tarjeta hoy");
    expect(h).toContain("Hoy no se cobra nada.");
    expect(h).toContain("Seguir entrenando");
  });

  it("sale en los dos descansos y se mide como primera-serie", () => {
    const p = read("src/app/(app)/app/entreno/player.tsx");
    expect(p).toContain("extra={cardLine} />");
    expect(p.match(/extra=\{cardLine\}/g)).toHaveLength(2);
    expect(p).toContain('track("card_ask_view", { where: "primera-serie" })');
  });
});

describe("bienvenida", () => {
  it("el botón de dejar la tarjeta dice el beneficio en dólares; la opción sin tarjeta sigue", () => {
    expect(cardOfferLabel({ plan: "entreno", billing: "mes" })).toBe("Dejar mi tarjeta: $4.99 tu primer mes, en lugar de $9.99");
    expect(cardOfferLabel({ plan: "completo", billing: "mes" })).toBe("Dejar mi tarjeta: $7.49 tu primer mes, en lugar de $14.99");
    expect(cardOfferLabel({ plan: "entreno", billing: "anual" })).toBe("Dejar mi tarjeta lista");
    const w = read("src/app/bienvenida/wizard.tsx");
    expect(w).toContain("submitLabel={cardOfferLabel(choice)}");
    expect(w).toContain("Empezar gratis sin tarjeta");
    expect(w).toContain('track("card_ask_view", { where: "bienvenida" })');
  });
});
