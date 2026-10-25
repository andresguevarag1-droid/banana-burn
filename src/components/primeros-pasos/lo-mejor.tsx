"use client";
// "Lo mejor de Banana Burn" en Hoy: accesos a lo que hace distinta a la app (coach, aprender, temporadas, correr, retos y
// Banana Shield). Aparece cuando "Tus primeros pasos" ya no está (completada u oculta), para no amontonar, y se puede cerrar.
import Link from "next/link";
import { ArrowRight, ChatCircleText, GraduationCap, Medal, PersonSimpleRun, ShieldCheck, Users, X } from "@/components/icons";
import { LO_MEJOR_HIDDEN, showLoMejor } from "@/lib/primeros-pasos";
import { useLearnKeys } from "./learn-store";

const ITEMS = [
  { href: "/app/coach", icon: ChatCircleText, t: "Pregúntale al coach", d: "Te responde a cualquier hora" },
  { href: "/app/aprende", icon: GraduationCap, t: "Aprende a entrenar", d: "Lecciones de 30 segundos" },
  { href: "/app/temporadas", icon: Medal, t: "Temporadas", d: "Running, Raquetas y Cross Training" },
  { href: "/app/correr", icon: PersonSimpleRun, t: "Correr con GPS", d: "Distancia y ritmo por km" },
  { href: "/app/retos", icon: Users, t: "Retos", d: "Programas que transforman la app" },
  { href: "/app/glp1", icon: ShieldCheck, t: "Banana Shield", d: "Si bajas rápido o usas GLP-1" },
] as const;

export function LoMejor({ serverKeys }: { serverKeys: readonly string[] }) {
  const { keys, ready, mark } = useLearnKeys(serverKeys);
  if (!ready) return null;
  if (!showLoMejor(keys)) return null;
  return (
    <section aria-labelledby="lo-mejor-t" className="rounded-[1.75rem] bg-ink p-5 text-white sm:p-6">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="lo-mejor-t" className="text-xl font-extrabold leading-tight text-balance">Lo mejor de Banana Burn</h2>
          <p className="mt-1 text-sm text-white/70 text-pretty">Lo que hace distinta a esta app, a un toque.</p>
        </div>
        <button type="button" onClick={() => mark(LO_MEJOR_HIDDEN)} className="tap -mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full text-white/70 hover:text-white" aria-label="Ocultar lo mejor de Banana Burn">
          <X weight="bold" className="size-5" />
        </button>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ITEMS.map(({ href, icon: I, t, d }) => (
          <li key={href}>
            <Link href={href} className="pressable flex h-full flex-col gap-2 rounded-2xl bg-white/[.07] p-3.5 ring-1 ring-white/10 hover:bg-white/[.11]">
              <span className="grid size-9 place-items-center rounded-xl bg-banana text-ink"><I weight="duotone" aria-hidden className="size-5" /></span>
              <span className="font-extrabold leading-tight">{t}</span>
              <span className="mt-auto flex items-end justify-between gap-1 text-xs text-white/65 text-pretty">{d}<ArrowRight weight="bold" aria-hidden className="size-4 shrink-0 text-banana" /></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
