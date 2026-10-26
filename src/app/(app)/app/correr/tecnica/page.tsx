import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { getRunningSeason } from "@/lib/running-server";
import { DRILLS, drillDose, GROUP_HINT, GROUP_LABEL, drillAnim, drillsBy, type Drill, type DrillGroup } from "@/lib/run-drills";
import { ExerciseMotion } from "@/components/exercise-motion";
import { Locked } from "@/components/correr/run-hub";

export const metadata = { title: "Técnica de carrera" };
const GROUPS: DrillGroup[] = ["calentamiento", "tecnica", "fuerza", "enfriar"];

function DrillCard({ d }: { d: Drill }) {
  const anim = drillAnim(d);
  return (
    <li className="card overflow-hidden">
      <div className="aspect-square bg-[var(--run-soft)]">{anim ? <ExerciseMotion anim={anim} label={false} className="h-full w-full" cues={d.cues} /> : <div className="grid h-full place-items-center p-6 text-center text-sm font-bold text-[var(--run)]">Corre 20 segundos, acelerando poco a poco hasta un ritmo rápido y suelto.</div>}</div>
      <div className="space-y-1 p-4">
        <h3 className="text-lg font-extrabold text-ink">{d.name}</h3>
        <p className="text-sm font-bold text-[var(--run)]">{drillDose(d)}</p>
        <ul className="text-sm text-body">{d.cues.map((c) => <li key={c}>{c}</li>)}</ul>
      </div>
    </li>
  );
}

export default async function Tecnica() {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/app/correr/tecnica");
  const rs = await getRunningSeason(v);
  const seasonHref = rs.season ? `/app/temporadas/${rs.season.slug}` : "/app/temporadas";
  return (
    <div className="space-y-6 animate-rise">
      <Link href="/app/correr" className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Banana Run</Link>
      <header className="space-y-1"><h1 className="text-3xl font-extrabold tracking-tight text-ink">Técnica de carrera</h1><p className="text-body">Calentamiento, técnica, fuerza y enfriamiento para correr mejor y con menos molestias. Tu plan te dice cuándo hacer cada grupo.</p></header>
      {rs.owned ? GROUPS.map((g) => (
        <section key={g} id={g} className="space-y-3 scroll-mt-20" aria-labelledby={`g-${g}`}>
          <div><h2 id={`g-${g}`} className="text-xl font-extrabold text-ink">{GROUP_LABEL[g]}</h2><p className="text-sm text-body">{GROUP_HINT[g]}</p></div>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">{drillsBy(g).map((d) => <DrillCard key={d.id} d={d} />)}</ul>
        </section>
      )) : (
        <Locked title={`${DRILLS.length} ejercicios de técnica`} why="Skipping, carioca, saltos de tobillo, fuerza para corredores y estiramientos, con la animación de tu coach. Se agregan solos a tus sesiones." href={seasonHref}>
          <ul className="grid grid-cols-2 gap-2">{DRILLS.slice(4, 8).map((d) => <li key={d.id} className="rounded-2xl bg-paper p-3 font-bold text-ink">{d.name}<span className="block text-xs font-semibold text-muted">{drillDose(d)}</span></li>)}</ul>
        </Locked>
      )}
      <p className="text-xs text-muted">Si un ejercicio te causa dolor, sáltalo. No reemplaza la indicación de un profesional de salud.</p>
    </div>
  );
}
