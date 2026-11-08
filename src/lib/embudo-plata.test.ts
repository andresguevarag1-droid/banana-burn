// Embudo de plata (#279): semanas de Costa Rica, cohortes, %, neto y "sin dato" cuando una fuente falla.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";
import {
  STEPS, adsOf, applyFilters, buildAccounts, campaignsOf, cohortTable, countriesOf, crWeeks, isAdUtm, netAfterAds, netUsd, parseUsd, pctOf, secondWorkoutUsers, weekKey, type FunnelRows,
} from "@/lib/embudo-plata";

const NOW = new Date("2026-11-07T18:00:00Z"); // sábado 7 nov, 12:00 en Costa Rica
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("semanas de Costa Rica", () => {
  it("el lunes empieza a las 00:00 de Costa Rica (06:00 UTC)", () => {
    expect(weekKey("2026-11-02T06:00:00Z")).toBe("2026-11-02");
    expect(weekKey("2026-11-02T05:59:59Z")).toBe("2026-10-26"); // domingo 23:59 en Costa Rica
    expect(weekKey("2026-11-09T05:59:00Z")).toBe("2026-11-02");
  });
  it("devuelve 8 semanas, la actual primero, de 7 días cada una", () => {
    const w = crWeeks(NOW);
    expect(w).toHaveLength(8);
    expect(w[0]).toEqual({ key: "2026-11-02", start: "2026-11-02T06:00:00.000Z", end: "2026-11-09T06:00:00.000Z" });
    expect(w[7].key).toBe("2026-09-14");
    for (const x of w) expect(Date.parse(x.end) - Date.parse(x.start)).toBe(7 * 86400_000);
  });
});

describe("neto y porcentajes", () => {
  it("quita el IVA incluido y la comisión del procesador, marcada como estimada", () => {
    // $9.99 / 1.13 = 8.8407; ONVO 9.99 × 3.9 % + 0.35 = 0.7396 → 8.10
    expect(netUsd(999, "onvo")).toEqual({ gross: 9.99, net: 8.1, estimated: true });
    // $4.99 / 1.13 = 4.4159; Tilopay 4.99 × 4.25 % + 0.35 = 0.5621 → 3.85
    expect(netUsd(499, "tilopay")).toEqual({ gross: 4.99, net: 3.85, estimated: true });
  });
  it("usa la comisión guardada cuando existe", () => {
    expect(netUsd(999, "onvo", 70)).toEqual({ gross: 9.99, net: 8.14, estimated: false });
  });
  it("% con un decimal; sin registrados o sin dato no hay %", () => {
    expect(pctOf(1, 3)).toBe(33.3);
    expect(pctOf(0, 0)).toBeNull();
    expect(pctOf(null, 10)).toBeNull();
  });
  it("ingreso neto menos anuncios solo con los dos datos", () => {
    expect(netAfterAds(12.5, 40)).toBe(-27.5);
    expect(netAfterAds(null, 40)).toBeNull();
    expect(netAfterAds(12.5, null)).toBeNull();
  });
  it("lee el gasto escrito a mano", () => {
    expect(parseUsd("120")).toBe(12000);
    expect(parseUsd("$1,200.5")).toBe(120050);
    expect(parseUsd("0")).toBe(0);
    expect(parseUsd("-5")).toBeNull();
    expect(parseUsd("doce")).toBeNull();
    expect(parseUsd("1.234")).toBeNull();
  });
  it("anuncio: utm de campaña o fbclid", () => {
    expect(isAdUtm({ utm_source: "facebook" })).toBe(true);
    expect(isAdUtm({ fbclid: "abc" })).toBe(true);
    expect(isAdUtm({})).toBe(false);
    expect(isAdUtm({ utm_source: " " })).toBe(false);
    expect(isAdUtm(null)).toBe(false);
  });
});

/** Semana del 2 nov: 1 anuncio que paga con tarjeta Tilopay, 1 de condominio que termina y deja tarjeta, 1 orgánico que solo ve Hoy.
 *  Semana del 26 oct: 1 que paga en el muro (suscripción ONVO). Fuera: staff, tester. */
