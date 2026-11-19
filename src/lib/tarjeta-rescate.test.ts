// Rescate del paso de la tarjeta de la bienvenida (#325): ventanas de T1 y T2, corte al guardar, cuentas anteriores a
// CARD_REQUIRED_FROM, uno por día, baja y supresión; textos en español e inglés; eventos sin datos personales.
import { describe, expect, it, vi } from "vitest";
import type { RescueInput } from "./tarjeta-rescate";

vi.mock("server-only", () => ({}));
const { CARD_REQUIRED_FROM } = await import("./card-required");
const { RESCUE_KINDS, cardRescueDue, rescueIdemKey, rescuePath } = await import("./tarjeta-rescate");
const { CARD_RESCUE_BILLING, CARD_RESCUE_CTA, CARD_RESCUE_MAILS, RESCUE_GOAL, tarjetaRescate } = await import("./email/templates");
const { EMAIL_CLICK_KINDS, cleanEvent } = await import("@/app/api/track/event");
const { hasTranslation } = await import("./i18n/t");
const { withLoginLinks } = await import("./email/login-link");
const { cardAskTable, buildAccounts } = await import("./embudo-plata");
const { SITE_URL } = await import("./env");

const H = 36e5;
// Paso visto el lunes 23 nov 2026 a las 10:00 de Costa Rica (16:00 UTC).
const STEP = "2026-11-23T16:00:00.000Z";
const at = (h: number) => new Date(Date.parse(STEP) + h * H);
const base = (over: Partial<RescueInput> = {}): RescueInput => ({
  now: at(1), createdAt: CARD_REQUIRED_FROM, stepAt: STEP, subs: [], chargeStatuses: [], cards: 0, emailReminders: true,
  timezone: "America/Costa_Rica", quietStart: null, quietEnd: null, sent: [], ...over,
});

describe("T1: de 1 h a 24 h después de ver el paso", () => {
  it("sale desde la hora, no antes", () => {
    expect(cardRescueDue(base({ now: new Date(Date.parse(STEP) + 59 * 60_000) }))).toBeNull();
    expect(cardRescueDue(base({ now: at(1) }))).toBe("tarjeta_rescate_1");
    expect(cardRescueDue(base({ now: at(23.5) }))).toBe("tarjeta_rescate_1");
  });
  it("una sola vez por cuenta", () => {
    expect(cardRescueDue(base({ now: at(3), sent: [{ kind: "tarjeta_rescate_1", local_day: "2026-11-23" }] }))).toBeNull();
    expect(cardRescueDue(base({ now: at(15), sent: [{ kind: "tarjeta_rescate_1", local_day: "2026-11-23" }] }))).toBeNull();
  });
});

