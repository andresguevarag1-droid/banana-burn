// Segundo entreno (#286): cuándo sale el correo de las 48 h, cuándo Hoy muestra "Tu segundo entreno", la franja del
// "Recuérdame ese día" del cierre del primer entreno y el copy del correo contra docs/emails/segundo-entreno.md.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { finishedInTrial, secondWorkoutEmailDue, type SecondWorkoutInput } from "./segundo-entreno";
import { isSecondDay } from "./hoy-first";
import { reminderTimeFor, slotAt } from "./train-slot";

vi.mock("@/lib/email/send", () => ({}));
const T = await import("@/lib/email/templates");

const SIGNUP = "2026-11-02T12:00:00.000Z"; // lunes 2 nov, 06:00 en Costa Rica
const FIRST = "2026-11-02T20:00:00.000Z"; // primer entreno terminado, 14:00 CR
const after = (h: number) => new Date(Date.parse(FIRST) + h * 3600_000);
const base = (over: Partial<SecondWorkoutInput> = {}): SecondWorkoutInput => ({
  createdAt: SIGNUP, now: after(50), emailReminders: true, profilePlan: "free", staff: false, paid: false, comp: false, tester: false, charge: null,
  finished: [FIRST], timezone: "America/Costa_Rica", quietStart: "22:00", quietEnd: "07:00", sent: false, ...over,
});

describe("correo del segundo entreno", () => {
  it("sale de 48 a 72 h después del primer entreno terminado, ni antes ni después", () => {
    const cases: [number, boolean][] = [[47.9, false], [48, true], [60, true], [71.9, true], [72, false], [96, false]];
    // 48 h = 14:00 CR, 60 h = 02:00 CR (silencio): sin silencio para mirar solo la ventana.
    for (const [h, due] of cases) expect(secondWorkoutEmailDue(base({ now: after(h), quietStart: null, quietEnd: null })), `${h} h`).toBe(due);
  });

  it("solo con un entreno terminado: sin entrenos o con el segundo ya hecho, no sale", () => {
    expect(secondWorkoutEmailDue(base())).toBe(true);
    expect(secondWorkoutEmailDue(base({ finished: [] }))).toBe(false);
    expect(secondWorkoutEmailDue(base({ finished: [FIRST, "2026-11-04T01:00:00.000Z"] }))).toBe(false);
  });

  it("una sola vez por cuenta", () => {
    expect(secondWorkoutEmailDue(base({ sent: true }))).toBe(false);
  });

  it("dentro de la prueba de 7 días desde el registro", () => {
    const late = "2026-11-07T20:00:00.000Z"; // primer entreno el día 6: a las 48 h ya pasaron 7 días
    expect(secondWorkoutEmailDue(base({ finished: [late], now: new Date(Date.parse(late) + 48 * 3600_000) }))).toBe(false);
  });

  it("respeta email_reminders y las horas de silencio", () => {
    expect(secondWorkoutEmailDue(base({ emailReminders: false }))).toBe(false);
    expect(secondWorkoutEmailDue(base({ now: after(57) }))).toBe(false); // 23:00 CR
    expect(secondWorkoutEmailDue(base({ now: after(65) }))).toBe(true); // 07:00 CR, termina el silencio
  });

  it("mismas exclusiones que la secuencia de la prueba", () => {
    expect(secondWorkoutEmailDue(base({ createdAt: "2026-10-30T12:00:00.000Z", finished: ["2026-10-30T20:00:00.000Z"], now: new Date("2026-11-01T21:00:00.000Z") }))).toBe(false); // beta
    for (const over of [{ staff: true }, { paid: true }, { comp: true }, { tester: true }, { profilePlan: "entreno" }, { profilePlan: "completo" }, { profilePlan: "pro" }])
      expect(secondWorkoutEmailDue(base(over)), JSON.stringify(over)).toBe(false);
    const charge = { status: "scheduled", kind: "prueba", charge_at: "2026-11-09T12:00:00.000Z", reminder_sent_at: null } as const;
    expect(secondWorkoutEmailDue(base({ charge }))).toBe(true);
    expect(secondWorkoutEmailDue(base({ charge: { ...charge, status: "succeeded" } }))).toBe(false);
    // El día del aviso del cobro va solo el aviso.
    expect(secondWorkoutEmailDue(base({ charge: { ...charge, reminder_sent_at: after(45).toISOString() } }))).toBe(false);
  });

  it("finishedInTrial cuenta solo lo terminado en los primeros 7 días", () => {
    expect(finishedInTrial(SIGNUP, [FIRST, null, "2026-11-09T12:00:00.000Z", "2026-11-09T11:59:00.000Z"])).toBe(2);
    expect(finishedInTrial(null, [FIRST])).toBe(0);
  });
});

describe("Hoy: tarjeta del segundo entreno", () => {
  it("desde el día siguiente al primer entreno y mientras lleve uno solo, sin programa", () => {
    expect(isSecondDay({ program: false, workouts: 1, trainedToday: false })).toBe(true);
    expect(isSecondDay({ program: false, workouts: 1, trainedToday: true })).toBe(false); // el mismo día del primero
    expect(isSecondDay({ program: false, workouts: 0, trainedToday: false })).toBe(false);
    expect(isSecondDay({ program: false, workouts: 2, trainedToday: false })).toBe(false);
    expect(isSecondDay({ program: true, workouts: 1, trainedToday: false })).toBe(false);
  });
});

describe("Recuérdame ese día", () => {
  it("guarda la franja de la hora en que entrenó", () => {
    expect([3, 4, 10, 11, 15, 16, 18, 19, 23].map(slotAt)).toEqual(["noche", "manana", "manana", "mediodia", "mediodia", "tarde", "tarde", "noche", "noche"]);
    expect(reminderTimeFor(slotAt(17))).toBe("15:00");
  });
});

describe("plantilla", () => {
  const doc = readFileSync("docs/emails/segundo-entreno.md", "utf8");
  const field = (name: string) => doc.match(new RegExp(`\\*\\*${name}:\\*\\* (.+)`))![1].trim();
  const body = doc.slice(doc.indexOf("**Cuerpo:**") + "**Cuerpo:**".length, doc.indexOf("Coach Banana\n\n**Botón:**")).trim().split(/\n\n+/);

  it("usa el texto aprobado del documento", () => {
    const m = T.segundoEntreno({ unsubscribe: "https://bananaburn.app/api/email/baja?u=x&s=recordatorios" });
    expect(m.subject).toBe(field("Asunto"));
    expect(m.subject).toBe("Tu segundo entreno está listo");
    expect(m.preheader).toBe(field("Preheader"));
    expect(T.SECOND_WORKOUT_MAIL.paragraphs).toEqual(body);
    expect(T.SECOND_WORKOUT_MAIL.cta).toBe(field("Botón"));
    for (const x of body) expect(m.text).toContain(x);
    expect(m.html).toContain("/app/entreno");
    expect(m.html).toContain("baja?u=x&amp;s=recordatorios");
  });

  it("libro de marca: sin emojis, sin IA, sin guiones largos ni exclamaciones", () => {
    const all = [T.SECOND_WORKOUT_MAIL.subject, T.SECOND_WORKOUT_MAIL.preheader, ...T.SECOND_WORKOUT_MAIL.paragraphs, T.SECOND_WORKOUT_MAIL.cta].join(" ");
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).not.toMatch(/\bIA\b|inteligencia artificial|—|!/);
  });
});
