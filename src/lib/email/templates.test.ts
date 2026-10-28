import { describe, expect, it } from "vitest";
import { bienvenida, planListo, regalo, reporteEquipo, testerAsignado, testerTerminado } from "./templates";

const base = { name: "Ana López", trainDays: 4, todayRoutine: "Pierna", goalWeight: 68, goalDate: "2027-03-01" };

describe("correo de plan listo según el plan", () => {
  it("con nutrición muestra calorías y proteína", () => {
    const e = planListo({ ...base, kcal: 1850, protein: 130, minutes: 45 });
    expect(e.text).toContain("kcal al día");
    expect(e.text).toContain("130 g de proteína");
    expect(e.html).toContain("kcal al día");
  });
  it("sin nutrición (Entreno) no muestra calorías ni proteína", () => {
    const e = planListo({ ...base, minutes: 45 });
    expect(e.text + e.html).not.toMatch(/kcal|proteína/);
    expect(e.text).toContain("45 min por sesión");
  });
});

describe("correo de bienvenida", () => {
  it("español neutro, sin modismos de un solo país", () => {
    const e = bienvenida({ name: "Ana" });
    expect(e.text + e.html).not.toMatch(/pura vida|comida tica/i);
  });
});

describe("correo de regalo", () => {
  const base = { name: "Ana López", months: 3, plan: "Entreno + Nutrición", source: "regalo" as const, startsAt: "2026-12-01T12:00:00Z", expiresAt: "2027-03-01T12:00:00Z", startsNow: true };
  it("dice cuánto, de qué plan y hasta cuándo", () => {
    const e = regalo(base);
    expect(e.subject).toBe("Ana, te regalaron 3 meses de Entreno + Nutrición");
    expect(e.text).toContain("Hasta:");
    expect(e.html).toContain("/app/suscripcion");
  });
  it("escapa el mensaje personal", () => {
    const e = regalo({ ...base, message: "<img src=x onerror=alert(1)>" });
    expect(e.html).not.toContain("<img src=x");
    expect(e.html).toContain("&lt;img");
  });
  it("recompensa por referidos y regalo programado", () => {
    const e = regalo({ ...base, source: "referido", months: 1, startsNow: false });
    expect(e.subject).toBe("Ganaste 1 mes gratis de Entreno + Nutrición");
    expect(e.preheader).toMatch(/Empieza el/);
  });
  it("sin emojis ni menciones de IA", () => {
    const e = regalo(base);
    expect(e.text + e.html).not.toMatch(/\bIA\b|inteligencia artificial|[\u{1F300}-\u{1FAFF}]/u);
    expect(bienvenida({ name: "Ana" }).text).not.toMatch(/\bIA\b/);
  });
});

describe("correos de tester", () => {
  const e = testerAsignado({ name: "Ana López", expiresAt: "2026-11-22T18:00:00Z" });
  it("héroe de tester, cortesía de la beta, 30 días y hasta qué fecha", () => {
    expect(e.subject).toBe("Ana, eres tester de Banana Burn");
    expect(e.html).toContain("Eres tester de Banana Burn");
    expect(e.html).toContain("30 días gratis");
    expect(e.text).toContain("Hasta: 22 de noviembre de 2026");
    expect(e.text).toMatch(/agradecimiento|probar la beta/);
    expect(e.text).toContain("Entreno + Nutrición");
  });
  it("explica cómo reportar y que no hay cobros", () => {
    expect(e.text).toContain("Reportar algo");
    expect(e.text).toMatch(/sin cobros|No se te cobrará/i);
    expect(e.html).toContain("/app");
  });
  it("renovación con su propio asunto", () => {
    expect(testerAsignado({ name: "Ana", expiresAt: "2026-11-22T18:00:00Z", renewal: true }).subject).toBe("Ana, renovamos tu mes de tester");
  });
  it("agradecimiento al terminar con lo que pasa ahora", () => {
    const t = testerTerminado({ name: "Ana", endedAt: "2026-11-22T18:00:00Z" });
    expect(t.subject).toBe("Gracias por probar Banana Burn, Ana");
    expect(t.text).toContain("22 de noviembre de 2026");
    expect(t.text).toMatch(/elige un plan/i);
    expect(t.html).toContain("/app/suscripcion");
  });
  it("sin emojis, sin raya larga, sin modismos y sin cadenas con punto medio", () => {
    for (const x of [e, testerTerminado({ name: "Ana", endedAt: "2026-11-22T18:00:00Z" })]) {
      expect(x.subject + x.text + x.html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]|\u2014|·|pura vida|\bmae\b|banano/u);
    }
  });
  it("el aviso interno de reportes escapa el texto", () => {
    const r = reporteEquipo({ name: "Ana", kind: "Algo falla", body: "<script>x</script>", tester: true, adminUrl: "/admin/usuarios/testers" });
    expect(r.subject).toBe("Reporte de tester: Algo falla");
    expect(r.html).not.toContain("<script>x");
  });
});

