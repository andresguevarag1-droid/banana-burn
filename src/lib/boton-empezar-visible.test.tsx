// #315: el botón de empezar se ve sin desplazar en "¿Entrenamos ahora?" (320 × 568) y en Hoy (390 × 664). Sin navegador en
// las pruebas, se revisa lo que va antes del botón: nada de cinta del programa, aviso largo de la prueba ni mascota, y
// ningún botón tapado por la barra de abajo.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { trialNudge } from "@/lib/copy";
import { TrialBanner } from "@/app/(app)/app/suscripcion/trial-banner";
import { NowOrLater } from "@/app/(app)/app/primer-entreno/now-or-later";
import { ProgramRibbon } from "@/components/programas/program-ribbon";

let pathname = "/app";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }) }));
vi.mock("@/app/actions/notifications", () => ({ saveNotificationPrefs: async () => ({ ok: true }) }));

const LEGAL = "Al terminar, sin un plan activo se pausa el acceso a tu plan y al seguimiento de tu progreso.";

describe("aviso de la prueba en una línea (#315)", () => {
  it.each([7, 5, 2, 1])("con %i días: arriba solo el título y Ver mi plan; el detalle, plegado", (days) => {
    const html = renderToStaticMarkup(<TrialBanner daysLeft={days} />);
    const n = trialNudge(days);
    const folded = html.slice(html.indexOf("<details"), html.indexOf("</details>"));
    const summary = folded.slice(folded.indexOf("<summary"), folded.indexOf("</summary>"));
    expect(summary).toContain(n.title);
    expect(summary).not.toContain(n.body);
    // No se quita ningún dato: el cuerpo y el texto de la pausa siguen en el aviso, dentro del plegado.
    expect(folded).toContain(n.body);
    expect(folded).toContain(LEGAL);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    // El enlace a Mi plan queda en la misma línea, fuera del plegado.
    expect(html.slice(html.indexOf("</details>"))).toContain('href="/app/suscripcion"');
  });

  it("con cobro programado, el monto sigue en la línea visible", () => {
    const html = renderToStaticMarkup(<TrialBanner daysLeft={2} charge={{ amount: 9.99, canceled: false }} />);
    expect(html.slice(html.indexOf("<summary"), html.indexOf("</summary>"))).toContain(trialNudge(2, undefined, { amount: 9.99, canceled: false }).title);
  });
});

describe("¿Entrenamos ahora? sin nada antes del botón (#315)", () => {
  it("el título, una línea y el botón de empezar van primero; gym y Ahora no, debajo", () => {
    const html = renderToStaticMarkup(<NowOrLater />);
    const start = html.indexOf('data-cta="primer-entreno-casa"');
    expect(start).toBeGreaterThan(0);
    const before = html.slice(0, start);
    // Antes del botón: el h1 y una sola línea de texto, sin mascota ni otra imagen.
    expect(before.indexOf("<h1")).toBeGreaterThanOrEqual(0);
    expect(before.match(/<p[\s>]/g)).toHaveLength(1);
    expect(before.slice(0, before.indexOf("<h1"))).not.toContain("<svg");
    expect(html.indexOf('data-cta="primer-entreno-gym"')).toBeGreaterThan(start);
    expect(html.indexOf('data-cta="primer-entreno-despues"')).toBeGreaterThan(start);
  });

  it("la cinta del programa no sale en esa pantalla (sí en las demás secciones)", () => {
    const p = { slug: "reconstruccion-total", title: "Reconstrucción Total", mode: "Programa activo", cover: "banana" as const, icon: "barbell", at: "semana 1 de 8" };
    pathname = "/app/primer-entreno";
    expect(renderToStaticMarkup(<ProgramRibbon p={p} />)).toBe("");
    pathname = "/app/progreso";
    expect(renderToStaticMarkup(<ProgramRibbon p={p} />)).toContain("Reconstrucción Total");
  });

  it("el aviso de la prueba tampoco", () => {
    const layout = readFileSync("src/app/(app)/app/layout.tsx", "utf8");
    expect(layout).toContain("<HideOnPath path={FIRST_WORKOUT_PATH}><HideOnPath path={hoyAsk ? \"/app\" : \"\"}><TrialBanner");
  });
});

describe("nada debajo de la barra de abajo (#315)", () => {
  it("el contenido de la app deja el alto de la barra más la zona segura del teléfono", () => {
    const layout = readFileSync("src/app/(app)/app/layout.tsx", "utf8");
    const main = layout.match(/<main id="contenido"[^>]*className="([^"]+)"/)?.[1] ?? "";
    expect(main).toContain("pb-[calc(8rem+env(safe-area-inset-bottom))]");
    expect(main).not.toMatch(/(^|\s)pb-32(\s|$)/);
    // La barra fija mide unos 4.5 rem más su propia zona segura: 8 rem dejan el último botón libre.
    expect(readFileSync("src/components/app-nav.tsx", "utf8")).toContain("fixed bottom-0 inset-x-0 z-40 border-t border-line bg-white/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]");
  });
});
