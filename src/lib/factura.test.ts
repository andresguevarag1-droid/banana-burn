// #334: cada cobro exitoso deja un comprobante electrónico en 'pendiente', una sola vez, y con ALEGRA_ENABLED apagada no
// hay ni una llamada a Alegra. La tabla (0074) solo la escribe service_role y cada persona lee los suyos.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeDb } from "./fake-db";

vi.mock("server-only", () => ({}));
const state: { db: SupabaseClient | null } = { db: null };
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => state.db }));
const email = vi.hoisted(() => ({ sendPaymentReceipt: vi.fn(async (_r: Record<string, unknown>) => ({ ok: true })), sendPaymentFailed: vi.fn(async () => ({ ok: true })), sendSubscriptionCanceled: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/email", () => email);
vi.mock("@/lib/push", () => ({ sendPush: vi.fn(async () => 1) }));

const billing = await import("./billing");
const factura = await import("./factura");
const { reciboPago, EINVOICE_NOTE } = await import("./email/templates");

const USER = "11111111-1111-4111-8111-111111111111";
const KEY = "5".repeat(50);
const fetchMock = vi.fn(async (url: string) => String(url).startsWith(factura.ALEGRA_API)
  ? new Response(JSON.stringify({ id: 77, numberTemplate: { fullNumber: "00100004000000000001" }, stamp: { cufe: KEY }, pdf: "https://alegra.test/f.pdf" }), { status: 201 })
  : new Response("{}", { status: 200 }));
const alegraCalls = () => (fetchMock.mock.calls as unknown as [string][]).filter(([u]) => String(u).startsWith(factura.ALEGRA_API));

function setup() {
  const f = fakeDb({
    profiles: [{ id: USER, plan: "free", email: "ana@prueba.test" }],
    subscriptions: [{ id: 5, user_id: USER, provider: "tilopay", provider_subscription_id: "tlp:bbc-1", status: "incomplete", plan: "entreno", billing: "mes" }],
    payment_events: [], billing_documents: [],
  }, { payment_events: ["event_key"], billing_documents: ["charge_id"] });
  state.db = f.db;
  return f;
}
const pay = { periodStart: "2026-11-30T15:00:00.000Z", periodEnd: "2026-12-30T15:00:00.000Z", amountMinor: 999, currency: "USD", reference: "orden_1", provider: "tilopay" as const };
const cobrar = (f: ReturnType<typeof setup>) => billing.activateVerified(f.db, f.tables.subscriptions[0] as never, pay);

beforeEach(() => {
  fetchMock.mockClear(); email.sendPaymentReceipt.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("META_CAPI_TOKEN", "");
  vi.stubEnv("ALEGRA_USER", "andres@prueba.test"); vi.stubEnv("ALEGRA_TOKEN", "token-de-prueba");
  vi.stubEnv("ALEGRA_CLIENT_ID", "1"); vi.stubEnv("ALEGRA_ITEM_ID", "2"); vi.stubEnv("ALEGRA_TAX_ID", "3");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("cola de comprobantes con ALEGRA_ENABLED apagada (por defecto)", () => {
  it("un cobro exitoso crea un comprobante pendiente una sola vez y no llama a Alegra", async () => {
    vi.stubEnv("ALEGRA_ENABLED", "");
    const f = setup();
    expect(await cobrar(f)).toMatchObject({ ok: true });
    expect(await cobrar(f)).toMatchObject({ note: "duplicado" });
    expect(f.tables.billing_documents).toHaveLength(1);
    expect(f.tables.billing_documents[0]).toMatchObject({ charge_id: "tilopay:orden_1", user_id: USER, provider: "tilopay", kind: "tiquete", status: "pendiente", amount_minor: 999, currency: "USD" });
    expect(alegraCalls()).toHaveLength(0);
    expect(email.sendPaymentReceipt.mock.calls[0][0]).toMatchObject({ reference: "orden_1", einvoice: false });
  });

  it("el mismo cobro avisado otra vez (otro evento del procesador) no crea un segundo comprobante", async () => {
    const f = setup();
    const c = { userId: USER, provider: "onvo" as const, reference: "pi_1", amountMinor: 749, currency: "usd" };
    expect(await factura.enqueueBillingDocument(f.db, c)).toBe("creado");
    expect(await factura.enqueueBillingDocument(f.db, c)).toBe("duplicado");
    expect(f.tables.billing_documents).toHaveLength(1);
    expect(f.tables.billing_documents[0].currency).toBe("USD");
  });

  it("con la bandera en cualquier otro valor, o sin credenciales, sigue apagada", async () => {
    for (const v of ["", "0", "true", "staff"]) expect(factura.alegraEnabled({ ALEGRA_ENABLED: v, ALEGRA_USER: "a", ALEGRA_TOKEN: "b" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(factura.alegraEnabled({ ALEGRA_ENABLED: "1" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    const f = setup();
    await factura.enqueueBillingDocument(f.db, { userId: USER, provider: "onvo", reference: "pi_2", amountMinor: 999, currency: "USD" });
    expect(await factura.issueBillingDocument(f.db, "onvo:pi_2", { ALEGRA_ENABLED: "0", ALEGRA_USER: "a", ALEGRA_TOKEN: "b" } as unknown as NodeJS.ProcessEnv)).toBe("apagado");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("con ALEGRA_ENABLED=1", () => {
  it("emite una vez con el precio sin IVA y guarda número, clave de Hacienda y PDF", async () => {
    vi.stubEnv("ALEGRA_ENABLED", "1");
    const f = setup();
    await cobrar(f); await cobrar(f);
    expect(alegraCalls()).toHaveLength(1);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ client: { id: 1 }, items: [{ id: 2, price: 8.84, quantity: 1, tax: [{ id: 3 }] }], stamp: { generateStamp: true } });
    expect(f.tables.billing_documents).toHaveLength(1);
    expect(f.tables.billing_documents[0]).toMatchObject({ status: "emitido", number: "00100004000000000001", hacienda_key: KEY, pdf_url: "https://alegra.test/f.pdf", provider_document_id: "77", attempts: 1 });
    expect(email.sendPaymentReceipt.mock.calls[0][0]).toMatchObject({ einvoice: true });
  });

  it("si Alegra falla, el cobro y el recibo siguen y el comprobante queda en error", async () => {
    vi.stubEnv("ALEGRA_ENABLED", "1");
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ message: "Credenciales inválidas" }), { status: 401 }));
    const f = setup();
    expect(await cobrar(f)).toMatchObject({ ok: true, plan: "entreno" });
    expect(f.tables.billing_documents[0]).toMatchObject({ status: "error", attempts: 1, last_error: "Alegra 401: Credenciales inválidas" });
    expect(email.sendPaymentReceipt).toHaveBeenCalledOnce();
  });
});

describe("IVA incluido y recibo", () => {
  it("separa el 13 % de un total con IVA incluido sin perder centavos", () => {
    expect(factura.splitIva(999)).toEqual({ netMinor: 884, ivaMinor: 115 });
    expect(factura.splitIva(5999)).toEqual({ netMinor: 5309, ivaMinor: 690 });
  });
  it("el recibo dice que el comprobante llega aparte solo con la bandera prendida", () => {
    const d = { name: "Ana", plan: "Entreno", amount: 9.99, currency: "USD" };
    const on = reciboPago({ ...d, einvoice: true }); const off = reciboPago(d);
    expect(EINVOICE_NOTE).toBe("Tu comprobante electrónico te llega aparte.");
    expect(on.html).toContain(EINVOICE_NOTE); expect(on.text).toContain(EINVOICE_NOTE);
    expect(off.html).not.toContain(EINVOICE_NOTE); expect(off.text).not.toContain(EINVOICE_NOTE);
  });
});

describe("0074 billing_documents: RLS", () => {
  const pg = new PGlite({ extensions: { pgcrypto } });
  const A = "00000000-0000-0000-0000-00000000000a"; const B = "00000000-0000-0000-0000-00000000000b";
  beforeAll(async () => {
    await pg.exec(readFileSync("supabase/tests/stub.sql", "utf8"));
    await pg.exec(readFileSync("supabase/migrations/0074_comprobantes_electronicos.sql", "utf8"));
    await pg.exec(`insert into auth.users (id) values ('${A}'), ('${B}');
      insert into public.billing_documents (charge_id, user_id, provider) values ('onvo:pi_a', '${A}', 'onvo'), ('onvo:pi_b', '${B}', 'onvo');`);
  }, 30000);
  afterAll(async () => { await pg.close(); });
  const as = async (role: string, sub: string | null, sql: string) => {
    await pg.exec(`begin; set local role ${role}; select set_config('request.jwt.claims', '${JSON.stringify({ sub, role })}', true);`);
    try { return (await pg.query<Record<string, unknown>>(sql)).rows; } finally { await pg.exec("rollback"); }
  };

  it("la persona lee solo los suyos; anon no lee nada", async () => {
    expect((await as("authenticated", A, "select charge_id from public.billing_documents")).map((r) => r.charge_id)).toEqual(["onvo:pi_a"]);
    await expect(as("anon", null, "select * from public.billing_documents")).rejects.toThrow();
  });
  it("la persona no escribe ni cambia el estado; service_role sí", async () => {
    await expect(as("authenticated", A, `insert into public.billing_documents (charge_id, user_id, provider) values ('onvo:x', '${A}', 'onvo')`)).rejects.toThrow();
    await expect(as("authenticated", A, "update public.billing_documents set status = 'emitido'")).rejects.toThrow();
    expect(await as("service_role", null, `update public.billing_documents set status = 'error' where charge_id = 'onvo:pi_a' returning id`)).toHaveLength(1);
  });
  it("un cobro tiene un solo comprobante y 'emitido' exige la clave de Hacienda", async () => {
    await expect(as("service_role", null, `insert into public.billing_documents (charge_id, user_id, provider) values ('onvo:pi_a', '${A}', 'onvo')`)).rejects.toThrow(/unique|duplicate/);
    await expect(as("service_role", null, `update public.billing_documents set status = 'emitido' where charge_id = 'onvo:pi_a'`)).rejects.toThrow(/check/);
    await expect(as("service_role", null, `update public.billing_documents set status = 'pagado'`)).rejects.toThrow(/check/);
  });
});
