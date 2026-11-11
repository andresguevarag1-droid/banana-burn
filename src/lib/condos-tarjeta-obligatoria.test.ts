// #269: desde el 1 de diciembre de 2026 todos los condominios piden la tarjeta a las cuentas nuevas, con el flujo de Soho
// Paradisus (#264, #267): primero prueban 7 días sin tarjeta y la tarjeta extiende el acceso hasta el fin de SU mes gratis
// (30 días desde que lo activaron, no free_until). El cobro pasa a esa fecha, a precio normal. Base falsa como en
// condos-server.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const jar = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (k: string) => (k === "bb_condo" && jar.value ? { value: jar.value } : undefined) }) }));
const paid = vi.hoisted(() => ({ value: false }));
vi.mock("@/lib/trial-billing", () => ({ hasLivePaidSubscription: async () => paid.value }));
const notified = vi.hoisted(() => [] as { title: string }[]);
vi.mock("@/lib/email", () => ({ notifyInApp: async (_u: string, n: { title: string }) => { notified.push(n); return true; }, sendCondoEndingEmail: async () => ({ ok: true }) }));

type Row = Record<string, unknown>;
const tables = vi.hoisted(() => ({} as Record<string, Row[]>));
// Constructor de consultas mínimo con el subconjunto de PostgREST que usa condos-server.
function from(name: string) {
  const rows = (tables[name] ??= []);
  const filters: ((r: Row) => boolean)[] = [];
  let op: "select" | "insert" | "update" | "delete" = "select";
  let payload: Row | null = null;
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return q; },
    in: (k: string, v: unknown[]) => { filters.push((r) => v.includes(r[k])); return q; },
    is: (k: string, v: unknown) => { filters.push((r) => (r[k] ?? null) === v); return q; },
    gt: () => q, limit: () => q, order: () => q,
    insert: (p: Row) => { op = "insert"; payload = p; return q; },
    update: (p: Row) => { op = "update"; payload = p; return q; },
    delete: () => { op = "delete"; return q; },
    run() {
      const hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op === "insert") {
        if (name === "comp_grants" && payload!.source === "condominio" && rows.some((r) => r.user_id === payload!.user_id && r.source === "condominio")) return { data: null, error: { code: "23505" } };
        if (name === "condo_members" && rows.some((r) => r.user_id === payload!.user_id)) return { data: null, error: { code: "23505" } };
        const row = { id: rows.length + 1, revoked_at: null, ...payload };
        rows.push(row);
        return { data: [row], error: null };
      }
      if (op === "update") { hit.forEach((r) => Object.assign(r, payload)); return { data: hit, error: null }; }
      if (op === "delete") { hit.forEach((r) => rows.splice(rows.indexOf(r), 1)); return { data: hit, error: null }; }
      return { data: hit, error: null };
    },
    single: async () => { const r = q.run(); return { data: (r.data as Row[] | null)?.[0] ?? null, error: r.error }; },
    maybeSingle: async () => { const r = q.run(); return { data: (r.data as Row[] | null)?.[0] ?? null, error: r.error }; },
    then: (ok: (v: unknown) => unknown) => Promise.resolve(q.run()).then(ok),
  };
  return q;
}
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({ from }) }));

import { joinCondo, pendingCardCondo, cutCardCondoGrant, syncCondoMembers } from "./condos-server";
import { CARD_REQUIRED_FROM } from "./card-required";
import { CONDO_FREE_DAYS, CONDO_TRY_DAYS, type CondoRow } from "./condos";

const DAY = 864e5;
const NEW = "u-nueva", OLD = "u-vieja";
const JOIN = new Date(Date.parse(CARD_REQUIRED_FROM) + 2 * DAY);
const plus = (d: Date, n: number) => new Date(d.getTime() + n * DAY).toISOString();
const db = { from } as unknown as Parameters<typeof pendingCardCondo>[0];
const grantOf = (u: string) => tables.comp_grants.find((g) => g.user_id === u)!;

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  notified.length = 0;
  paid.value = false;
  tables.condos = [{ id: 1, code: "las-palmas", name: "Las Palmas", status: "mes_gratis", free_ends_at: null, paid_plan: null, paid_until: null, card_required: false, free_until: null }];
  tables.profiles = [{ id: NEW, created_at: CARD_REQUIRED_FROM }, { id: OLD, created_at: new Date(Date.parse(CARD_REQUIRED_FROM) - 60_000).toISOString() }];
  tables.trial_charges = [];
  tables.payment_methods = [];
});

