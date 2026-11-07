import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EX, planDay, prescribe, scheduleFor, type Equipment, type ExerciseId } from "@/lib/engine";
import { TECH } from "@/lib/engine/technique";
import { firstSessionPlan } from "@/lib/athlete";
import { loadKindOf } from "@/components/workout/logic";
import { GuidedRest, GuidedSet, guidedHint, guidedLine } from "@/components/workout/guided";
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
  it.each(["gym", "ninguno"] as const)("%s: un ejercicio por pantalla con la serie actual y un solo botón grande de Terminé la serie", (equipment) => {
    const html = render(equipment, true);
    const options = optionsOf(equipment), first = options[0][0];
    expect(html).toContain(`>${first.name}</h1>`);
    expect(html).toContain(`Ejercicio 1 de ${options.length}`);
    expect(html).toContain(`Serie 1 de 2 · ${first.rx.reps[0] ?? first.cfg.lo} repeticiones`);
    expect(html).toContain(`Clave: ${first.tech!.cues[0].replace(/^./, (c) => c.toLowerCase())}`);
    expect(html).toContain("Ver cómo se hace");
    const buttons = mainButtons(html);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toContain("Terminé la serie");
    // Nada de lo que asusta al empezar: ni lista de series, ni tarjeta previa, ni calentamiento.
    for (const t of ["Empezar serie", "Calienta primero", "Más opciones", "Cambiar"]) expect(html).not.toContain(t);
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
    expect(mainButtons(render("gym", true))[0]).toContain("Terminé la serie");
    // Y marcar no espera un peso: la condición de kilos se salta en el guiado.
    expect(readFileSync("src/app/(app)/app/entreno/player.tsx", "utf8")).toMatch(/needsLoad\(ex\) && num\(row\.kg\) <= 0 && !guided\) return/);
  });

  it("desde el segundo entreno se usa el reproductor de siempre", () => {
    const html = render("gym", false);
    expect(html).toContain("Empezar serie 1 de 2");
    expect(html).toContain("Más opciones");
    expect(html).not.toContain("Sugerido. Ajústalo");
    expect(mainButtons(html).join("")).not.toContain("Terminé la serie");
    expect(html).not.toContain(guidedHint(false, false));
  });

  it("antes de tocar dice qué hacer, con la clave completa y sin pantalla ni toque extra (#252)", () => {
    const html = render("ninguno", true);
    expect(html).toContain("Haz las repeticiones y después toca Terminé la serie.");
    // La clave puede ocupar dos líneas: nada de truncate.
    expect(html.match(/<p class="([^"]*)">Clave:/)?.[1]).not.toContain("truncate");
    const long = renderToStaticMarkup(<GuidedSet name="Peso muerto" cue="Pies separados para estabilidad" line="Serie 1 de 2 · 10 repeticiones" exNo={1} exTotal={3} onDone={() => {}} onHow={() => {}} onExit={() => {}} />);
    expect(long).toContain("Clave: pies separados para estabilidad</p>");
    // El botón sigue siendo uno, grande (80 px), y la serie sigue describiéndolo.
    expect(mainButtons(long)).toHaveLength(1);
    expect(mainButtons(long)[0]).toMatch(/h-20[^>]*>Terminé la serie/);
    expect(mainButtons(long)[0]).toContain('aria-describedby="serie-guiada"');
    // Por tiempo: primero Empezar, y con el reloj corriendo se sigue hasta 0.
    const timed = (timer: { left: number; label: string } | null) => renderToStaticMarkup(<GuidedSet name="Plancha" line="Serie 1 de 2 · 20 segundos" exNo={1} exTotal={3} timer={timer} onStart={() => {}} onDone={() => {}} onHow={() => {}} onExit={() => {}} />);
    expect(timed(null)).toContain("Toca Empezar y sigue el reloj.");
    expect(mainButtons(timed(null))[0]).toContain("Empezar");
    expect(timed({ left: 12, label: "seg" })).toContain("Sigue hasta que el reloj llegue a 0.");
    // El movimiento conserva su tamaño.
    expect(long).toContain("h-[clamp(170px,34dvh,420px)]");
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

  it("a 375 px el peso sugerido va en la tarjeta de la serie, antes de la clave (#273)", () => {
    const html = render("gym", true);
    const at = (t: string) => html.indexOf(t);
    expect(at("Sugerido. Ajústalo")).toBeGreaterThan(at('id="serie-guiada"'));
    expect(at("Sugerido. Ajústalo")).toBeLessThan(at("Clave:"));
    // El movimiento sigue arriba de todo y el nombre, debajo.
    expect(at("Ver cómo se hace")).toBeLessThan(at("<h1"));
  });

  it("si no reconoce el equipo, lo cambia por uno equivalente sin salir del guiado (#273)", () => {
    const props = { name: "Jalón al pecho", line: "Serie 1 de 2 · 10 repeticiones", exNo: 1, exTotal: 3, onDone: () => {}, onHow: () => {}, onExit: () => {} };
    const swap = renderToStaticMarkup(<GuidedSet {...props} kg={15} onKg={() => {}} onSwap={() => {}} />);
    expect(swap).toContain("¿No conoces este equipo? Usa otro");
    // Sigue habiendo un solo botón grande.
    expect(mainButtons(swap)).toHaveLength(1);
    expect(renderToStaticMarkup(<GuidedSet {...props} />)).not.toContain("No conoces este equipo");
    // Con el reloj corriendo no distrae.
    expect(renderToStaticMarkup(<GuidedSet {...props} timer={{ left: 10, label: "seg" }} onSwap={() => {}} />)).not.toContain("No conoces este equipo");
    // El reproductor lo ofrece solo con equipo (o si ya cambió) y abre la misma lista de Cambiar ejercicio.
    const src = readFileSync("src/app/(app)/app/entreno/player.tsx", "utf8");
    expect(src).toContain('onSwap={alts > 0 && (needsLoad(ex) || choice[idx] > 0) ? () => { setSwapAsk(null); setSheet("swap"); } : undefined}');
  });

  it("workout_first_set_view: vio el primer ejercicio antes de hacer la serie, una vez (#273)", async () => {
    const { cleanEvent } = await import("@/app/api/track/event");
    expect(cleanEvent({ name: "workout_first_set_view", props: { first_session: true, template: "pushA", guided: true } })).toEqual({ name: "workout_first_set_view", props: { first_session: true, template: "pushA", guided: true } });
    const src = readFileSync("src/app/(app)/app/entreno/player.tsx", "utf8");
    expect(src).toMatch(/if \(viewedFirst\.current \|\| !restored \|\| gate \|\| phase !== "play" \|\| doneSets > 0 \|\| !exercises\.length\) return;/);
    expect(src).toContain('track("workout_first_set_view", { first_session: firstSession, template: tpl, ...(guided ? { guided: true } : {}) });');
  });

  it("workout_first_set y workout_leave siguen igual, con guided: true", () => {
    const src = readFileSync("src/app/(app)/app/entreno/player.tsx", "utf8");
    expect(src).toMatch(/track\("workout_first_set", \{ first_session: firstSession, template: tpl, total: planTotal, \.\.\.\(guided \? \{ guided: true \} : \{\}\) \}\)/);
    expect(src).toMatch(/track\("workout_leave", \{[^}]*seconds_on_screen:[^}]*\), \.\.\.\(guided \? \{ guided: true \} : \{\}\) \}\)/);
  });
});
