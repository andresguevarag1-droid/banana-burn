import { describe, expect, it, vi } from "vitest";
import { purgeHousekeeping } from "./housekeeping";

vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => null }));
type Db = NonNullable<NonNullable<Parameters<typeof purgeHousekeeping>[0]>["db"]>;
const db = (data: unknown, error: { code?: string } | null = null) => ({ rpc: vi.fn(async () => ({ data, error })) }) as unknown as Db & { rpc: ReturnType<typeof vi.fn> };

describe("limpieza diaria (0040)", () => {
  it("llama a purge_housekeeping por lotes y devuelve los conteos", async () => {
    const d = db({ rate_limits: 12, notifications: 0 });
    expect(await purgeHousekeeping({ db: d })).toEqual({ rate_limits: 12, notifications: 0 });
    expect(d.rpc).toHaveBeenCalledWith("purge_housekeeping", { p_limit: 20_000 });
  });
  it("sin service_role, sin 0040 o con error: null y nunca lanza", async () => {
    expect(await purgeHousekeeping({ db: null })).toBeNull();
    expect(await purgeHousekeeping({ db: db(null, { code: "PGRST202" }) })).toBeNull();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await purgeHousekeeping({ db: db(null, { code: "57014" }) })).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