describe("condominios con la tarjeta obligatoria (#269)", () => {
  it("cuenta de antes del 1 de enero: el mes gratis de siempre, sin tarjeta", async () => {
    expect((await joinCondo(OLD, "las-palmas", JOIN)).kind).toBe("join");
    expect(grantOf(OLD).expires_at).toBe(plus(JOIN, CONDO_FREE_DAYS));
    expect(await pendingCardCondo(db, OLD, JOIN)).toBeNull();
  });

  it("cuenta nueva: prueba 7 días sin tarjeta; con la tarjeta sigue gratis hasta completar su mes y el cobro pasa a ese día", async () => {
    expect((await joinCondo(NEW, "las-palmas", JOIN)).kind).toBe("join");
    expect(grantOf(NEW).expires_at).toBe(plus(JOIN, CONDO_TRY_DAYS));
    expect(notified[0].title).toMatch(/^Listo: pruébalo gratis hasta el/);
    // Hasta cuándo sigue gratis si deja la tarjeta: 30 días desde que lo activó, aunque la deje después.
    const later = new Date(JOIN.getTime() + 3 * DAY);
    expect(await pendingCardCondo(db, NEW, later)).toMatchObject({ code: "las-palmas", freeUntil: plus(JOIN, CONDO_FREE_DAYS), tryUntil: plus(JOIN, CONDO_TRY_DAYS) });

    // Deja la tarjeta (ONVO) en el día 3: su cobro de la prueba queda programado con el 50 %; el condominio lo mueve.
    tables.payment_methods.push({ user_id: NEW, status: "active", provider: "onvo" });
    tables.trial_charges.push({ id: 7, user_id: NEW, status: "scheduled", plan: "entreno", billing: "mes", amount_minor: 499, promo: "primer_mes_50", charge_at: "2026-12-08T06:00:00.000Z", moved_from: null });
    expect((await joinCondo(NEW, "las-palmas", later)).kind).toBe("join");
    expect(grantOf(NEW).expires_at).toBe(plus(JOIN, CONDO_FREE_DAYS));
    expect(tables.trial_charges[0]).toMatchObject({ charge_at: plus(JOIN, CONDO_FREE_DAYS), next_attempt_at: plus(JOIN, CONDO_FREE_DAYS), moved_from: "2026-12-08T06:00:00.000Z", promo: null, amount_minor: 999 });
    expect(await pendingCardCondo(db, NEW, later)).toBeNull();
  });

  it("si cancela, vuelve a su prueba del condominio; su mes no se reinicia al volver a abrir el enlace", async () => {
    await joinCondo(NEW, "las-palmas", JOIN);
    tables.payment_methods.push({ user_id: NEW, status: "active", provider: "onvo" });
    tables.trial_charges.push({ id: 7, user_id: NEW, status: "scheduled", plan: "entreno", billing: "mes", amount_minor: 499, promo: "primer_mes_50", charge_at: "2026-12-08T06:00:00.000Z", moved_from: null });
    await joinCondo(NEW, "las-palmas", JOIN);
    const cancelAt = new Date(JOIN.getTime() + 2 * DAY);
    expect(await cutCardCondoGrant(db, NEW, cancelAt)).toBe(plus(JOIN, CONDO_TRY_DAYS));
    expect(grantOf(NEW).expires_at).toBe(plus(JOIN, CONDO_TRY_DAYS));
    expect(await pendingCardCondo(db, NEW, cancelAt)).toMatchObject({ freeUntil: plus(JOIN, CONDO_FREE_DAYS) });
    // Después de su mes ya no hay nada que extender.
    expect(await pendingCardCondo(db, NEW, new Date(JOIN.getTime() + (CONDO_FREE_DAYS + 1) * DAY))).toBeNull();
  });

  it("Tilopay no cuenta para el condominio (como en Soho Paradisus)", async () => {
    await joinCondo(NEW, "las-palmas", JOIN);
    tables.payment_methods.push({ user_id: NEW, status: "active", provider: "tilopay" });
    tables.trial_charges.push({ id: 7, user_id: NEW, status: "scheduled", plan: "entreno", billing: "mes", amount_minor: 499, promo: "primer_mes_50", charge_at: "2026-12-08T06:00:00.000Z" });
    expect((await joinCondo(NEW, "las-palmas", JOIN)).kind).toBe("ya_vinculado");
    expect(grantOf(NEW).expires_at).toBe(plus(JOIN, CONDO_TRY_DAYS));
  });

  it("el aviso de \"termina tu mes gratis\" solo sale a las cuentas de antes: a las nuevas las avisa su cobro", async () => {
    await joinCondo(OLD, "las-palmas", JOIN);
    await joinCondo(NEW, "las-palmas", JOIN);
    tables.condo_members.forEach((m) => { m.ending_notified_at = null; });
    // A 2 días del fin del mes gratis de la cuenta vieja (la nueva ya terminó su prueba de 7 días).
    for (const g of tables.comp_grants) g.expires_at = plus(JOIN, CONDO_FREE_DAYS);
    const r = await syncCondoMembers(db, tables.condos[0] as unknown as CondoRow, new Date(JOIN.getTime() + (CONDO_FREE_DAYS - 2) * DAY));
    expect(r.notices).toBe(1);
    expect(tables.condo_members.find((m) => m.user_id === OLD)!.ending_notified_at).not.toBeNull();
    expect(tables.condo_members.find((m) => m.user_id === NEW)!.ending_notified_at).toBeNull();
  });
});
