// #269: desde el 1 de enero de 2027 (00:00 de Costa Rica) el registro pide la tarjeta. Antes y después de la fecha: el
// interruptor, el acceso (entitlements), los condominios (decideJoin), el paso de la bienvenida y los textos públicos.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { prerender } from "react-dom/static.edge";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ STAFF: ["admin", "superadmin"], createClient: async () => ({}) }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }), usePathname: () => "/bienvenida", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/condominios/lead-form", () => ({ LeadForm: () => <form aria-label="Solicitud de reunión" /> }));

const { CARD_COPY_PATHS, CARD_REQUIRED_FROM, cardRequiredDemo, cardRequiredFor, cardRequiredNow, cardSwitchDay } = await import("./card-required");
const { entitlementsFrom } = await import("./entitlements");
const { CONDO_FREE_DAYS, CONDO_TRY_DAYS, condoForAccount, condoFreeEnd, condoWhatsapp, decideJoin } = await import("./condos");
const { offer } = await import("./offer");
const { cardStepFor, cardTrialReady, kindFor, promoFor, firstChargeMinor, scheduleFor } = await import("./trial");
const { Wizard, requiredLine } = await import("@/app/bienvenida/wizard");
const Precios = (await import("@/app/(marketing)/precios/page")).default;
const Glp1 = await import("@/app/(marketing)/glp1/page");
const Running = (await import("@/app/(marketing)/running/page")).default;
const Temporadas = (await import("@/app/(marketing)/temporadas/page")).default;
const Terminos = (await import("@/app/(marketing)/terminos/page")).default;
const Condominios = (await import("@/app/condominios/page")).default;
const { faq, homeFaq } = await import("@/app/(marketing)/content");

const DAY = 864e5;
const FROM = Date.parse(CARD_REQUIRED_FROM);
/** 31 de diciembre de 2026 a las 23:59 de Costa Rica (UTC-6). */
const DEC31_2359 = new Date(FROM - 60_000).toISOString();
/** 1 de enero de 2027 a las 00:00 de Costa Rica. */
const JAN1_0000 = CARD_REQUIRED_FROM;
const at = (iso: string, days = 0) => new Date(Date.parse(iso) + days * DAY);
const CARD = { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030, status: "active" as const };
const row = (createdAt: string, o: Record<string, unknown> = {}) => {
  const s = scheduleFor("prueba", new Date(createdAt), undefined, undefined, createdAt);
  return { id: 1, user_id: "u", idem_key: "trial:u", kind: "prueba" as const, plan: "entreno" as const, billing: "mes" as const, amount_minor: 499, promo: "primer_mes_50" as const, trial_started_at: s.trialStartedAt, trial_ends_at: s.trialEndsAt, charge_at: s.chargeAt, next_attempt_at: s.chargeAt, status: "scheduled" as const, attempts: 0, last_attempt_at: null, provider_subscription_id: null, last_error: null, reminder_sent_at: null, failure_notified_attempt: null, canceled_at: null, created_at: s.trialStartedAt, updated_at: s.trialStartedAt, ...o };
};
const ent = (createdAt: string, now: Date, o: Record<string, unknown> = {}) => entitlementsFrom({ profilePlan: "free", role: "free", createdAt, subs: [], now, ...o });
const nb = (s: string) => s.replace(/\u00a0/g, " ");
const text = (html: string) => nb(html).replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const withClock = <T,>(now: Date, fn: () => T): T => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now); return fn(); };

afterEach(() => { vi.useRealTimers(); });

