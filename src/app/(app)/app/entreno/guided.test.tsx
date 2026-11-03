import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EX, planDay, prescribe, scheduleFor, type Equipment, type ExerciseId } from "@/lib/engine";
import { TECH } from "@/lib/engine/technique";
import { firstSessionPlan } from "@/lib/athlete";
import { loadKindOf } from "@/components/workout/logic";
import { GuidedRest, GuidedSet, guidedLine } from "@/components/workout/guided";
import { Readiness } from "@/components/readiness";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }) }));
vi.mock("@/components/analytics", () => ({ track: () => {} }));
// Las clases de animación del reproductor no importan aquí (y Vite no corre el PostCSS de Tailwind en las pruebas).
vi.mock("@/components/workout/workout.module.css", () => ({ default: new Proxy({}, { get: (_, k) => String(k) }) }));

const { Player } = await import("./player");
type Options = Parameters<typeof Player>[0]["options"];

// Mismo recorte del dashboard que usan Hoy y /app/entreno, y los ejercicios como los arma page.tsx (sin historial).
const firstPlan = (equipment: Equipment) => {
  const engineSched = scheduleFor(6);
  const opts = { equipment, level: "principiante" as const, minutes: undefined, sex: "m" as const };
  return firstSessionPlan({ program: null, plan: planDay(1, 0, engineSched, opts), engineSched, today: { dow: 1 } as never, week: 0, opts }, 0)!;
};
const optionsOf = (equipment: Equipment): Options => firstPlan(equipment).exercises.map((e) => {
  const id = e.id as ExerciseId, inc = EX[id].inc;
  return [{ id, name: EX[id].n, muscle: EX[id].m, cfg: e.cfg, tech: TECH[id] ?? null, bw: inc === 0, barbell: false, load: loadKindOf(id, { inc }), rx: prescribe(id, e.cfg, []), best: 0, lastSets: null }];
});
const render = (equipment: Equipment, firstSession: boolean) => renderToStaticMarkup(
  <Player firstSession={firstSession} template="pushA" title="Cuerpo completo para empezar" icon="bolt" options={optionsOf(equipment)} dateKey="2026-11-03" gam={{ xp: 0, streak: 0, todayDone: false }} />,
);
/** Botones grandes del pie (los que se tocan con el pulgar). */
const mainButtons = (html: string) => html.match(/data-tour="done"[^>]*>.*?<\/button>/g) ?? [];

