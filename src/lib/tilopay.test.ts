import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __setTilopayFetch, amountText, apiToken, chargeSavedCard, checkoutOrderNumber, consultOrder, createTokenizeUrl, isTilopayConfigured,
  readCharge, readConsult, readReturn, renewalOrderNumber, signState, splitName, trialOrderNumber, verifyState,
} from "./tilopay";
import { RENEWAL_MAX_ATTEMPTS, renewalNext } from "./tilopay-renewal";

const ENV = { TILOPAY_API_USER: "u", TILOPAY_API_PASSWORD: "p", TILOPAY_KEY: "k", TILOPAY_ENABLED: "1" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("configuración de Tilopay", () => {
  it("necesita las cuatro variables y TILOPAY_ENABLED=1", () => {
    expect(isTilopayConfigured(ENV as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(isTilopayConfigured({ ...ENV, TILOPAY_ENABLED: "0" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isTilopayConfigured({ ...ENV, TILOPAY_KEY: "" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isTilopayConfigured({} as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("cliente REST (fetch simulado)", () => {
  const calls: { url: string; body: Record<string, unknown>; auth: string | null }[] = [];
  let replies: Response[] = [];
  beforeEach(() => {
    Object.assign(process.env, ENV);
    calls.length = 0;
    replies = [];
    __setTilopayFetch(async (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")), auth: new Headers(init?.headers).get("authorization") });
      const r = replies.shift();
      if (!r) throw new Error("sin respuesta simulada");
      return r;
    });
  });
  afterEach(() => __setTilopayFetch(null));

  it("pide el token una sola vez y lo reutiliza", async () => {
    replies.push(json(200, { access_token: "tok1", token_type: "bearer", expires_in: 86400 }));
    expect(await apiToken()).toBe("tok1");
    expect(await apiToken()).toBe("tok1");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://app.tilopay.com/api/v1/login");
    expect(calls[0].body).toEqual({ apiuser: "u", password: "p" });
  });

  it("renueva el token si vence", async () => {
    replies.push(json(200, { access_token: "a", expires_in: 700 }), json(200, { access_token: "b", expires_in: 700 }));
    const t0 = Date.now();
    expect(await apiToken(t0)).toBe("a");
    expect(await apiToken(t0 + 200_000)).toBe("b");
  });

  it("login fallido lanza error", async () => {
    replies.push(json(401, { message: "no" }));
    await expect(apiToken()).rejects.toThrow(/login/);
  });

  it("pide la página para guardar la tarjeta con los campos de la documentación", async () => {
    replies.push(json(200, { access_token: "t", expires_in: 86400 }), json(200, { type: "100", url: "https://secure.tilopay.com/x" }));
    const url = await createTokenizeUrl({ redirect: "https://www.bananaburn.app/api/pagos/tilopay/vuelta?s=1", email: "a@b.co", name: "Ana María López" });
    expect(url).toBe("https://secure.tilopay.com/x");
    expect(calls[1].url).toBe("https://app.tilopay.com/api/v1/processTokenize");
    expect(calls[1].auth).toBe("bearer t");
    expect(calls[1].body).toMatchObject({ key: "k", email: "a@b.co", language: "es", firstName: "Ana", lastName: "María López", token_version: "v2" });
  });

  it("cobro aprobado", async () => {
    replies.push(json(200, { access_token: "t", expires_in: 86400 }), json(200, { type: "200", response: "1", description: "Transacción aprobada", auth: "123", tilopayTransaction: "999" }));
    const r = await chargeSavedCard({ token: "tok_tarjeta_1", email: "a@b.co", amountMinor: 999, orderNumber: "bbt-1-1" });
    expect(r).toEqual({ state: "approved", auth: "123", transactionId: "999", description: "Transacción aprobada" });
    expect(calls[1].url).toBe("https://app.tilopay.com/api/v1/processRecurrentPayment");
    expect(calls[1].body).toEqual({ key: "k", amount: "9.99", currency: "USD", orderNumber: "bbt-1-1", capture: "1", email: "a@b.co", card: "tok_tarjeta_1" });
  });

  it("cobro rechazado (respuesta 200 con otro código o un 4xx)", async () => {
    replies.push(json(200, { access_token: "t", expires_in: 86400 }), json(200, { response: "0", description: "Fondos insuficientes" }));
    expect((await chargeSavedCard({ token: "tok_tarjeta_1", email: "a@b.co", amountMinor: 999, orderNumber: "o1" })).state).toBe("declined");
    replies.push(json(400, { type: "400", message: "Tarjeta inválida" }));
    const r = await chargeSavedCard({ token: "tok_tarjeta_1", email: "a@b.co", amountMinor: 999, orderNumber: "o2" });
    expect(r.state).toBe("declined");
  });

  it("tiempo agotado, 5xx o llave mala = por confirmar (nunca rechazo ni aprobado)", async () => {
    replies.push(json(200, { access_token: "t", expires_in: 86400 }), json(502, { message: "gateway" }));
    expect((await chargeSavedCard({ token: "tok_tarjeta_1", email: "a@b.co", amountMinor: 999, orderNumber: "o1" })).state).toBe("unknown");
    replies.push(json(403, { message: "key" }));
    expect((await chargeSavedCard({ token: "tok_tarjeta_1", email: "a@b.co", amountMinor: 999, orderNumber: "o2" })).state).toBe("unknown");
    // Red caída (sin respuesta simulada = el fetch lanza).
    expect((await chargeSavedCard({ token: "tok_tarjeta_1", email: "a@b.co", amountMinor: 999, orderNumber: "o3" })).state).toBe("unknown");
  });

  it("token vencido (401): pide uno nuevo y reintenta una vez", async () => {
    replies.push(json(200, { access_token: "viejo", expires_in: 86400 }), json(401, {}), json(200, { access_token: "nuevo", expires_in: 86400 }), json(200, { response: "1" }));
    expect((await chargeSavedCard({ token: "tok_tarjeta_1", email: "a@b.co", amountMinor: 999, orderNumber: "o1" })).state).toBe("approved");
    expect(calls[3].auth).toBe("bearer nuevo");
  });

  it("consulta que no se entiende = unknown", async () => {
    replies.push(json(200, { access_token: "t", expires_in: 86400 }), json(200, { algo: "raro" }));
    expect(await consultOrder("o1")).toEqual({ state: "unknown" });
    replies.push(json(500, {}));
    expect(await consultOrder("o1")).toEqual({ state: "unknown" });
  });
});

describe("lecturas puras", () => {
  it("readCharge", () => {
    expect(readCharge({ response: 1 }).state).toBe("approved");
    expect(readCharge({ response: "2", description: "x" })).toEqual({ state: "declined", description: "x" });
    expect(readCharge({}).state).toBe("unknown");
    expect(readCharge(null).state).toBe("unknown");
  });

  it("readConsult acepta formas razonables y exige la misma orden", () => {
    expect(readConsult({ response: [{ orderNumber: "o1", code: "1", amount: "9.99", currency: "usd", crd: "tok_abcdefgh" }] }, "o1")).toEqual({ state: "approved", amountMinor: 999, currency: "USD", token: "tok_abcdefgh" });
    expect(readConsult({ response: { order: "o1", estado: "rechazada" } }, "o1")).toEqual({ state: "declined" });
    expect(readConsult({ response: [{ orderNumber: "otra", code: "1" }] }, "o1")).toEqual({ state: "unknown" });
    expect(readConsult({ orderNumber: "o1", code: "pendiente" }, "o1")).toEqual({ state: "unknown" });
  });

  it("readReturn: el token puede venir con varios nombres; datos raros se descartan", () => {
    const a = readReturn(new URLSearchParams("code=1&crd=tok_ABC123xyz&brand=Visa&last4=4242&order=o1"));
    expect(a).toMatchObject({ code: "1", token: "tok_ABC123xyz", brand: "visa", last4: "4242", order: "o1" });
    expect(readReturn(new URLSearchParams("token=abcdefgh12&cardNumber=4111XXXXXXXX1111")).last4).toBe("1111");
    expect(readReturn(new URLSearchParams("crd=<script>")).token).toBeNull();
    expect(readReturn(new URLSearchParams("brand=hackercard")).brand).toBeNull();
    expect(readReturn(new URLSearchParams("")).token).toBeNull();
  });

  it("montos, nombres y números de orden", () => {
    expect(amountText(999)).toBe("9.99");
    expect(amountText(8999)).toBe("89.99");
    expect(splitName("")).toEqual({ firstName: "Cliente", lastName: "Banana Burn" });
    expect(splitName("Andrés")).toEqual({ firstName: "Andrés", lastName: "Banana Burn" });
    const t = trialOrderNumber("trial:3f2b1c4d-1111-4222-8333-444455556666", 2);
    expect(t).toBe("bbt-3f2b1c4d111142228333444455556666-2");
    expect(t.length).toBeLessThan(50);
    expect(trialOrderNumber("trial:3f2b1c4d-1111-4222-8333-444455556666", 2)).toBe(t);
    expect(renewalOrderNumber(42, "2026-12-01T10:00:00.000Z", 1)).toBe("bbr-42-20261201-1");
    expect(checkoutOrderNumber("ab-12_cd")).toBe("bbc-ab12cd");
  });
});

describe("estado firmado de la vuelta", () => {
  const env = ENV as unknown as NodeJS.ProcessEnv;
  const base = { u: "3f2b1c4d-1111-4222-8333-444455556666", p: "tarjeta" as const, plan: "completo" as const, billing: "mes" as const, n: "x" };
  it("firma y verifica", () => {
    const now = Date.now();
    const s = signState(base, now, env);
    expect(verifyState(s, now + 1000, env)).toMatchObject(base);
  });
  it("rechaza firma alterada, otro secreto o vencido", () => {
    const now = Date.now();
    const s = signState(base, now, env);
    const [p, sig] = s.split(".");
    const forged = Buffer.from(JSON.stringify({ ...base, u: "otra", t: Math.floor(now / 1000) })).toString("base64url");
    expect(verifyState(`${forged}.${sig}`, now, env)).toBeNull();
    expect(verifyState(`${p}.${sig}x`, now, env)).toBeNull();
    expect(verifyState(s, now, { ...env, TILOPAY_API_PASSWORD: "otra" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(verifyState(s, now + 3 * 3600_000, env)).toBeNull();
    expect(verifyState(null, now, env)).toBeNull();
  });
});

describe("renovaciones", () => {
  const now = new Date("2026-12-01T12:00:00Z");
  it("aprobada renueva", () => expect(renewalNext(1, "approved", now)).toEqual({ do: "renewed" }));
  it("rechazada: past_due y reintento mañana, hasta 3 intentos; después se cancela", () => {
    expect(renewalNext(1, "declined", now)).toEqual({ do: "retry", status: "past_due", nextAt: "2026-12-02T12:00:00.000Z" });
    expect(renewalNext(2, "sin_tarjeta", now).do).toBe("retry");
    expect(renewalNext(RENEWAL_MAX_ATTEMPTS, "declined", now)).toEqual({ do: "cancel" });
  });
  it("sin respuesta: espera una hora y consulta (no se reintenta a ciegas)", () => {
    expect(renewalNext(3, "unknown", now)).toEqual({ do: "wait", nextAt: "2026-12-01T13:00:00.000Z" });
  });
});