describe("el interruptor por fecha (card-required.ts)", () => {
  it("es la medianoche del 1 de enero de 2027 en Costa Rica", () => {
    expect(CARD_REQUIRED_FROM).toBe("2027-01-01T06:00:00.000Z");
    expect(new Date(CARD_REQUIRED_FROM).toLocaleString("es-419", { timeZone: "America/Costa_Rica", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })).toMatch(/1 de enero de 2027.*00:00/);
  });
  it("una cuenta del 31 dic a las 23:59 de Costa Rica sigue sin tarjeta; una del 1 ene a las 00:00 la necesita", () => {
    expect(cardRequiredFor(DEC31_2359)).toBe(false);
    expect(cardRequiredFor(JAN1_0000)).toBe(true);
    expect(cardRequiredFor(null)).toBe(false);
    expect(cardRequiredNow(new Date(DEC31_2359))).toBe(false);
    expect(cardRequiredNow(new Date(JAN1_0000))).toBe(true);
  });
  it("el cron de cobros (00:20 de Costa Rica) regenera ese día las páginas públicas en caché", () => {
    expect(cardSwitchDay(new Date(DEC31_2359))).toBe(false);
    expect(cardSwitchDay(new Date("2027-01-01T06:20:00Z"))).toBe(true);
    expect(cardSwitchDay(new Date("2027-01-02T06:20:00Z"))).toBe(false);
    expect([...CARD_COPY_PATHS]).toEqual(["/", "/anuncio/reel_cuanto_peso", "/anuncio/reel_gym_condominio", "/anuncio/reel_casa_gym_parque", "/anuncio/reel_nadie_te_mira", "/precios", "/glp1", "/running", "/temporadas", "/terminos", "/llms.txt"]);
    expect(readFileSync("src/app/api/cron/cobros/route.ts", "utf8")).toContain("if (cardSwitchDay()) for (const p of CARD_COPY_PATHS)");
    expect(readFileSync("vercel.json", "utf8")).toContain('"schedule": "20 6 * * *"');
  });
  it("solo en demo, ?tarjeta=obligatoria lo activa", () => {
    expect(cardRequiredDemo(true, "obligatoria")).toBe(true);
    expect(cardRequiredDemo(false, "obligatoria")).toBe(false);
    expect(cardRequiredDemo(true, undefined)).toBe(false);
  });
});

describe("acceso (entitlements) antes y después de la fecha", () => {
  it("cuenta del 31 dic a las 23:59: 7 días gratis sin tarjeta, como hoy", () => {
    const e = ent(DEC31_2359, at(DEC31_2359, 1));
    expect(e).toMatchObject({ access: "trial", app: true, nutrition: true, locked: false, cardStep: "trial" });
  });
  it("cuenta del 1 ene a las 00:00 sin tarjeta: bloqueada y lleva a dejar la tarjeta, no al muro de planes", () => {
    const e = ent(JAN1_0000, at(JAN1_0000, 0.01));
    expect(e).toMatchObject({ access: "none", app: false, nutrition: false, locked: true, trial: null, cardStep: "card" });
  });
  it("con la tarjeta activa y el cobro programado: su prueba de 7 días con todo incluido", () => {
    const e = ent(JAN1_0000, at(JAN1_0000, 1), { trialCharge: row(JAN1_0000), card: CARD });
    expect(e).toMatchObject({ access: "trial", app: true, nutrition: true, locked: false, cardStep: "none" });
    expect(e.trial?.daysLeft).toBe(6);
    expect(e.charge).toMatchObject({ phase: "programado", amount: 4.99, promo: true, chargeAt: at(JAN1_0000, 7).toISOString() });
  });
  it("un cobro programado sin tarjeta activa no cuenta; cancelar antes del fin conserva el acceso hasta ese día", () => {
    expect(ent(JAN1_0000, at(JAN1_0000, 1), { trialCharge: row(JAN1_0000), card: { ...CARD, status: "disconnected" } }).cardStep).toBe("card");
    expect(ent(JAN1_0000, at(JAN1_0000, 1), { trialCharge: row(JAN1_0000), card: null }).locked).toBe(true);
    const canceled = row(JAN1_0000, { status: "canceled", canceled_at: at(JAN1_0000, 1).toISOString() });
    expect(ent(JAN1_0000, at(JAN1_0000, 2), { trialCharge: canceled, card: { ...CARD, status: "disconnected" } })).toMatchObject({ access: "trial", locked: false });
    expect(ent(JAN1_0000, at(JAN1_0000, 7.1), { trialCharge: canceled, card: CARD })).toMatchObject({ locked: true, cardStep: "pay" });
  });
  it("sin tarjeta después de sus 7 días: el muro (guardarla cobra en ese momento)", () => {
    expect(ent(JAN1_0000, at(JAN1_0000, 8))).toMatchObject({ locked: true, cardStep: "pay" });
    expect(kindFor({ createdAt: JAN1_0000, now: at(JAN1_0000, 8) })).toBe("inmediato");
  });
  it("con un plan o la cortesía de un condominio no hace falta: la regla es solo de la prueba", () => {
    const comp = { plan: "completo", previous_plan: "free", starts_at: JAN1_0000, expires_at: at(JAN1_0000, CONDO_TRY_DAYS).toISOString(), revoked_at: null, created_at: JAN1_0000, source: "condominio" };
    expect(ent(JAN1_0000, at(JAN1_0000, 1), { comps: [comp] })).toMatchObject({ access: "comp", locked: false, cardStep: "none" });
  });
  it("cardTrialReady y cardStepFor por separado", () => {
    expect(cardTrialReady(null, CARD)).toBe(false);
    expect(cardTrialReady(row(JAN1_0000), CARD)).toBe(true);
    expect(cardStepFor({ paidAccess: false, createdAt: JAN1_0000, row: null, now: at(JAN1_0000, 1), needsCard: true })).toBe("card");
    expect(cardStepFor({ paidAccess: true, createdAt: JAN1_0000, row: null, now: at(JAN1_0000, 1), needsCard: true })).toBe("none");
  });
  it("la tarjeta del registro programa el cobro del día 8 con el 50 % del primer mes (mensual)", () => {
    const now = at(JAN1_0000, 0.01);
    const kind = kindFor({ createdAt: JAN1_0000, now });
    expect(kind).toBe("prueba");
    const promo = promoFor(kind, false);
    expect(firstChargeMinor("entreno", "mes", promo)).toBe(499);
    expect(firstChargeMinor("completo", "mes", promo)).toBe(749);
    expect(firstChargeMinor("completo", "anual", promo)).toBe(8999);
    expect(scheduleFor(kind, now, undefined, undefined, JAN1_0000).chargeAt).toBe("2027-01-08T06:00:00.000Z");
  });
});

