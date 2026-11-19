import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sendEmail = vi.hoisted(() => vi.fn(async (_to: string, _m: unknown, _o: unknown) => ({ ok: true })));
vi.mock("@/lib/email/send", () => ({ sendEmail }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => null }));
vi.mock("@/lib/admin-avisos-server", async () => {
  // Solo crDayRange (igual que el real): el resto del módulo no hace falta aquí.
  return { crDayRange: (now = new Date()) => {
    const cr = new Date(now.getTime() - 6 * 3600_000);
    const start = new Date(Date.UTC(cr.getUTCFullYear(), cr.getUTCMonth(), cr.getUTCDate(), 6));
    return { start: start.toISOString(), end: new Date(start.getTime() + 864e5).toISOString(), label: start.toISOString().slice(0, 10) };
  } };
});

import { aliasOf, buildResumen, genericReason, groupUpcoming, resumenEmail, resumenKey, splitMinor, upcomingWindow, type UpcomingCharge } from "./cobros-diarios";
import { listPrice } from "./embudo-plata";
import { cobrosCronMissed, loadUpcoming, RESUMEN_TO, sendCobrosResumen } from "./cobros-diarios-server";

/** El cron del lunes 30 de noviembre de 2026, 00:20 en Costa Rica. */
const CRON = new Date("2026-11-30T06:20:00.000Z");

type Call = { table: string; ops: [string, unknown[]][] };
/** Cliente falso: cada consulta encadena lo que sea y responde lo que diga `answer` según la tabla y los filtros. */
function fakeDb(answer: (c: Call) => { data: unknown; error?: { message: string; code?: string } | null }) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      const c: Call = { table, ops: [] };
      calls.push(c);
      const q: Record<string, unknown> = {};
      const chain = new Proxy(q, {
        get(_t, k: string) {
          if (k === "then") return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve({ error: null, ...answer(c) }).then(ok, bad);
          return (...args: unknown[]) => { c.ops.push([k, args]); return chain; };
        },
      });
      return chain;
    },
  };
  return { db: db as never, calls };
}
const has = (c: Call, op: string, ...args: unknown[]) => c.ops.some(([k, a]) => k === op && args.every((x, i) => JSON.stringify(a[i]) === JSON.stringify(x)));

const charge = (p: Partial<UpcomingCharge>): UpcomingCharge => ({ at: "2026-11-30T06:00:00.000Z", userId: "u1", alias: "@ana", plan: "entreno", billing: "mes", amountMinor: 499, processor: "onvo", attempt: 1, kind: "primer_cobro", ...p });

