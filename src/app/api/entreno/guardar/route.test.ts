// Guardado del primer entreno a medias con sendBeacon (#246): la misma acción de guardar y el evento del embudo una sola vez.
import { beforeEach, describe, expect, it, vi } from "vitest";

const save = vi.hoisted(() => vi.fn());
const inserts = vi.hoisted(() => [] as unknown[]);
vi.mock("next/server", () => ({ after: (fn: () => unknown) => { void fn(); } }));
vi.mock("@/app/(app)/app/entreno/actions", () => ({ saveWorkout: save }));
vi.mock("@/lib/supabase/server", () => ({ getViewer: async () => ({ id: "u1", demo: false }) }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({ from: () => ({ insert: async (row: unknown) => { inserts.push(row); return { error: null }; } }) }) }));

const workout = { template: "primero", startedAt: "2026-11-03T10:00:00.000Z", fun: null, exercises: [{ id: "squat", sets: [{ kg: null, reps: 10, rir: null }, { kg: null, reps: 8, rir: null }] }] };
const beacon = (body: string, url = "/api/entreno/guardar?parcial=1", headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, { method: "POST", body, headers: { host: "localhost", origin: "http://localhost", ...headers } });

beforeEach(() => { save.mockReset(); inserts.length = 0; });

describe("/api/entreno/guardar", () => {
  it("guarda con la acción de siempre y registra workout_saved con partial: true", async () => {
    save.mockResolvedValue({ ok: true, xp: 20, prNames: [] });
    const { POST } = await import("./route");
    const r = await POST(beacon(JSON.stringify(workout)));
    expect(r.status).toBe(200);
    expect(save).toHaveBeenCalledWith(workout);
    expect(inserts).toEqual([expect.objectContaining({ user_id: "u1", name: "workout_saved", props: expect.objectContaining({ partial: true, done: 2 }) })]);
  });
  it("un segundo envío del mismo entreno (ya guardado) no vuelve a contar el evento", async () => {
    save.mockResolvedValue({ ok: true, already: true, xp: 20, prNames: [] });
    const { POST } = await import("./route");
    expect((await POST(beacon(JSON.stringify(workout)))).status).toBe(200);
    expect(inserts).toEqual([]);
  });
  it("sin ?parcial=1 o si falla no registra el evento", async () => {
    const { POST } = await import("./route");
    save.mockResolvedValue({ ok: true, xp: 20 });
    await POST(beacon(JSON.stringify(workout), "/api/entreno/guardar"));
    save.mockResolvedValue({ ok: false, error: "x" });
    expect((await POST(beacon(JSON.stringify(workout)))).status).toBe(400);
    expect(inserts).toEqual([]);
  });
  it("rechaza otro origen, cuerpo vacío y JSON roto sin tocar la base", async () => {
    const { POST } = await import("./route");
    expect((await POST(beacon(JSON.stringify(workout), undefined, { origin: "https://otro.com" }))).status).toBe(403);
    expect((await POST(beacon(""))).status).toBe(400);
    expect((await POST(beacon("{roto"))).status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });
});
