// joinCondo con una base falsa en memoria: un solo mes gratis por cuenta, cuentas con plan pagado y la cookie del registro.
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

import { joinCondo, joinCondoFromCookie } from "./condos-server";

const NOW = new Date("2026-10-25T12:00:00Z");
beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  tables.condos = [
    { id: 1, code: "las-palmas", name: "Las Palmas", status: "mes_gratis", free_ends_at: null, paid_plan: null, paid_until: null },
    { id: 2, code: "el-bosque", name: "El Bosque", status: "terminado", free_ends_at: null, paid_plan: null, paid_until: null },
    { id: 3, code: "torre-sur", name: "Torre Sur", status: "activo", free_ends_at: null, paid_plan: "entreno", paid_until: "2026-12-31T23:59:59.000Z" },
  ];
  tables.trial_charges = [{ id: 9, user_id: "u1", status: "scheduled" }];
  paid.value = false; jar.value = undefined; notified.length = 0;
});

describe("joinCondo", () => {
  it("vincula la cuenta, da 30 días del plan completo y reemplaza el cobro de su prueba individual", async () => {
    expect((await joinCondo("u1", "las-palmas", NOW)).kind).toBe("join");
    expect(tables.comp_grants).toHaveLength(1);
    expect(tables.comp_grants[0]).toMatchObject({ user_id: "u1", plan: "completo", source: "condominio", expires_at: "2026-11-24T12:00:00.000Z" });
    expect(tables.condo_members[0]).toMatchObject({ condo_id: 1, user_id: "u1", grant_id: 1 });
    expect(tables.trial_charges[0]).toMatchObject({ status: "superseded", next_attempt_at: null });
    expect(notified[0].title).toBe("Tu condominio Las Palmas te regala el primer mes");
  });
  it("un solo mes gratis por cuenta: abrir el enlace otra vez no da otro", async () => {
    await joinCondo("u1", "las-palmas", NOW);
    expect((await joinCondo("u1", "las-palmas", NOW)).kind).toBe("ya_vinculado");
    expect(tables.comp_grants).toHaveLength(1);
  });
  it("condominio activo: el plan que paga hasta la fecha pagada", async () => {
    expect((await joinCondo("u2", "torre-sur", NOW)).kind).toBe("join");
    expect(tables.comp_grants[0]).toMatchObject({ plan: "entreno", expires_at: "2026-12-31T23:59:59.000Z" });
  });
  it("cuenta con plan pagado: no se vincula ni recibe cortesía", async () => {
    paid.value = true;
    expect((await joinCondo("u1", "las-palmas", NOW)).kind).toBe("plan_pagado");
    expect(tables.comp_grants ?? []).toHaveLength(0);
    expect(tables.condo_members ?? []).toHaveLength(0);
    expect(tables.trial_charges[0].status).toBe("scheduled");
  });
  it("condominio terminado o código inexistente: inactivo", async () => {
    expect((await joinCondo("u1", "el-bosque", NOW)).kind).toBe("inactivo");
    expect((await joinCondo("u1", "no-existe", NOW)).kind).toBe("inactivo");
    expect(tables.comp_grants ?? []).toHaveLength(0);
  });
});

describe("al crear la cuenta (attributeNewAccount)", () => {
  it("con la cookie del enlace, la cuenta queda vinculada a su condominio", async () => {
    jar.value = "las-palmas";
    expect(await joinCondoFromCookie("u3")).toBe("join");
    expect(tables.condo_members[0]).toMatchObject({ condo_id: 1, user_id: "u3" });
  });
  it("sin cookie no hace nada", async () => {
    expect(await joinCondoFromCookie("u3")).toBe("sin_cookie");
    expect(tables.condo_members ?? []).toHaveLength(0);
  });
});