describe("condominios (decideJoin) antes y después de la fecha", () => {
  const condo = { id: 1, status: "mes_gratis" as const, paid_plan: null, paid_until: null, free_ends_at: null };
  const now = at(JAN1_0000, 2);
  const base = { condo, memberOf: null, hadCondoGrant: false, hasPaidPlan: false, now };
  it("cuenta de antes: el mes gratis de siempre, sin tarjeta", () => {
    expect(decideJoin({ ...base, createdAt: DEC31_2359 })).toEqual({ kind: "join", plan: "completo", expiresAt: at(now.toISOString(), CONDO_FREE_DAYS).toISOString(), free: true, card: false });
  });
  it("cuenta nueva: todos los condominios piden la tarjeta, primero se prueba y la tarjeta da el resto del mes", () => {
    expect(decideJoin({ ...base, createdAt: JAN1_0000 })).toEqual({ kind: "join", plan: "completo", expiresAt: at(now.toISOString(), CONDO_TRY_DAYS).toISOString(), free: true, card: true, pendingCard: true, freeEnd: at(now.toISOString(), CONDO_FREE_DAYS).toISOString() });
    expect(decideJoin({ ...base, createdAt: JAN1_0000, cardReady: true })).toEqual({ kind: "join", plan: "completo", expiresAt: at(now.toISOString(), CONDO_FREE_DAYS).toISOString(), free: true, card: true });
  });
  it("el fin del mes gratis cuenta desde que lo activó; free_until es solo de Soho Paradisus", () => {
    expect(condoFreeEnd({}, JAN1_0000)).toBe(at(JAN1_0000, CONDO_FREE_DAYS).toISOString());
    expect(condoFreeEnd({ free_until: "2027-01-01T06:00:00Z" }, "2026-11-20T12:00:00Z")).toBe("2027-01-01T06:00:00.000Z");
    expect(condoForAccount({ card_required: false }, DEC31_2359).card_required).toBe(false);
    expect(condoForAccount({ card_required: false }, JAN1_0000).card_required).toBe(true);
  });
  it("un condominio activo (lo paga el condominio) no pide tarjeta", () => {
    const paid = { ...condo, status: "activo" as const, paid_plan: "entreno" as const, paid_until: at(JAN1_0000, 60).toISOString() };
    expect(decideJoin({ ...base, condo: paid, createdAt: JAN1_0000 })).toMatchObject({ kind: "join", card: false });
  });
  it("el mensaje de WhatsApp deja de decir que no se necesita tarjeta", () => {
    const c = { name: "Las Palmas", code: "las-palmas" };
    expect(condoWhatsapp(c, new Date(DEC31_2359))).toContain("No se necesita tarjeta.");
    const after = condoWhatsapp(c, new Date(JAN1_0000));
    expect(after).not.toContain("No se necesita tarjeta");
    expect(after).toContain("dejas tu tarjeta y sigues gratis hasta completar el mes");
  });
});

