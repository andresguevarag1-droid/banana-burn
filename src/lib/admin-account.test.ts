import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteAccountData } from "./admin-account";

/** Cliente falso que anota el orden de las llamadas. */
function fakeAdmin(opts: { scrubError?: boolean } = {}) {
  const calls: string[] = [];
  const query = { select: () => query, eq: () => query, in: async () => ({ data: [] }) };
  const admin = {
    from: () => query,
    storage: { from: () => ({ list: async () => ({ data: [], error: null }), remove: async () => ({ error: null }) }) },
    rpc: async (fn: string, args: Record<string, unknown>) => { calls.push(`rpc:${fn}:${args.p_user}`); return { error: opts.scrubError ? { code: "XX000" } : null }; },
    auth: { admin: { deleteUser: async (id: string) => { calls.push(`deleteUser:${id}`); return { error: null }; } } },
  };
  return { admin: admin as unknown as SupabaseClient, calls };
}

describe("deleteAccountData (borrado completo)", () => {
  it("quita los datos personales que sobreviven a la cascada ANTES de borrar el usuario", async () => {
    const { admin, calls } = fakeAdmin();
    expect(await deleteAccountData(admin, "u1")).toEqual({ ok: true });
    expect(calls).toEqual(["rpc:scrub_deleted_user:u1", "deleteUser:u1"]);
  });
  it("si la limpieza falla, igual borra la cuenta (no deja a la persona sin poder irse)", async () => {
    const { admin, calls } = fakeAdmin({ scrubError: true });
    expect(await deleteAccountData(admin, "u2")).toEqual({ ok: true });
    expect(calls.at(-1)).toBe("deleteUser:u2");
  });
});
