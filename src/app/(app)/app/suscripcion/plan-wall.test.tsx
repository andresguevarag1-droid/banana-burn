import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanGate } from "./plan-wall";
import { TrialBanner } from "./trial-banner";
import { Pricing } from "@/components/pricing";
import { PLANS, annualSaving } from "@/lib/plans";
import { money, trialNudge } from "@/lib/copy";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/hoy", useRouter: () => ({ refresh() {} }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/env", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/env")>(), isSupabaseConfigured: true }));

const wall = (props: Partial<Parameters<typeof PlanGate>[0]> = {}) =>
  renderToStaticMarkup(<PlanGate locked trialEndedOn="8 nov" {...props}><p>contenido</p></PlanGate>);

describe("Muro de planes (#91)", () => {
  it("muestra el selector compacto con anual primero y seleccionado, y oculta la sección pagada", () => {
    const html = wall();
    expect(html).not.toContain("contenido");
    expect(html).toContain("Tu prueba gratis terminó");
    const tabs = [...html.matchAll(/role="tab" aria-selected="(true|false)"[^>]*>([^<]+)/g)].map(m => [m[1], m[2].trim()]);
    expect(tabs[0]).toEqual(["true", "Anual"]);
    expect(tabs[1]?.[0]).toBe("false");
  });

  it("dice lo que se pierde sin plan: plan, progreso y racha, sin amenazar con borrar", () => {
    const html = wall();
    expect(html).toMatch(/seguir entrenando, registrar tu progreso y mantener tu racha/);
    expect(html).toContain("No se borra nada mientras decides.");
  });

  it("cada plan muestra el precio anual y el ahorro en dólares de plans.ts, con la temporada gratis", () => {
    const html = wall();
    for (const p of PLANS) {
      expect(html).toContain(`Ahorras ${money(annualSaving(p))} frente a ${money(p.price.mes)} al mes`);
      expect(html).toContain(money(p.price.anual));
    }
    expect(html.match(/Incluye 1 temporada deportiva gratis/g)?.length).toBe(PLANS.length);
  });

  it("con sesión, el botón de cada plan va al checkout anual y aparece antes del detalle desplegable", () => {
    const html = wall();
    for (const p of PLANS) {
      const btn = html.indexOf(`data-cta="pricing-${p.id}-anual"`);
      expect(btn).toBeGreaterThan(-1);
      expect(html.slice(btn - 200, btn)).toContain("<button");
      expect(html.indexOf("Ver qué incluye", btn)).toBeGreaterThan(btn);
      expect(html).toContain(`Activar ${p.name}`);
    }
    // El checkout de la prueba terminada no ofrece la prueba gratis de nuevo.
    expect(html).not.toContain("días gratis con todo incluido, sin tarjeta");
  });

  it("en el detalle compacto lo no incluido va tachado y se anuncia a lectores de pantalla", () => {
    const html = renderToStaticMarkup(<Pricing compact loggedIn />);
    const struck = PLANS.flatMap(p => p.excluded).length;
    expect(struck).toBeGreaterThan(0);
    expect(html.match(/No incluye: <\/span><s>/g)?.length).toBe(struck);
  });

  it("sin compact, /precios conserva la lista completa sin desplegable", () => {
    const html = renderToStaticMarkup(<Pricing loggedIn />);
    expect(html).not.toContain("Ver qué incluye");
    expect(html).not.toContain("<details");
    for (const p of PLANS) expect(html).toContain(`Ahorras ${money(annualSaving(p))}`);
  });

  it("si no está bloqueado o la ruta siempre abre, deja pasar el contenido", () => {
    expect(wall({ locked: false })).toBe("<p>contenido</p>");
  });

  it("con cobro en proceso no muestra planes", () => {
    const html = wall({ chargePhase: "procesando" });
    expect(html).toContain("Estamos confirmando el cobro");
    expect(html).not.toContain("pricing-");
  });

  it("con cobro fallido ofrece cambiar tarjeta y sigue mostrando los planes", () => {
    const html = wall({ chargePhase: "fallido" });
    expect(html).toContain("No pudimos cobrar tu plan");
    expect(html).toContain('data-cta="pricing-completo-anual"');
  });
});

describe("Aviso de prueba (#91)", () => {
  it.each([7, 3, 2, 1])("con %i días muestra el tiempo restante y lo que se pausa", days => {
    const html = renderToStaticMarkup(<TrialBanner daysLeft={days} />);
    expect(html).toContain(trialNudge(days).title);
    if (days > 1 && days < 7) expect(html).toContain(`Te quedan ${days} días de prueba`);
    expect(html).toMatch(/plan.*progreso.*racha.*Tus datos quedan guardados\./);
    expect(html).toContain('href="/app/suscripcion"');
  });

  it("con cobro programado sigue diciendo el monto del cobro", () => {
    const html = renderToStaticMarkup(<TrialBanner daysLeft={2} charge={{ amount: 9.99, canceled: false }} />);
    expect(html).toContain(`se cobra tu plan de ${money(9.99)}`);
  });
});