const sample = (): FunnelRows => ({
  profiles: [
    { id: id(1), created_at: "2026-11-03T15:00:00Z", role: "free", country: "CO" },
    { id: id(2), created_at: "2026-11-04T15:00:00Z", role: "free", country: "CR" },
    { id: id(3), created_at: "2026-11-05T15:00:00Z", role: "free", country: null },
    { id: id(4), created_at: "2026-10-27T15:00:00Z", role: "pro", country: "cr" },
    { id: id(5), created_at: "2026-11-03T15:00:00Z", role: "admin", country: "CR" },
    { id: id(6), created_at: "2026-11-03T15:00:00Z", role: "free", country: "CR" },
  ],
  testers: [id(6)],
  condo: [id(2)],
  utm: [{ user_id: id(1), utm: { utm_source: "facebook", utm_campaign: "nov" } }],
  signup: [],
  events: [
    ...[1, 2, 3, 5, 6].map((n) => ({ user_id: id(n), name: "hoy_view" })),
    { user_id: id(1), name: "hoy_view" },
    ...[1, 2].flatMap((n) => ["workout_open", "workout_first_set_view", "workout_first_set"].map((name) => ({ user_id: id(n), name }))),
    { user_id: null, name: "workout_open" },
  ],
  finished: [id(1), id(2), id(5)],
  second: [id(1)],
  charges: [
    { user_id: id(1), status: "succeeded", amount_minor: 499 },
    { user_id: id(2), status: "scheduled", amount_minor: 499 },
  ],
  methods: [{ user_id: id(1), provider: "tilopay", status: "active" }],
  subs: [
    { user_id: id(4), provider: "onvo", status: "active", plan: "entreno", billing: "mes", current_period_end: "2026-12-01T00:00:00Z", cancel_at_period_end: false },
    { user_id: id(3), provider: "onvo", status: "incomplete", plan: "entreno", billing: "mes", current_period_end: null, cancel_at_period_end: false },
  ],
});

describe("segundo entreno (#286)", () => {
  it("la columna va justo después del primer entreno", () => {
    const keys = STEPS.map((s) => s.key);
    expect(keys.indexOf("second")).toBe(keys.indexOf("finished") + 1);
    expect(STEPS.find((s) => s.key === "second")!.label).toBe("Segundo entreno");
  });

  it("cuenta 2 o más entrenos terminados dentro de los primeros 7 días desde el registro", () => {
    const profiles = [
      { id: id(1), created_at: "2026-11-01T15:00:00Z" },
      { id: id(2), created_at: "2026-11-01T15:00:00Z" },
      { id: id(3), created_at: "2026-11-01T15:00:00Z" },
      { id: id(4), created_at: "2026-11-01T15:00:00Z" },
    ];
    const w = (n: number, finished_at: string | null) => ({ user_id: id(n), finished_at });
    expect(secondWorkoutUsers(profiles, [
      w(1, "2026-11-01T20:00:00Z"), w(1, "2026-11-03T20:00:00Z"), // dos en la prueba
      w(2, "2026-11-01T20:00:00Z"), w(2, "2026-11-08T15:00:00Z"), // el segundo justo a los 7 días: fuera
      w(3, "2026-11-02T20:00:00Z"), w(3, null), // uno sin terminar
      w(4, "2026-11-02T10:00:00Z"), w(4, "2026-11-02T20:00:00Z"), w(4, "2026-11-04T20:00:00Z"), // tres
    ])).toEqual([id(1), id(4)]);
  });
});

