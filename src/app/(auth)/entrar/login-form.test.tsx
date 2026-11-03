import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanEvent } from "@/app/api/track/event";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("modo=registro"),
  useRouter: () => ({ replace: () => {}, refresh: () => {} }),
}));
vi.mock("./actions", () => ({ afterSocialSignIn: vi.fn(), confirmAndCheck: vi.fn(), signUpConfirmed: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const { LoginForm } = await import("./login-form");

describe("registro dentro de Instagram o Facebook (#235)", () => {
  it("sin Google y con el enlace para abrirla en Safari o Chrome; el correo queda primero", () => {
    for (const openIn of ["Safari", "Chrome"] as const) {
      const html = renderToStaticMarkup(<LoginForm configured googleEnabled openIn={openIn} />);
      expect(html).not.toContain("Continuar con Google");
      expect(html).toContain(`¿Prefieres Google? Ábrelo en ${openIn}`);
      expect(html).toContain("Empezar mi prueba gratis");
    }
  });
  it("en el navegador normal, todo igual", () => {
    const html = renderToStaticMarkup(<LoginForm configured googleEnabled />);
    expect(html).toContain("Continuar con Google");
    expect(html).not.toContain("¿Prefieres Google?");
  });
  it("sin Google activo no ofrece abrirla en otro navegador", () => {
    expect(renderToStaticMarkup(<LoginForm configured openIn="Safari" />)).not.toContain("¿Prefieres Google?");
  });
  it("signup_view es un evento permitido y guarda inapp", () => {
    expect(cleanEvent({ name: "signup_view", props: { inapp: true } })).toEqual({ name: "signup_view", props: { inapp: true } });
    expect(cleanEvent({ name: "signup_view", props: { inapp: false } })?.props).toEqual({ inapp: false });
  });
});
