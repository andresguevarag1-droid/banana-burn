// #236: dónde se cae el registro, de tocar "Empezar" a la cuenta creada. Cada evento sale una vez por vista o acción,
// solo con códigos fijos (nunca el correo), y docs/metas/embudo-registro.sql corre sobre la tabla real de 0061.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanEvent, ONBOARDING_STEPS, SIGNUP_ERRORS, SIGNUP_METHODS } from "./event";
import { signupReason } from "@/app/(auth)/entrar/validate";
import { toMetaEvent } from "@/lib/meta-pixel";

describe("cleanEvent: eventos del registro con forma fija", () => {
  it("signup_view guarda solo la ruta e inapp (#235)", () => {
    expect(cleanEvent({ name: "signup_view", props: { path: "/entrar", inapp: true, email: "ana@correo.com", cta: "hero" } })).toEqual({ name: "signup_view", props: { path: "/entrar", inapp: true } });
    expect(cleanEvent({ name: "signup_view", props: { path: "/entrar", inapp: "ana@correo.com" } })).toBeNull();
  });
  it("signup_submit acepta solo los métodos conocidos y descarta todo lo demás", () => {
    for (const method of SIGNUP_METHODS) expect(cleanEvent({ name: "signup_submit", props: { path: "/entrar", method } })?.props).toEqual({ path: "/entrar", method });
    expect(cleanEvent({ name: "signup_submit", props: { method: "password", email: "ana@correo.com", mail: "ana" } })?.props).toEqual({ method: "password" });
    expect(cleanEvent({ name: "signup_submit", props: { method: "ana@correo.com" } })).toBeNull();
    expect(cleanEvent({ name: "signup_submit", props: {} })).toBeNull();
    expect(cleanEvent({ name: "signup_submit" })).toBeNull();
  });
  it("signup_error acepta solo un motivo de la lista: un correo o un mensaje libre se rechazan", () => {
    for (const reason of SIGNUP_ERRORS) expect(cleanEvent({ name: "signup_error", props: { reason } })?.props).toEqual({ reason });
    expect(cleanEvent({ name: "signup_error", props: { reason: "ana@correo.com" } })).toBeNull();
    expect(cleanEvent({ name: "signup_error", props: { reason: "Ya existe una cuenta con ese correo." } })).toBeNull();
  });
  it("onboarding_step acepta pasos enteros de 0 a 6", () => {
    expect(ONBOARDING_STEPS).toBe(7);
    for (let step = 0; step < 7; step++) expect(cleanEvent({ name: "onboarding_step", props: { path: "/bienvenida", step } })?.props).toEqual({ path: "/bienvenida", step });
    for (const step of [7, -1, 2.5, "3", null]) expect(cleanEvent({ name: "onboarding_step", props: { step } })).toBeNull();
  });
  it("ninguno va al píxel de Meta (no inflan Lead ni CompleteRegistration)", () => {
    expect(toMetaEvent("signup_view")).toBeNull();
    expect(toMetaEvent("signup_submit", { method: "password" })).toBeNull();
    expect(toMetaEvent("signup_error", { reason: "network" })).toBeNull();
    expect(toMetaEvent("onboarding_step", { step: 0 })).toBeNull();
  });
});

describe("signupReason: motivo corto a partir del mensaje", () => {
  it("traduce los mensajes de Supabase y los nuestros", () => {
    expect(signupReason("User already registered")).toBe("email_taken");
    expect(signupReason("Ya existe una cuenta con ese correo. Entra con tu contraseña.")).toBe("email_taken");
    expect(signupReason("Password should be at least 8 characters")).toBe("weak_password");
    expect(signupReason("Usa al menos 8 caracteres.")).toBe("weak_password");
    expect(signupReason("Esa contraseña es muy débil. Usa al menos 8 caracteres, con letras y números.")).toBe("weak_password");
    expect(signupReason("Revisa que tu correo esté bien escrito.")).toBe("invalid_email");
    expect(signupReason("Demasiados intentos. Espera unos minutos e intenta de nuevo.")).toBe("rate_limit");
    expect(signupReason("For security purposes, you can only request this after 42 seconds.")).toBe("rate_limit");
    expect(signupReason("Failed to fetch")).toBe("network");
    expect(signupReason("No pudimos crear tu cuenta. Intenta de nuevo en un momento.")).toBe("other");
    expect(signupReason(undefined)).toBe("other");
  });
});

