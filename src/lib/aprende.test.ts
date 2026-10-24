import { describe, expect, it } from "vitest";
import { courseProgress, lessonKey, lessons } from "./aprende";

const RULES = /[\u{1F300}-\u{1FAFF}☀-➿]|—|\bIA\b|·|banano|inteligencia artificial/iu;

describe("Aprende a entrenar", () => {
  it("son 10 lecciones, numeradas en orden, cortas y con una pregunta o un botón para hacerlo", () => {
    const all = lessons({ nutrition: true });
    expect(all).toHaveLength(10);
    all.forEach((l, i) => {
      expect(l.n).toBe(i + 1);
      expect(l.check || l.cta).toBeTruthy();
      const words = [l.idea, ...l.body, ...l.points].join(" ").split(/\s+/).length;
      expect(words).toBeLessThan(160); // unos 30 segundos de lectura
    });
  });
  it("las respuestas correctas existen y las claves caben en la base", () => {
    for (const l of lessons({ nutrition: true })) {
      if (l.check) expect(l.check.options[l.check.correct]).toBeTruthy();
      expect(lessonKey(l.slug)).toMatch(/^[a-z0-9-]{1,24}$/);
    }
    const keys = lessons({ nutrition: true }).map((l) => lessonKey(l.slug));
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("Entreno sin nutrición: la lección de comida no promete calorías ni recetas de la app", () => {
    const comida = lessons({ nutrition: false }).find((l) => l.slug === "comida")!;
    expect(comida.body.join(" ")).not.toMatch(/te calcula|Menú flash/);
    expect(comida.cta).toBeNull();
    const conNutri = lessons({ nutrition: true }).find((l) => l.slug === "comida")!;
    expect(conNutri.cta?.href).toBe("/app/nutricion");
  });
  it("el coach de la técnica cambia con quien acompaña", () => {
    expect(lessons({ nutrition: true, coach: "Coach Platanita" }).find((l) => l.slug === "tecnica")!.body.join(" ")).toContain("Coach Platanita");
  });
  it("los textos cumplen el libro de marca", () => {
    for (const nutrition of [true, false]) for (const l of lessons({ nutrition })) {
      expect(JSON.stringify(l)).not.toMatch(RULES);
    }
  });
  it("el progreso cuenta lecciones leídas y propone la siguiente", () => {
    const all = lessons({ nutrition: true });
    const p = courseProgress(all, [lessonKey(all[0].slug)]);
    expect(p.done).toBe(1);
    expect(p.next?.slug).toBe(all[1].slug);
    expect(courseProgress(all, all.map((l) => lessonKey(l.slug))).complete).toBe(true);
  });
});
