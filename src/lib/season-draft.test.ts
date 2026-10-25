import { describe, expect, it } from "vitest";
import { buildDraft, nextSeason, parseDraft, ruleNotes } from "@/lib/season-draft";
import { SEASON_BY_SLUG, aggregateFeedback, type FeedbackRow } from "@/lib/seasons";
import type { ProgramSession } from "@/lib/programs";

const prev = SEASON_BY_SLUG["temporada-running-1"];
const sessions: ProgramSession[] = [
  { phase: 1, day: 1, title: "Fuerza", focus: "Piernas", exercises: [{ id: "squat", sets: 3, lo: 6, hi: 8, rest: 120 }, { id: "lunge", sets: 3, lo: 8, hi: 10, rest: 90, home: "bulgarian" }] },
  { phase: 1, day: 2, title: "Core", focus: "Tronco", exercises: [{ id: "plank", sets: 3, lo: 30, hi: 45, rest: 60 }] },
];
const rows = (id: string, n: number, liked: boolean | null, skipped = false): FeedbackRow[] => Array.from({ length: n }, () => ({ exercise_id: id, week: 1, liked, difficulty: null, skipped, completed: !skipped }));

describe("borrador de la próxima temporada", () => {
  it("la siguiente empieza el lunes después y dura 8 semanas", () => {
    const n = nextSeason(prev);
    expect(n.slug).toBe("temporada-running-2");
    expect(n.startsOn).toBe("2027-01-04");
    expect(n.endsOn).toBe("2027-02-28");
    expect(n.enrollUntil).toBe("2027-01-17");
  });
  it("cambia lo que no gustó o se saltó, deja lo que gustó y nunca toca un ejercicio sin datos", () => {
    const stats = aggregateFeedback([...rows("lunge", 6, false), ...rows("plank", 5, null, true), ...rows("squat", 6, true)]);
    const d = buildDraft(prev, sessions, stats, (id) => ({ lunge: ["bulgarian", "stepup"], plank: ["deadbug"] })[id] ?? [], () => true);
    const ids = d.sessions.flatMap((s) => s.exercises.map((e) => e.id));
    expect(ids).toEqual(["squat", "bulgarian", "deadbug"]);
    expect(d.changes.map((c) => c.from).sort()).toEqual(["lunge", "plank"]);
    expect(d.keep).toEqual(["squat"]);
    expect(d.sessions[0].exercises[1].home).toBeUndefined();
  });
  it("sin alternativa válida, se queda y se marca para revisar", () => {
    const d = buildDraft(prev, sessions, aggregateFeedback(rows("plank", 6, false)), () => ["nope"], (id) => id !== "nope");
    expect(d.sessions[1].exercises[0].id).toBe("plank");
    expect(d.changes[0]).toMatchObject({ from: "plank", to: null });
    expect(d.changes[0].reason).toMatch(/a mano/);
  });
  it("notas por reglas y lectura segura del jsonb", () => {
    const d = buildDraft(prev, sessions, [], () => [], () => true);
    expect(ruleNotes(d, 12, [{ week: 1, pct: 1 }, { week: 5, pct: 0.4 }])).toMatch(/semana 5/);
    expect(parseDraft({ ...d, notes: "x" })?.slug).toBe("temporada-running-2");
    expect(parseDraft({ slug: 3 })).toBeNull();
    expect(JSON.stringify(d)).not.toMatch(/—|crossfit/i);
  });
});