describe("T2: a las 7:00 locales, 24 h o más después del paso", () => {
  const t1 = [{ kind: "tarjeta_rescate_1", local_day: "2026-11-23" }];
  it("el 24 a las 7:00 todavía no (21 h); el 25 a las 7:00 sí", () => {
    // 24 nov 7:00 CR = 13:00 UTC = 21 h después: aún la ventana de T1, que ya salió.
    expect(cardRescueDue(base({ now: new Date("2026-11-24T13:00:00Z"), sent: t1 }))).toBeNull();
    // 24 nov 10:00 CR: 24 h, pero no son las 7:00 del primer día que cumple las 24 h.
    expect(cardRescueDue(base({ now: new Date("2026-11-24T16:30:00Z"), sent: t1 }))).toBeNull();
    expect(cardRescueDue(base({ now: new Date("2026-11-25T12:59:00Z"), sent: t1 }))).toBeNull();
    expect(cardRescueDue(base({ now: new Date("2026-11-25T13:00:00Z"), sent: t1 }))).toBe("tarjeta_rescate_2");
    // Si la corrida de las 7:00 se perdió, sale más tarde ese mismo día; el día siguiente ya no.
    expect(cardRescueDue(base({ now: new Date("2026-11-25T20:00:00Z"), sent: t1 }))).toBe("tarjeta_rescate_2");
    expect(cardRescueDue(base({ now: new Date("2026-11-26T13:00:00Z"), sent: t1 }))).toBeNull();
  });
  it("paso a las 6:00: T2 el día siguiente a las 7:00 (25 h)", () => {
    const stepAt = "2026-11-23T12:00:00.000Z";
    expect(cardRescueDue(base({ stepAt, now: new Date("2026-11-24T13:00:00Z"), sent: [{ kind: "tarjeta_rescate_1", local_day: "2026-11-23" }] }))).toBe("tarjeta_rescate_2");
  });
  it("en la hora local de cada persona", () => {
    // 25 nov 7:00 en Ciudad de México (UTC-6) = 13:00 UTC; en Bogotá (UTC-5) = 12:00 UTC.
    expect(cardRescueDue(base({ timezone: "America/Bogota", now: new Date("2026-11-25T12:00:00Z") }))).toBe("tarjeta_rescate_2");
    expect(cardRescueDue(base({ timezone: "America/Bogota", now: new Date("2026-11-25T11:00:00Z") }))).toBeNull();
  });
  it("una sola vez por cuenta, y nada después de T2", () => {
    expect(cardRescueDue(base({ now: new Date("2026-11-25T14:00:00Z"), sent: [...t1, { kind: "tarjeta_rescate_2", local_day: "2026-11-25" }] }))).toBeNull();
  });
  it("sin atajo diario: en Buenos Aires (UTC-3) sale a las 7:00 locales, no en la corrida de las 13:00 UTC", () => {
    const ba = { timezone: "America/Argentina/Buenos_Aires", sent: t1 };
    // 25 nov 7:00 en Buenos Aires = 10:00 UTC.
    expect(cardRescueDue(base({ ...ba, now: new Date("2026-11-25T09:05:00Z") }))).toBeNull();
    expect(cardRescueDue(base({ ...ba, now: new Date("2026-11-25T10:05:00Z") }))).toBe("tarjeta_rescate_2");
    expect(cardRescueDue(base({ now: at(72), sent: t1 }))).toBeNull();
  });
  it("el cron se llama cada hora y este paso no depende de NOTIFY_CRON_MODE", async () => {
    const { readFileSync } = await import("node:fs");
    const wf = readFileSync(".github/workflows/recordatorios-cada-hora.yml", "utf8");
    expect(wf).toMatch(/cron: "\d+ \* \* \* \*"/);
    expect(wf).toMatch(/\/api\/cron\/recordatorios/);
    expect(readFileSync("src/lib/notify-run.ts", "utf8")).toMatch(/sendCardRescueEmails\(admin, now, stats, late\)/);
  });
});

describe("reglas", () => {
  it("se corta al guardar la tarjeta (o con un cobro abierto o un plan pagado)", () => {
    expect(cardRescueDue(base({ cards: 1 }))).toBeNull();
    expect(cardRescueDue(base({ chargeStatuses: ["scheduled"] }))).toBeNull();
    expect(cardRescueDue(base({ subs: [{ status: "active", current_period_start: STEP }] }))).toBeNull();
    // Un cobro cancelado no es una tarjeta.
    expect(cardRescueDue(base({ chargeStatuses: ["canceled"] }))).toBe("tarjeta_rescate_1");
  });
  it("solo cuentas desde CARD_REQUIRED_FROM", () => {
    expect(cardRescueDue(base({ createdAt: new Date(Date.parse(CARD_REQUIRED_FROM) - 1).toISOString() }))).toBeNull();
    expect(cardRescueDue(base({ createdAt: null }))).toBeNull();
  });
  it("máximo uno por día local", () => {
    // T1 salió el 24 a las 23:00 CR (en su ventana); el 25 a las 7:00 sí sale T2, pero no el mismo día de T1.
    const late = "2026-11-24T05:00:00.000Z"; // paso el 23 a las 23:00 CR
    expect(cardRescueDue(base({ stepAt: late, now: new Date("2026-11-24T13:00:00Z"), sent: [] }))).toBe("tarjeta_rescate_1");
    expect(cardRescueDue(base({ stepAt: STEP, now: new Date("2026-11-25T13:00:00Z"), sent: [{ kind: "tarjeta_rescate_1", local_day: "2026-11-25" }] }))).toBeNull();
  });
  it("respeta la baja de los recordatorios y las horas de silencio", () => {
    expect(cardRescueDue(base({ emailReminders: false }))).toBeNull();
    // Paso a las 21:30 CR, silencio de 22:00 a 8:00: T1 a las 22:30 no; a las 8:00 del día siguiente sí.
    const stepAt = "2026-11-24T03:30:00.000Z";
    expect(cardRescueDue(base({ stepAt, quietStart: "22:00", quietEnd: "08:00", now: new Date("2026-11-24T04:30:00Z") }))).toBeNull();
    expect(cardRescueDue(base({ stepAt, quietStart: "22:00", quietEnd: "08:00", now: new Date("2026-11-24T14:00:00Z") }))).toBe("tarjeta_rescate_1");
    // T2 con silencio hasta las 8:00: sale a las 8:00 del primer día cuyas 7:00 cumplen las 24 h.
    const t1 = [{ kind: "tarjeta_rescate_1", local_day: "2026-11-23" }];
    expect(cardRescueDue(base({ quietStart: "22:00", quietEnd: "08:00", now: new Date("2026-11-25T13:00:00Z"), sent: t1 }))).toBeNull();
    expect(cardRescueDue(base({ quietStart: "22:00", quietEnd: "08:00", now: new Date("2026-11-25T14:00:00Z"), sent: t1 }))).toBe("tarjeta_rescate_2");
  });
  it("la supresión de 0072 la hace sendEmail (una dirección suprimida no recibe nada)", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/lib/email/send.ts", "utf8")).toMatch(/isSuppressed\(to\)/);
    const run = readFileSync("src/lib/notify-run.ts", "utf8");
    expect(run).toMatch(/sendCardRescueEmails/);
    expect(run).toMatch(/idempotencyKey: rescueIdemKey\(p\.id, kind\)/);
  });
  it("llaves, enlace y email_click", () => {
    expect(rescueIdemKey("u1", "tarjeta_rescate_2")).toBe("tarjeta_rescate_2/u1");
    expect(rescuePath("tarjeta_rescate_1")).toBe("/bienvenida?e=tarjeta_rescate_1");
    expect([...EMAIL_CLICK_KINDS]).toEqual(expect.arrayContaining([...RESCUE_KINDS]));
  });
});

