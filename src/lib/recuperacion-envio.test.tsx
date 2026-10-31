// Recuperación al terminar la prueba: las plantillas y el aviso dicen lo mismo que docs/emails/recuperacion-prueba.md,
// y las reglas de fechas y audiencia (recuperacion.ts) cumplen "Fechas, audiencia y convivencia".
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RECOVERY_MAILS, recuperacionPrueba } from "@/lib/email/templates";
import { RECOVERY_NOTICE, recoveryEligible, recoveryStep, recoveryStepAt, trialExpired } from "@/lib/recuperacion";
import { BETA_ENDS_AT } from "@/lib/plans";
import { DAY_MS } from "@/lib/trial";
import { RecoveryNoticeCard } from "@/components/recovery-notice";

const doc = readFileSync("docs/emails/recuperacion-prueba.md", "utf8");
const pieces = doc.split(/^## /m).slice(1, 4);
const field = (piece: string, name: string) => piece.match(new RegExp(`\\*\\*${name}[^*]*:\\*\\*\\s*([\\s\\S]*?)\\s*(?=\\n\\*\\*|$)`))?.[1]?.trim() ?? "";
const unsubscribe = "https://bananaburn.app/api/email/baja?u=x&s=recordatorios";

const SIGNUP = "2026-11-02T12:00:00.000Z";
const at = (days: number, extraMs = 0) => new Date(Date.parse(SIGNUP) + days * DAY_MS + extraMs);
const audience = { createdAt: SIGNUP, profilePlan: "free", staff: false, paid: false, comp: false, tester: false, hasCharge: false };

describe("correos de recuperación: copy del documento", () => {
  for (const [i, day] of [[0, 8], [1, 14]] as const) {
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
    });
  }

  it("lleva baja y motivo, respeta la marca y no ofrece descuentos", () => {
    for (const day of [8, 14] as const) {
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

describe("fechas: día 8 = 7 días completos, día 14 = 13 días completos", () => {
  it("abre cada ventana 24 horas, nunca fuera de ellas", () => {
    expect(recoveryStepAt(SIGNUP, at(7, -1))).toBeNull();
    expect(recoveryStepAt(SIGNUP, at(7))).toBe("recuperacion_d8");
    expect(recoveryStepAt(SIGNUP, at(8, -1))).toBe("recuperacion_d8");
    for (const d of [8, 10, 12, 14, 20]) expect(recoveryStepAt(SIGNUP, at(d)), `día ${d + 1}`).toBeNull();
    expect(recoveryStepAt(SIGNUP, at(13))).toBe("recuperacion_d14");
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

  it("el correo respeta la baja de recordatorios; el aviso de la app no depende de ella", () => {
    expect(recoveryStep({ ...audience, now: at(7), emailReminders: true })).toBe("recuperacion_d8");
    expect(recoveryStep({ ...audience, now: at(7), emailReminders: false })).toBeNull();
    expect(recoveryEligible({ ...audience, now: at(7) })).toBe(true);
  });
});
