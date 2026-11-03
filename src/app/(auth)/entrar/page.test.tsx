import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({ ua: "", viewer: null as null | { email: string; onboarded: boolean }, blocked: false }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/supabase/server", () => ({ getViewer: async () => state.viewer, blockedSession: async () => state.blocked }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": state.ua }), cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/platform-server", () => ({ requestPlatform: async () => "web" }));
vi.mock("@/components/analytics", () => ({ FunnelTracker: ({ view, props }: { view: string; props: object }) => <output data-view={view}>{JSON.stringify(props)}</output> }));
vi.mock("./login-form", () => ({ LoginForm: ({ openIn }: { openIn: string | null }) => <input aria-label="openIn" value={openIn ?? "normal"} readOnly /> }));
const { default: Entrar } = await import("./page");
const render = async (modo?: string) => renderToStaticMarkup(await Entrar({ searchParams: Promise.resolve({ modo }) }));

describe("signup_view y detección del servidor (#235)", () => {
  beforeEach(() => { state.ua = ""; state.viewer = null; state.blocked = false; });
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