describe("marca y personalización", () => {
  const unsubscribe = "https://bananaburn.app/api/email/baja?token=x";
  it("todos los correos siguen el libro de marca", async () => {
    const T = await import("./templates");
    const all = [
      T.bienvenida({ name: "Ana" }),
      T.planListo({ ...base, startWeight: 75 }),
      T.reciboPago({ name: "Ana", plan: "Entreno", amount: 9.99 }),
      T.pagoFallido({ name: "Ana", plan: "Entreno", amount: 9.99 }),
      T.suscripcionCancelada({ name: "Ana", plan: "Entreno" }),
      T.recordatorio({ name: "Ana", routine: "Pierna", streak: 3, unsubscribe }),
      T.recordatorio({ name: "Ana", routine: "Pierna", mins: 35, exercises: ["Sentadilla", "Puente"], streak: 0, unsubscribe, first: true }),
      T.rachaEnPeligro({ name: "Ana", streak: 4, unsubscribe }),
      T.resumenSemanal({ name: "Ana", workouts: 3, planned: 4, streak: 5, prs: [], nextWeek: [], unsubscribe }),
      T.reactivacion({ name: "Ana", days: 3, routine: "Pierna", trainingDay: true, unsubscribe }),
      T.testerAsignado({ name: "Ana", expiresAt: "2026-11-22T18:00:00Z" }),
      T.testerTerminado({ name: "Ana", endedAt: "2026-11-22T18:00:00Z" }),
    ];
    for (const e of all) {
      expect(e.html).toMatch(/\/email\/(coach|mascota)\.png/); // Coach Banana, una sola pose por correo
      expect(e.html.match(/\/email\/(coach|mascota)\.png/g)).toHaveLength(1);
      expect(e.html).toContain('Banana <span style="color:#8A5300;">Burn</span>'); // logotipo: Burn en ember-ink
      expect(e.html).toContain("background:#FFD60A;padding:26px"); // héroe banana
      expect(e.text).toContain("Coach Banana");
      expect(e.subject + e.text).not.toContain("·");
      expect(e.text + e.html).not.toMatch(/cédula|pura vida|banano|\bIA\b|[\u{1F300}-\u{1FAFF}]/u);
    }
  });
  it("calcula el avance hacia la meta (bajar y subir de peso)", async () => {
    const { goalProgress, goalLine } = await import("./templates");
    expect(goalProgress({ start: 94, current: 90, goal: 85 })).toMatchObject({ pct: 44, left: 5, moved: 4, reached: false, losing: true });
    expect(goalProgress({ start: 60, current: 63, goal: 66 })).toMatchObject({ pct: 50, left: 3, losing: false });
    expect(goalProgress({ start: 94, current: 84.5, goal: 85 })?.reached).toBe(true);
    expect(goalLine({ start: 94, current: 90, goal: 85 })).toBe("Te faltan 5 kg para tus 85 kg");
    expect(goalLine(null)).toBe("");
  });
  it("el recordatorio y el resumen muestran la meta cuando existe", async () => {
    const T = await import("./templates");
    const goal = { start: 94, current: 90.2, goal: 85, date: "2026-12-31" };
    const r = T.recordatorio({ name: "Andrés Guevara", routine: "Empuje", streak: 0, goal, unsubscribe });
    expect(r.subject).toBe("Andrés, hoy te toca Empuje: tus cargas ya están listas");
    expect(r.html).toContain("Tu meta");
    expect(r.text).toContain("Te faltan 5,2 kg");
    const w = T.resumenSemanal({ name: "Andrés", workouts: 4, planned: 4, streak: 9, prs: [], nextWeek: [], goal, unsubscribe });
    expect(w.html).toContain("3,8 kg menos");
  });
  it("las plantillas de Supabase conservan sus variables", async () => {
    const { authTemplates } = await import("./templates");
    const t = authTemplates();
    expect(t.map((x) => x.file)).toEqual(["invite.html", "magic-link.html", "confirm-signup.html", "reset-password.html", "change-email.html", "reauthentication.html"]);
    for (const x of t) expect(x.html).toMatch(/\{\{ \.SiteURL \}\}\/email\/(coach|mascota)\.png/);
    expect(t[1].html).toContain("{{ .Token }}");
    expect(t[1].html).toContain("token_hash={{ .TokenHash }}&amp;type=email");
    expect(t[4].html).toContain("{{ .NewEmail }}");
  });
  it("cifras con el formato de la marca", async () => {
    const { money, reciboPago } = await import("./templates");
    expect(money(9.99)).toBe("$9,99");
    expect(money(1200)).toBe("$1.200,00");
    expect(reciboPago({ name: "Ana", plan: "Entreno", amount: 9.99 }).subject).toBe("Recibo de pago: Entreno, $9,99");
  });
});
