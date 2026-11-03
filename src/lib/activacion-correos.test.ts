// Reglas de los correos de activación A0, A1 y A2 (#225) y su copy contra docs/emails/activacion.md.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { activationDue, activationStepAt, emailedToday, type ActivationInput } from "./activacion-correos";

vi.mock("@/lib/email/send", () => ({}));
const T = await import("@/lib/email/templates");

const SIGNUP = "2026-11-02T16:00:00.000Z"; // 10:00 en Costa Rica
const at = (h: number) => new Date(Date.parse(SIGNUP) + h * 3600_000);
const base = (over: Partial<ActivationInput> = {}): ActivationInput => ({
  createdAt: SIGNUP, now: at(2), mode: "daily", trained: false, emailReminders: true, timezone: "America/Costa_Rica",
  quietStart: "22:00", quietEnd: "07:00", reminderHour: 7, reminderAt: at(2), sent: [], ...over,
});

describe("ventanas de cada pieza", () => {
  it("A0 de 1 a 24 h, A1 de 24 a 48 h, A2 de 72 a 96 h; nada antes, entre A1 y A2 ni después", () => {
    const cases: [number, number | null][] = [[0.5, null], [1, 0], [23.9, 0], [24, 1], [47.9, 1], [48, null], [71.9, null], [72, 2], [95.9, 2], [96, null]];
    for (const [h, step] of cases) expect(activationStepAt(SIGNUP, at(h)), `${h} h`).toBe(step);
    expect(activationStepAt(null, at(2))).toBeNull();
  });
});

describe("activationDue", () => {
  it("solo sin entrenos y con email_reminders", () => {
    expect(activationDue(base())).toBe(0);
    expect(activationDue(base({ trained: true }))).toBeNull();
    expect(activationDue(base({ emailReminders: false }))).toBeNull();
  });

  it("una vez por pieza", () => {
    expect(activationDue(base({ sent: ["activacion_0"] }))).toBeNull();
    expect(activationDue(base({ now: at(25), sent: ["activacion_0"] }))).toBe(1);
  });

  it("modo diario: si ya pasaron 24 h, toca A1 y A0 no sale", () => {
    expect(activationDue(base({ now: at(25) }))).toBe(1);
  });

  it("modo diario: A0 en la primera corrida después de la primera hora, aunque sea al día siguiente; respeta el silencio", () => {
    const cases: [number, number | null][] = [[0.5, null], [24.5, 0], [25, 1], [48.5, 1], [49, null], [72.5, null], [96.5, 2], [97, null]];
    for (const [h, step] of cases) expect(activationDue(base({ now: at(h), quietEnd: "06:00" })), `${h} h`).toBe(step);
    expect(activationDue(base({ now: at(2), quietStart: "11:00", quietEnd: "13:00" }))).toBeNull(); // 12:00 CR
  });

  it("cada hora: A0 a cualquier hora fuera del silencio; A1 y A2 solo a la hora del recordatorio", () => {
    const hourly = (now: Date, reminderAt: Date) => activationDue(base({ mode: "hourly", now, reminderAt }));
    expect(hourly(at(1), at(-3))).toBe(0); // 11:00 CR
    expect(hourly(new Date("2026-11-03T05:00:00.000Z"), at(-3))).toBeNull(); // 23:00 CR, silencio
    // 3 nov 07:00 CR (21 h): todavía A0.
    expect(hourly(new Date("2026-11-03T13:00:00.000Z"), new Date("2026-11-03T13:00:00.000Z"))).toBe(0);
    // 4 nov 07:00 CR (45 h): A1. A las 10:00 CR (48 h) ya no.
    expect(hourly(new Date("2026-11-04T13:00:00.000Z"), new Date("2026-11-04T13:00:00.000Z"))).toBe(1);
    expect(hourly(new Date("2026-11-04T15:00:00.000Z"), new Date("2026-11-04T13:00:00.000Z"))).toBeNull();
    // 6 nov 07:00 CR (93 h): A2.
    expect(hourly(new Date("2026-11-06T13:00:00.000Z"), new Date("2026-11-06T13:00:00.000Z"))).toBe(2);
  });
});

describe("emailedToday", () => {
  const now = new Date("2026-11-03T13:00:00.000Z"); // 07:00 CR del 3 nov
  const tz = "America/Costa_Rica";
  it("cuenta los correos con fecha de hoy y los únicos creados hoy, no la bienvenida, el plan listo ni lo que no fue por correo", () => {
    expect(emailedToday([{ kind: "recordatorio", local_day: "2026-11-03", channels: ["inapp", "email"] }], now, tz)).toBe(true);
    expect(emailedToday([{ kind: "recordatorio", local_day: "2026-11-03", channels: ["inapp", "push"] }], now, tz)).toBe(false);
    expect(emailedToday([{ kind: "recordatorio", local_day: "2026-11-02", channels: ["email"] }], now, tz)).toBe(false);
    expect(emailedToday([{ kind: "prueba_d2", local_day: "1970-01-01", channels: ["email"], created_at: "2026-11-03T12:10:00.000Z" }], now, tz)).toBe(true);
    expect(emailedToday([{ kind: "prueba_d2", local_day: "1970-01-01", channels: ["email"], created_at: "2026-11-03T05:00:00.000Z" }], now, tz)).toBe(false); // 23:00 CR del 2 nov
    expect(emailedToday([{ kind: "bienvenida", local_day: "1970-01-01", channels: ["email"], created_at: "2026-11-03T12:10:00.000Z" }], now, tz)).toBe(false);
    expect(emailedToday([{ kind: "plan_listo", local_day: "1970-01-01", channels: ["email"], created_at: "2026-11-03T12:10:00.000Z" }], now, tz)).toBe(false);
  });
});

describe("plantilla", () => {
  const doc = readFileSync("docs/emails/activacion.md", "utf8");
  const section = (id: string) => { const s = doc.slice(doc.indexOf(`## ${id}.`)); return s.slice(0, s.indexOf("\n## ", 3)); };
  const field = (s: string, name: string) => s.match(new RegExp(`\\*\\*${name}:\\*\\* (.+)`))![1].trim();

  it.each([[0, "A0"], [1, "A1"], [2, "A3"]] as const)("la pieza %s usa el texto aprobado de %s", (step, id) => {
    const s = section(id);
    const c = T.ACTIVATION_MAILS[step];
    expect(c.subject).toBe(field(s, "Asunto"));
    expect(c.preheader).toBe(field(s, "Preheader"));
    for (const para of c.paragraphs) expect(s).toContain(para);
    expect(field(s, "Botón")).toBe("Empezar mi entreno");
    const mail = T.activacion({ step, home: false, unsubscribe: "https://bananaburn.app/api/email/baja?u=x&s=recordatorios" });
    expect(mail.text).toContain("Coach Banana");
    expect(mail.html).toContain("Empezar mi entreno");
  });

  it("un solo botón, sin enlace a pago", () => {
    const mail = T.activacion({ step: 0, home: true, unsubscribe: "https://bananaburn.app/api/email/baja?u=x&s=recordatorios" });
    expect(mail.html).not.toContain("/app/suscripcion");
    expect(mail.html.match(/\/app\/entreno\?casa=1/g)).toHaveLength(1);
    expect(T.activationPath(true)).toBe("/app/entreno?casa=1");
    expect(T.activationPath(false)).toBe("/app/entreno");
  });
});
