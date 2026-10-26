import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { todayFor } from "@/lib/today";
import { getRaceGoal } from "@/lib/race-goal-server";
import { RaceGoalForm } from "@/components/correr/race-goal-form";

export const metadata = { title: "Mi carrera objetivo" };

export default async function Objetivo() {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/app/correr/objetivo");
  const goal = await getRaceGoal(v);
  const today = todayFor(v).iso;
  return (
    <div className="mx-auto max-w-xl space-y-5 animate-rise">
      <Link href="/app/correr" className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Banana Run</Link>
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Mi carrera objetivo</h1>
        <p className="text-body">Elige tu próxima carrera. Con la Temporada Running te armamos el plan semana a semana, tus ritmos y todo para el día de la carrera.</p>
      </header>
      <RaceGoalForm initial={goal && goal.raceDate >= today ? goal : goal ? { ...goal, raceDate: "" } : null} today={today} />
    </div>
  );
}