describe("cohortes por semana de registro", () => {
  const weeks = crWeeks(NOW);

  it("quita staff y testers, y cuenta cada paso una vez por persona", () => {
    const t = cohortTable(buildAccounts(sample(), NOW), weeks);
    expect(t[0]).toEqual({
      week: "2026-11-02", registrados: 3,
      steps: { hoy: 3, open: 2, firstView: 2, firstSet: 2, finished: 2, second: 1, card: 2, paid: 1 },
      net: 3.85, estimated: true,
    });
    // Pago en el muro de planes: precio de lista $9.99 con ONVO.
    expect(t[1]).toMatchObject({ week: "2026-10-26", registrados: 1, steps: { paid: 1, card: 0, finished: 0 }, net: 8.1 });
    expect(t.slice(2).every((r) => r.registrados === 0 && r.net === 0)).toBe(true);
  });

  it("una suscripción vencida o sin pagar no cuenta como pago", () => {
    const r = sample();
    r.subs![0].current_period_end = "2026-11-01T00:00:00Z";
    const t = cohortTable(buildAccounts(r, NOW), weeks);
    expect(t[1].steps.paid).toBe(0);
    expect(t[1].net).toBe(0);
  });

  it("con varios cobros por cuenta cuenta el primero que se cobró, aunque después venga uno agendado", () => {
    const r = sample();
    r.charges = [
      { user_id: id(1), status: "succeeded", amount_minor: 499 },
      { user_id: id(1), status: "scheduled", amount_minor: 499 },
      { user_id: id(2), status: "scheduled", amount_minor: 499 },
    ];
    const t = cohortTable(buildAccounts(r, NOW), weeks)[0];
    expect(t.steps).toMatchObject({ card: 2, paid: 1 });
    expect(t.net).toBe(3.85);
  });

  it("con un método inactivo y uno activo cuenta la tarjeta y usa el procesador del activo", () => {
    const r = sample();
    r.methods = [
      { user_id: id(1), provider: "onvo", status: "inactive" },
      { user_id: id(1), provider: "tilopay", status: "active" },
      { user_id: id(3), provider: "onvo", status: "active" },
      { user_id: id(3), provider: "onvo", status: "inactive" },
    ];
    const t = cohortTable(buildAccounts(r, NOW), weeks)[0];
    expect(t.steps.card).toBe(3);
    // $4.99 con Tilopay: 4.99 / 1.13 - (4.99 * 0.0425 + 0.35) = 3.85 (con ONVO sería 3.87).
    expect(t.net).toBe(3.85);
  });

  it("una fuente que falla deja sus columnas en sin dato, nunca en cero", () => {
    const t = cohortTable(buildAccounts({ ...sample(), events: null, methods: null, second: null }, NOW), weeks)[0];
    expect(t.registrados).toBe(3);
    expect(t.steps).toEqual({ hoy: null, open: null, firstView: null, firstSet: null, finished: 2, second: null, card: null, paid: null });
    expect(t.net).toBeNull();
  });

  it("filtra por país (con Sin dato), origen y cuentas antes o desde el 1 ene 2027", () => {
    const a = buildAccounts(sample(), NOW);
    expect(countriesOf(a)).toEqual(["CO", "CR"]);
    expect(applyFilters(a, { country: "CR" })!.length).toBe(2);
    expect(applyFilters(a, { country: "sin" })!.length).toBe(1);
    expect(applyFilters(a, { origin: "anuncio" })!.map((x) => x.country)).toEqual(["CO"]);
    expect(applyFilters(a, { origin: "condominio" })!.length).toBe(1);
    expect(applyFilters(a, { origin: "organico" })!.length).toBe(2);
    expect(applyFilters(a, { era: "antes" })!.length).toBe(4);
    expect(applyFilters(a, { era: "desde" })!.length).toBe(0);
    const later = buildAccounts({ ...sample(), profiles: [{ id: id(9), created_at: "2027-01-01T06:00:00Z", role: "free", country: "CR" }] }, NOW);
    expect(applyFilters(later, { era: "desde" })!.length).toBe(1);
  });

  it("sin condominios o sin utm, el filtro de origen no se aplica (sin dato)", () => {
    const a = buildAccounts({ ...sample(), condo: null }, NOW);
    expect(a.every((x) => x.origin === null)).toBe(true);
    expect(applyFilters(a, { origin: "anuncio" })).toBeNull();
    expect(applyFilters(a, { country: "CR" })!.length).toBe(2);
  });
});