describe("textos", () => {
  const unsubscribe = "https://bananaburn.app/api/email/baja?token=x";
  const mail = (kind: "tarjeta_rescate_1" | "tarjeta_rescate_2", locale?: "es-419" | "en-US", home = true) =>
    tarjetaRescate({ kind, goal: "grasa", days: 4, home, unsubscribe, locale });

  it("español: asunto, plan elegido, cobro honesto y botón al paso de la tarjeta", () => {
    const t1 = mail("tarjeta_rescate_1");
    expect(t1.subject).toBe("Tu plan ya está armado: falta un paso");
    expect(t1.text).toContain("Tu plan para bajar grasa ya está armado: 4 entrenos por semana");
    expect(t1.text).toContain("Hoy no se cobra nada. Tienes 7 días gratis y te avisamos 2 días antes del cobro.");
    expect(t1.text).toContain("El día 8 se cobra el primer mes de tu plan con 50 % de descuento: $4.99 con Entreno");
    expect(t1.text).toContain("Cancelas cuando quieras desde Mi plan.");
    expect(t1.text).toContain(`Dejar mi tarjeta: ${SITE_URL}/bienvenida?e=tarjeta_rescate_1`);
    expect(mail("tarjeta_rescate_2").subject).toBe("Tu primer entreno de 12 min te está esperando");
    expect(mail("tarjeta_rescate_2").text).toContain("/bienvenida?e=tarjeta_rescate_2");
    // Sin el primer entreno en casa (no eligió gym o mixto) no se prometen los 12 minutos.
    expect(mail("tarjeta_rescate_2", undefined, false).subject).toBe("Tu primer entreno te está esperando");
    expect(mail("tarjeta_rescate_2", undefined, false).text).not.toMatch(/12 min/);
    // Sin datos del plan, una frase sin ellos.
    expect(tarjetaRescate({ kind: "tarjeta_rescate_1", goal: null, days: null, home: true, unsubscribe }).text).toContain("Tu plan ya está armado con tus días");
  });

  it("inglés: todo traducido", () => {
    const SPANISH = /\b(tu|tus|de|del|que|para|con|los|las|el|entreno|prueba|correo|Recibes|tarjeta|cobra)\b/i;
    for (const [kind, home] of [["tarjeta_rescate_1", true], ["tarjeta_rescate_2", true], ["tarjeta_rescate_2", false]] as const) {
      const e = mail(kind, "en-US", home);
      const visible = [e.subject, e.preheader, e.text.replace(/https?:\S+/g, ""), e.html.replace(/<[^>]+>/g, " ").replace(/https?:\S+/g, "")].join("\n");
      expect(visible, kind).not.toMatch(SPANISH);
      expect(e.html).toContain('<html lang="en">');
    }
    expect(mail("tarjeta_rescate_1", "en-US").subject).toBe("Your plan is ready: one step left");
    const pieces = [...Object.values(CARD_RESCUE_MAILS).flatMap((c) => [c.subject, c.preheader, c.lead]), CARD_RESCUE_CTA, ...CARD_RESCUE_BILLING, ...Object.values(RESCUE_GOAL)];
    for (const s of pieces) expect(hasTranslation("en-US", s), s).toBe(true);
  });

  it("sin emojis, sin exclamaciones ni urgencia falsa, de tú", () => {
    for (const locale of ["es-419", "en-US"] as const) for (const kind of RESCUE_KINDS) {
      const e = mail(kind, locale);
      expect(e.subject + e.text).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(e.subject + e.text).not.toMatch(/[!¡]|última oportunidad|solo hoy|last chance|hurry/i);
      expect(e.text).not.toMatch(/\busted\b/i);
    }
  });

  it("el botón entra sin contraseña y abre directo en el paso de la tarjeta", () => {
    const user = "11111111-1111-4111-8111-111111111111";
    const e = withLoginLinks(mail("tarjeta_rescate_1"), user, { secret: "s", site: SITE_URL });
    expect(e.text).toContain(`${SITE_URL}/auth/correo?t=`);
    expect(e.text).toContain("&next=%2Fbienvenida%3Fe%3Dtarjeta_rescate_1");
    expect(e.html).toContain("next=%2Fbienvenida%3Fe%3Dtarjeta_rescate_1");
    // La baja no se toca.
    expect(e.text).toContain(unsubscribe);
  });
});

