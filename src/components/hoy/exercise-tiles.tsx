// Ejercicios de hoy como fichas con imagen: Coach Banana haciendo la técnica (fotograma quieto), nombre, series y
// repeticiones en el registro de la persona y músculo. En el teléfono se desliza de lado; en pantalla grande, cuadrícula.
// Tocar una ficha abre la página de técnica del ejercicio. Servidor (solo la imagen es de cliente, por el respaldo).
import Image from "next/image";
import Link from "next/link";
import { SafeImage, SheetFrame } from "@/components/safe-image";
import { TECH } from "@/lib/engine/technique";
import { sheetFor } from "@/lib/exercise-frames";
import { DS_ID, animFor, getLibEx } from "@/lib/library";
import { setsReps, t, type Voice, muscleText } from "@/lib/voice";
import type { SlotCfg } from "@/lib/engine";

export type TileExercise = { id: string; name: string; muscle: string; cfg: Pick<SlotCfg, "sets" | "lo" | "hi" | "unit"> };

/** Animación de técnica de un ejercicio del motor ("squat") o de la biblioteca ("ds:0043"). */
function animOf(id: string): string | null {
  if (id.startsWith("ds:")) { const x = getLibEx(id.slice(3)); return x ? animFor(x) : null; }
  return TECH[id]?.anim || null;
}
/** Página de técnica: la ficha de la biblioteca del ejercicio, o la búsqueda por nombre si no tiene ficha. */
export function techniqueHref(e: Pick<TileExercise, "id" | "name">) {
  if (e.id.startsWith("ds:")) return `/app/ejercicios/${e.id.slice(3)}`;
  return DS_ID[e.id] ? `/app/ejercicios/${DS_ID[e.id]}` : `/app/ejercicios?q=${encodeURIComponent(e.name)}`;
}

/** `art`: ilustración del coach del programa haciendo cada ejercicio (Coach Platanita); manda sobre la animación. */
export function ExerciseTiles({ exercises, voice, label = "Ejercicios de hoy", art }: { exercises: TileExercise[]; voice: Voice; label?: string; art?: Record<string, string> }) {
  return (
    <ol aria-label={label} className="-mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-5 px-5 pb-1 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:snap-none lg:grid-cols-2 lg:overflow-visible lg:px-0 xl:grid-cols-3">
      {exercises.map((e, i) => {
        const anim = animOf(e.id);
        const sheet = anim ? sheetFor(anim) : null;
        const cell = sheet ? (sheet.cells ? sheet.cells[Math.min(sheet.cells.length - 1, 1)] : 1) : 0;
        const pic = art?.[e.id];
        return (
          <li key={`${e.id}-${i}`} className="w-[10.5rem] shrink-0 snap-start lg:w-auto">
            <Link href={techniqueHref(e)} className="pressable group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_0_rgb(27_21_5/.08)] hover:shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              <span className={`relative block aspect-[4/3] ${pic ? "bg-[#F3E8FF]" : "bg-banana-soft"}`}>
                {pic ? <SafeImage src={pic} alt="" fill sizes="(min-width: 1024px) 240px, 168px" className="object-contain" fallbackClassName="object-contain p-2" /> : sheet ? <SheetFrame src={sheet.url} grid={sheet.grid} cell={cell} sizes={sheet.grid === 3 ? "504px" : "336px"} /> : <Image src="/brand/mascota-sola.webp" alt="" fill sizes="168px" className="object-contain p-2" />}
                <span className="absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-ink text-xs font-extrabold text-banana tabular-nums">{i + 1}</span>
              </span>
              <span className="flex flex-1 flex-col p-3">
                <span className="line-clamp-2 text-[15px] font-extrabold leading-tight text-ink">{e.name}</span>
                <span className="mt-1 text-sm font-bold text-ink tabular-nums">{setsReps(voice, e.cfg.sets, e.cfg.lo, e.cfg.hi, e.cfg.unit)}{voice !== "basico" && !e.cfg.unit ? " reps" : ""}</span>
                {e.muscle && <span className="mt-0.5 text-xs font-semibold text-ink/70">{t(voice, { basico: "Trabaja: ", intermedio: "", tecnico: "" })}{muscleText(voice, e.muscle.toLowerCase())}</span>}
                <span className="mt-auto pt-2 text-xs font-bold text-ink/70 underline decoration-ink/25 underline-offset-2 group-hover:decoration-ink">{t(voice, { basico: "Ver cómo se hace", intermedio: "Ver técnica", tecnico: "Técnica" })}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
