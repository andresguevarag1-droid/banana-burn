// Correos de la prueba en inglés (#301): cada uno sale en el idioma de la cuenta, el español no cambia, nada queda sin
// traducir y el copy coincide con docs/emails/en.md.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ACTIVATION_MAILS, RECOVERY_MAILS, SECOND_WORKOUT_MAIL, TRIAL_SEQUENCE, WEEKLY_GOAL_MAIL, activacion, metaSemanal, recoveryProgressLine, recuperacionPrueba, secuenciaPrueba, segundoEntreno, type Email } from "./templates";
import { hasTranslation, tr } from "@/lib/i18n/t";
import type { Locale } from "@/lib/i18n/locale";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => null }));
vi.mock("@/lib/supabase/server", () => ({ STAFF: [] }));
const { languagesOf } = await import("@/lib/notify-run");

const unsubscribe = "https://bananaburn.app/api/email/baja?token=x";
const progress = { workouts: 2, sets: 3, kg: 1240 };

/** Todos los correos de la prueba en un idioma. */
const all = (locale?: Locale): [string, Email][] => [
  ...([2, 4, 6] as const).map((day): [string, Email] => [`prueba_d${day}`, secuenciaPrueba({ day, unsubscribe, locale })]),
  ["recuperacion_d8", recuperacionPrueba({ day: 8, unsubscribe, progress, trainDays: 4, locale })],
  ["recuperacion_d8 sin entrenos", recuperacionPrueba({ day: 8, unsubscribe, progress: null, trainDays: 4, locale })],
  ["recuperacion_d10", recuperacionPrueba({ day: 10, unsubscribe, locale })],
  ["segundo_entreno", segundoEntreno({ unsubscribe, locale })],
  ["meta_semanal", metaSemanal({ count: 1, goal: 3, mins: 20, unsubscribe, locale })],
  ["meta_semanal sin minutos", metaSemanal({ count: 0, goal: 3, mins: null, unsubscribe, locale })],
  ...([0, 1, 2] as const).map((step): [string, Email] => [`activacion_${step}`, activacion({ step, home: true, unsubscribe, locale })]),
];

/** Frases en español que no deberían quedar en un correo en inglés (las rutas /app/entreno no cuentan). */
const SPANISH = /\b(tu|tus|de|del|que|para|con|los|las|el|entreno|prueba|correo|Recibes|Ayuda|semana|Elegir)\b/i;
const visible = (e: Email) => [e.subject, e.preheader, e.text.replace(/https?:\S+/g, ""), e.html.replace(/<[^>]+>/g, " ").replace(/https?:\S+/g, "")].join("\n");

