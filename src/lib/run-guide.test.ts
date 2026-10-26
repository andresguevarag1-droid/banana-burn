import { describe, expect, it } from "vitest";
import { trainingPaces } from "@/lib/run-fitness";
import { GUIDE_START, advance, kmCue, paceBand, paceCheck, paceCue, raceGuide, raceWeek, raceWarmup, remaining, stepCue, toGuide } from "@/lib/run-guide";
import type { Step } from "@/lib/run-plan";

const p = trainingPaces(45);
const steps: Step[] = [
  { kind: "calentar", timeS: 600, zone: "facil", label: "Calentamiento" },
  { kind: "trabajo", distM: 400, zone: "intervalo", label: "400 m 1 de 2" },
  { kind: "recuperar", timeS: 90, zone: "trote", label: "Recupera" },
  { kind: "trabajo", distM: 400, zone: "intervalo", label: "400 m 2 de 2" },
  { kind: "enfriar", timeS: 300, zone: "facil", label: "Enfriamiento" },
];
const g = toGuide("Series", steps, p);

describe("sesión guiada", () => {
  it("pone ritmo a cada tramo menos al trote", () => {
    expect(g.steps[1].paceS).toBe(p.intervalo);
    expect(g.steps[2].paceS).toBeNull();
  });
  it("avanza por tiempo y por distancia, sin perder lo que sobra", () => {
    let st = GUIDE_START;
    st = advance(g.steps, st, 1500, 599).state; expect(st.idx).toBe(0);
    st = advance(g.steps, st, 1600, 600).state; expect(st).toMatchObject({ idx: 1, startTime: 600 });
    expect(remaining(g.steps[1], st, 1800, 650).m).toBe(200);
    st = advance(g.steps, st, 2000, 690).state; expect(st).toMatchObject({ idx: 2, startDist: 2000 });
    expect(remaining(g.steps[2], st, 2010, 720).s).toBe(60);
    // Un corte de señal largo salta varios tramos de una vez.
    const jump = advance(g.steps, st, 2600, 900);
    expect(jump.changed).toBe(true);
    // Tras un tramo por tiempo, el siguiente por distancia cuenta desde donde estás.
    expect(jump.state).toMatchObject({ idx: 3, startDist: 2600 });
    const s4 = advance(g.steps, jump.state, 3200, 1300).state;
    expect(s4.idx).toBe(4);
    expect(advance(g.steps, s4, 3300, 1600).state.done).toBe(true);
  });
  it("ritmo con 5 s de margen", () => {
    expect(paceCheck(300, 300)).toBe("en_ritmo");
    expect(paceCheck(304, 300)).toBe("en_ritmo");
    expect(paceCheck(290, 300)).toBe("rapido");
    expect(paceCheck(310, 300)).toBe("lento");
    expect(paceCheck(null, 300)).toBeNull();
    expect(paceCue("rapido")).toMatch(/suave/);
    expect(paceCue("en_ritmo")).toBeNull();
  });
  it("frases en voz alta en español, sin símbolos raros", () => {
    expect(stepCue(g.steps[1])).toMatch(/^Ahora 400 metros a ritmo de series, \d \d{2} por kilómetro\.$/);
    expect(stepCue(g.steps[2])).toBe("Recupera trotando suave, 90 segundos.");
    expect(stepCue(g.steps[0])).toBe("Calentamiento: 10 minutos a ritmo fácil.");
    expect(stepCue(undefined)).toMatch(/Terminaste/);
    expect(kmCue(3, 342, 1030)).toBe("Kilómetro 3, ritmo 5 42.");
  });
});

describe("pace band y modo carrera", () => {
  it("pareja: todos iguales y cierra en la meta", () => {
    const b = paceBand(10000, 3000);
    expect(b).toHaveLength(10);
    expect(new Set(b.map((r) => r.splitS)).size).toBe(1);
    expect(b.at(-1)!.cumS).toBe(3000);
  });
  it("negativa: primera mitad más lenta, misma meta", () => {
    const b = paceBand(21097, 7200, "negativa", "6:30");
    expect(b).toHaveLength(22);
    expect(b[0].splitS).toBeGreaterThan(b[15].splitS);
    expect(b.at(-1)!.cumS).toBe(7200);
    expect(b.at(-1)!.km).toBe(21.1);
    expect(b.at(-1)!.clock).toBe("8:30");
    expect(b[0].clock).toMatch(/^6:3\d$/);
  });
  it("la carrera guiada compara cada km con la tabla", () => {
    const b = paceBand(5000, 1500);
    const r = raceGuide("Mi 5K", b, 1500);
    expect(r.steps).toHaveLength(5);
    expect(r.steps[0].distM).toBe(1000);
    expect(kmCue(2, 290, 590, b)).toMatch(/10 segundos adelante/);
    expect(kmCue(2, 310, 612, b)).toMatch(/12 segundos atrás/);
    expect(kmCue(2, 300, 602, b)).toMatch(/Justo en tu plan/);
  });
  it("semana de carrera y calentamiento", () => {
    const w = raceWeek("2026-12-13", 21097);
    expect(w[0].date).toBe("2026-12-07");
    expect(w.find((d) => d.offset === 0)!.date).toBe("2026-12-13");
    expect(w.flatMap((d) => d.items).join(" ")).not.toMatch(/[—·]/);
    expect(raceWarmup(5000).length).toBeGreaterThan(raceWarmup(42195).length);
  });
});
