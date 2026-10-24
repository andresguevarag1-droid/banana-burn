import { describe, expect, it } from "vitest";
import { beatState, byRoute, totals } from "./summary";

describe("resumen de errores", () => {
  const rows = [
    { source: "client", route: "/app", hits: 2 }, { source: "server", route: "pagos", hits: 5 }, { source: "boundary", route: "/app", hits: 1 },
  ];
  it("agrupa por ruta de mayor a menor", () => {
    expect(byRoute(rows)).toEqual([{ route: "pagos", hits: 5 }, { route: "/app", hits: 3 }]);
  });
  it("totales por fuente", () => {
    expect(totals(rows)).toEqual({ total: 8, client: 2, boundary: 1, server: 5 });
  });
  it("estado de una tarea", () => {
    const now = Date.parse("2026-10-23T12:00:00Z");
    expect(beatState(null, now)).toBe("nunca");
    expect(beatState({ ok: true, last_at: "2026-10-23T07:00:00Z" }, now)).toBe("ok");
    expect(beatState({ ok: false, last_at: "2026-10-23T07:00:00Z" }, now)).toBe("fallo");
    expect(beatState({ ok: true, last_at: "2026-10-21T07:00:00Z" }, now)).toBe("atrasada");
  });
});
