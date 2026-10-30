// Pruebas de QA del running (#54): parciales, recorte de privacidad de 200 m, puntos de GPS perdidos y la relación entre
// las carreras con GPS y el plan. Complementan runs.test.ts y run-plan.test.ts con casos límite. Las que llevan
// `it.fails` son fallos conocidos de la app: están descritos en el PR y no se arreglan aquí.
import { describe, expect, it } from "vitest";
import { GAP_MS, PRIVACY_TRIM_M, cleanSegment, haversine, isLongRun, longRunShift, privacyTrim, processUpload, runStats, segDistance, splitGaps, type GeoPoint } from "@/lib/runs";
import { trainingPaces } from "@/lib/run-fitness";
import { addDays, buildPlan, matchRuns, type DoneRun, type PlannedRun } from "@/lib/run-plan";

// Línea recta hacia el norte: 1 grado de latitud ~ 111 195 m. Paso de `m` metros cada `s` segundos.
const M_PER_DEG = 111_195;
const line = (n: number, m = 10, s = 3, t0 = 0, lat0 = 9.93): GeoPoint[] => Array.from({ length: n }, (_, i) => ({ t: t0 + i * s * 1000, lat: lat0 + (i * m) / M_PER_DEG, lng: -84.08, acc: 8 }));
/** Tramo que sigue a `seg` después de `gapS` segundos, habiendo avanzado `gapM` metros sin señal. */
const after = (seg: GeoPoint[], n: number, gapS: number, gapM: number, m = 10, s = 3) => {
  const last = seg[seg.length - 1];
  return line(n, m, s, last.t + gapS * 1000, last.lat + gapM / M_PER_DEG);
};
/** Distancia a lo largo del recorrido desde el primer punto hasta `p` (en una línea recta, la distancia directa). */
const fromStart = (start: GeoPoint, p: GeoPoint) => haversine(start, p);

describe("parciales de 1 km", () => {
  it("1 km justo da un solo parcial, sin fracción extra", () => {
    const s = runStats([line(101)]); // 1000 m en 300 s
    expect(s.splits).toEqual([{ km: 1, seconds: 300 }]);
  });
  it("lo que sobra después del último km entra solo si es de 100 m o más", () => {
    expect(runStats([line(110)]).splits).toEqual([{ km: 1, seconds: 300 }]); // 1090 m: sobran 90 m
    const s = runStats([line(112)]); // 1110 m
    expect(s.splits).toHaveLength(2);
    expect(s.splits[1]).toEqual({ km: 1.11, seconds: 33 });
  });
  it("cada parcial tiene su propio ritmo cuando cambia la velocidad", () => {
    const a = line(101, 10, 3); // km 1 a 5:00/km
    const b = line(101, 10, 3.6, a[100].t, a[100].lat).slice(1); // km 2 a 6:00/km, sigue desde el último punto
    const s = runStats([[...a, ...b]]);
    expect(s.splits.map((x) => x.seconds)).toEqual([300, 360]);
    expect(s.paceSKm).toBe(330);
  });
  it("un salto largo entre dos puntos reparte el tiempo entre los km que cruza", () => {
    const seg: GeoPoint[] = [line(1)[0], { ...line(1)[0], t: 600_000, lat: 9.93 + 2000 / M_PER_DEG }]; // 2 km en 10 min
    expect(runStats([seg]).splits).toEqual([{ km: 1, seconds: 300 }, { km: 2, seconds: 300 }]);
  });
  it("las pausas entre tramos no cuentan en el parcial ni en el tiempo en movimiento", () => {
    const a = line(51); // 500 m en 150 s
    const b = after(a, 51, 600, 0); // 10 min parado, luego otros 500 m
    const s = runStats([a, b]);
    expect(s.distanceM).toBe(1000);
    expect(s.movingS).toBe(300);
    expect(s.splits).toEqual([{ km: 1, seconds: 300 }]);
  });
  it("los parciales suman el tiempo en movimiento", () => {
    const s = runStats([line(523, 10, 3.1)]); // 5.22 km
    expect(s.splits.reduce((a, x) => a + x.seconds, 0)).toBeCloseTo(s.movingS, -1);
    expect(s.splits.filter((x) => Number.isInteger(x.km))).toHaveLength(5);
  });
  it("sin distancia no hay ritmo promedio ni parciales", () => {
    expect(runStats([])).toEqual({ distanceM: 0, movingS: 0, paceSKm: null, splits: [] });
    expect(runStats([line(4)]).paceSKm).toBeNull(); // 30 m
  });
});