describe("bienvenida: el paso de la tarjeta obligatoria", () => {
  const props = { name: "Ana", demo: true, initialGoal: null, glp1: false, country: "CR", intent: null, trialEndsAt: "2027-01-08T06:00:00.000Z", chargeAt: "2027-01-08T06:00:00.000Z", startOnCard: true };
  it("con la tarjeta obligatoria: sin \"Empezar gratis sin tarjeta\" ni \"La tarjeta es opcional\", y con el texto del cobro", () => {
    const t = text(renderToStaticMarkup(<Wizard {...props} cardOffer cardRequired />));
    expect(t).toContain("Deja tu tarjeta para empezar tus 7 días gratis");
    expect(t).toContain("Hoy no se cobra nada. El 8 de enero se cobra $7.49, tu primer mes con 50 %. Cancela cuando quieras desde Mi plan. Te avisamos 2 días antes.");
    expect(t).not.toMatch(/sin tarjeta|opcional/i);
  });
  it("al volver con el plan ya guardado abre directo en la tarjeta, sin volver atrás", () => {
    const html = renderToStaticMarkup(<Wizard {...props} demo={false} startOnCard cardRequired onboarded />);
    expect(text(html)).toContain("Deja tu tarjeta para empezar tus 7 días gratis");
    expect(html).not.toContain('aria-label="Atrás"');
  });
  it("antes de la fecha (demo ?vista=tarjeta) sigue el paso opcional de siempre", () => {
    const t = text(renderToStaticMarkup(<Wizard {...props} cardOffer />));
    expect(t).toContain("La tarjeta es opcional");
    expect(t).toContain("Empezar gratis sin tarjeta");
  });
  it("el texto principal dice que hoy no se cobra, cuándo y cuánto, cómo cancelar y el aviso", () => {
    expect(nb(requiredLine("8 de enero", { plan: "entreno", billing: "mes" }))).toBe("Hoy no se cobra nada. El 8 de enero se cobra $4.99, tu primer mes con 50 %. Cancela cuando quieras desde Mi plan. Te avisamos 2 días antes.");
    expect(requiredLine("8 de enero", { plan: "completo", billing: "anual" })).toBe("Hoy no se cobra nada. El 8 de enero se cobran $89.99 del plan anual. Cancela cuando quieras desde Mi plan. Te avisamos 2 días antes.");
  });
});

/** Textos públicos que no pueden decir "sin tarjeta" desde el 1 de enero. */
const NO_CARD = /sin tarjeta|tarjeta es opcional|no necesitas tarjeta|no se necesita tarjeta|nadie necesita tarjeta|no pide tarjeta/i;

