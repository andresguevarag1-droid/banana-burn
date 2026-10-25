import { describe, expect, it } from "vitest";
import { acceptPoint, cleanSegment, currentPace, fmtDuration, fmtPace, haversine, isLongRun, privacyTrim, processUpload, runStats, runsForCoach, splitGaps, thin, weeklyKm, type GeoPoint } from "@/lib/runs";

// Línea recta hacia el norte: 1 grado de latitud ~ 111 195 m. Paso de `m` metros cada `s` segundos.
const line = (n: number, m = 10, s = 3, t0 = 0, lat0 = 9.93): GeoPoint[] => Array.from({ length: n }, (_, i) => ({ t: t0 + i * s * 1000, lat: lat0 + (i * m) / 111_195, lng: -84.08, acc: 8 }));

describe("carreras con GPS", () => {
  it("haversine da la distancia real", () => {
    expect(Math.round(haversine({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) / 100)).toBe(1112);
  });
  it("descarta precisión peor que 30 m y saltos a más de 25 km/h", () => {
    const a = line(1)[0];
    expect(acceptPoint(null, { ...a, acc: 45 })).toBe(false);
    expect(acceptPoint(a, { ...a, t: a.t + 1000, lat: a.lat + 50 / 111_195 })).toBe(false);
    expect(acceptPoint(a, { ...a, t: a.t + 3000, lat: a.lat + 10 / 111_195 })).toBe(true);
    const seg = line(20);
    seg[10] = { ...seg[10], lat: seg[10].lat + 0.01 };
    expect(cleanSegment(seg)).toHaveLength(19);
  });
  it("las pausas largas cortan el tramo y no suman distancia", () => {
    const a = line(11), b = line(11, 10, 3, 200_000, 9.94);
    const segs = splitGaps([...a, ...b]);
    expect(segs).toHaveLength(2);
    expect(runStats(segs).distanceM).toBe(200);
  });
  it("parciales de 1 km, ritmo promedio y ritmo actual", () => {
    const seg = line(251, 10, 3); // 2.5 km a 3.33 m/s (5:00/km)
    const s = runStats([seg]);
    expect(s.distanceM).toBe(2500);
    expect(s.splits.map((x) => x.seconds)).toEqual([300, 300, 150]);
    expect(s.splits[2].km).toBe(2.5);
    expect(s.paceSKm).toBe(300);
    expect(currentPace(seg)).toBe(300);
  });
  it("recorta 200 m al inicio y al final para no mostrar dónde vives", () => {
    const t = privacyTrim([line(101)]); // 1 km
    const d = t.flat();
    expect(haversine(line(1)[0], d[0])).toBeGreaterThanOrEqual(199);
    expect(runStats(t).distanceM).toBeGreaterThanOrEqual(570);
    expect(runStats(t).distanceM).toBeLessThanOrEqual(600);
    expect(privacyTrim([line(30)])).toEqual([]);
  });
  it("el servidor recalcula y rechaza lo que no es plausible", () => {
    const ok = processUpload([line(251)]);
    expect(ok?.stats.distanceM).toBe(2500);
    expect(processUpload([line(5)])).toBeNull();
    expect(processUpload("x")).toBeNull();
    expect(processUpload([line(300, 5, 1)])?.stats.distanceM).toBeGreaterThan(1400);
    expect(processUpload([line(300, 60, 1)])).toBeNull();
    expect(thin([line(1000, 1, 1)])[0].length).toBeLessThan(250);
  });
  it("formatos, km por semana, carrera larga y la línea de la coach", () => {
    expect(fmtPace(305)).toBe("5:05");
    expect(fmtPace(null)).toBe("--:--");
    expect(fmtDuration(3725)).toBe("1:02:05");
    const w = weeklyKm([{ day: "2026-11-09", distanceM: 5000 }, { day: "2026-11-15", distanceM: 2500 }, { day: "2026-11-16", distanceM: 10000 }], "2026-11-18", 2);
    expect(w).toEqual([{ weekStart: "2026-11-09", km: 7.5 }, { weekStart: "2026-11-16", km: 10 }]);
    expect(isLongRun({ distanceM: 12_500, movingS: 3000 })).toBe(true);
    expect(isLongRun({ distanceM: 6000, movingS: 1900 })).toBe(false);
    expect(runsForCoach([{ day: "2026-11-10", distanceM: 5230, movingS: 1600, paceSKm: 306 }])).toMatch(/5.23 km/);
    expect(runsForCoach([])).toBeNull();
  });
});

import { longRunShift } from "@/lib/runs";
describe("carrera larga fuera de plan en la temporada", () => {
  const days = [{ dow: 0, session: null }, { dow: 1, session: "fuerza" }, { dow: 2, session: null }, { dow: 3, session: "potencia" }, { dow: 4, session: null }, { dow: 5, session: null }, { dow: 6, session: null }];
  it("mueve la sesión pesada de hoy o mañana un día", () => {
    // 2026-11-09 es lunes; corrió 14 km el lunes (su carrera larga era el domingo) y el martes toca fuerza.
    expect(longRunShift(days, [{ day: "2026-11-09", distanceM: 14000, movingS: 4800 }], "2026-11-09", 6)).toMatchObject({ moved: "fuerza", to: 2 });
  });
  it("no cambia nada si era su día de carrera larga, si fue corta o si no viene sesión pesada", () => {
    expect(longRunShift(days, [{ day: "2026-11-15", distanceM: 14000, movingS: 4800 }], "2026-11-15", 6)).toBeNull();
    expect(longRunShift(days, [{ day: "2026-11-09", distanceM: 5000, movingS: 1500 }], "2026-11-09", 6)).toBeNull();
    expect(longRunShift(days, [{ day: "2026-11-12", distanceM: 14000, movingS: 4800 }], "2026-11-13", 6)).toBeNull();
  });
});