describe("correos de la prueba en inglés (#301)", () => {
  it("en-US: asunto, cuerpo y pie en inglés, sin frases en español", () => {
    for (const [name, e] of all("en-US")) {
      expect(visible(e), name).not.toMatch(SPANISH);
      expect(e.html, name).toContain('<html lang="en">');
      expect(e.text, name).toContain(`Stop getting these emails: ${unsubscribe}`);
      expect(e.subject + e.text, name).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(e.subject + e.text, name).not.toMatch(/\bAI\b|artificial intelligence/i);
    }
  });

  it("es-419 y sin idioma: el mismo correo de siempre", () => {
    const es = all("es-419"), none = all();
    for (let i = 0; i < es.length; i++) {
      expect(es[i][1]).toEqual(none[i][1]);
      expect(es[i][1].html).toContain('<html lang="es">');
      expect(es[i][1].text).toContain(`Dejar de recibir estos correos: ${unsubscribe}`);
    }
    expect(none[0][1].subject).toBe("Tu primer resultado empieza por registrar");
  });

  it("cada frase de las plantillas tiene traducción en src/lib/i18n/en/email.ts", () => {
    const pieces = [
      ...Object.values(TRIAL_SEQUENCE), ...Object.values(RECOVERY_MAILS), SECOND_WORKOUT_MAIL,
      ...Object.values(ACTIVATION_MAILS).map((c) => ({ ...c, cta: "Empezar mi entreno" })),
    ];
    for (const c of pieces) for (const s of [c.subject, c.preheader, c.cta, ...c.paragraphs]) expect(hasTranslation("en-US", s), s).toBe(true);
    expect(hasTranslation("en-US", WEEKLY_GOAL_MAIL.subject)).toBe(true);
    expect(hasTranslation("en-US", WEEKLY_GOAL_MAIL.cta)).toBe(true);
  });

  it("día 8: el total levantado en lb (redondeado a 2.5 lb) si las unidades son imperiales; en kg si son métricas", () => {
    expect(recoveryProgressLine(progress, 4, "en-US", "imperial")).toBe("During your trial you saved 2 workouts, with 3 sets and 2,732.5 lb lifted. All of it is still in your account.");
    expect(recoveryProgressLine(progress, 4, "en-US", "metric")).toBe("During your trial you saved 2 workouts, with 3 sets and 1,240 kg lifted. All of it is still in your account.");
    expect(recoveryProgressLine({ workouts: 1, sets: 1, kg: 0 }, 4, "en-US", "imperial")).toBe("During your trial you saved 1 workout, with 1 set. All of it is still in your account.");
    expect(recoveryProgressLine(null, 1, "en-US")).toBe("Your plan for 1 day a week is still ready in your account, with routines built from your details.");
    expect(recoveryProgressLine(progress, 4)).toBe("En tu prueba guardaste 2 entrenos, con 3 series y 1,240 kg levantados. Todo eso sigue en tu cuenta.");
    // Sin unidades guardadas, las del idioma: lb en inglés.
    expect(recuperacionPrueba({ day: 8, unsubscribe, progress, locale: "en-US" }).text).toContain("2,732.5 lb lifted");
  });

  it("coincide con docs/emails/en.md", () => {
    const doc = readFileSync("docs/emails/en.md", "utf8");
    const t = tr("en-US");
    for (const [name, e] of all("en-US")) {
      expect(doc, name).toContain(`**Subject:** ${e.subject}`);
      if (!name.startsWith("meta_semanal")) expect(doc, name).toContain(`**Preview:** ${e.preheader}`);
    }
    const pieces = [...Object.values(TRIAL_SEQUENCE), ...Object.values(RECOVERY_MAILS), SECOND_WORKOUT_MAIL, ...Object.values(ACTIVATION_MAILS).map((c) => ({ ...c, cta: "Empezar mi entreno" }))];
    for (const c of pieces) {
      expect(doc).toContain(`**Button:** ${t(c.cta)}`);
      for (const para of c.paragraphs) expect(doc).toContain(t(para));
    }
    for (const para of WEEKLY_GOAL_MAIL.text(1, 3, 20, t).paragraphs) expect(doc).toContain(para);
    expect(doc).toContain(recoveryProgressLine(progress, 4, "en-US", "imperial"));
    expect(doc).toContain(recoveryProgressLine(null, 4, "en-US"));
  });
});

describe("idioma de cada cuenta en el cron (languagesOf)", () => {
  const client = (result: () => Promise<unknown>) => {
    const q = { select: () => q, in: () => q, order: () => q, range: () => result() };
    return { from: () => q } as never;
  };
  it("lee locale y units; valores raros quedan en español y sin unidades", async () => {
    const rows = [{ id: "a", locale: "en-US", units: "imperial" }, { id: "b", locale: null, units: null }, { id: "c", locale: "fr", units: "x" }];
    const m = await languagesOf(client(async () => ({ data: rows, error: null })), ["a", "b", "c"]);
    expect(m.get("a")).toEqual({ locale: "en-US", units: "imperial" });
    expect(m.get("b")).toEqual({ locale: "es-419", units: null });
    expect(m.get("c")).toEqual({ locale: "es-419", units: null });
  });
  it("si la lectura falla (o 0070 no corrió), nadie se queda sin correo: todos en español", async () => {
    expect((await languagesOf(client(async () => ({ data: null, error: { code: "42703" } })), ["a"])).size).toBe(0);
    expect((await languagesOf(client(async () => { throw new Error("red"); }), ["a"])).size).toBe(0);
  });
});
