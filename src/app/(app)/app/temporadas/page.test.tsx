import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SEASONS_T1 } from "@/lib/seasons";

const state = vi.hoisted(() => ({ annual: null as null | { subId: string; periodStart: string }, hasAnnual: false, owned: [] as string[], today: "2026-11-01", seasons: true }));
vi.mock("@/lib/supabase/server", () => ({ getViewer: async () => ({ demo: true, plan: "completo", role: "free" }) }));
vi.mock("@/lib/seasons-server", () => ({ getSeasonsView: async () => ({ ...state, access: true, owned: new Set(state.owned), seasons: state.seasons ? SEASONS_T1 : [] }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/tilopay", () => ({ tilopayOfferedTo: () => false }));
vi.mock("@/lib/pay-provider", () => ({ providerFor: () => "onvo" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), redirect: vi.fn() }));
import Temporadas from "./page";
const render = async (pago?: string) => renderToStaticMarkup(await Temporadas({ searchParams: Promise.resolve({ pago }) }));
beforeEach(() => { state.annual = null; state.hasAnnual = false; state.owned = []; state.today = "2026-11-01"; state.seasons = true; });
it("offers each single purchase and the matching annual price with official dates", async () => {
  const html = await render();
  for (const price of ["US$14.99", "US$16.99", "US$18.99", "US$89.99"]) expect(html).toContain(price);
  for (const date of ["9 de noviembre", "3 de enero", "22 de noviembre"]) expect(html).toContain(date);
  expect(html).toContain("Sumar la temporada por");
  expect(html).toContain("plan=completo&amp;pago=anual");
});
it("offers the existing free redemption only while available", async () => {
  state.annual = { subId: "annual", periodStart: "2026-11-01" }; state.hasAnnual = true;
  expect(await render()).toContain("Elegir mi temporada gratis");
  state.annual = null;
  const html = await render();
  expect(html).not.toContain("Elegir mi temporada gratis");
  expect(html).toContain("comprar otra por separado");
});
it("keeps owned seasons accessible and closes purchases after the deadline", async () => {
  state.today = "2026-11-23"; state.owned = [SEASONS_T1[0].slug];
  const html = await render();
  expect(html).toContain("Ver mi temporada");
  expect(html).toContain("Inscripciones cerradas");
  expect(html).not.toContain("Sumar la temporada por");
});
it("provides recovery copy for expired checkout and an empty catalog", async () => {
  state.seasons = false;
  const html = await render("vencido");
  expect(html).toContain('role="alert"');
  expect(html).toContain("Todavía no hay temporadas disponibles");
  expect(html).toContain("/app/entrenar");
});
