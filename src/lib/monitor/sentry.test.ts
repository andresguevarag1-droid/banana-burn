import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { scrubBreadcrumb, scrubEvent, scrubUrl, sentryOptions } from "./sentry";

describe("Sentry sin datos personales", () => {
  it("sin DSN queda apagado; con DSN no manda PII ni trazas", () => {
    expect(sentryOptions(undefined, "production").enabled).toBe(false);
    expect(sentryOptions("  ", "production").enabled).toBe(false);
    const o = sentryOptions("https://abc@o1.ingest.us.sentry.io/2", "preview");
    expect(o).toMatchObject({ enabled: true, environment: "preview", sendDefaultPii: false, tracesSampleRate: 0 });
    expect(o.beforeSendTransaction()).toBeNull();
    expect(sentryOptions("https://abc@o1.ingest.us.sentry.io/2", undefined).environment).toBe("local");
  });

  it("las URLs pierden query, hash e ids", () => {
    expect(scrubUrl("https://www.bananaburn.app/admin/usuarios/0b3c6f0e-1d2a-4c55-9a8e-2f1b3c4d5e6f?email=ana@a.co#x")).toBe("www.bananaburn.app/admin/usuarios/:id");
    expect(scrubUrl("https://www.bananaburn.app/r/ANA2026?utm_source=ig")).toBe("www.bananaburn.app/r/:codigo");
    expect(scrubUrl("/pago/exito?token=abc123def456ghi789jkl")).toBe("/pago/exito");
    expect(scrubUrl(undefined)).toBeUndefined();
  });

  it("el evento pierde usuario, cabeceras, cookies, cuerpo, extras y datos en mensajes", () => {
    const e = {
      type: undefined,
      user: { id: "u1", email: "ana@a.co", ip_address: "1.2.3.4" },
      request: { url: "https://www.bananaburn.app/c/PALMAS1?x=1", method: "POST", headers: { cookie: "sb=tok" }, cookies: { sb: "tok" }, data: { email: "ana@a.co" }, query_string: "x=1" },
      extra: { body: "algo" },
      server_name: "maquina",
      message: "Falló el correo a ana@a.co",
      tags: { url: "https://x.co/?t=1", cron: "cobros" },
      exception: { values: [{ type: "Error", value: "No se pudo cobrar a ana@a.co con el token eyJhbGciOiJIUzI1NiJ9.abc.def", stacktrace: { frames: [{ filename: "app:///_next/static/chunks/a.js", lineno: 1, vars: { email: "ana@a.co" } }] } }] },
      breadcrumbs: [
        { category: "fetch", data: { url: "https://www.bananaburn.app/api/cuenta?email=ana@a.co", method: "GET", status_code: 500, body: "x" } },
        { category: "navigation", data: { from: "/c/ABC123", to: "/app/hoy?token=1" } },
        { category: "console", message: "hola ana@a.co" },
      ],
    } as unknown as ErrorEvent;
    const out = scrubEvent(e);
    const text = JSON.stringify(out);
    expect(text).not.toMatch(/ana@a\.co|cookie|sb=tok|1\.2\.3\.4|maquina|eyJ|query_string/);
    expect(out.user).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.request).toEqual({ method: "POST", url: "www.bananaburn.app/c/:id" });
    expect(out.tags).toEqual({ cron: "cobros" });
    expect(out.exception?.values?.[0].value).toContain("[correo]");
    expect(out.exception?.values?.[0].stacktrace?.frames?.[0]).toMatchObject({ filename: "app:///_next/static/chunks/a.js", lineno: 1 });
    expect(out.breadcrumbs?.[0].data).toEqual({ url: "www.bananaburn.app/api/cuenta", method: "GET", status_code: 500 });
    expect(out.breadcrumbs?.[1].data).toEqual({ from: "/c/:id", to: "/app/hoy" });
  });

  it("breadcrumb sin data queda igual salvo el mensaje", () => {
    expect(scrubBreadcrumb({ category: "ui.click", message: "button#pagar" })).toEqual({ category: "ui.click", message: "button#pagar" });
  });
});