describe("recorte de privacidad de 200 m", () => {
  it("usa 200 m por defecto", () => {
    expect(PRIVACY_TRIM_M).toBe(200);
  });
  it("el mapa guardado empieza 200 m después de la salida y termina 200 m antes de la llegada", () => {
    const seg = line(301); // 3 km
    const kept = privacyTrim([seg]).flat();
    const start = seg[0], end = seg[seg.length - 1];
    expect(fromStart(start, kept[0])).toBeGreaterThanOrEqual(200);
    expect(fromStart(start, kept[0])).toBeLessThan(215);
    expect(haversine(end, kept[kept.length - 1])).toBeGreaterThanOrEqual(200);
    expect(haversine(end, kept[kept.length - 1])).toBeLessThan(215);
    // Ningún punto guardado queda a menos de 200 m de la salida o de la llegada.
    expect(kept.every((p) => haversine(start, p) >= 199.5 && haversine(end, p) >= 199.5)).toBe(true);
  });
  it("una carrera de 400 m o menos no guarda mapa", () => {
    expect(privacyTrim([line(41)])).toEqual([]); // 400 m
    expect(privacyTrim([line(2)])).toEqual([]);
    expect(privacyTrim([])).toEqual([]);
  });
  it("una ida y vuelta a la casa tampoco muestra la casa", () => {
    const ida = line(101); // 1 km al norte
    const vuelta = ida.slice(0, -1).reverse().map((p, i) => ({ ...p, t: ida[100].t + (i + 1) * 3000 }));
    const home = ida[0];
    const kept = privacyTrim([[...ida, ...vuelta]]).flat();
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.every((p) => haversine(home, p) >= 199.5)).toBe(true);
  });
  it("respeta los tramos: no une tramos y quita el primero si cae entero en los 200 m", () => {
    const a = line(16); // 150 m
    const b = after(a, 101, 120, 0); // pausa de 2 min y 1 km
    const out = privacyTrim([a, b]);
    expect(out).toHaveLength(1);
    expect(fromStart(a[0], out[0][0])).toBeGreaterThanOrEqual(200);
    const c = after(b, 101, 120, 0);
    expect(privacyTrim([a, b, c])).toHaveLength(2);
  });
  it("lo que guarda el servidor (subida, recorte) nunca incluye los primeros ni los últimos puntos", () => {
    const up = processUpload([line(401, 10, 3)])!; // 4 km
    const kept = privacyTrim(up.track).flat();
    const first = up.track[0][0], last = up.track.at(-1)!.at(-1)!;
    expect(kept.some((p) => p.t === first.t || p.t === last.t)).toBe(false);
    expect(haversine(first, kept[0])).toBeGreaterThanOrEqual(199.5);
  });
});

