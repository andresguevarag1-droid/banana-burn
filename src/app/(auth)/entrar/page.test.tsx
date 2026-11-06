import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({ ua: "", viewer: null as null | { email: string; onboarded: boolean }, blocked: false, cookies: {} as Record<string, string> }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/supabase/server", () => ({ getViewer: async () => state.viewer, blockedSession: async () => state.blocked }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": state.ua }), cookies: async () => ({ get: (k: string) => (k in state.cookies ? { value: state.cookies[k] } : undefined) }) }));
vi.mock("@/lib/platform-server", () => ({ requestPlatform: async () => "web" }));
vi.mock("@/components/analytics", () => ({ FunnelTracker: ({ view, props }: { view: string; props: object }) => <output data-view={view}>{JSON.stringify(props)}</output> }));
vi.mock("./login-form", () => ({ LoginForm: ({ openIn, signupChecks }: { openIn: string | null; signupChecks?: string[] }) => <><input aria-label="openIn" value={openIn ?? "normal"} readOnly /><ul>{(signupChecks ?? []).map((c) => <li key={c}>{c}</li>)}</ul></> }));
const { default: Entrar } = await import("./page");
const render = async (modo?: string) => renderToStaticMarkup(await Entrar({ searchParams: Promise.resolve({ modo }) }));

describe("signup_view y detección del servidor (#235)", () => {
  beforeEach(() => { state.ua = ""; state.viewer = null; state.blocked = false; state.cookies = {}; });
  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Instagram", "Safari", true],
    ["Mozilla/5.0 (Linux; Android 14) [FB_IAB/FB4A;FBAV/485]", "Chrome", true],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Safari/604.1", "normal", false],
    ["Mozilla/5.0 (Linux; Android 14) Chrome/129 Mobile Safari/537.36", "normal", false],
  ])("pasa la detección a LoginForm y mide inapp: %s", async (ua, browser, inapp) => {
    state.ua = ua;
    const html = await render("registro");
    expect(html).toContain(`value="${browser}"`);
    expect(html).toContain('data-view="signup_view"');
    expect(html).toContain(`{&quot;inapp&quot;:${inapp}}`);
  });
  it("no mide signup_view en login", async () => {
    expect(await render()).not.toContain('data-view="signup_view"');
  });
  it("no mide signup_view con sesión abierta", async () => {
    state.viewer = { email: "qa@example.com", onboarded: true };
    const html = await render("registro");
    expect(html).toContain("Ya tienes la sesión abierta");
    expect(html).not.toContain('data-view="signup_view"');
  });
  it("no mide signup_view para una cuenta bloqueada", async () => {
    state.blocked = true;
    const html = await render("registro");
    expect(html).toContain("Tu cuenta está pausada");
    expect(html).not.toContain('data-view="signup_view"');
  });
});

describe("registro desde la página de un condominio", () => {
  beforeEach(() => { state.ua = ""; state.viewer = null; state.blocked = false; state.cookies = {}; });
  it("no promete el 50 % del primer mes a quien viene de su condominio", async () => {
    state.cookies = { bb_condo: "soho-paradisus" };
    const html = await render("registro");
    expect(html).toContain("Beneficio de tu condominio");
    expect(html).toContain("se activa el beneficio de tu condominio");
    expect(html).not.toContain("% menos");
  });
  it("sin condominio sigue la oferta normal", async () => {
    const html = await render("registro");
    expect(html).not.toContain("Beneficio de tu condominio");
  });
});
