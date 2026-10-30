// El checklist del lanzamiento y del primer cobro (docs/qa/lanzamiento-y-cobro.md) cita horas de los crons, fechas de la
// beta, montos del 50 % y pantallas del panel: estas pruebas vigilan que sigan iguales al código y que cada fila tenga hora,
// responsable y acción ante la falla.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { usd2 } from "@/lib/num";
import { BETA_ENDS_AT, BETA_GRACE_UNTIL } from "@/lib/plans";
import { MAX_ATTEMPTS, REMINDER_DAYS_BEFORE, RETRY_AFTER_DAYS, promoPrice } from "@/lib/trial";

const doc = readFileSync("docs/qa/lanzamiento-y-cobro.md", "utf8");
const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string; schedule: string }[] };
const adminNav = readFileSync("src/app/admin/layout.tsx", "utf8");

const CR_OFFSET_H = -6;
const cells = (line: string) => line.split("|").slice(1, -1).map((c) => c.trim());
const checkRows = doc.split("\n").filter((l) => /^\| [A-E]\d+ \|/.test(l)).map(cells);
const crHour = (iso: string) => {
  const d = new Date(Date.parse(iso) + CR_OFFSET_H * 3600_000);
  return { day: d.getUTCDate(), hm: `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}` };
};

describe("checklist del lanzamiento y del primer cobro", () => {
  it("cada fila tiene hora, responsable, acción ante la falla y columna de resultado", () => {
    expect(checkRows.length).toBeGreaterThanOrEqual(30);
    const ids = checkRows.map((r) => r[0]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [id, hora, resp, donde, que, falla, resultado] of checkRows) {
      expect(hora, id).toMatch(/\d{2}:\d{2}/);
      expect(["Andrés", "Grace", "Adrian", "Andrés y Grace"], id).toContain(resp);
      expect(donde, id).not.toBe("");
      expect(que, id).not.toBe("");
      expect(falla, id).not.toBe("");
      expect(resultado, id).toBe("");
    }
  });

  it("las horas de los crons coinciden con vercel.json en hora de Costa Rica", () => {
    for (const { path, schedule } of vercel.crons) {
      const [min, hourUtc] = schedule.split(" ").map(Number);
      const h = (hourUtc + CR_OFFSET_H + 24) % 24;
      const hm = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      expect(doc, path).toContain(`| ${hm} diario | Cron de ${path.split("/").pop()} (\`${path}\`)`);
    }
  });

  it("el fin de la beta y del periodo de gracia caen a las 00:00 del 1 y del 8 de noviembre", () => {
    expect(crHour(BETA_ENDS_AT)).toEqual({ day: 1, hm: "00:00" });
    expect(crHour(BETA_GRACE_UNTIL)).toEqual({ day: 8, hm: "00:00" });
    expect(doc).toContain("| 00:00 del 1 nov |");
    expect(doc).toContain("| 00:00 del 8 nov |");
  });

  it("los avisos, reintentos y montos son los del código", () => {
    expect(REMINDER_DAYS_BEFORE).toBe(2);
    expect(doc).toContain("aviso de 48 horas antes del cobro");
    expect(RETRY_AFTER_DAYS).toBe(1);
    expect(doc).toContain("vence 1 día después del rechazo");
    expect(doc).toContain(`hasta ${MAX_ATTEMPTS} intentos`);
    expect(doc).toContain(`son ${usd2(promoPrice("entreno"))} (Entreno) y ${usd2(promoPrice("completo"))} (Completo)`);
  });

  it("las pantallas del panel y los archivos citados existen", () => {
    for (const href of ["/admin/salud", "/admin/pagos", "/admin/usuarios"]) {
      expect(doc).toContain(href);
      expect(adminNav).toContain(`href: "${href}"`);
    }
    expect(adminNav).toContain('href: "/admin/notificaciones", label: "Avisos"');
    for (const f of ["docs/simulacro-cobros.md", "docs/metas/tablero-diario.md", "marketing/estrategia/correos/08-oferta-50-tarjeta.md", "supabase/migrations/0062_llaves_cobro.sql", "src/app/api/pagos/webhook/route.ts", "src/app/api/salud/route.ts"]) {
      expect(existsSync(f), f).toBe(true);
    }
    for (const code of ["pagos/llave-ocupada", "pagos/llave-error", "pagos/cobro-por-confirmar", "pagos/renovacion-por-confirmar"]) {
      expect(doc).toContain(code);
    }
  });

  it("nombra variables de entorno que existen (en .env.example, o NEXT_PUBLIC_BETA_ENDS_AT en plans.ts)", () => {
    const example = readFileSync(".env.example", "utf8");
    const plans = readFileSync("src/lib/plans.ts", "utf8");
    const named = [...doc.matchAll(/`([A-Z][A-Z0-9_]+)`/g)].map((m) => m[1]).filter((v) => /^(ONVO|TILOPAY|RESEND|CRON|NEXT_PUBLIC|OPS)_/.test(v));
    expect(named.length).toBeGreaterThan(5);
    for (const v of named) expect(new RegExp(`^#?\\s*${v}=`, "m").test(example) || plans.includes(`process.env.${v}`), v).toBe(true);
  });
});