describe("puntos de GPS perdidos", () => {
  it("un hueco de 30 s justos no corta el tramo; uno más largo sí", () => {
    const a = line(5);
    expect(splitGaps([...a, ...line(5, 10, 3, a[4].t + GAP_MS, a[4].lat + 50 / M_PER_DEG)])).toHaveLength(1);
    expect(splitGaps([...a, ...line(5, 10, 3, a[4].t + GAP_MS + 1, a[4].lat + 50 / M_PER_DEG)])).toHaveLength(2);
  });
  it("descarta puntos imprecisos, sin coordenadas, repetidos en el tiempo o imposibles", () => {
    const seg = line(30);
    seg[5] = { ...seg[5], acc: 31 };
    seg[8] = { ...seg[8], lat: Number.NaN };
    seg[12] = { ...seg[12], t: seg[11].t };
    seg[20] = { ...seg[20], lng: seg[20].lng + 0.005 }; // ~550 m de lado en 3 s
    const out = cleanSegment(seg);
    expect(out).toHaveLength(26);
    expect(out.every((p) => p.acc <= 30 && Number.isFinite(p.lat))).toBe(true);
  });
  it("ordena los puntos que llegan desordenados", () => {
    const seg = line(20);
    const shuffled = [...seg.slice(10), ...seg.slice(0, 10)];
    expect(cleanSegment(shuffled).map((p) => p.t)).toEqual(seg.map((p) => p.t));
  });
  it("sin señal un rato: la distancia y el tiempo del hueco no se suman", () => {
    // El navegador ya corta el tramo al perder la señal más de 30 s; el servidor recibe dos tramos.
    const a = line(51), b = after(a, 51, 90, 250);
    const up = processUpload([a, b])!;
    expect(up.track).toHaveLength(2);
    expect(up.stats.distanceM).toBe(1000);
    expect(up.stats.movingS).toBe(300);
  });
  it("una subida sin ningún punto útil se rechaza", () => {
    expect(processUpload([line(50).map((p) => ({ ...p, acc: 80 }))])).toBeNull();
    expect(processUpload([[]])).toBeNull();
    expect(processUpload([])).toBeNull();
  });
  it("puntos sueltos con mala señal dentro de la carrera no cambian la distancia", () => {
    const seg = line(251);
    for (const i of [30, 90, 150, 210]) seg[i] = { ...seg[i], lat: seg[i].lat + 0.02, acc: 12 }; // saltos de 2 km
    expect(processUpload([seg])!.stats.distanceM).toBeGreaterThanOrEqual(2490);
    expect(processUpload([seg])!.stats.distanceM).toBeLessThanOrEqual(2510);
  });
  // FALLO CONOCIDO 1: cleanSegment suaviza (media de 3 puntos) antes de que splitGaps corte el tramo, así que el último
  // punto antes del hueco y el primero después se promedian con puntos del otro lado del hueco y se mueven. Si llega un
  // solo tramo con un hueco adentro, la distancia crece (aquí, 327 m en vez de 200 m). Hoy el navegador corta el
  // tramo antes de subirlo, así que solo pasa con tramos que lleguen sin cortar.
  it.fails("un hueco dentro de un mismo tramo no mueve los puntos de los bordes", () => {
    const a = line(11), b = after(a, 11, 60, 200); // 100 m, 60 s sin señal avanzando 200 m, 100 m
    const up = processUpload([[...a, ...b]])!;
    expect(up.track).toHaveLength(2);
    expect(up.stats.distanceM).toBe(200);
  });
  // FALLO CONOCIDO 2: cleanSegment compara cada punto con el último aceptado. Si el primer punto del tramo viene desviado
  // (por ejemplo, 300 m al arrancar el GPS, con precisión de 25 m que sí pasa el filtro), los puntos buenos que siguen
  // parecen un salto a más de 25 km/h y se descartan hasta que pasa suficiente tiempo. En este caso se pierden los
  // primeros 51 s (16 puntos buenos) y la distancia suma el salto falso: unos 1,166 m en vez de 1,000 m. El tracker en
  // vivo (run-tracker.tsx) usa el mismo acceptPoint, así que pasa igual en pantalla.
  it.fails("un primer punto desviado no borra el resto del arranque", () => {
    const seg = line(101);
    seg[0] = { ...seg[0], lng: seg[0].lng + 300 / M_PER_DEG, acc: 25 };
    const out = cleanSegment(seg);
    expect(out.length).toBeGreaterThanOrEqual(99);
    expect(segDistance(out)).toBeGreaterThan(950);
    expect(segDistance(out)).toBeLessThan(1050);
  });
});

