// Regreso (#320): ventanas de R1 a R4, corte al entrenar, horas de silencio, baja, exclusiones, el dato del último entreno,
// la tabla de /admin/embudo y el texto en español contra docs/emails/regreso.md.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { comebackDue, comebackLift, comebackTable, type ComebackInput } from "./regreso";
import { DEFAULT_WEEK, planDay } from "./engine";

vi.mock("@/lib/email/send", () => ({}));
const T = await import("@/lib/email/templates");

// Registro el lunes 2 nov a las 06:00 en Costa Rica (UTC-6); primer entreno terminado a las 14:00 CR.
const SIGNUP = "2026-11-02T12:00:00.000Z";
const FIRST = "2026-11-02T20:00:00.000Z";
/** Instante en hora de Costa Rica: cr("2026-11-03", 7) son las 7:00 del martes 3 nov. */
const cr = (day: string, hour: number) => new Date(Date.parse(`${day}T00:00:00.000Z`) + (hour + 6) * 3600_000);
const base = (over: Partial<ComebackInput> = {}): ComebackInput => ({
  createdAt: SIGNUP, now: cr("2026-11-03", 7), mode: "hourly", emailReminders: true, profilePlan: "free", staff: false, paid: false, comp: false, tester: false, charge: null,
  finished: [FIRST], timezone: "America/Costa_Rica", quietStart: "22:00", quietEnd: "07:00", sent: [], ...over,
});
const at = (day: string, hour: number, over: Partial<ComebackInput> = {}) => comebackDue(base({ now: cr(day, hour), ...over }));

describe("ventanas de la secuencia", () => {
  it("R1: a las 7:00 locales del día siguiente al primer entreno, no antes ni el mismo día", () => {
    expect(at("2026-11-02", 21)).toBe(null); // el mismo día
    expect(at("2026-11-03", 6, { quietStart: null, quietEnd: null })).toBe(null); // antes de las 7:00
    expect(at("2026-11-03", 7)).toBe("r1");
    expect(at("2026-11-03", 15)).toBe("r1"); // si a las 7:00 no salió, la corrida siguiente del mismo día
  });

  it("R1 al día siguiente también si entrenó tarde (23:30): 7.5 h después", () => {
    expect(at("2026-11-03", 7, { finished: ["2026-11-03T05:30:00.000Z"] })).toBe("r1");
  });

  it("R2: de 48 a 72 h después del primer entreno", () => {
    expect(at("2026-11-04", 13)).toBe(null); // 47 h
    expect(at("2026-11-04", 14)).toBe("r2"); // 48 h
    expect(at("2026-11-05", 7)).toBe("r2"); // 65 h
    expect(at("2026-11-05", 14)).toBe(null); // 72 h
  });

  it("R3: día 4 o 5 después del primer entreno, desde las 7:00", () => {
    expect(at("2026-11-06", 6, { quietStart: null, quietEnd: null })).toBe(null);
    expect(at("2026-11-06", 7)).toBe("r3");
    expect(at("2026-11-07", 7)).toBe("r3"); // día 5, si el 4 no salió
    expect(at("2026-11-07", 7, { sent: ["regreso_r3"] })).toBe(null);
    expect(at("2026-11-08", 7)).toBe(null); // día 6
  });

  it("R4: al día siguiente del segundo entreno, a las 7:00, si no hizo el tercero", () => {
    const second = "2026-11-05T01:00:00.000Z"; // miércoles 4 nov, 19:00 CR
    expect(at("2026-11-04", 21, { finished: [FIRST, second] })).toBe(null);
    expect(at("2026-11-05", 7, { finished: [FIRST, second] })).toBe("r4");
    expect(at("2026-11-05", 7, { finished: [FIRST, second, "2026-11-05T12:00:00.000Z"] })).toBe(null);
    expect(at("2026-11-06", 7, { finished: [FIRST, second] })).toBe(null); // solo el día siguiente
  });

  it("en el cron diario sale en la corrida del día, sin mirar la hora", () => {
    expect(at("2026-11-03", 5, { mode: "daily", quietStart: null, quietEnd: null })).toBe("r1");
  });
});

