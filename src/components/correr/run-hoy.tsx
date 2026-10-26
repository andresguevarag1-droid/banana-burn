// Resumen de running en Hoy: aparece si corriste en las últimas 3 semanas o tienes la Temporada Running.
// km de la semana, mejor ritmo y lo que sigue. Hoy nunca se rompe por esto: si algo falla, no aparece.
import Link from "next/link";
import { ArrowRight, Sneaker } from "@/components/icons";
import type { Viewer } from "@/lib/supabase/server";
import { getRunningView } from "@/lib/running-server";
import { weekRecap } from "@/lib/run-badges";
import { fmtPace } from "@/lib/runs";
import { addDays } from "@/lib/run-plan";

export async function RunHoy({ v }: { v: Viewer }) {
  try {
    const r = await getRunningView(v);
    const recent = r.runs.some((x) => x.day >= addDays(r.today, -21));
    if (!recent && !r.owned) return null;
    const w = weekRecap(r.runs, r.today);
    const next = r.owned && r.next ? (r.next.status === "hoy" ? `Hoy: ${r.next.title.toLowerCase()}, ${r.next.detail}` : `Siguiente: ${r.next.title.toLowerCase()}`) : r.daysToRace != null ? `Faltan ${r.daysToRace} días para tu carrera` : null;
    return (
      <Link href="/app/correr" className="card flex items-center gap-4 p-4 transition-transform duration-150 active:scale-[.99]" aria-label="Banana Run: tu semana de running">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--run)] text-white"><Sneaker weight="duotone" className="size-6" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold text-ink">Esta semana: {w.km} km{w.runs ? `, ${w.runs} ${w.runs === 1 ? "carrera" : "carreras"}` : ""}</span>
          <span className="block truncate text-sm text-muted">{[w.bestPace ? `Mejor ritmo ${fmtPace(w.bestPace)}/km` : null, next].filter(Boolean).join(". ") || "Sal a correr y registra tu carrera."}</span>
        </span>
        <ArrowRight className="size-5 shrink-0 text-muted" />
      </Link>
    );
  } catch (e) {
    console.error("[running] hoy", e instanceof Error ? e.name : "error");
    return null;
  }
}
