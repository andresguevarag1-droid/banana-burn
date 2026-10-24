import { describe, expect, it } from "vitest";
import { PP_CELEBRATED, PP_HIDDEN, STEP_KEY, TOUR_KEYS, addKey, checklistState, firstSteps, nextStep, nextTimeLine, shouldAutoTour, type StepSignals } from "./primeros-pasos";

const base: StepSignals = { keys: [], workouts: 0, weights: 1, coachMessages: 0, push: false, pushSupported: true };

describe("primeros pasos", () => {
  it("una cuenta nueva ve 6 pasos, ninguno hecho, y el primero es mirar su semana", () => {
    const st = checklistState(base);
    expect(st.total).toBe(6);
    expect(st.done).toBe(0);
    expect(st.visible).toBe(true);
    expect(nextStep(st.steps)?.id).toBe("semana");
  });
  it("el pesaje de la bienvenida no cuenta: el paso del peso pide uno nuevo", () => {
    expect(firstSteps({ ...base, weights: 1 }).find((s) => s.id === "peso")?.done).toBe(false);
    expect(firstSteps({ ...base, weights: 2 }).find((s) => s.id === "peso")?.done).toBe(true);
  });
  it("los datos reales marcan pasos solos: entreno, chat y avisos", () => {
    const s = firstSteps({ ...base, workouts: 1, coachMessages: 3, push: true });
    expect(s.find((x) => x.id === "entreno")?.done).toBe(true);
    expect(s.find((x) => x.id === "coach")?.done).toBe(true);
    expect(s.find((x) => x.id === "avisos")?.done).toBe(true);
  });
  it("sin avisos posibles en este equipo, ese paso se cambia por la primera lección", () => {
    const s = firstSteps({ ...base, pushSupported: false });
    expect(s.some((x) => x.id === "avisos")).toBe(false);
    expect(s.find((x) => x.id === "leccion")?.done).toBe(false);
    expect(firstSteps({ ...base, pushSupported: false, keys: ["lec-tecnica"] }).find((x) => x.id === "leccion")?.done).toBe(true);
  });
  it("instalar la LinkApp solo aparece en celular (en lugar de los avisos), y se marca solo si ya corre instalada", () => {
    expect(firstSteps(base).some((x) => x.id === "instalar")).toBe(false);
    expect(firstSteps({ ...base, mobile: true })).toHaveLength(6);
    expect(firstSteps({ ...base, mobile: true }).some((x) => x.id === "avisos")).toBe(false);
    expect(firstSteps({ ...base, mobile: true }).find((x) => x.id === "instalar")?.done).toBe(false);
    expect(firstSteps({ ...base, mobile: true, standalone: true }).find((x) => x.id === "instalar")?.done).toBe(true);
  });
  it("con todo hecho celebra una vez; después de celebrar o cerrar, no se muestra", () => {
    const all = Object.values(STEP_KEY);
    const st = checklistState({ ...base, keys: all, weights: 3 });
    expect(st.complete).toBe(true);
    expect(st.celebrate).toBe(true);
    expect(checklistState({ ...base, keys: [...all, PP_CELEBRATED] }).visible).toBe(false);
    expect(checklistState({ ...base, keys: [PP_HIDDEN] }).visible).toBe(false);
  });
  it("el coach del texto cambia con quien acompaña", () => {
    expect(firstSteps(base, "Coach Platanita").find((x) => x.id === "coach")?.title).toBe("Pregúntale algo a Coach Platanita");
  });
  it("el recorrido de cada pantalla se abre una vez y nunca encima de la guía", () => {
    expect(shouldAutoTour({ keys: [], tour: "hoy", blocked: false })).toBe(true);
    expect(shouldAutoTour({ keys: [], tour: "hoy", blocked: true })).toBe(false);
    expect(shouldAutoTour({ keys: [TOUR_KEYS.hoy], tour: "hoy", blocked: false })).toBe(false);
    expect(shouldAutoTour({ keys: [TOUR_KEYS.hoy], tour: "entrenar", blocked: false })).toBe(true);
  });
  it("las claves no se repiten, respetan el formato y el tope de 64 (igual que 0047)", () => {
    expect(addKey(["a"], "a")).toEqual(["a"]);
    expect(addKey([], "Mal Formada")).toEqual([]);
    expect(addKey(Array.from({ length: 64 }, (_, i) => `k${i}`), "otra")).toHaveLength(64);
    for (const k of [...Object.values(STEP_KEY), ...Object.values(TOUR_KEYS), PP_HIDDEN, PP_CELEBRATED]) expect(k).toMatch(/^[a-z0-9-]{1,24}$/);
  });
  it("la frase de la próxima vez dice lo mismo que el motor", () => {
    expect(nextTimeLine({ type: "up", kg: 42.5, reps: [8, 8, 8] }, 8)).toBe("Sube a 42.5 kg y vuelve a 8 repeticiones.");
    expect(nextTimeLine({ type: "reps", kg: 40, reps: [9, 9, 9] }, 8)).toBe("Mismo peso, una repetición más por serie.");
    expect(nextTimeLine({ type: "reset", kg: 36, reps: [9] }, 8)).toBe("Baja a 36 kg para retomar con buena técnica.");
    expect(nextTimeLine({ type: "cal", kg: null, reps: [8] }, 8)).toBeNull();
  });
});
