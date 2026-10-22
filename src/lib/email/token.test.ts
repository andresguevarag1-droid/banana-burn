import { describe, expect, it } from "vitest";
import { signUnsubToken, verifyUnsubToken } from "./token";
import { recordatorio, reciboPago, resumenSemanal, esc } from "./templates";

const UID = "6f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b";
const SECRET = "test-secret-123";

describe("token de baja (HMAC)", () => {
  it("firma y verifica", () => {
    const t = signUnsubToken(UID, "semanal", SECRET);
    expect(verifyUnsubToken(t, SECRET)).toEqual({ userId: UID, scope: "semanal" });
  });
  it("rechaza otro secreto, firma alterada o payload alterado", () => {
    const t = signUnsubToken(UID, "recordatorios", SECRET);
    expect(verifyUnsubToken(t, "otro")).toBeNull();
    const [p, s] = t.split(".");
    expect(verifyUnsubToken(`${p}.${s.slice(0, -2)}xx`, SECRET)).toBeNull();
    const forged = Buffer.from(JSON.stringify({ u: UID, s: "todo", v: 1 })).toString("base64url");
    expect(verifyUnsubToken(`${forged}.${s}`, SECRET)).toBeNull();
  });
  it("rechaza basura y falta de secreto", () => {
    expect(verifyUnsubToken("", SECRET)).toBeNull();
    expect(verifyUnsubToken("abc", SECRET)).toBeNull();
    expect(verifyUnsubToken("a.b.c", SECRET)).toBeNull();
    expect(verifyUnsubToken(signUnsubToken(UID, "todo", SECRET), null)).toBeNull();
    expect(verifyUnsubToken(signUnsubToken("no-es-uuid", "todo", SECRET), SECRET)).toBeNull();
  });
});

describe("plantillas", () => {
  it("escapan HTML del nombre", () => {
    expect(esc(`<script>"x"</script>`)).toBe("&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
    const e = recordatorio({ name: "<b>Ana</b>", routine: "Tirón A", streak: 3, unsubscribe: "https://bananaburn.app/api/email/baja?token=x" });
    expect(e.html).not.toContain("<b>Ana</b>");
  });
  it("las de ciclo de vida llevan baja en HTML y texto", () => {
    const u = "https://bananaburn.app/api/email/baja?token=abc";
    const e = resumenSemanal({ name: "Andrés", workouts: 5, planned: 6, streak: 9, kgStart: 93.8, kgEnd: 93.1, trendPerWeek: -0.6, prs: ["Sentadilla 100 kg"], nextWeek: [{ day: "Lunes", name: "Empuje A" }], unsubscribe: u });
    expect(e.subject).toContain("-0,7 kg");
    expect(e.subject).not.toMatch(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u);
    expect(e.html).toContain(u);
    expect(e.text).toContain(u);
  });
  it("las transaccionales no llevan baja", () => {
    const e = reciboPago({ name: "Andrés", plan: "Entreno", amount: 9.99, currency: "USD", reference: "ch_1" });
    expect(e.html).not.toContain("/api/email/baja");
    expect(e.text).toContain("ch_1");
  });
});