describe("reglas", () => {
  it("nada en horas de silencio", () => {
    expect(at("2026-11-03", 7, { quietStart: "22:00", quietEnd: "08:00" })).toBe(null);
    expect(at("2026-11-03", 8, { quietStart: "22:00", quietEnd: "08:00" })).toBe("r1");
    expect(at("2026-11-04", 23, { quietStart: "22:00", quietEnd: "07:00" })).toBe(null); // 57 h, en silencio
  });

  it("se corta apenas entrena: sin entrenos, o con el segundo hecho, no sale R1, R2 ni R3", () => {
    expect(at("2026-11-03", 7, { finished: [] })).toBe(null);
    expect(at("2026-11-03", 7, { finished: [FIRST, "2026-11-03T12:30:00.000Z"] })).toBe(null); // entrenó a las 6:30
    expect(at("2026-11-04", 14, { finished: [FIRST, "2026-11-04T01:00:00.000Z"] })).toBe("r4"); // ya no R2: pasa a R4
    expect(at("2026-11-06", 7, { finished: [FIRST, "2026-11-04T01:00:00.000Z"] })).toBe(null);
  });

  it("una vez por cuenta y por correo; quien recibió segundo_entreno (#286) tiene R2 por enviado", () => {
    expect(at("2026-11-03", 7, { sent: ["regreso_r1"] })).toBe(null);
    expect(at("2026-11-04", 14, { sent: ["segundo_entreno"] })).toBe(null);
    expect(at("2026-11-04", 14, { sent: ["regreso_r1"] })).toBe("r2");
  });

  it("respeta la baja (email_reminders) y las exclusiones de la prueba", () => {
    expect(at("2026-11-03", 7, { emailReminders: false })).toBe(null);
    for (const over of [{ staff: true }, { paid: true }, { comp: true }, { tester: true }, { profilePlan: "entreno" }, { profilePlan: "completo" }])
      expect(at("2026-11-03", 7, over), JSON.stringify(over)).toBe(null);
    expect(at("2026-11-03", 7, { createdAt: "2026-10-30T12:00:00.000Z" })).toBe(null); // beta
  });

  it("solo en los primeros 14 días desde el registro", () => {
    const first = "2026-11-14T20:00:00.000Z";
    expect(at("2026-11-15", 7, { finished: [first] })).toBe("r1"); // 13 días
    expect(at("2026-11-16", 7, { finished: ["2026-11-15T20:00:00.000Z"] })).toBe(null); // 14 días
  });
});

describe("dato del último entreno", () => {
  const pushA = planDay(1, 0, DEFAULT_WEEK, { equipment: "gym" }).exercises;

  it("sentadilla con 20 kg y todas las reps: hoy toca 22.5", () => {
    const sets = [1, 2, 3, 4].map(() => ({ exercise: "squat", kg: "20", reps: 8, rir: 2 }));
    expect(comebackLift(pushA, sets)).toEqual({ exercise: "Sentadilla trasera", kg: 20, next: 22.5 });
  });

  it("sin todas las reps: el mismo peso, sin la carga de hoy", () => {
    expect(comebackLift(pushA, [{ exercise: "squat", kg: 20, reps: 5, rir: 2 }])).toEqual({ exercise: "Sentadilla trasera", kg: 20, next: null });
  });

  it("si la sesión de hoy no tiene ese ejercicio, el primero con peso del último entreno", () => {
    expect(comebackLift(pushA, [{ exercise: "row", kg: 30, reps: 10 }])).toEqual({ exercise: "Remo con barra", kg: 30, next: null });
  });

  it("sin pesos (en casa, sin equipo), nada", () => {
    expect(comebackLift(pushA, [{ exercise: "bwsquat", kg: 0, reps: 12 }, { exercise: "squat", kg: null, reps: 8 }])).toBe(null);
  });
});

describe("tabla de /admin/embudo", () => {
  it("enviados, cuentas que tocaron el botón y envíos con un entreno en las 48 h siguientes", () => {
    const sentAt = "2026-11-03T13:00:00.000Z";
    const rows = comebackTable(
      [
        { user_id: "a", kind: "regreso_r1", created_at: sentAt, channels: ["email"] },
        { user_id: "b", kind: "regreso_r1", created_at: sentAt, channels: ["email"] },
        { user_id: "c", kind: "regreso_r1", created_at: sentAt, channels: [] }, // omitido: no cuenta
        { user_id: "a", kind: "regreso_r3", created_at: sentAt, channels: ["email"] },
      ],
      [{ user_id: "a", kind: "regreso_r1" }, { user_id: "a", kind: "regreso_r1" }, { user_id: "b", kind: "regreso_r2" }],
      [{ user_id: "a", finished_at: "2026-11-04T12:00:00.000Z" }, { user_id: "b", finished_at: "2026-11-06T12:00:00.000Z" }, { user_id: "b", finished_at: null }],
    );
    expect(rows).toEqual([
      { step: "r1", sent: 2, clicks: 1, trained: 1 },
      { step: "r2", sent: 0, clicks: 1, trained: 0 },
      { step: "r3", sent: 1, clicks: 0, trained: 1 },
      { step: "r4", sent: 0, clicks: 0, trained: 0 },
    ]);
  });
});

