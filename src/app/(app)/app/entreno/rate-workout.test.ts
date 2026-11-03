import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  viewer: null as Record<string, unknown> | null,
  found: { id: "wk-1" } as { id: string } | null,
  updateError: null as { code: string } | null,
  calls: [] as Array<{ table: string; op: string; values?: unknown; filters: Array<[string, unknown]> }>,
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("@/lib/challenges-server", () => ({ creditChallenges: async () => {}, getCatalog: async () => [] }));
vi.mock("@/lib/entitlements", () => ({ accessError: async () => null }));
vi.mock("@/lib/today", () => ({ todayFor: () => "2026-10-22" }));
vi.mock("@/lib/gamify", () => ({ workoutXp: () => 0 }));
vi.mock("@/lib/history", () => ({ getHistory: async () => [] }));
vi.mock("@/lib/engine", () => ({ EX: {} }));
vi.mock("@/lib/library", () => ({ getLibEx: () => null }));
vi.mock("@/lib/programs", () => ({ parseProgramTemplate: () => null, weeksOf: () => 0 }));
vi.mock("@/lib/log", () => ({ errCode: () => "unknown", logError: () => {} }));
vi.mock("@/lib/security/limits", () => ({ limitError: async () => null }));
vi.mock("@/lib/supabase/server", () => ({
  getViewer: async () => state.viewer,
  createClient: async () => ({
    from(table: string) {
      const q = { table, op: "select", values: undefined as unknown, filters: [] as Array<[string, unknown]> };
      state.calls.push(q);
      const b = {
        select() { return b; },
        update(values: unknown) { q.op = "update"; q.values = values; return b; },
        eq(col: string, val: unknown) { q.filters.push([col, val]); return b; },
        limit() { return b; },
        async maybeSingle() { return { data: state.found, error: null }; },
        then(res: (v: unknown) => unknown, rej: (e: unknown) => unknown) {
          return Promise.resolve({ data: null, error: state.updateError }).then(res, rej);
        },
      };
      return b;
    },
  }),
}));

import { rateWorkout } from "./actions";

const base = { template: "Fuerza A", startedAt: "2026-10-22T12:00:00.000Z" };
const updates = () => state.calls.filter((c) => c.op === "update");

beforeEach(() => {
  state.viewer = { id: "u1", demo: false };
  state.found = { id: "wk-1" };
  state.updateError = null;
  state.calls = [];
});

describe("rateWorkout (#253)", () => {
  it("guarda la diversión en el entreno del usuario, buscado por plantilla y hora de inicio", async () => {
    expect(await rateWorkout({ ...base, fun: 4, last: null })).toBe(true);
    const find = state.calls.find((c) => c.op === "select");
    expect(find?.table).toBe("workouts");
    expect(find?.filters).toEqual(expect.arrayContaining([["user_id", "u1"], ["template", "Fuerza A"], ["started_at", "2026-10-22T12:00:00.000Z"]]));
    const fun = updates().find((c) => c.table === "workouts");
    expect(fun?.values).toEqual({ fun: 4 });
    expect(fun?.filters).toEqual(expect.arrayContaining([["id", "wk-1"], ["user_id", "u1"]]));
  });

  it("anota el RIR de la última serie por ejercicio y número de serie, dentro del entreno del usuario", async () => {
    expect(await rateWorkout({ ...base, fun: null, last: { exercise: "bench", setNo: 3, rir: 2 } })).toBe(true);
    const set = updates().find((c) => c.table === "workout_sets");
    expect(set?.values).toEqual({ rir: 2 });
    expect(set?.filters).toEqual(expect.arrayContaining([
      ["workout_id", "wk-1"], ["user_id", "u1"], ["exercise", "bench"], ["set_no", 3],
    ]));
  });

  it("no escribe nada si el entreno no existe para ese usuario", async () => {
    state.found = null;
    expect(await rateWorkout({ ...base, fun: 5, last: { exercise: "bench", setNo: 1, rir: 1 } })).toBe(false);
    expect(updates()).toHaveLength(0);
  });

  it("devuelve false si la base rechaza la actualización", async () => {
    state.updateError = { code: "42501" };
    expect(await rateWorkout({ ...base, fun: 3, last: null })).toBe(false);
  });

  it("sin sesión no toca la base", async () => {
    state.viewer = null;
    expect(await rateWorkout({ ...base, fun: 3, last: null })).toBe(false);
    expect(state.calls).toHaveLength(0);
  });

  it("en modo demo responde true sin escribir", async () => {
    state.viewer = { id: "u1", demo: true };
    expect(await rateWorkout({ ...base, fun: 3, last: null })).toBe(true);
    expect(state.calls).toHaveLength(0);
  });

  it("rechaza una respuesta sin contenido o con una fecha inválida", async () => {
    expect(await rateWorkout({ ...base, fun: null, last: null })).toBe(false);
    expect(await rateWorkout({ template: "Fuerza A", startedAt: "ayer", fun: 4, last: null })).toBe(false);
    expect(state.calls).toHaveLength(0);
  });
});
