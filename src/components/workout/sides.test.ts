import { describe, expect, it } from "vitest";
import { SWITCH_SECONDS, advanceTimed, pauseTimed, resumeTimed, segCue, segLabel, skipLabel, skipTimed, startTimed, timedSegments, timedView } from "./sides";

describe("tramos de una serie por tiempo", () => {
  it("sin lado: preparación y trabajo", () => {
    expect(timedSegments(30, false, 3)).toEqual([{ kind: "prep", secs: 3 }, { kind: "work", secs: 30 }]);
    expect(timedSegments(30, false)).toEqual([{ kind: "work", secs: 30 }]);
  });
  it("por lado: preparación, lado derecho, cambio de 5 s y lado izquierdo con el mismo tiempo", () => {
    expect(SWITCH_SECONDS).toBe(5);
    expect(timedSegments(35, true, 3)).toEqual([
      { kind: "prep", secs: 3 }, { kind: "work", secs: 35, side: 1 }, { kind: "switch", secs: 5, side: 2 }, { kind: "work", secs: 35, side: 2 },
    ]);
  });
  it("nunca un tramo de 0 s", () => {
    expect(timedSegments(0, true)[0]).toEqual({ kind: "work", secs: 1, side: 1 });
  });
});

describe("avanzar el reloj", () => {
  const segs = timedSegments(30, true, 3); // prep 0-3, derecho 3-33, cambio 33-38, izquierdo 38-68
  const run = startTimed(segs, 0);
  it("dentro de un tramo no cambia nada", () => {
    const r = advanceTimed(run, 2_000);
    expect(r).toEqual({ run, entered: [], finished: false });
  });
  it("pasa al lado derecho, al cambio y al izquierdo, cada uno desde el final exacto del anterior", () => {
    let r = advanceTimed(run, 3_000);
    expect(r.entered).toEqual([1]);
    expect(r.run).toMatchObject({ i: 1, end: 33_000 });
    r = advanceTimed(r.run, 33_500);
    expect(r.entered).toEqual([2]);
    expect(r.run).toMatchObject({ i: 2, end: 38_000 });
    r = advanceTimed(r.run, 38_000);
    expect(r.run).toMatchObject({ i: 3, end: 68_000 });
    expect(r.finished).toBe(false);
    r = advanceTimed(r.run, 68_000);
    expect(r.finished).toBe(true);
  });
  it("con la pestaña oculta se pone al día con todos los tramos que pasaron", () => {
    const r = advanceTimed(run, 40_000);
    expect(r.entered).toEqual([1, 2, 3]);
    expect(r.run).toMatchObject({ i: 3, end: 68_000 });
    expect(advanceTimed(run, 99_000).finished).toBe(true);
  });
});

describe("pausa y saltar", () => {
  const segs = timedSegments(30, true, 3);
  it("en pausa el tiempo no corre y al seguir conserva lo que quedaba", () => {
    let run = advanceTimed(startTimed(segs, 0), 10_000).run; // lado derecho, quedan 23 s
    run = pauseTimed(run, 10_000);
    expect(run.paused).toBe(23_000);
    expect(advanceTimed(run, 500_000)).toEqual({ run, entered: [], finished: false });
    expect(timedView(run, 500_000)).toMatchObject({ left: 23, paused: true });
    expect(pauseTimed(run, 600_000)).toBe(run); // pausar dos veces no cambia nada
    run = resumeTimed(run, 500_000);
    expect(run).toMatchObject({ end: 523_000, paused: null });
    expect(resumeTimed(run, 1)).toBe(run);
  });
  it("saltar termina el tramo actual: del lado derecho pasa al cambio y del izquierdo cierra la serie", () => {
    let run = advanceTimed(startTimed(segs, 0), 5_000).run;
    let r = advanceTimed(skipTimed(run, 5_000), 5_000);
    expect(r.run.segs[r.run.i].kind).toBe("switch");
    expect(r.run.end).toBe(10_000);
    r = advanceTimed(skipTimed(r.run, 6_000), 6_000);
    expect(r.run.segs[r.run.i]).toEqual({ kind: "work", secs: 30, side: 2 });
    run = r.run;
    expect(advanceTimed(skipTimed(run, 7_000), 7_000).finished).toBe(true);
  });
  it("saltar en pausa también avanza (y deja de estar en pausa)", () => {
    const run = pauseTimed(startTimed(segs, 0), 1_000);
    const r = advanceTimed(skipTimed(run, 2_000), 2_000);
    expect(r.run).toMatchObject({ i: 1, paused: null, end: 32_000 });
  });
});

describe("lo que se ve y se dice", () => {
  const segs = timedSegments(30, true, 3);
  it("la barra de cada lado: se llena el derecho y luego el izquierdo", () => {
    const run = startTimed(segs, 0);
    expect(timedView(run, 1_000)).toMatchObject({ perSide: true, sides: [0, 0], frac: 1 });
    const r1 = advanceTimed(run, 18_000).run; // derecho, quedan 15 de 30
    expect(timedView(r1, 18_000)).toMatchObject({ sides: [0.5, 0], frac: 0.5, left: 15 });
    const r2 = advanceTimed(run, 35_000).run; // cambio
    expect(timedView(r2, 35_000)).toMatchObject({ sides: [1, 0], frac: 1, left: 3 });
    const r3 = advanceTimed(run, 53_000).run; // izquierdo, quedan 15
    expect(timedView(r3, 53_000)).toMatchObject({ sides: [1, 0.5], last: true });
  });
  it("sin lado no hay dos barras", () => {
    expect(timedView(startTimed(timedSegments(30, false, 3), 0), 0)).toMatchObject({ perSide: false, sides: null });
  });
  it("etiquetas y avisos", () => {
    expect(segs.map(segLabel)).toEqual(["Prepárate", "Lado derecho", "Cambia de lado", "Lado izquierdo"]);
    expect(segLabel({ kind: "work", secs: 30 })).toBe("Trabaja");
    expect(skipLabel(segs[1], false)).toBe("Terminar este lado");
    expect(skipLabel(segs[2], false)).toBe("Saltar el cambio de lado");
    expect(skipLabel(segs[3], true)).toBe("Terminar la serie");
    expect(segCue(segs[0])).toBeNull();
    expect(segCue(segs[2])).toEqual({ say: "Cambia de lado.", live: "Primer lado listo. Cambia de lado: 5 segundos" });
    expect(segCue(segs[3])?.say).toBe("Lado izquierdo. Ya.");
    expect(segCue({ kind: "work", secs: 30 })).toBeNull();
  });
});
