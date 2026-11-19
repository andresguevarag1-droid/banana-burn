// #329: consentimiento del cobro recurrente. El texto que va arriba del botón (montos reales de plans.ts y del 50 %), que las
// pantallas lo muestren antes del botón, y la migración 0074 (idempotente, la persona lee lo suyo y solo service_role escribe).
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }), usePathname: () => "/bienvenida", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

const { CONSENT_VERSION, consentAmounts, consentBody, consentFor, consentGiven, consentLine, ipCountryOf } = await import("./billing-consent");
const { tr } = await import("./i18n/t");
const { Wizard } = await import("@/app/bienvenida/wizard");
const Terminos = (await import("@/app/(marketing)/terminos/page")).default;
const { CardPanel } = await import("@/app/(app)/app/suscripcion/card-panel");

const nb = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
const text = (html: string) => nb(html).replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/\s+/g, " ");
const BTN = "Empezar mis 7 días gratis";

describe("texto del consentimiento", () => {
  it("mensual: el día 8 se cobra el primer mes con 50 % y luego el precio normal cada mes", () => {
    expect(nb(consentLine({ button: BTN, plan: "entreno", billing: "mes", promo: true, day: "30 de noviembre" }))).toBe(
      "Al tocar «Empezar mis 7 días gratis» autorizas que el 30 de noviembre se cobre $4.99 (Entreno) y luego $9.99 cada mes, hasta que canceles en Mi plan. Hoy no se cobra nada.");
    expect(nb(consentLine({ button: BTN, plan: "completo", billing: "mes", promo: true, day: "30 de noviembre" }))).toContain("se cobre $7.49 (Entreno + Nutrición) y luego $14.99 cada mes");
  });

  it("anual: sin el 50 %, el precio del año y luego lo mismo cada año", () => {
    expect(nb(consentLine({ button: BTN, plan: "completo", billing: "anual", promo: true, day: "30 de noviembre" }))).toBe(
      "Al tocar «Empezar mis 7 días gratis» autorizas que el 30 de noviembre se cobre $89.99 (Entreno + Nutrición) y luego $89.99 cada año, hasta que canceles en Mi plan. Hoy no se cobra nada.");
  });

  it("sin el 50 % (condominio), sin fecha (al terminar la prueba) y con el cobro de hoy", () => {
    expect(nb(consentLine({ button: "Seguir", plan: "entreno", billing: "mes", promo: false, day: "1 de enero" }))).toContain("el 1 de enero se cobre $9.99 (Entreno) y luego $9.99 cada mes");
    expect(nb(consentLine({ button: BTN, plan: "entreno", billing: "mes", promo: true, day: null }))).toContain("al terminar tu prueba se cobre $4.99");
    const hoy = nb(consentLine({ button: "Guardar tarjeta y pagar $9.99", plan: "entreno", billing: "mes", promo: false, day: null, today: true }));
    expect(hoy).toBe("Al tocar «Guardar tarjeta y pagar $9.99» autorizas que hoy se cobre $9.99 (Entreno) y luego $9.99 cada mes, hasta que canceles en Mi plan.");
    expect(hoy).not.toContain("Hoy no se cobra nada");
  });

  it("en inglés", () => {
    const t = tr("en-US");
    expect(nb(consentLine({ button: t("Empezar mis {n} días gratis", { n: 7 }), plan: "entreno", billing: "mes", promo: true, day: "November 30" }, t))).toBe(
      "By tapping “Start my 7 free days” you authorize a charge of $4.99 (Training) on November 30, then $9.99 every month, until you cancel in My plan. Nothing is charged today.");
    expect(consentLine({ button: "X", plan: "completo", billing: "anual", promo: false, day: null, today: true }, t)).toBe(
      "By tapping “X” you authorize a charge of $89.99 (Training + Nutrition) today, then $89.99 every year, until you cancel in My plan.");
  });

  it("montos en centavos para el registro; solo la versión vigente cuenta como aceptada; solo el país, nunca la IP", () => {
    expect(consentAmounts("entreno", "mes", true)).toEqual({ firstMinor: 499, fullMinor: 999 });
    expect(consentAmounts("entreno", "anual", true)).toEqual({ firstMinor: 5999, fullMinor: 5999 });
    // Se guarda lo que la pantalla mostró: la versión y los dos montos (consentBody de card-form.tsx).
    const shown = consentFor({ button: BTN, plan: "entreno", billing: "mes", promo: true, day: null });
    expect(consentGiven(consentBody(shown))).toEqual({ firstMinor: 499, fullMinor: 999 });
    expect(consentGiven(CONSENT_VERSION)).toBeNull();
    expect(consentGiven(true)).toBeNull();
    expect(consentGiven({ ...consentBody(shown), version: "2020-01-01" })).toBeNull();
    expect(consentGiven({ version: CONSENT_VERSION, first_amount_minor: 499 })).toBeNull();
    expect(consentGiven({ version: CONSENT_VERSION, first_amount_minor: "499", full_amount_minor: 999 })).toBeNull();
    expect(ipCountryOf(new Headers({ "x-vercel-ip-country": "cr", "x-forwarded-for": "201.1.2.3" }))).toBe("CR");
    expect(ipCountryOf(new Headers({ "x-vercel-ip-country": "201.1.2.3" }))).toBeNull();
  });
});