/** Cuerpo de una función del componente, hasta la siguiente función de primer nivel. */
const body = (src: string, start: string) => {
  const i = src.indexOf(start);
  expect(i, start).toBeGreaterThan(-1);
  const rest = src.slice(i + start.length);
  const end = rest.search(/\n {2}(async function|function|const [a-zA-Z]+ = (\(|async))/);
  return end < 0 ? rest : rest.slice(0, end);
};
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe("/entrar: un evento por vista o acción, sin datos personales", () => {
  const src = readFileSync("src/app/(auth)/entrar/login-form.tsx", "utf8");

  it("signup_view sale una sola vez: lo mide la página /entrar con inapp, no el formulario (#235)", () => {
    expect(count(src, /track\("signup_view"/g)).toBe(0);
    const page = readFileSync("src/app/(auth)/entrar/page.tsx", "utf8");
    expect(count(page, /view="signup_view"/g)).toBe(1);
  });

  it("cada forma de crear la cuenta manda un solo signup_submit con su método, y solo en modo registro", () => {
    expect(count(src, /track\("signup_submit"/g)).toBe(4);
    expect(count(body(src, "async function withPassword("), /track\("signup_submit", \{ method: "password" \}\)/g)).toBe(1);
    expect(count(body(src, "async function google("), /track\("signup_submit", \{ method: "google" \}\)/g)).toBe(1);
    expect(count(body(src, "async function nativeSocial("), /track\("signup_submit", \{ method: provider \}\)/g)).toBe(1);
    // El código: solo el primer envío desde el formulario, no "Reenviar código".
    const send = body(src, "async function sendCode(");
    expect(send).toContain('const counted = isSignup && step === "email";');
    expect(send).toContain('if (counted) track("signup_submit", { method: "code" });');
    expect(body(src, "async function withPassword(")).toContain('if (isSignup) track("signup_submit"');
    expect(body(src, "async function google(")).toContain('if (isSignup) track("signup_submit"');
    expect(body(src, "async function nativeSocial(")).toContain('if (isSignup) track("signup_submit"');
  });

  it("signup_error sale solo con un motivo corto, nunca con el correo, la contraseña ni el mensaje", () => {
    // Todo lo que el formulario manda al embudo: un método fijo o un motivo de signupReason, nada más (el servidor rechaza el resto).
    const args = [...src.matchAll(/track\("signup_(?:view|submit|error)"(.*?)\);/g)].map((m) => m[1]).sort();
    expect(args).toEqual([
      ', { method: "code" }', ', { method: "google" }', ', { method: "password" }', ", { method: provider }",
      ', { reason: rate ? "rate_limit" : signupReason(error.message) }', ", { reason }",
    ].sort());
    // fail() es el único camino de error del registro además del código, y manda el motivo una vez antes de mostrarlo.
    const fail = src.slice(src.indexOf("const fail = "), src.indexOf("const go = () =>"));
    expect(fail).toContain('if (isSignup) track("signup_error", { reason });');
    expect(count(src, /track\("signup_error"/g)).toBe(2);
    expect(body(src, "async function google(")).toContain('"oauth_blocked"');
    expect(body(src, "async function withPassword(")).toContain('"network"');
  });
});

describe("/bienvenida: un onboarding_step al entrar a cada paso", () => {
  const src = readFileSync("src/app/bienvenida/wizard.tsx", "utf8");
  it("en un efecto que solo depende del paso, y solo de 0 a 6", () => {
    expect(src).toContain("const STEPS = 7;");
    expect(count(src, /track\("onboarding_step"/g)).toBe(1);
    expect(src).toContain('useEffect(() => { if (step < ONBOARDING_STEPS) track("onboarding_step", { step }); }, [step]);');
  });
});

describe("docs/metas/embudo-registro.sql sobre funnel_events (0061)", () => {
  const [daily, steps, detail] = readFileSync("docs/metas/embudo-registro.sql", "utf8")
    .replaceAll("(now() at time zone 'America/Costa_Rica')::date", "date '2026-11-03'")
    .split(/^(?=-- [23]\))/m);
  const pg = new PGlite({ extensions: { pgcrypto } });
  const u = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
  const ev = (name: string, props: object, at = "2026-11-03 15:00+00", user: number | null = null) =>
    `insert into public.funnel_events (user_id, name, path, props, created_at) values (${user ? `'${u(user)}'` : "null"}, '${name}', '/x', '${JSON.stringify(props)}', '${at}');`;

  beforeAll(async () => {
    await pg.exec(readFileSync("supabase/tests/stub.sql", "utf8"));
    await pg.exec(readFileSync("supabase/migrations/0061_eventos_embudo.sql", "utf8"));
    const seed: string[] = [];
    for (let n = 1; n <= 3; n++) seed.push(`insert into auth.users (id) values ('${u(n)}');`);
    // 4 Lead en la landing (más 1 registro-password que no cuenta como "empezar" y 1 botón que no es Lead).
    for (const cta of ["hero", "final", "sticky", "precios-anual", "registro-password", "faq"]) seed.push(ev("cta_click", { cta }));
    seed.push(ev("signup_view", {}), ev("signup_view", {}));
    seed.push(ev("signup_submit", { method: "password" }), ev("signup_submit", { method: "google" }), ev("signup_error", { reason: "weak_password" }));
    // Dos cuentas llegan a la bienvenida; una termina los 7 pasos y guarda el plan, la otra se queda en el paso 1 (y vuelve al 0).
    for (let s = 0; s < 7; s++) seed.push(ev("onboarding_step", { step: s }, "2026-11-03 15:01+00", 1));
    seed.push(ev("onboarding_done", {}, "2026-11-03 15:05+00", 1));
    seed.push(ev("onboarding_step", { step: 0 }, "2026-11-03 15:01+00", 2), ev("onboarding_step", { step: 1 }, "2026-11-03 15:02+00", 2), ev("onboarding_step", { step: 0 }, "2026-11-03 15:03+00", 2));
    // Otro día de Costa Rica (2 nov, 23:30 CR) y fuera de la ventana de 14 días.
    seed.push(ev("signup_view", {}, "2026-11-03 05:30+00"), ev("signup_view", {}, "2026-10-01 15:00+00"));
    await pg.exec(seed.join("\n"));
  }, 30000);
  afterAll(async () => { await pg.close(); });

  const run = async (sql: string) => {
    await pg.exec("begin read only");
    try { return (await pg.query<Record<string, unknown>>(sql)).rows; } finally { await pg.exec("rollback"); }
  };
  const num = (v: unknown) => (v == null ? null : Number(v));

  it("1) una fila por día con conteos y % de caída entre pasos", async () => {
    const rows = await run(daily);
    expect(rows).toHaveLength(14);
    const hoy = rows[0];
    expect((hoy.dia as Date).toISOString().slice(0, 10)).toBe("2026-11-03");
    expect([hoy.empezar, hoy.vista_registro, hoy.intento, hoy.errores, hoy.cuenta, hoy.paso_6, hoy.bienvenida].map(num)).toEqual([4, 2, 2, 1, 2, 1, 1]);
    expect([hoy.caida_landing_pct, hoy.caida_entrar_pct, hoy.caida_crear_cuenta_pct, hoy.caida_bienvenida_pct, hoy.caida_guardar_plan_pct].map(num)).toEqual([50, 0, 0, 50, 0]);
    expect(num(rows[1].vista_registro)).toBe(1);
    expect(num(rows[1].caida_landing_pct)).toBeNull();
  });

  it("2) por paso, con cada paso de la bienvenida por separado", async () => {
    const rows = await run(steps);
    expect(rows.map((r) => [r.paso, num(r.total), num(r.caida_pct)])).toEqual([
      ["empezar", 4, null], ["vista_registro", 3, 25], ["intento", 2, 33.3],
      ["bienvenida_paso_0", 2, 0], ["bienvenida_paso_1", 2, 0], ["bienvenida_paso_2", 1, 50],
      ["bienvenida_paso_3", 1, 0], ["bienvenida_paso_4", 1, 0], ["bienvenida_paso_5", 1, 0], ["bienvenida_paso_6", 1, 0],
      ["bienvenida_terminada", 1, 0],
    ]);
  });

  it("3) intentos por método y errores por motivo", async () => {
    const rows = await run(detail);
    expect(rows.map((r) => [r.evento, r.detalle, num(r.total)])).toEqual([
      ["signup_submit", "google", 1], ["signup_submit", "password", 1], ["signup_error", "weak_password", 1],
    ]);
  });

  it("'empezar' son los mismos botones que mandan Lead al píxel, sin los registro-* de /entrar", () => {
    const re = new RegExp(daily.match(/e\.props->>'cta' ~ '([^']+)'/)![1]);
    for (const cta of ["hero", "final", "nav", "sticky", "glp1-hero", "glp1-banda", "precios-anual", "precio-mes", "plan-completo", "registro-password", "registro-google", "faq", "lo-mejor", "pasos"]) {
      const lead = toMetaEvent("cta_click", { cta })?.name === "Lead";
      expect(re.test(cta), cta).toBe(lead && !cta.startsWith("registro-"));
    }
  });
});