describe("relación entre la carrera con GPS y el plan", () => {
  const P = (id: string, date: string, distM: number, kind: PlannedRun["kind"] = "facil"): PlannedRun => ({ id, date, dow: 0, kind, title: id, detail: "", distM, steps: [], strides: false, key: false });
  const D = (id: string, day: string, distanceM: number, movingS = 1800): DoneRun => ({ id, day, distanceM, movingS });
  const today = "2026-11-12";

  it("cuenta como hecha con 60 % de la distancia planeada o más, y no con menos", () => {
    expect(matchRuns([P("a", today, 10_000)], [D("x", today, 6000)], today)[0]).toMatchObject({ status: "hecha", doneId: "x" });
    expect(matchRuns([P("a", today, 10_000)], [D("x", today, 5999)], today)[0].status).toBe("hoy");
  });
  it("sin corrida, la sesión queda perdida, de hoy o pendiente según la fecha", () => {
    const m = matchRuns([P("a", addDays(today, -1), 5000), P("b", today, 5000), P("c", addDays(today, 1), 5000)], [], today);
    expect(m.map((x) => x.status)).toEqual(["perdida", "hoy", "pendiente"]);
  });
  it("acepta la corrida un día antes o después solo si ese día no tenía otra sesión", () => {
    const tue = "2026-11-10", wed = "2026-11-11", thu = "2026-11-12";
    // Corre el miércoles (sin sesión) entre dos sesiones: primero se busca un día antes de cada sesión, así que cuenta
    // para la del jueves (la adelantó) y la del martes queda perdida.
    expect(matchRuns([P("mar", tue, 5000), P("jue", thu, 5000)], [D("x", wed, 5000)], "2026-11-13").map((x) => x.status)).toEqual(["perdida", "hecha"]);
    // Si solo está la del martes, la corrida del miércoles cuenta para esa (un día después).
    expect(matchRuns([P("mar", tue, 5000)], [D("x", wed, 5000)], "2026-11-13")[0].status).toBe("hecha");
    // Corre el jueves, que tiene su propia sesión: no se usa para la del miércoles.
    const m = matchRuns([P("mie", wed, 5000), P("jue", thu, 5000)], [D("x", thu, 5000)], "2026-11-13");
    expect(m.map((x) => x.status)).toEqual(["perdida", "hecha"]);
  });
  it("con dos corridas el mismo día, elige la más parecida a lo planeado y cada una cuenta una vez", () => {
    const m = matchRuns([P("larga", today, 16_000, "larga")], [D("x", today, 10_000), D("y", today, 15_500)], today);
    expect(m[0].doneId).toBe("y");
    const two = matchRuns([P("a", today, 5000), P("b", today, 5000)], [D("x", today, 5000)], today);
    expect(two.filter((r) => r.status === "hecha")).toHaveLength(1);
  });
  it("una carrera subida con GPS marca hecha la sesión del plan de ese día", () => {
    const p = buildPlan({ start: "2026-11-02", raceDate: "2027-02-28", kind: "21k", distM: 21097, level: "recreativo", runDays: [1, 3, 5, 6], longRunDay: 6, kmWeek: 25, paces: trainingPaces(42) });
    const s = p.weeks[1].runs.find((r) => r.kind === "facil")!;
    const n = Math.ceil(s.distM / 10) + 1;
    const up = processUpload([line(n, 10, 3, Date.parse(s.date + "T12:00:00Z"))])!;
    expect(up.stats.distanceM).toBeGreaterThanOrEqual(s.distM);
    const m = matchRuns(p.weeks[1].runs, [{ id: "gps", day: s.date, distanceM: up.stats.distanceM, movingS: up.stats.movingS }], addDays(p.weeks[1].start, 7));
    expect(m.find((r) => r.id === s.id)).toMatchObject({ status: "hecha", doneId: "gps" });
  });
  it("una carrera larga es de 60 min o de 12 km, contados desde el borde", () => {
    expect(isLongRun({ distanceM: 11_999, movingS: 3599 })).toBe(false);
    expect(isLongRun({ distanceM: 12_000, movingS: 1 })).toBe(true);
    expect(isLongRun({ distanceM: 1, movingS: 3600 })).toBe(true);
  });
  it("una larga fuera de plan de anteayer ya no mueve la sesión pesada", () => {
    const days = [{ dow: 0, session: null }, { dow: 1, session: "fuerza" }, { dow: 2, session: null }, { dow: 3, session: null }, { dow: 4, session: null }, { dow: 5, session: null }, { dow: 6, session: null }];
    // 2026-11-10 es martes (fuerza). Larga el domingo 8 (día 6, su día de larga): nada. Larga el lunes 9: mueve fuerza al miércoles.
    expect(longRunShift(days, [D("x", "2026-11-08", 14_000, 4800)], "2026-11-10", 5)).toBeNull();
    expect(longRunShift(days, [D("x", "2026-11-09", 14_000, 4800)], "2026-11-10", 6)).toMatchObject({ moved: "fuerza", to: 2 });
  });
});