describe("eventos del paso de la tarjeta (sin datos personales)", () => {
  it("card_form_start, card_step_error y card_tilopay_hint con el `where` del pedido", () => {
    expect(cleanEvent({ name: "card_form_start", props: { where: "bienvenida", email: "a@b.co" } })).toEqual({ name: "card_form_start", props: { where: "bienvenida" } });
    expect(cleanEvent({ name: "card_form_start", props: {} })).toBeNull();
    expect(cleanEvent({ name: "card_step_error", props: { where: "bienvenida", reason: "rechazada", code: "issuer_declined" } })).toEqual({ name: "card_step_error", props: { where: "bienvenida", reason: "rechazada" } });
    // El código crudo del procesador no entra.
    expect(cleanEvent({ name: "card_step_error", props: { where: "bienvenida", reason: "issuer_declined" } })).toBeNull();
    expect(cleanEvent({ name: "card_step_error", props: { reason: "rechazada" } })).toBeNull();
    expect(cleanEvent({ name: "card_tilopay_hint", props: { where: "bienvenida" } })).toEqual({ name: "card_tilopay_hint", props: { where: "bienvenida" } });
  });
  it("email_click solo con un correo conocido", () => {
    expect(cleanEvent({ name: "email_click", props: { e: "tarjeta_rescate_2", path: "/bienvenida" } })).toEqual({ name: "email_click", props: { e: "tarjeta_rescate_2", path: "/bienvenida" } });
    expect(cleanEvent({ name: "email_click", props: { e: "a@b.co" } })).toBeNull();
  });
  it("/admin/embudo: la fila Bienvenida muestra vieron, empezaron, error y guardaron", () => {
    const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    const profiles = [1, 2, 3].map((n) => ({ id: u(n), created_at: "2026-11-23T10:00:00.000Z", role: "free", country: "CR" }));
    const ask = (n: number, name: string) => ({ user_id: u(n), name, where: "bienvenida" });
    const cardAsks = [ask(1, "card_ask_view"), ask(2, "card_ask_view"), ask(3, "card_ask_view"), ask(1, "card_form_start"), ask(2, "card_form_start"), ask(2, "card_step_error"), ask(1, "card_saved")];
    const rows = cardAskTable(buildAccounts({ profiles, testers: [], cardAsks } as never, new Date("2026-11-25T00:00:00Z")))!;
    expect(rows.find((r) => r.where === "bienvenida")).toMatchObject({ view: 3, start: 2, error: 1, saved: 1 });
  });
});
