import { afterEach, describe, expect, it, vi } from "vitest";
import { cronFailed, cronFromRoute, errorRateAlert } from "./alerts";

/** Base falsa: solo guarda las llamadas a admin_event_enqueue. */
function fakeDb() {
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  return { rpc, db: { rpc } as never };
}
const now = new Date("2026-11-08T06:25:00Z"); // 00:25 del 8 de noviembre en Costa Rica

afterEach(() => vi.restoreAllMocks());

describe("avisos de sistema", () => {
  it("un cron fallido deja un aviso 'sistema' con clave por cron y día de Costa Rica", async () => {
    const { rpc, db } = fakeDb();
    await cronFailed("cobros", { errores: 3 }, { db, now, kick: false });
    expect(rpc).toHaveBeenCalledWith("admin_event_enqueue", {
      p_key: "sistema:cron:cobros:2026-11-08", p_kind: "sistema", p_user: null, p_amount: null, p_currency: null,
      p_data: { motivo: "cron", cron: "cobros", errores: 3 },
    });
  });

  it("no manda datos de personas aunque se los pasen", async () => {
    const { rpc, db } = fakeDb();
    await cronFailed("avisos", { email: "ana@a.co", userId: "u1", nombre: "Ana", pendientes: false }, { db, now, kick: false });
    const data = (rpc.mock.calls[0] as unknown as [string, { p_data: Record<string, unknown> }])[1].p_data;
    expect(data).toEqual({ motivo: "cron", cron: "avisos", pendientes: false });
  });

  it("si la base falla, no lanza (avisar nunca rompe el cron)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const db = { rpc: vi.fn(async () => { throw new Error("caída"); }) } as never;
    await expect(cronFailed("recordatorios", {}, { db, now, kick: false })).resolves.toBeUndefined();
  });

  it("errores sobre el umbral: un aviso por día con el total y el umbral", async () => {
    const { rpc, db } = fakeDb();
    await errorRateAlert(73, 50, { db, now, kick: false });
    expect(rpc).toHaveBeenCalledWith("admin_event_enqueue", expect.objectContaining({ p_key: "sistema:errores:2026-11-08", p_kind: "sistema", p_data: { motivo: "errores", total: 73, umbral: 50 } }));
  });

  it("reconoce las rutas de los crons que avisan", () => {
    expect(cronFromRoute("/api/cron/cobros")).toBe("cobros");
    expect(cronFromRoute("/api/cron/avisos")).toBe("avisos");
    expect(cronFromRoute("/api/cron/recordatorios")).toBe("recordatorios");
    expect(cronFromRoute("/api/cronx/cobros")).toBeNull();
    expect(cronFromRoute("/api/salud")).toBeNull();
    expect(cronFromRoute(null)).toBeNull();
  });
});
