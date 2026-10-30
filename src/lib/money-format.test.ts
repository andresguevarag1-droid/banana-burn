import { describe, expect, it } from "vitest";
import { usd2 } from "./num";
import { money } from "./copy";
import { usd as planUsd } from "./plans";
import { usd as challengeUsd } from "./challenges";
import { reminderLine } from "./trial";
import { money as mailMoney, recordatorioCobro } from "./email/templates";

// Todos los montos de la app y de los correos salen con el mismo formato es-419 (issue #46).
describe("dinero en es-419 en toda la app", () => {
  const amounts: [number, string][] = [[9.99, "$9.99"], [14.99, "$14.99"], [4.99, "$4.99"], [1040, "$1,040.00"], [1234567.891, "$1,234,567.89"]];

  it("copy.ts money, usd2 y el money de los correos dan lo mismo", () => {
    for (const [n, s] of amounts) {
      expect(usd2(n)).toBe(s);
      expect(money(n)).toBe(s);
      expect(mailMoney(n)).toBe(s);
    }
  });
  it("el precio de un reto (centavos) usa coma de miles y punto decimal", () => {
    expect(challengeUsd(699)).toBe("$6.99");
    expect(challengeUsd(104000)).toBe("$1,040.00");
  });
  it("plans.ts usd omite decimales solo en montos enteros", () => {
    expect(planUsd(9.99)).toBe("$9.99");
    expect(planUsd(60)).toBe("$60");
    expect(planUsd(1040)).toBe("$1,040");
    expect(planUsd(1040.5)).toBe("$1,040.50");
  });
  it("el aviso de cobro en la app y en el correo muestran el mismo monto", () => {
    expect(reminderLine(1040)).toContain("$1,040.00");
    const mail = recordatorioCobro({ name: "Ana", plan: "Entreno", amount: 1040, chargeAt: "2026-11-08", kind: "prueba" });
    expect(mail.subject).toBe("En 2 días se cobra tu plan de $1,040.00");
  });
});
