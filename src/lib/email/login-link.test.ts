import { describe, expect, it } from "vitest";
import { HANDOFF_TTL_MS, LOGIN_LINK_TTL_MS, signLoginToken, verifyLoginToken, withLoginLinks } from "./login-link";

const S = "secreto-de-prueba";
const U = "11111111-1111-4111-8111-111111111111";
const NOW = Date.parse("2026-10-28T12:00:00Z");
const SITE = "https://www.bananaburn.app";

describe("enlace de un toque en los correos", () => {
  it("firma y verifica: usuario, nonce y fecha", () => {
    const t = signLoginToken(U, S, NOW, "nonce-de-prueba-123456");
    expect(verifyLoginToken(t, S, NOW + 1000)).toEqual({ userId: U, nonce: "nonce-de-prueba-123456", issuedAt: Math.floor(NOW / 1000) * 1000, handoff: false });
  });
  it("vence a las 72 horas", () => {
    const t = signLoginToken(U, S, NOW);
    expect(verifyLoginToken(t, S, NOW + LOGIN_LINK_TTL_MS - 1000)).not.toBeNull();
    expect(verifyLoginToken(t, S, NOW + LOGIN_LINK_TTL_MS + 1000)).toBeNull();
  });
  it("rechaza firmas cambiadas, otro secreto, basura y tokens del futuro", () => {
    const t = signLoginToken(U, S, NOW);
    const [p, sig] = t.split(".");
    const other = Buffer.from(JSON.stringify({ u: "22222222-2222-4222-8222-222222222222", n: "x".repeat(22), t: Math.floor(NOW / 1000) })).toString("base64url");
    expect(verifyLoginToken(`${other}.${sig}`, S, NOW)).toBeNull();
    expect(verifyLoginToken(`${p}.${sig}x`, S, NOW)).toBeNull();
    expect(verifyLoginToken(t, "otro", NOW)).toBeNull();
    expect(verifyLoginToken(t, null, NOW)).toBeNull();
    expect(verifyLoginToken("basura", S, NOW)).toBeNull();
    expect(verifyLoginToken(signLoginToken(U, S, NOW + 3600_000), S, NOW)).toBeNull();
  });
  it("cambia solo los enlaces a la app, en HTML y en texto", () => {
    const msg = {
      subject: "Hoy toca",
      html: `<a href="${SITE}/app/entreno">Empezar</a> <a href="${SITE}/app?x=1&amp;y=2">Abrir</a> <a href="${SITE}/api/email/baja?token=abc">Baja</a> <a href="${SITE}/">Inicio</a>`,
      text: `Empezar: ${SITE}/app/entreno\nBaja: ${SITE}/api/email/baja?token=abc`,
    };
    const out = withLoginLinks(msg, U, { secret: S, site: SITE, now: NOW });
    expect(out.html).toContain(`href="${SITE}/auth/correo?t=`);
    expect(out.html).toContain("&amp;next=%2Fapp%2Fentreno");
    expect(out.html).toContain("&amp;next=%2Fapp%3Fx%3D1%26y%3D2");
    expect(out.html).toContain(`href="${SITE}/api/email/baja?token=abc"`);
    expect(out.html).toContain(`href="${SITE}/"`);
    expect(out.text).toMatch(new RegExp(`Empezar: ${SITE}/auth/correo\\?t=[^&]+&next=%2Fapp%2Fentreno`));
    expect(out.text).toContain(`Baja: ${SITE}/api/email/baja?token=abc`);
    // Un solo token por correo
    const tokens = new Set([...out.html.matchAll(/correo\?t=([^&"]+)/g)].map((m) => m[1]));
    expect(tokens.size).toBe(1);
  });
  it("sin secreto o sin usuario, el correo queda igual", () => {
    const msg = { subject: "a", html: `<a href="${SITE}/app">x</a>`, text: `${SITE}/app` };
    expect(withLoginLinks(msg, U, { secret: null, site: SITE })).toEqual(msg);
    expect(withLoginLinks(msg, null, { secret: S, site: SITE })).toEqual(msg);
  });

  it("pase de navegador: un solo formato, vence en 30 minutos y no se puede convertir en enlace de 72 h", () => {
    const t = signLoginToken(U, S, NOW, "nonce-de-prueba-pase-1", true);
    expect(verifyLoginToken(t, S, NOW + HANDOFF_TTL_MS - 1000)).toMatchObject({ userId: U, handoff: true });
    expect(verifyLoginToken(t, S, NOW + HANDOFF_TTL_MS + 1000)).toBeNull();
    // Quitar la marca del pase rompe la firma.
    const [p, sig] = t.split(".");
    const plain = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), k: undefined })).toString("base64url");
    expect(verifyLoginToken(`${plain}.${sig}`, S, NOW)).toBeNull();
  });
});
