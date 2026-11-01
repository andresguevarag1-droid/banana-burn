import { existsSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PLANS } from "@/lib/plans";
import { usd2 } from "@/lib/num";

vi.mock("@/app/condominios/lead-form", () => ({
  LeadForm: ({ condo }: { condo: string }) => <form aria-label="Solicitud de reunión"><input defaultValue={condo} /></form>,
}));
import Condominios, { metadata } from "@/app/condominios/page";

const report = readFileSync("marketing/condominios/revision-landing-149.md", "utf8");
const render = async (c?: string) => renderToStaticMarkup(await Condominios({ searchParams: Promise.resolve({ c }) }));

describe("landing para administraciones: QA #149", () => {
  it("ofrece la reunión desde el encabezado y apunta al formulario", async () => {
    const html = await render();
    const header = html.match(/<header[\s\S]*?<\/header>/)![0];
    expect(header).toContain('href="#reunion"');
    expect(header).toContain("Agendar reunión de 30 minutos");
    expect(html).toContain('id="reunion"');
    expect(html).toContain("Dale uso al gimnasio de tu condominio.");
    expect(html).toContain("La administración y el condominio nunca pagan nada.");
    expect(html).toContain("Después, cada residente decide si sigue");
    expect(html).toContain("Primer mes gratis con entreno y nutrición, sin tarjeta");
  });

  it("explica cuatro pasos y comparte solo conteos sin acceso al panel", async () => {
    const html = await render();
    const steps = html.match(/<ol[\s\S]*?<\/ol>/)![0];
    expect(steps.match(/<li\b/g)).toHaveLength(4);
    for (const text of ["Reunión virtual de 30 minutos", "Activamos el condominio", "Los residentes se registran", "Cada residente decide", "Sus 30 días empiezan cuando activa el beneficio, sin tarjeta."]) {
      expect(steps).toContain(text);
    }
    expect(html).toContain("cuántos residentes se unieron y cuántos entrenaron en la semana");
    expect(html).toContain("Sin nombres, datos personales ni detalles de sus entrenamientos.");
    expect(html).toContain("La administración no accede al panel interno de Banana Burn.");
  });

  it("personaliza con texto escapado y mantiene los metadatos de exclusión", async () => {
    const html = await render("Las Palmas & Sol");
    expect(html).toContain("Hola, administración de Las Palmas &amp; Sol.");
    expect(html).toContain('value="Las Palmas &amp; Sol"');
    expect(await render("<script>alert(1)</script>")).not.toContain("<script>alert(1)</script>");
    expect(metadata.robots).toEqual({ index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } });
    expect(metadata.title).toEqual({ absolute: "Banana Burn para condominios" });
    expect(metadata.description).toBe("Un entrenador personal en el celular para cada residente. El primer mes es gratis para todo el condominio.");
  });

  it("respalda los materiales prometidos y usa capturas locales reales", async () => {
    for (const file of ["presentacion-junta.pdf", "one-pager-junta.pdf"]) {
      expect(existsSync(`marketing/condominios/${file}`)).toBe(true);
    }
    const html = await render();
    for (const file of ["entreno.png", "hoy2.png"]) {
      expect(existsSync(`public/landing/${file}`)).toBe(true);
      expect(html).toContain(encodeURIComponent(`/landing/${file}`));
    }
  });

  it("mantiene precios y ejemplos de ingresos alineados con los planes", () => {
    for (const plan of PLANS) {
      expect(report).toContain(`${plan.name} ${usd2(plan.price.mes)} mensual o ${usd2(plan.price.anual)} anual`);
      for (const price of Object.values(plan.price)) expect(report).toContain(usd2(Math.round(price * 1000) / 100));
    }
    expect(report).toContain("Son cálculos condicionales, no una proyección ni una garantía.");
    expect(report).toContain("contar pagos confirmados y suscripciones vigentes");
  });
});
