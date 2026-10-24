import { describe, expect, test } from "vitest";
import { ALTS, BEGINNER, EX, EXPRESS_POOL, HOME, NOEQUIP, SLOTS, TPL } from "@/lib/engine/data";
import { TECH } from "@/lib/engine/technique";
import { ALL_PROGRAM_SEED, PROGRAM_SEED_BY_SLUG } from "@/lib/program-seed";
import { LIB_ANIM, animFor, getLibEx } from "@/lib/library";
import { ANIM_KEYS, SHEET_MOTION, sheetFor } from "@/lib/exercise-frames";
import { COACHES, coachArt } from "@/lib/coaches";
import { SHARED_SHEET, VETTED_ANIM } from "@/lib/technique-audit";

/** Animación que el código muestra para un ejercicio (la misma lógica que el reproductor, las fichas y los programas). */
const resolved = (id: string): string | null => {
  if (id.startsWith("ds:")) { const x = getLibEx(id.slice(3)); return x ? animFor(x) : null; }
  return TECH[id]?.anim || null;
};

/** Todo lo que alguien puede ver: rutinas, ranuras, exprés, sustitutos, alternativas y sesiones de programas. */
function visibleIds() {
  const ids = new Set<string>();
  for (const t of Object.values(TPL)) for (const e of t.ex) { if (e.id) ids.add(e.id); if (e.slot) SLOTS[e.slot].forEach((s) => ids.add(s)); }
  EXPRESS_POOL.forEach((e) => ids.add(e.id));
  for (const m of [HOME, NOEQUIP, BEGINNER]) Object.values(m).forEach((v) => ids.add(v as string));
  Object.values(ALTS).flat().forEach((a) => ids.add(a));
  Object.keys(EX).forEach((k) => ids.add(k));
  for (const p of ALL_PROGRAM_SEED) for (const s of p.sessions) for (const e of s.exercises) { ids.add(e.id); if (e.home) ids.add(e.home); }
  return [...ids].sort();
}

describe("técnica: cada ejercicio muestra SU movimiento o ninguno", () => {
  test("todo ejercicio visible está en la lista revisada y resuelve exactamente esa animación", () => {
    const missing = visibleIds().filter((id) => !(id in VETTED_ANIM));
    expect(missing, "Ejercicios nuevos sin revisar: agrega cada uno a VETTED_ANIM (src/lib/technique-audit.ts) tras mirar su hoja").toEqual([]);
    const wrong = visibleIds().filter((id) => resolved(id) !== VETTED_ANIM[id]).map((id) => `${id}: muestra ${resolved(id)}, revisado ${VETTED_ANIM[id]}`);
    expect(wrong).toEqual([]);
  });

  test("toda animación revisada tiene hoja, y ninguna hoja se reparte entre movimientos distintos", () => {
    for (const [id, anim] of Object.entries(VETTED_ANIM)) if (anim) expect(sheetFor(anim), `${id} → ${anim}`).not.toBeNull();
    // Un ejercicio del motor con hoja ajena solo si está en SHARED_SHEET (mismo movimiento, cambia tempo/agarre/carga).
    const borrowed = Object.entries(VETTED_ANIM).filter(([id, a]) => a && !id.startsWith("ds:") && a !== id && SHARED_SHEET[id] !== a);
    expect(borrowed).toEqual([]);
    for (const [id, a] of Object.entries(SHARED_SHEET)) expect(VETTED_ANIM[id], id).toBe(a);
  });

  test("los cambios de mapeo que motivaron la revisión siguen corregidos", () => {
    // Antes: press de piso → press banca, remo invertido → remo con barra, jalón con banda → dominada, puente → plancha…
    expect(resolved("floorpress")).toBe("floorpress");
    expect(resolved("invrow")).toBe("invrow");
    expect(resolved("bandpull")).toBe("bandpull");
    expect(resolved("lat")).toBe("lat");
    expect(resolved("goblet")).toBe("goblet");
    for (const id of ["glutebridge", "bicycle", "legraisef", "bearcrawl"]) expect(resolved(id), id).not.toBe("plank");
    for (const id of ["ytw", "jacks"]) expect(resolved(id), id).not.toBe("lateral");
    for (const id of ["lunge", "bulgarian"]) expect(resolved(id), id).not.toBe("squat_bw");
  });

  test("toda animación del motor y de la biblioteca tiene hoja", () => {
    for (const [id, t] of Object.entries(TECH)) if (t.anim) expect(sheetFor(t.anim), id).not.toBeNull();
    for (const [id, a] of Object.entries(LIB_ANIM)) expect(sheetFor(a), id).not.toBeNull();
    for (const id of Object.keys(LIB_ANIM)) expect(getLibEx(id), id).not.toBeNull();
  });

  test("la biblioteca no adivina por el nombre: variantes sin hoja propia no muestran animación", () => {
    const lib = (id: string) => animFor(getLibEx(id)!);
    expect(lib("0025")).toBe("bench"); // press banca con barra
    expect(lib("0499")).toBe("invrow"); // remo invertido: no el remo con barra
    expect(lib("1760")).toBe("goblet"); // goblet: no la sentadilla frontal con barra
    expect(lib("0413")).toBeNull(); // dumbbell squat
    expect(lib("0289")).toBeNull(); // dumbbell bench press (antes mostraba el press militar con mancuernas)
    expect(lib("0533")).toBeNull(); // kettlebell front squat
  });

  test("las hojas nuevas traen fases y dirección; las de motion.ts no se pisan salvo el salto", () => {
    for (const k of Object.keys(SHEET_MOTION)) expect(ANIM_KEYS, k).toContain(k);
    for (const m of Object.values(SHEET_MOTION)) expect(m.ph.length).toBeGreaterThan(0);
  });
});

describe("Coach Platanita", () => {
  const pl = COACHES.platanita;
  test("cada ejercicio de pilates tiene su ilustración", () => {
    const p = PROGRAM_SEED_BY_SLUG["pilates-casa-30"];
    const ids = new Set(p.sessions.flatMap((s) => s.exercises.flatMap((e) => [e.id, ...(e.home ? [e.home] : [])])));
    expect([...ids].filter((id) => !coachArt(pl, id))).toEqual([]);
  });

  test("las dos de pilates que faltaban por créditos ya tienen ilustración", () => {
    expect(coachArt(pl, "ds:3663")).toMatch(/cloudfront\.net\/.+_min\.webp$/);
    expect(coachArt(pl, "planktap")).toMatch(/cloudfront\.net\/.+_min\.webp$/);
  });

  test("Banana Girl: cada ejercicio tiene ilustración de Platanita o una animación revisada", () => {
    const p = PROGRAM_SEED_BY_SLUG["banana-girl"];
    const ids = new Set(p.sessions.flatMap((s) => s.exercises.flatMap((e) => [e.id, ...(e.home ? [e.home] : [])])));
    expect([...ids].filter((id) => !coachArt(pl, id) && !(VETTED_ANIM[id] && sheetFor(VETTED_ANIM[id]!)))).toEqual([]);
  });
});