describe("textos públicos antes y después de la fecha", () => {
  const before = new Date(DEC31_2359), after = new Date(JAN1_0000);
  it("offer(): ningún texto dice \"sin tarjeta\" desde el 1 de enero", () => {
    const strings = (o: ReturnType<typeof offer>) => Object.values(o).map((v) => (typeof v === "function" ? (v as (x: unknown) => string)(1) : String(v))).join(" ");
    expect(offer(before).cardRequired).toBe(false);
    expect(strings(offer(before))).toMatch(/sin tarjeta/);
    expect(offer(after).cardRequired).toBe(true);
    expect(strings(offer(after))).not.toMatch(NO_CARD);
    expect(offer(after).faqTrial("Entreno + Nutrición")).toContain("dejas tu tarjeta");
    expect(nb(offer(after).faqTrial("Entreno + Nutrición"))).toContain("el día 8 se cobra tu primer mes con 50 % de descuento");
  });
  it("preguntas frecuentes del inicio y de precios", () => {
    const all = (now: Date) => [...faq(now), ...homeFaq(now)].flat().join(" ");
    expect(all(before)).toMatch(/sin tarjeta/);
    expect(all(after)).not.toMatch(NO_CARD);
  });
  const pages: [string, () => React.ReactElement][] = [
    ["/precios", () => <Precios />],
    ["/glp1", () => <Glp1.default />],
    ["/running", () => <Running />],
    ["/temporadas", () => <Temporadas />],
  ];
  for (const [name, el] of pages) {
    it(`${name}: dice "sin tarjeta" el 31 de diciembre y nunca desde el 1 de enero`, () => {
      expect(withClock(before, () => text(renderToStaticMarkup(el())))).toMatch(/sin tarjeta/i);
      const html = withClock(after, () => renderToStaticMarkup(el()));
      expect(text(html)).not.toMatch(NO_CARD);
      expect(html).not.toMatch(NO_CARD);
    });
  }
  it("inicio (la landing): \"Sin tarjeta\" hasta el 31 de diciembre, nunca desde el 1 de enero", async () => {
    const Home = (await import("@/app/(marketing)/page")).default as unknown as () => Promise<React.ReactElement>;
    const html = async (now: Date) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now); const { prelude } = await prerender(await Home()); return text(await new Response(prelude).text()); };
    expect(await html(before)).toMatch(/sin tarjeta/i);
    const t = await html(after);
    expect(t).not.toMatch(NO_CARD);
    expect(t).toContain("Hoy no se cobra nada");
  }, 20_000);
    it("/glp1: la descripción para buscadores también cambia", () => {
    expect(JSON.stringify(withClock(before, () => Glp1.generateMetadata()))).toContain("sin tarjeta");
    expect(JSON.stringify(withClock(after, () => Glp1.generateMetadata()))).not.toMatch(NO_CARD);
  });
  it("/terminos: las cuentas nuevas dejan la tarjeta y las de antes conservan sus reglas", () => {
    expect(withClock(before, () => text(renderToStaticMarkup(<Terminos />)))).toContain("sin tarjeta");
    const t = withClock(after, () => text(renderToStaticMarkup(<Terminos />)));
    // "Sin tarjeta" solo queda en el párrafo de las reglas de las cuentas de antes (y de la beta).
    const i = t.indexOf("Las cuentas creadas antes del 1 de enero de 2027");
    const end = t.indexOf("sin tarjeta.", t.indexOf("acceso anticipado", i)) + "sin tarjeta.".length;
    expect(i).toBeGreaterThan(0);
    expect(t.slice(0, i) + t.slice(end)).not.toMatch(NO_CARD);
    expect(t).toContain("Desde el 1 de enero de 2027, al crear tu cuenta dejas tu tarjeta para empezar tu prueba gratis de 7 días");
    expect(t).toContain("Las cuentas creadas antes del 1 de enero de 2027 conservan sus reglas");
  });
  it("/condominios: el primer mes sigue gratis y se completa con la tarjeta", async () => {
    const render = async (now: Date) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now); return text(renderToStaticMarkup(await Condominios({ searchParams: Promise.resolve({}) }))); };
    expect(await render(before)).toContain("Primer mes gratis con entreno y nutrición, sin tarjeta");
    const t = await render(after);
    expect(t).toContain("Primer mes gratis con entreno y nutrición");
    expect(t).toContain(`prueba ${CONDO_TRY_DAYS} días gratis sin tarjeta. Si le gusta, deja su tarjeta`);
    expect(t).not.toMatch(/nadie necesita tarjeta|nadie deja tarjeta|Sus 30 días empiezan cuando activa el beneficio, sin tarjeta/);
  });
});
