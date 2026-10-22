import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { DAY_NAMES } from "@/lib/engine";

export const metadata = { title: "Entrenar" };

export default async function Entrenar() {
  const v = (await getViewer())!;
  const d = dashboard(await getAthlete(v));
  return (
    <div className="space-y-6 animate-rise">
      <header>
        <p className="eyebrow">Semana {d.week + 1}{d.deload && " · descarga"}</p>
        <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Tu plan de la semana</h1>
        <p className="mt-2 text-muted">Ningún día se repite con el anterior o el siguiente. Los accesorios rotan cada lunes.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {d.weekPlan.map((p) => {
          const today = p.dow === d.today.dow;
          return (
            <section key={p.dow} className={`rounded-[1.5rem] p-5 border ${today ? "bg-banana border-banana shadow-lift" : "card"}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-ink/60">{DAY_NAMES[p.dow]}{today && " · hoy"}</p>
                <span className="chip bg-ink/5 text-ink">{p.tag}</span>
              </div>
              <h2 className="mt-1 text-xl font-extrabold text-ink">{p.emoji} {p.name}</h2>
              {p.exercises.length ? (
                <ul className="mt-3 divide-y divide-ink/10 text-[15px]">
                  {p.exercises.map((e) => (
                    <li key={e.id} className="py-2 flex justify-between gap-3"><span className="text-ink">{e.name}<span className="text-ink/50 text-xs"> · {e.muscle}</span></span><span className="font-bold tabular-nums text-ink">{e.cfg.sets}×{e.cfg.lo}–{e.cfg.hi}{e.cfg.unit === "s" ? " s" : e.cfg.unit === "m" ? " m" : ""}</span></li>
                  ))}
                </ul>
              ) : null}
              {p.cardio && <p className="mt-3 text-sm text-ink/70">🚶 {p.cardio}</p>}
            </section>
          );
        })}
      </div>
      <p className="text-sm text-faint text-center">🏗️ Próximo: reproductor de entreno con animaciones, cronómetro de descanso y registro de series (Fase 1).</p>
    </div>
  );
}
