// Recuperación al terminar la prueba: las plantillas y el aviso dicen lo mismo que docs/emails/recuperacion.md,
// y las reglas de fechas y audiencia (recuperacion.ts) cumplen "Fechas, audiencia y convivencia".
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RECOVERY_MAILS, recoveryProgressLine, recuperacionPrueba } from "@/lib/email/templates";
import { RECOVERY_NOTICE, recoveryEligible, recoveryStep, recoveryStepAt, trialExpired, trialProgress } from "@/lib/recuperacion";
import { CARD_REQUIRED_FROM } from "@/lib/card-required";
import { BETA_ENDS_AT } from "@/lib/plans";
import { DAY_MS } from "@/lib/trial";
import { RecoveryNoticeCard } from "@/components/recovery-notice";

const doc = readFileSync("docs/emails/recuperacion.md", "utf8");
const pieces = doc.split(/^## /m).slice(1, 4);
const field = (piece: string, name: string) => piece.match(new RegExp(`\\*\\*${name}[^*]*:\\*\\*\\s*([\\s\\S]*?)\\s*(?=\\n\\*\\*|$)`))?.[1]?.trim() ?? "";
const unsubscribe = "https://bananaburn.app/api/email/baja?u=x&s=recordatorios";

const SIGNUP = "2026-11-02T12:00:00.000Z";
const at = (days: number, extraMs = 0) => new Date(Date.parse(SIGNUP) + days * DAY_MS + extraMs);
const audience = { createdAt: SIGNUP, profilePlan: "free", staff: false, paid: false, comp: false, tester: false, hasCharge: false };

describe("correos de recuperación: copy del documento", () => {
  for (const [i, day] of [[0, 8], [1, 10]] as const) {
    it(`día ${day}: asunto, vista previa, cuerpo, botón y destino`, () => {
      const c = RECOVERY_MAILS[day];
      expect(c.subject).toBe(field(pieces[i], "Asunto"));
      expect(c.preheader).toBe(field(pieces[i], "Vista previa"));
      expect(c.cta).toBe(field(pieces[i], "Botón"));
      expect(field(pieces[i], "Destino")).toContain(`\`${c.path}\``);
      expect([...c.paragraphs, "Coach Banana"].join("\n\n")).toBe(field(pieces[i], "Cuerpo"));
      const e = recuperacionPrueba({ day, unsubscribe });
      expect(e.subject).toBe(c.subject);
      expect(e.html).toContain('/app/suscripcion"');
      expect(e.text).toContain(`${c.cta}: `);
      expect(e.text).toContain("/app/suscripcion");
      for (const para of c.paragraphs) expect(e.text).toContain(para);
      expect(c.subject.length).toBeLessThan(45);
    });
  }

  it("día 8: el primer párrafo nombra cifras reales o el plan, nunca logros inventados", () => {
    const first = pieces[0];
    const real = recoveryProgressLine({ workouts: 3, sets: 42, kg: 3150 }, 4);
    expect(real).toBe("En tu prueba guardaste 3 entrenos, con 42 series y 3,150 kg levantados. Todo eso sigue en tu cuenta.");
    expect(first).toContain(`«${real}»`);
    expect(recoveryProgressLine({ workouts: 1, sets: 1, kg: 0 })).toBe("En tu prueba guardaste 1 entreno, con 1 serie. Todo eso sigue en tu cuenta.");
    expect(recoveryProgressLine({ workouts: 2, sets: 0, kg: 0 })).toBe("En tu prueba guardaste 2 entrenos. Todo eso sigue en tu cuenta.");
    const plan = recoveryProgressLine({ workouts: 0, sets: 0, kg: 0 }, 4);
    expect(plan).toBe("Tu plan de 4 días por semana sigue listo en tu cuenta, con las rutinas armadas a partir de tus datos.");
    expect(first).toContain(`«${plan}»`);
    expect(recoveryProgressLine(null, 4)).toBe(plan);
    expect(recoveryProgressLine(null, null)).toBe("Tu plan sigue listo en tu cuenta, con las rutinas armadas a partir de tus datos.");
    for (const line of [plan, recoveryProgressLine(null, null)]) expect(line).not.toMatch(/\d+ (entreno|serie|kg)|guardaste|lograste/);
    const e = recuperacionPrueba({ day: 8, unsubscribe, progress: { workouts: 3, sets: 42, kg: 3150 }, trainDays: 4 });
    expect(e.text).toContain(real);
    expect(e.html).toContain("3,150 kg levantados");
    expect(recuperacionPrueba({ day: 8, unsubscribe }).text).toContain("Tu plan sigue listo en tu cuenta");
    expect(recuperacionPrueba({ day: 10, unsubscribe, progress: { workouts: 3, sets: 42, kg: 3150 } }).text).not.toContain("3,150");
  });

  it("trialProgress cuenta solo entrenos terminados (sin descansos), sus series hechas y kg × repeticiones", () => {
    const workouts = [
      { id: "a", template: "pierna", finished_at: "2026-11-03T12:00:00Z" },
      { id: "b", template: "descanso", finished_at: "2026-11-04T12:00:00Z" },
      { id: "c", template: "torso", finished_at: null },
      { id: "d", template: "casa", finished_at: "2026-11-05T12:00:00Z" },
    ];
    const sets = [
      { workout_id: "a", kg: "60.5", reps: 10, done: true },
      { workout_id: "a", kg: 60, reps: 8, done: null },
      { workout_id: "a", kg: 60, reps: 8, done: false },
      { workout_id: "c", kg: 100, reps: 5, done: true },
      { workout_id: "d", kg: null, reps: 15, done: true },
    ];
    expect(trialProgress(workouts, sets)).toEqual({ workouts: 2, sets: 3, kg: 1085 });
    expect(trialProgress([], [])).toEqual({ workouts: 0, sets: 0, kg: 0 });
  });

  it("lleva baja y motivo, respeta la marca y no ofrece descuentos", () => {
    for (const day of [8, 10] as const) {
      const e = recuperacionPrueba({ day, unsubscribe });
      expect(e.html).toContain(unsubscribe.replace(/&/g, "&amp;"));
      expect(e.text).toContain(`Dejar de recibir estos correos: ${unsubscribe}`);
      expect(e.text).toContain("tu prueba de 7 días terminó sin elegir un plan");
      for (const color of ["#FFF8E3", "#FFD60A", "#1B1505"]) expect(e.html).toContain(color);
      expect(e.html).toContain("Plus Jakarta Sans");
      expect(e.subject + e.text).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(e.subject + e.text).not.toMatch(/\bIA\b|inteligencia artificial|descuento|50\s?%|gratis por/i);
    }
  });

  it("el aviso de la app usa el título, el apoyo, el cuerpo y el botón del documento", () => {
    const n = pieces[2];
    expect(RECOVERY_NOTICE.title).toBe(field(n, "Asunto"));
    expect(RECOVERY_NOTICE.lead).toBe(field(n, "Vista previa"));
    expect(RECOVERY_NOTICE.body).toBe(field(n, "Cuerpo"));
    expect(RECOVERY_NOTICE.cta).toBe(field(n, "Botón"));
    expect(field(n, "Destino")).toContain(`\`${RECOVERY_NOTICE.path}\``);
    const html = renderToStaticMarkup(<RecoveryNoticeCard onClose={() => {}} />);
    expect(html).toContain(RECOVERY_NOTICE.title);
    expect(html).toContain('href="/app/suscripcion"');
    expect(html).toContain('data-cta="recuperacion-elegir-plan"');
    expect(html).toContain('aria-label="Cerrar aviso"');
  });

  it("el layout de /app pinta el aviso solo sin otro aviso arriba", () => {
    const layout = readFileSync("src/app/(app)/app/layout.tsx", "utf8");
    expect(layout).toContain('const recovery = (!banner || banner === "none") && !cs && (await getRecoveryNotice(v, ent));');
    expect(layout).toContain("<RecoveryNotice account={v.id} />");
  });
});

describe("fechas: día 8 = 168 h, día 10 = 216 h", () => {
  it("abre cada ventana 24 horas, nunca fuera de ellas", () => {
    expect(recoveryStepAt(SIGNUP, at(7, -1))).toBeNull();
    expect(recoveryStepAt(SIGNUP, at(7))).toBe("recuperacion_d8");
    expect(recoveryStepAt(SIGNUP, at(8, -1))).toBe("recuperacion_d8");
    for (const d of [8, 10, 12, 13, 20]) expect(recoveryStepAt(SIGNUP, at(d)), `día ${d + 1}`).toBeNull();
    expect(recoveryStepAt(SIGNUP, at(9, -1))).toBeNull();
    expect(recoveryStepAt(SIGNUP, at(9))).toBe("recuperacion_d10");
    expect(recoveryStepAt(SIGNUP, at(10, -1))).toBe("recuperacion_d10");
  });

  it("valida el vencimiento con trialEndFor y deja fuera las cuentas de la beta", () => {
    expect(trialExpired(SIGNUP, at(7, -1))).toBe(false);
    expect(trialExpired(SIGNUP, at(7))).toBe(true);
    const beta = new Date(Date.parse(BETA_ENDS_AT) - 7 * DAY_MS).toISOString();
    expect(trialExpired(beta, at(30))).toBe(false);
    expect(recoveryStepAt(beta, new Date(Date.parse(beta) + 7 * DAY_MS))).toBeNull();
    expect(recoveryStepAt(null, at(7))).toBeNull();
  });
});

describe("audiencia", () => {
  it("prueba vencida sin plan, pagos, cortesías, tester, staff ni cobro", () => {
    expect(recoveryEligible({ ...audience, now: at(9) })).toBe(true);
    for (const k of ["staff", "paid", "comp", "tester", "hasCharge"] as const) expect(recoveryEligible({ ...audience, now: at(9), [k]: true }), k).toBe(false);
    for (const plan of ["entreno", "completo", "pro"]) expect(recoveryEligible({ ...audience, now: at(9), profilePlan: plan }), plan).toBe(false);
    expect(recoveryEligible({ ...audience, now: at(6) })).toBe(false);
  });

  it("desde el 1 de diciembre de 2026 (cardRequiredFor) una cuenta nueva no tuvo prueba: no le llega", () => {
    const before = new Date(Date.parse(CARD_REQUIRED_FROM) - 1).toISOString();
    const after = CARD_REQUIRED_FROM;
    const later = (c: string, days: number) => new Date(Date.parse(c) + days * DAY_MS);
    expect(recoveryStep({ ...audience, createdAt: before, now: later(before, 7), emailReminders: true })).toBe("recuperacion_d8");
    for (const days of [7, 9]) expect(recoveryStep({ ...audience, createdAt: after, now: later(after, days), emailReminders: true }), `día ${days + 1}`).toBeNull();
    expect(recoveryEligible({ ...audience, createdAt: after, now: later(after, 8) })).toBe(false);
  });

  it("el correo respeta la baja de recordatorios; el aviso de la app no depende de ella", () => {
    expect(recoveryStep({ ...audience, now: at(7), emailReminders: true })).toBe("recuperacion_d8");
    expect(recoveryStep({ ...audience, now: at(7), emailReminders: false })).toBeNull();
    expect(recoveryEligible({ ...audience, now: at(7) })).toBe(true);
  });
});