describe("primer contacto en el embudo (#283)", () => {
  const signup = (user: number, campaign: string | null, content: string | null, fbclid: string | null = null) =>
    ({ user_id: id(user), utm_source: campaign ? "meta" : null, utm_medium: campaign ? "paid" : null, utm_campaign: campaign, utm_content: content, fbclid });

  it("una cuenta con utm o fbclid en signup_attribution es Anuncio, aunque no venga de un referidor", () => {
    const a = buildAccounts({ ...sample(), utm: [], signup: [signup(3, null, null, "IwAR0abc"), signup(4, "Primer entreno", "Video 12 min")] }, NOW);
    expect(applyFilters(a, { origin: "anuncio" })!.length).toBe(2);
    expect(applyFilters(a, { origin: "organico" })!.length).toBe(1);
    // El condominio manda sobre el anuncio.
    const c = buildAccounts({ ...sample(), signup: [signup(2, "Primer entreno", "Video 12 min")] }, NOW);
    expect(applyFilters(c, { origin: "condominio" })!.length).toBe(1);
  });

  it("una fila sin utm de campaña ni fbclid no marca anuncio", () => {
    const a = buildAccounts({ ...sample(), signup: [{ ...signup(3, null, null), utm_content: "algo" }] }, NOW);
    expect(applyFilters(a, { origin: "organico" })!.length).toBe(2);
  });

  it("filtra por campaña y anuncio, con solo los valores que existen", () => {
    const a = buildAccounts({ ...sample(), signup: [signup(1, "Primer entreno", "Video 12 min"), signup(3, "Primer entreno", "Carrusel"), signup(4, "Temporada 1", "Video 12 min")] }, NOW);
    expect(campaignsOf(a)).toEqual(["Primer entreno", "Temporada 1"]);
    expect(adsOf(a)).toEqual(["Carrusel", "Video 12 min"]);
    expect(adsOf(a, "Temporada 1")).toEqual(["Video 12 min"]);
    expect(applyFilters(a, { campaign: "Primer entreno" })!.length).toBe(2);
    expect(applyFilters(a, { campaign: "Primer entreno", ad: "Carrusel" })!.map((x) => x.country)).toEqual([null]);
    expect(applyFilters(a, { ad: "Video 12 min", country: "CR" })!.length).toBe(1);
  });

  it("sin signup_attribution (falló la lectura) el origen y la campaña quedan sin dato", () => {
    const a = buildAccounts({ ...sample(), signup: null }, NOW);
    expect(a.every((x) => x.origin === null)).toBe(true);
    expect(applyFilters(a, { campaign: "Primer entreno" })).toBeNull();
    expect(applyFilters(a, { era: "antes" })!.length).toBe(4);
  });
});

describe("0068_embudo_plata.sql", () => {
  it("se puede aplicar dos veces y deja la tabla del gasto con RLS", async () => {
    const pg = new PGlite({ extensions: { pgcrypto } });
    await pg.exec(readFileSync("supabase/tests/stub.sql", "utf8"));
    await pg.exec(readFileSync("supabase/migrations/0001_init.sql", "utf8"));
    const sql = readFileSync("supabase/migrations/0068_embudo_plata.sql", "utf8");
    await pg.exec(sql);
    await pg.exec(sql);
    const { rows } = await pg.query<{ rls: boolean }>("select relrowsecurity as rls from pg_class where relname = 'ad_spend_weeks'");
    expect(rows[0].rls).toBe(true);
    await pg.exec("insert into public.ad_spend_weeks (week_start, amount_minor) values ('2026-11-02', 4000)");
    await expect(pg.exec("insert into public.ad_spend_weeks (week_start, amount_minor) values ('2026-11-03', 4000)")).rejects.toThrow();
    await pg.close();
  });
});
