import { describe, expect, it } from "vitest";
import { emailSignal, ipSignal, signalHash } from "./referrals-server";

const K = "secreto-de-prueba";

describe("señales de atribución (HMAC, sin datos legibles)", () => {
  it("sin secreto o sin valor no hay firma", () => {
    expect(signalHash("mail", "a@b.com", "")).toBeNull();
    expect(signalHash("ip", null, K)).toBeNull();
  });
  it("misma bandeja = misma firma; otra persona = otra firma", () => {
    expect(emailSignal("Rita.Gomez+promo@gmail.com", K)).toBe(emailSignal("ritagomez@gmail.com", K));
    expect(emailSignal("ana@hotmail.com", K)).not.toBe(emailSignal("rita@hotmail.com", K));
    expect(emailSignal("sin-arroba", K)).toBeNull();
  });
  it("misma red /24 = misma firma; red local no se guarda", () => {
    expect(ipSignal("201.204.33.10", K)).toBe(ipSignal("201.204.33.250", K));
    expect(ipSignal("201.204.34.10", K)).not.toBe(ipSignal("201.204.33.10", K));
    expect(ipSignal("192.168.0.4", K)).toBeNull();
  });
  it("la firma no contiene el correo ni la IP y depende del secreto", () => {
    const h = emailSignal("ritagomez@gmail.com", K)!;
    expect(h).toHaveLength(32);
    expect(h).not.toMatch(/rita|gmail/);
    expect(emailSignal("ritagomez@gmail.com", "otro")).not.toBe(h);
    expect(signalHash("mail", "x", K)).not.toBe(signalHash("ip", "x", K));
  });
});
