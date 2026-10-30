// Pruebas de QA (#54) de la voz del modo carrera. Las que llevan `it.fails` son fallos conocidos de la app: están
// descritos en el PR y no se arreglan aquí.
import { describe, expect, it } from "vitest";
import { stepCue, type GuideStep } from "@/lib/run-guide";

const step = (distM: number): GuideStep => ({ kind: "trabajo", label: "", distM, paceS: 330, zoneLabel: "ritmo de carrera" });

describe("voz al empezar un tramo con distancia", () => {
  it("dice los kilómetros con coma y en plural cuando no es 1", () => {
    expect(stepCue(step(2000))).toBe("Ahora 2 kilómetros a ritmo de carrera, 5 30 por kilómetro.");
    expect(stepCue(step(1500))).toBe("Ahora 1 coma 5 kilómetros a ritmo de carrera, 5 30 por kilómetro.");
    expect(stepCue(step(800))).toBe("Ahora 800 metros a ritmo de carrera, 5 30 por kilómetro.");
  });
  // FALLO CONOCIDO 3: sayDist en run-guide.ts siempre dice "kilómetros", así que el primer tramo del modo carrera
  // (1 km) se oye "Ahora 1 kilómetros a ritmo de carrera". Debería decir "1 kilómetro".
  it.fails("un tramo de 1 km se dice en singular", () => {
    expect(stepCue(step(1000))).toBe("Ahora 1 kilómetro a ritmo de carrera, 5 30 por kilómetro.");
  });
});