describe("primer entreno guiado (#226)", () => {
  it.each(["gym", "ninguno"] as const)("%s: un ejercicio por pantalla con la serie actual y un solo botón grande de Hecho", (equipment) => {
    const html = render(equipment, true);
    const options = optionsOf(equipment), first = options[0][0];
    expect(html).toContain(`>${first.name}</h1>`);
    expect(html).toContain(`Ejercicio 1 de ${options.length}`);
    expect(html).toContain(`Serie 1 de 2 · ${first.rx.reps[0] ?? first.cfg.lo} repeticiones`);
    expect(html).toContain(`Clave: ${first.tech!.cues[0].replace(/^./, (c) => c.toLowerCase())}`);
    expect(html).toContain("Ver cómo se hace");
    const buttons = mainButtons(html);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toContain("Hecho");
    // Nada de lo que asusta al empezar: ni lista de series, ni tarjeta previa, ni calentamiento.
    for (const t of ["Terminé la serie", "Empezar serie", "Calienta primero", "Más opciones", "Cambiar"]) expect(html).not.toContain(t);
  });

  it("con mancuerna muestra el peso sugerido para ajustar, sin exigirlo", () => {
    const html = render("gym", true);
    expect(html).toContain("Sugerido. Ajústalo si quieres.");
    expect(html).toContain('aria-label="Más peso"');
    expect(html).not.toContain("Elige un peso");
    expect(render("ninguno", true)).not.toContain("Sugerido. Ajústalo");
  });

  it("un ejercicio con carga no baja a 0 kg con Menos peso (QA #226)", () => {
    const set = (kg: number) => renderToStaticMarkup(<GuidedSet name="Press" line="Serie 1 de 2 · 10 repeticiones" exNo={1} exTotal={4} kg={kg} kgMin={1} onKg={() => {}} onDone={() => {}} onHow={() => {}} onExit={() => {}} />);
    const minus = (html: string) => html.match(/<button[^>]*aria-label="Menos peso"[^>]*>/)?.[0] ?? "";
    expect(minus(set(1))).toContain('disabled=""');
    expect(set(1)).not.toContain("Sin peso");
    expect(minus(set(4))).not.toContain('disabled=""');
    // Y el paso de kilos del reproductor respeta ese mínimo.
    const src = readFileSync("src/app/(app)/app/entreno/player.tsx", "utf8");
    expect(src).toContain('onKg={(d) => step(activeSet, "kg", d, guidedMinKg)} kgMin={guidedMinKg}');
    expect(src).toMatch(/const next = Math\.max\(min, bump\(/);
  });

  it("del Empezar de Hoy a la primera serie marcada hay 2 toques", () => {
    // Toque 1: el botón de Hoy lleva directo a /app/entreno. Toque 2: el único botón grande del guiado marca la serie.
    const hoy = renderToStaticMarkup(<Readiness first initial={0} dateKey="2026-11-03" demo={false} mins={12} />);
    expect(hoy.match(/<a [^>]*href="([^"]+)"/)?.[1]).toBe("/app/entreno");
    expect(mainButtons(render("gym", true))[0]).toContain("Hecho");
    // Y marcar no espera un peso: la condición de kilos se salta en el guiado.
    expect(readFileSync("src/app/(app)/app/entreno/player.tsx", "utf8")).toMatch(/needsLoad\(ex\) && num\(row\.kg\) <= 0 && !guided\) return/);
  });

  it("desde el segundo entreno se usa el reproductor de siempre", () => {
    const html = render("gym", false);
    expect(html).toContain("Empezar serie 1 de 2");
    expect(html).toContain("Más opciones");
    expect(html).not.toContain("Sugerido. Ajústalo");
    expect(mainButtons(html).join("")).not.toContain("Hecho");
  });

  it("la línea de la serie usa el valor sugerido, también por tiempo", () => {
    expect(guidedLine({ setNo: 1, sets: 2, reps: "10", lo: 8, hi: 12 })).toBe("Serie 1 de 2 · 10 repeticiones");
    expect(guidedLine({ setNo: 2, sets: 2, reps: "20", unit: "s", lo: 20, hi: 30 })).toBe("Serie 2 de 2 · 20 segundos");
  });

  it("el descanso trae cuenta regresiva, lo que sigue y Saltar", () => {
    const html = renderToStaticMarkup(<GuidedRest left={42} total={60} next={{ name: "Press inclinado", line: "Serie 1 de 2 · 10 repeticiones" }} onSkip={() => {}} />);
    expect(html).toContain(">42<");
    expect(html).toContain("Press inclinado");
    expect(html).toContain(">Saltar</button>");
  });

  it("cabe en 375 px: nada más ancho que la pantalla y sin scroll horizontal", () => {
    const html = render("gym", true) + renderToStaticMarkup(<GuidedRest left={42} total={60} next={null} onSkip={() => {}} />);
    const widths = [...html.matchAll(/width:\s*(\d+)px|w-\[(\d+)px\]|min-w-\[(\d+)px\]/g)].map((m) => Number(m[1] ?? m[2] ?? m[3]));
    for (const w of widths) expect(w).toBeLessThanOrEqual(375 - 2 * 20);
    expect(html).toContain("overflow-x-hidden");
  });

  it("workout_first_set y workout_leave siguen igual, con guided: true", () => {
    const src = readFileSync("src/app/(app)/app/entreno/player.tsx", "utf8");
    expect(src).toMatch(/track\("workout_first_set", \{ first_session: firstSession, template: tpl, total: planTotal, \.\.\.\(guided \? \{ guided: true \} : \{\}\) \}\)/);
    expect(src).toMatch(/track\("workout_leave", \{[^}]*seconds_on_screen:[^}]*\), \.\.\.\(guided \? \{ guided: true \} : \{\}\) \}\)/);
  });
});
