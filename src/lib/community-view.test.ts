import { describe, expect, it } from "vitest";
import { counterState, fmtDuration, fmtVolume, initials, isPostTag, levelFor, mondayIso, podiumOrder, POST_TAGS, publicBadges, splitBoard, tagDef, timeAgo, zonedMidnightUtc, type BoardRow } from "./community-view";

const NOW = new Date("2026-10-22T18:00:00Z");
const before = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("timeAgo (es-419)", () => {
  it("ahora, minutos y horas", () => {
    expect(timeAgo(before(10_000), NOW)).toBe("ahora");
    expect(timeAgo(before(5 * 60_000), NOW)).toBe("hace 5 minutos");
    expect(timeAgo(before(60_000), NOW)).toBe("hace 1 minuto");
    expect(timeAgo(before(3 * 3600_000), NOW)).toBe("hace 3 horas");
  });
  it("ayer y días", () => {
    expect(timeAgo(before(24 * 3600_000), NOW)).toBe("ayer");
    expect(timeAgo(before(3 * 86400_000), NOW)).toBe("hace 3 días");
  });
  it("más de una semana: fecha corta", () => {
    expect(timeAgo("2026-09-01T12:00:00Z", NOW)).toMatch(/1.*sept?/i);
    expect(timeAgo("2025-09-01T12:00:00Z", NOW)).toMatch(/2025/);
  });
  it("fecha inválida: vacío", () => expect(timeAgo("x", NOW)).toBe(""));
});

describe("tipos de publicación", () => {
  it("coinciden con la lista del servidor", () => expect(POST_TAGS.map((t) => t.id)).toEqual(["entreno", "logro", "pregunta", "comida", "progreso"]));
  it("valida", () => {
    expect(isPostTag("logro")).toBe(true);
    expect(isPostTag("record_mundial")).toBe(false);
    expect(isPostTag(undefined)).toBe(false);
    expect(tagDef("pregunta")?.label).toBe("Pregunta");
    expect(tagDef("nada")).toBeNull();
  });
  it("sin emojis en etiquetas ni textos de ayuda", () => {
    const re = /\p{Extended_Pictographic}/u;
    for (const t of POST_TAGS) expect(re.test(t.chip + t.label + t.placeholder)).toBe(false);
  });
});

describe("cifras", () => {
  it("volumen", () => {
    expect(fmtVolume(0)).toBeNull();
    expect(fmtVolume(820)).toBe("820 kg");
    expect(fmtVolume(7420)).toBe((7.4).toLocaleString("es-419") + " t");
  });
  it("duración", () => {
    expect(fmtDuration(null)).toBeNull();
    expect(fmtDuration(52)).toBe("52 min");
    expect(fmtDuration(65)).toBe("1 h 05 min");
    expect(fmtDuration(120)).toBe("2 h");
  });
  it("iniciales", () => {
    expect(initials("Carla Mora")).toBe("CM");
    expect(initials("andrés")).toBe("A");
    expect(initials("  ")).toBe("?");
  });
});

describe("contador de caracteres", () => {
  it("solo cerca del límite", () => {
    expect(counterState(10, 500).show).toBe(false);
    expect(counterState(400, 500)).toEqual({ left: 100, show: true, danger: false });
    expect(counterState(490, 500).danger).toBe(true);
  });
});

describe("ranking", () => {
  const row = (id: string, xp: number, pos: number, me = false): BoardRow => ({ userId: id, username: id, name: id, workouts: 1, xp, totalXp: xp, pos, me });
  it("podio, resto y tu fila", () => {
    const r = splitBoard([row("a", 900, 1), row("b", 700, 2), row("c", 500, 3), row("d", 300, 4), row("yo", 0, 5, true)]);
    expect(r.podium.map((x) => x.userId)).toEqual(["a", "b", "c"]);
    expect(r.rest.map((x) => x.userId)).toEqual(["d"]);
    expect(r.me?.userId).toBe("yo");
    expect(r.meInList).toBe(false);
    expect(r.honest).toBe(true);
  });
  it("honesto: con menos de 2 personas activas no hay podio", () => {
    const r = splitBoard([row("yo", 120, 1, true)]);
    expect(r.honest).toBe(false);
    expect(r.active).toBe(1);
  });
  it("orden del podio 2-1-3", () => expect(podiumOrder(["1", "2", "3"])).toEqual(["2", "1", "3"]));
  it("podio incompleto", () => expect(podiumOrder(["1", "2"])).toEqual(["2", "1", null]));
});

describe("nivel e insignias", () => {
  it("nivel desde XP", () => {
    expect(levelFor(null)).toBeNull();
    expect(levelFor(0)?.idx).toBe(1);
    expect(levelFor(900)?.name).toBe("Banana madura");
  });
  it("nunca muestra insignias de peso", () => {
    const ids = publicBadges({ workouts: 12, prs: 1, streak: 8 }).map((b) => b.id);
    expect(ids).toEqual(["first", "w10", "s7", "s30", "pr"]);
  });
  it("sin racha conocida, sin insignias de racha", () => {
    const ids = publicBadges({ workouts: 1, prs: 0 }).map((b) => b.id);
    expect(ids).toEqual(["first", "w10", "pr"]);
  });
});

describe("semana local", () => {
  it("lunes", () => {
    expect(mondayIso("2026-10-22")).toBe("2026-10-19");
    expect(mondayIso("2026-10-19")).toBe("2026-10-19");
    expect(mondayIso("2026-10-25")).toBe("2026-10-19");
  });
  it("medianoche local en UTC", () => {
    expect(zonedMidnightUtc("2026-10-19", "America/Costa_Rica").toISOString()).toBe("2026-10-19T06:00:00.000Z");
    expect(zonedMidnightUtc("2026-10-19", "America/Mexico_City").toISOString()).toBe("2026-10-19T06:00:00.000Z");
    expect(zonedMidnightUtc("2026-10-19", "America/Bogota").toISOString()).toBe("2026-10-19T05:00:00.000Z");
    expect(zonedMidnightUtc("2026-10-19", "Zona/Rara").toISOString()).toBe("2026-10-19T00:00:00.000Z");
  });
});