describe("texto en español", () => {
  const doc = readFileSync("docs/emails/regreso.md", "utf8");
  const unsubscribe = "https://bananaburn.app/api/email/baja?u=x&s=recordatorios";
  const routine = "Fuerza total: piernas, pecho y hombros";
  const lift = { exercise: "Sentadilla trasera", kg: 20, next: 22.5 };

  it("R1 nombra la sesión, sus minutos y el dato del primer entreno, con un botón al entreno", () => {
    const m = T.regreso({ step: "r1", routine, mins: 25, lift, unsubscribe });
    expect(m.subject).toBe("Tu entreno 2 está listo: unos 25 min");
    expect(m.text).toContain("Hoy te toca Fuerza total: piernas, pecho y hombros: unos 25 minutos.");
    expect(m.text).toContain("La vez pasada hiciste sentadilla trasera con 20 kg; hoy toca 22.5 kg.");
    expect(m.text).toContain("Empezar mi entreno 2: ");
    expect(m.text).toContain("/app/entreno?e=regreso_r1");
    expect(m.html).toContain("/app/entreno?e=regreso_r1");
    expect(m.html).toContain("baja?u=x&amp;s=recordatorios");
  });

  it("sin minutos ni dato: otro asunto y sin la línea del dato", () => {
    const m = T.regreso({ step: "r2", routine, mins: null, lift: null, unsubscribe });
    expect(m.subject).toBe("Ayer no pudiste. Tu entreno 2 sigue listo");
    expect(m.text).toContain("Hoy te toca Fuerza total: piernas, pecho y hombros.");
    expect(m.text).not.toContain("La vez pasada");
    expect(m.html).toContain("/app/entreno?e=regreso_r2");
  });

  it("R2 y R4 con minutos", () => {
    expect(T.regreso({ step: "r2", routine, mins: 25, lift, unsubscribe }).subject).toBe("Ayer no pudiste. Hoy son 25 minutos");
    const r4 = T.regreso({ step: "r4", routine, mins: 25, lift, unsubscribe });
    expect(r4.subject).toBe("Vas 2. El 3.º es el que hace el hábito");
    expect(r4.text).toContain("Empezar mi entreno 3");
  });

  it("R3: texto plano de Andrés, con una sola pregunta y la baja", () => {
    const m = T.regresoPregunta({ name: "Ana López", unsubscribe });
    expect(m.html).toBe("");
    expect(m.subject).toBe("¿Qué te frenó para volver?");
    expect(m.text.startsWith("Hola, Ana:\n")).toBe(true);
    expect(m.text).toContain("\nAndrés\n");
    expect(m.text).toContain(`Si no quieres recibir más correos como este: ${unsubscribe}`);
    expect(m.text.match(/https?:\S+/g)).toEqual([unsubscribe]);
    expect(T.regresoPregunta({ name: "", unsubscribe }).text.startsWith("Hola:\n")).toBe(true);
    expect(T.COMEBACK_QUESTION_REPLY_TO).toBe("hola@bananaburn.app");
  });

  it("usa el texto del documento", () => {
    for (const m of Object.values(T.COMEBACK_MAILS)) {
      expect(doc).toContain(`**Asunto:** ${m.subject}`);
      expect(doc).toContain(`**Preheader:** ${m.preheader}`);
      expect(doc).toContain(`**Primera frase:** ${m.intro}`);
      expect(doc).toContain(`**Botón:** ${m.cta}`);
      if (m.subjectNoMins !== m.subject) expect(doc).toContain(`**Asunto sin minutos:** ${m.subjectNoMins}`);
    }
    for (const x of Object.values(T.COMEBACK_LINES)) expect(doc).toContain(x);
    for (const x of T.COMEBACK_QUESTION.paragraphs) expect(doc).toContain(x);
    expect(doc).toContain(`**Asunto:** ${T.COMEBACK_QUESTION.subject}`);
    expect(doc).toContain(T.COMEBACK_QUESTION.unsubscribe);
    expect(doc).toContain(`Remitente: ${T.COMEBACK_QUESTION_FROM}`);
    for (const x of T.comebackParagraphs("r1", { routine, mins: 25, lift })) expect(doc).toContain(`> ${x}`);
  });

  it("libro de marca: sin emojis, sin IA, sin guiones largos ni exclamaciones", () => {
    const all = [...Object.values(T.COMEBACK_MAILS).flatMap((m) => Object.values(m)), ...Object.values(T.COMEBACK_LINES), ...Object.values(T.COMEBACK_QUESTION).flat()].join(" ");
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).not.toMatch(/\bIA\b|inteligencia artificial|—|!/);
  });
});