describe("próximos cobros (7 días)", () => {
  it("la ventana empieza a las 00:00 de hoy en Costa Rica y dura 7 días", () => {
    expect(upcomingWindow(new Date("2026-11-29T05:59:00.000Z"))).toEqual({ start: "2026-11-28T06:00:00.000Z", end: "2026-12-05T06:00:00.000Z" });
    expect(upcomingWindow(CRON)).toEqual({ start: "2026-11-30T06:00:00.000Z", end: "2026-12-07T06:00:00.000Z" });
  });

  it("agrupa por día de Costa Rica con bruto, comisiones y neto sin IVA; lo vencido cae en hoy", () => {
    const days = groupUpcoming([
      charge({ at: "2026-11-30T06:00:00.000Z", amountMinor: 499 }),
      charge({ at: "2026-11-29T06:00:00.000Z", userId: "u2", amountMinor: 749, kind: "reintento", attempt: 2 }),
      // 23:30 del 1 de diciembre en Costa Rica (05:30 UTC del 2): cuenta el 1.
      charge({ at: "2026-12-02T05:30:00.000Z", userId: "u3", amountMinor: 1499, processor: "tilopay", kind: "renovacion" }),
      charge({ at: "2026-12-08T06:00:00.000Z", userId: "u4" }),
    ], new Date("2026-11-29T18:00:00.000Z"));
    expect(days.map((d) => d.day)).toEqual(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05"]);
    expect(days[0].rows.map((r) => r.userId)).toEqual(["u2"]);
    expect(days[1].rows.map((r) => r.userId)).toEqual(["u1"]);
    expect(days[2].rows.map((r) => r.userId)).toEqual(["u3"]);
    expect(days.flatMap((d) => d.rows).some((r) => r.userId === "u4")).toBe(false);
    // $4.99 en ONVO: 3.9 % + $0.35 = 54 ¢; sin IVA 442 ¢; neto 388 ¢.
    expect(splitMinor(499, "onvo")).toEqual({ comisionMinor: 54, netoMinor: 388 });
    expect(days[1]).toMatchObject({ brutoMinor: 499, comisionMinor: 54, netoMinor: 388 });
    expect(days[2]).toMatchObject({ brutoMinor: 1499, comisionMinor: splitMinor(1499, "tilopay").comisionMinor });
    expect(days[6].rows).toEqual([]);
  });

  it("el alias nunca es el correo", () => {
    expect(aliasOf({ username: "ana", full_name: "Ana Pérez" })).toBe("@ana");
    expect(aliasOf({ username: null, full_name: "Ana Pérez" })).toBe("Ana");
    expect(aliasOf({ full_name: "ana@correo.com" })).toBe("Sin nombre");
    expect(aliasOf(null)).toBe("Sin nombre");
  });

  it("lee primeros cobros, reintentos y renovaciones con su procesador y alias", async () => {
    const { db } = fakeDb((c) => {
      if (c.table === "trial_charges") return { data: [
        { user_id: "u1", plan: "entreno", billing: "mes", amount_minor: 499, next_attempt_at: "2026-11-30T06:00:00.000Z", status: "scheduled", attempts: 0 },
        { user_id: "u2", plan: "completo", billing: "mes", amount_minor: 749, next_attempt_at: "2026-12-01T06:00:00.000Z", status: "retry_scheduled", attempts: 1 },
      ] };
      if (c.table === "subscriptions") return { data: [{ user_id: "u3", provider: "tilopay", plan: "completo", billing: "anual", current_period_end: "2026-12-02T06:00:00.000Z", renewal_attempts: 0 }] };
      if (c.table === "profiles") return { data: [{ id: "u1", username: "ana", full_name: null }, { id: "u2", username: null, full_name: "Luis Mora" }] };
      if (c.table === "payment_methods") return { data: [{ user_id: "u2", provider: "tilopay" }] };
      return { data: [] };
    });
    const rows = await loadUpcoming(CRON, db);
    expect(rows).toEqual([
      expect.objectContaining({ userId: "u1", alias: "@ana", processor: "onvo", attempt: 1, kind: "primer_cobro", amountMinor: 499 }),
      expect.objectContaining({ userId: "u2", alias: "Luis", processor: "tilopay", attempt: 2, kind: "reintento" }),
      expect.objectContaining({ userId: "u3", alias: "Sin nombre", processor: "tilopay", attempt: 1, kind: "renovacion", amountMinor: listPrice("completo", "anual") }),
    ]);
  });

  it("deja fuera las suscripciones que no cobra ningún procesador (condominio, regaladas, de prueba)", async () => {
    const subs = [
      { user_id: "u1", provider: "onvo", plan: "entreno", billing: "mes", current_period_end: "2026-12-01T06:00:00.000Z", renewal_attempts: 0 },
      { user_id: "u2", provider: "condominio", plan: "completo", billing: "mes", current_period_end: "2026-12-01T06:00:00.000Z", renewal_attempts: 0 },
    ];
    const { db, calls } = fakeDb((c) => {
      if (c.table !== "subscriptions") return { data: [] };
      const only = c.ops.find(([k, a]) => k === "in" && a[0] === "provider")?.[1][1] as string[] | undefined;
      return { data: only ? subs.filter((s) => only.includes(s.provider)) : subs };
    });
    const rows = await loadUpcoming(CRON, db);
    expect(has(calls.find((c) => c.table === "subscriptions")!, "in", "provider", ["onvo", "tilopay"])).toBe(true);
    expect(rows?.map((r) => r.userId)).toEqual(["u1"]);
  });

  it("si la base falla devuelve null (el panel dice sin dato, nunca cero)", async () => {
    const { db } = fakeDb((c) => (c.table === "trial_charges" ? { data: null, error: { message: "x", code: "42P01" } } : { data: [] }));
    expect(await loadUpcoming(CRON, db)).toBeNull();
  });
});

describe("resumen diario de cobros", () => {
  it("sin cobros no hay resumen", () => {
    expect(buildResumen([], "2026-11-30", false)).toBeNull();
  });

  it("cuenta los que pasaron y los que fallaron con un motivo genérico, y marca el primer pago real", () => {
    const r = buildResumen([
      { status: "succeeded", amountMinor: 499, processor: "onvo", lastError: null },
      { status: "retry_scheduled", amountMinor: 749, processor: "onvo", lastError: "ONVO card_declined: insufficient_funds 4242" },
      { status: "pending", amountMinor: 499, processor: "onvo", lastError: null },
    ], "2026-11-30", false)!;
    expect(r).toMatchObject({ pasaron: 1, fallaron: 1, enProceso: 1, brutoMinor: 499, netoMinor: 388, motivos: { "Tarjeta rechazada": 1 }, primerPago: true });
    const m = resumenEmail(r);
    expect(m.subject).toBe("Primer pago real. Cobros del 30 nov 2026: 1 pasó, 1 falló");
    expect(m.text).toContain("Tarjeta rechazada: 1");
    expect(m.text).toContain("$3.88 neto");
    expect(m.html + m.text).not.toContain("4242");
    expect(m.text).not.toMatch(/!/);
  });

  it("si ya hubo pagos antes, o hoy no pasó ninguno, no es el primer pago", () => {
    const ok = [{ status: "succeeded", amountMinor: 499, processor: "onvo" as const, lastError: null }];
    expect(buildResumen(ok, "2026-12-01", true)!.primerPago).toBe(false);
    const r = buildResumen([{ status: "failed", amountMinor: 499, processor: "onvo", lastError: "sin tarjeta guardada" }], "2026-11-30", false)!;
    expect(r.primerPago).toBe(false);
    expect(resumenEmail(r).subject).toBe("Cobros del 30 nov 2026: 0 pasaron, 1 falló");
  });

  it("motivos genéricos", () => {
    expect(genericReason("sin tarjeta guardada")).toBe("Sin tarjeta guardada");
    expect(genericReason("Tilopay: rechazado (consulta)")).toBe("Tarjeta rechazada");
    expect(genericReason("sin respuesta de ONVO (red)")).toBe("Sin respuesta del procesador");
    expect(genericReason("ONVO requires_action")).toBe("El banco pidió verificación");
    expect(genericReason("algo raro")).toBe("Otro motivo");
  });

  it("sin cobros ese día no manda correo", async () => {
    sendEmail.mockClear();
    const { db } = fakeDb(() => ({ data: [] }));
    expect(await sendCobrosResumen(CRON, db)).toEqual({ sent: false, resumen: null });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("con cobros manda a hola@bananaburn.app con una llave por día: dos corridas el mismo día usan la misma llave", async () => {
    sendEmail.mockClear();
    const { db, calls } = fakeDb((c) => {
      if (c.table === "trial_charges" && has(c, "gte", "last_attempt_at")) return { data: [
        { user_id: "u1", status: "succeeded", amount_minor: 499, last_error: null },
        { user_id: "u2", status: "retry_scheduled", amount_minor: 749, last_error: "Tilopay: rechazado (consulta)" },
      ] };
      if (c.table === "payment_methods") return { data: [{ user_id: "u2", provider: "tilopay" }] };
      return { data: [] }; // nunca hubo un pago antes
    });
    const a = await sendCobrosResumen(CRON, db);
    await sendCobrosResumen(new Date(CRON.getTime() + 3600_000), db);
    expect(a.sent).toBe(true);
    expect(a.resumen).toMatchObject({ day: "2026-11-30", pasaron: 1, fallaron: 1, primerPago: true });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const [to, msg, opts] = sendEmail.mock.calls[0] as [string, { subject: string }, { idempotencyKey: string }];
    expect(to).toBe(RESUMEN_TO);
    expect(msg.subject).toMatch(/^Primer pago real\./);
    expect(opts.idempotencyKey).toBe(resumenKey("2026-11-30"));
    expect((sendEmail.mock.calls[1][2] as { idempotencyKey: string }).idempotencyKey).toBe(opts.idempotencyKey);
    // Lee los cobros intentados desde las 00:00 de hoy en Costa Rica.
    expect(calls.some((c) => has(c, "gte", "last_attempt_at", "2026-11-30T06:00:00.000Z"))).toBe(true);
  });

  it("si la base falla no lanza ni manda", async () => {
    sendEmail.mockClear();
    const { db } = fakeDb(() => ({ data: null, error: { message: "caída" } }));
    expect(await sendCobrosResumen(CRON, db)).toEqual({ sent: false, resumen: null });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("¿corrió el cron de cobros hoy?", () => {
  const at7 = new Date("2026-11-30T13:00:00.000Z");
  it("con latido de hoy, corrió", async () => {
    expect(await cobrosCronMissed(at7, fakeDb(() => ({ data: { last_at: "2026-11-30T06:20:30.000Z" } })).db)).toBe(false);
  });
  it("con latido de ayer o sin latido, no corrió", async () => {
    expect(await cobrosCronMissed(at7, fakeDb(() => ({ data: { last_at: "2026-11-29T06:20:30.000Z" } })).db)).toBe(true);
    expect(await cobrosCronMissed(at7, fakeDb(() => ({ data: null })).db)).toBe(true);
  });
  it("si no se puede leer, no se sabe (null)", async () => {
    expect(await cobrosCronMissed(at7, fakeDb(() => ({ data: null, error: { message: "x" } })).db)).toBeNull();
  });
});
