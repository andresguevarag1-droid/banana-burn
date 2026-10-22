import { describe, expect, it } from "vitest";
import { csvCell, subFiltersFrom, subsCsv } from "./admin-csv";

describe("filtros de pagos", () => {
  it("ignora valores inválidos", () => {
    expect(subFiltersFrom({ status: "hack", plan: "completo", billing: "anual", q: "  Ana ", page: "0" })).toEqual({ status: undefined, plan: "completo", billing: "anual", q: "Ana", page: 1 });
    expect(subFiltersFrom({ status: "fallido", page: "3" }).page).toBe(3);
  });
});

describe("CSV", () => {
  it("escapa comillas, comas y fórmulas", () => {
    expect(csvCell('Ana "La Tica", CR')).toBe('"Ana ""La Tica"", CR"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
  });
  it("una fila por suscripción con fechas ISO y montos con punto", () => {
    const csv = subsCsv([{ name: "María Mora", email: "maria@gmail.com", user_id: "u1", planLabel: "Entreno · mensual", status: "active", created_at: "2026-09-21T10:00:00-06:00", current_period_start: "2026-10-21T06:00:00-06:00", current_period_end: "2026-11-21T06:00:00-06:00", monthly: 9.99, provider_customer_id: "cus_1", provider_subscription_id: "sub_1" }]);
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("María Mora,maria@gmail.com,u1,Entreno · mensual,Activa,2026-09-21,2026-10-21,2026-11-21,,9.99,cus_1,sub_1");
  });
});
