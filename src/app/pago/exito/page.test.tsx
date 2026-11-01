import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PLANS, annualSaving } from "@/lib/plans";
import { usd2 } from "@/lib/num";

const mocks = vi.hoisted(() => ({
  viewer: { id: "person", demo: false, tz: "America/Costa_Rica" },
  ent: { plan: "entreno", fromSubscription: true, billing: "mes" as string | undefined },
  row: { status: "active", plan: "entreno", billing: "mes" },
}));
vi.mock("@/lib/supabase/server", () => ({
  getViewer: async () => mocks.viewer,
  createClient: async () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.row }) }) }) }) }) }),
}));
vi.mock("@/lib/entitlements", () => ({ getEntitlements: async () => mocks.ent }));
vi.mock("@/components/analytics", () => ({ FunnelTracker: () => null }));
vi.mock("./auto-refresh", () => ({ AutoRefresh: () => <span>Actualizando</span> }));
import Exito from "./page";

const render = async (s?: string) => renderToStaticMarkup(await Exito({ searchParams: Promise.resolve({ s }) }));
afterEach(() => {
  vi.useRealTimers();
  mocks.ent = { plan: "entreno", fromSubscription: true, billing: "mes" };
  mocks.row = { status: "active", plan: "entreno", billing: "mes" };
});

describe("pago confirmado: siguiente paso y ofertas", () => {
  it("usa la periodicidad del acceso sin parámetro y ofrece el mismo plan anual", async () => {
    const html = await render();
    expect(html).toContain("Entreno ya está activo");
    expect(html).toContain("exito-entreno");
    expect(html).toContain(usd2(annualSaving(PLANS[0])));
    expect(html).toContain("/app/suscripcion?plan=entreno&amp;pago=anual");
    expect(html).toContain("sin prorrateo");
    expect(html).toContain("/app/referidos");
    expect(html).toContain("3 meses en total");
  });
  it("respeta el plan y periodicidad de la suscripción consultada", async () => {
    mocks.row = { status: "active", plan: "completo", billing: "mes" };
    const html = await render("subscription");
    expect(html).toContain(usd2(annualSaving(PLANS[1])));
    expect(html).toContain("plan=completo&amp;pago=anual");
  });
  it.each(["anual", undefined])("no ofrece cambiar a anual con periodicidad %s", async (billing) => {
    mocks.ent.billing = billing;
    expect(await render()).not.toContain("exito-anual");
  });
  it("muestra Temporada 1 hasta el cierre local y la retira al día siguiente", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T05:59:59Z"));
    expect(await render()).toContain("exito-temporadas");
    vi.setSystemTime(new Date("2026-11-23T06:00:00Z"));
    expect(await render()).not.toContain("exito-temporadas");
  });
  it.each(["incomplete", "canceled"])("no muestra ofertas con pago %s", async (status) => {
    mocks.row.status = status;
    const html = await render("subscription");
    expect(html).not.toContain("exito-anual");
    expect(html).not.toContain("exito-temporadas");
    expect(html).not.toContain("exito-referidos");
    if (status === "incomplete") expect(html).toContain("Actualizando");
  });
});

it("documenta precios, ahorros y netos calculados desde los planes", () => {
  const doc = readFileSync("docs/upsell-pago-exito.md", "utf8");
  for (const plan of PLANS) {
    expect(doc).toContain(usd2(annualSaving(plan)));
    for (const price of Object.values(plan.price)) {
      expect(doc).toContain(usd2(price));
      for (const rate of [0.039, 0.0425]) expect(doc).toContain(usd2(price / 1.13 - price * rate - 0.35));
    }
  }
});