describe("pantallas: el texto va justo arriba del botón", () => {
  const props = { name: "Ana", demo: true, initialGoal: null, glp1: false, country: "CR", intent: null, trialEndsAt: "2026-11-30T06:00:00.000Z", chargeAt: "2026-11-30T06:00:00.000Z", startOnCard: true };
  it("bienvenida con la tarjeta obligatoria", () => {
    const html = renderToStaticMarkup(<Wizard {...props} cardOffer cardRequired />);
    const t = text(html);
    const consent = "Al tocar «Empezar mis 7 días gratis» autorizas que el 30 de noviembre se cobre $7.49 (Entreno + Nutrición) y luego $14.99 cada mes, hasta que canceles en Mi plan. Hoy no se cobra nada.";
    expect(t).toContain(consent);
    const at = html.indexOf(`data-consent="${CONSENT_VERSION}"`);
    expect(at).toBeGreaterThan(0);
    // Lo siguiente después del texto es el botón que guarda la tarjeta.
    expect(html.slice(at).match(/<(p|div|label|input|button)\b/)![0]).toBe("<button");
  });

  it("bienvenida en inglés", () => {
    const t = text(renderToStaticMarkup(<Wizard {...props} locale="en-US" cardOffer cardRequired />));
    expect(t).toContain("you authorize a charge of $7.49 (Training + Nutrition) on November 30, then $14.99 every month, until you cancel in My plan.");
  });

  it("Mi plan con la tarjeta obligatoria (step card): mensual con el 50 %, como la bienvenida y el cobro programado; anual al precio normal", () => {
    const panel = (billing: "mes" | "anual", promoLost = false) => text(renderToStaticMarkup(<CardPanel step="card" charge={null} card={null} demo payments
      initial={{ plan: "entreno", billing }} tz="America/Costa_Rica" betaFirstPaid="8 de noviembre" trialEndsAt="2026-11-30T15:00:00.000Z" promoLost={promoLost} />));
    expect(panel("mes")).toContain("Al tocar «Empezar mis 7 días gratis» autorizas que el 30 de noviembre se cobre $4.99 (Entreno) y luego $9.99 cada mes, hasta que canceles en Mi plan. Hoy no se cobra nada.");
    expect(panel("mes")).toContain("se cobra $4.99 , tu primer mes con 50 %");
    expect(panel("anual")).toContain("el 30 de noviembre se cobre $59.99 (Entreno) y luego $59.99 cada año");
    // Vuelta de Tilopay con una tarjeta que ya usó el 50 % (?tilopay=monto): el texto dice el precio normal.
    expect(panel("mes", true)).toContain("el 30 de noviembre se cobre $9.99 (Entreno) y luego $9.99 cada mes");
  });

  it("todos los formularios que pueden programar un cobro mandan el consentimiento", () => {
    for (const f of ["src/app/bienvenida/wizard.tsx", "src/app/(app)/app/suscripcion/card-panel.tsx", "src/app/c/[code]/condo-card.tsx", "src/components/workout/first-set-card-ask.tsx"]) {
      expect(readFileSync(f, "utf8"), f).toMatch(/consent=\{\(promo = [\w.]+\) => consentFor\(/);
    }
    const form = readFileSync("src/components/pagos/card-form.tsx", "utf8");
    // ONVO (guardar) y Tilopay (antes de salir a su página) mandan la versión aceptada.
    expect(form.match(/\.\.\.accepted/g)).toHaveLength(2);
  });

  it("/terminos: sección Cobro recurrente y cómo cancelar", () => {
    const t = text(renderToStaticMarkup(<Terminos />));
    expect(t).toContain("Cobro recurrente y cómo cancelar");
    expect(t).toContain("Al tocar el botón autorizas ese cobro recurrente hasta que canceles en Mi plan.");
    expect(t).toContain("con el 50 % de descuento si te toca (por ejemplo, $4.99), y luego se cobra $9.99 cada mes");
    expect(t).toContain("nunca la dirección IP completa");
  });
});

describe("0074_consentimiento_cobro.sql", () => {
  it("se aplica dos veces; la persona lee solo los suyos y no escribe; service_role escribe", async () => {
    const pg = new PGlite({ extensions: { pgcrypto } });
    await pg.exec(readFileSync("supabase/tests/stub.sql", "utf8"));
    await pg.exec(readFileSync("supabase/migrations/0001_init.sql", "utf8"));
    const sql = readFileSync("supabase/migrations/0074_consentimiento_cobro.sql", "utf8");
    await pg.exec(sql);
    await pg.exec(sql);
    const a = "00000000-0000-4000-8000-00000000000a", b = "00000000-0000-4000-8000-00000000000b";
    await pg.exec(`insert into auth.users (id) values ('${a}'), ('${b}')`);
    const row = (u: string) => `insert into public.billing_consents (user_id, text_version, plan, billing, first_amount_minor, full_amount_minor, first_charge_at, processor, ip_country)
      values ('${u}', '${CONSENT_VERSION}', 'entreno', 'mes', 499, 999, '2026-11-30 06:00+00', 'onvo', 'CR')`;
    await pg.exec(`set role service_role; ${row(a)}; ${row(b)}; reset role`);
    await expect(pg.exec(`${row(a).replace("'CR'", "'201.1.2.3'")}`)).rejects.toThrow();

    await pg.exec(`set role authenticated; select set_config('request.jwt.claims', '{"sub":"${a}","role":"authenticated"}', false)`);
    const { rows } = await pg.query<{ user_id: string; first_amount_minor: number }>("select user_id, first_amount_minor from public.billing_consents");
    expect(rows).toEqual([{ user_id: a, first_amount_minor: 499 }]);
    await expect(pg.exec(row(a))).rejects.toThrow();
    await expect(pg.exec("update public.billing_consents set first_amount_minor = 1")).rejects.toThrow();
    await expect(pg.exec("delete from public.billing_consents")).rejects.toThrow();
    await pg.exec("reset role");
    const { rows: rls } = await pg.query<{ rls: boolean }>("select relrowsecurity as rls from pg_class where relname = 'billing_consents'");
    expect(rls[0].rls).toBe(true);
    await pg.close();
  });
});
