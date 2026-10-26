import { beforeEach, describe, expect, it, vi } from "vitest";

// Cada acción del superadmin (0056) pasa por authorize("users.manage") en el servidor. Si el rol no alcanza, responde
// el error y no toca la base, Auth, cobros ni correos.
const auth = vi.hoisted(() => ({ result: { ok: false, error: "Tu rol no tiene permiso para esta acción." } as { ok: boolean; error?: string; v?: unknown }, caps: [] as string[] }));
const touched = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/lib/admin-auth", () => ({ authorize: async (cap: string) => { auth.caps.push(cap); return auth.result; } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => { touched.n++; return { rpc: async () => { touched.n++; return { data: null, error: null }; } }; } }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => { touched.n++; return null; } }));
vi.mock("@/lib/billing", () => ({ cancelAtPeriodEndFor: async () => { touched.n++; return { endsAt: null }; } }));
vi.mock("@/lib/trial-billing", () => ({ cancelTrial: async () => { touched.n++; return { accessUntil: null, cardKept: true }; } }));
vi.mock("@/lib/email/send", () => ({ sendEmail: async () => { touched.n++; return { ok: true }; } }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => { touched.n++; return {}; } }));

import * as actions from "./cuentas-actions";

const T = "b2b2b2b2-0000-4000-8000-0000000000b2";
const form = (o: Record<string, string>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.set(k, v); return fd; };
const full = form({ target: T, reason: "prueba de permisos", confirm: "on", full_name: "Ana", country: "CR", email: "nuevo@correo.com", mode: "ahora", kind: "clave", block: "si", plan: "completo", duration: "30", slug: "abdomen-21", badge: "w50", delta: "100", total: "0" });

beforeEach(() => { touched.n = 0; auth.caps = []; auth.result = { ok: false, error: "Tu rol no tiene permiso para esta acción." }; });

describe("acciones de cuentas del superadmin", () => {
  const all = Object.entries(actions).filter(([, f]) => typeof f === "function") as [string, (s: null, fd: FormData) => Promise<{ ok: boolean; message: string } | null>][];

  it("exporta las acciones esperadas", () => {
    expect(all.map(([n]) => n).sort()).toEqual(["adjustXp", "cancelRenewal", "cancelScheduledCharge", "changeEmail", "grantAccess", "grantPlan", "resetIntake", "resetProgress", "revokeAccess", "sendAccessEmail", "setBadge", "setBlocked", "signOutEverywhere", "updateProfile"]);
  });

  it.each(all)("%s: sin rol de superadmin responde el error y no toca nada", async (_, fn) => {
    const r = await fn(null, full);
    expect(r?.ok).toBe(false);
    expect(r?.message).toMatch(/permiso/);
    expect(auth.caps).toEqual(["users.manage"]);
    expect(touched.n).toBe(0);
  });

  it("con la sesión vencida tampoco hace nada", async () => {
    auth.result = { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
    for (const [, fn] of all) expect((await fn(null, full))?.message).toMatch(/sesión expiró/);
    expect(touched.n).toBe(0);
  });

  it("el superadmin no se bloquea, no cierra sus sesiones ni se cambia el correo desde el panel", async () => {
    auth.result = { ok: true, v: { id: T, demo: false, role: "superadmin" } };
    expect((await actions.setBlocked(null, form({ target: T, block: "si", reason: "prueba de reglas", confirm: "on" })))?.message).toMatch(/propia cuenta/);
    expect((await actions.signOutEverywhere(null, form({ target: T, reason: "prueba de reglas", confirm: "on" })))?.message).toMatch(/Salir/);
    expect((await actions.changeEmail(null, form({ target: T, mode: "ahora", email: "x@y.com", reason: "prueba de reglas", confirm: "on" })))?.message).toMatch(/tu perfil/);
  });

  it("sin motivo o sin confirmar no aplica nada (modo demo)", async () => {
    auth.result = { ok: true, v: { id: "otro", demo: true, role: "superadmin" } };
    expect((await actions.adjustXp(null, form({ target: T, delta: "100", total: "0", confirm: "on" })))?.message).toMatch(/Motivo/);
    expect((await actions.adjustXp(null, form({ target: T, delta: "100", total: "0", reason: "prueba de reglas" })))?.message).toMatch(/Confirma/);
    expect((await actions.adjustXp(null, form({ target: T, delta: "-50", total: "10", reason: "prueba de reglas", confirm: "on" })))?.message).toMatch(/bajo 0/);
    expect((await actions.setBadge(null, form({ target: T, badge: "nivel", mode: "quitada", reason: "prueba de reglas", confirm: "on" })))?.message).toMatch(/no se puede/);
    expect((await actions.grantPlan(null, form({ target: T, plan: "completo", duration: "siempre", reason: "prueba de reglas", confirm: "on" })))?.ok).toBe(true);
  });
});
