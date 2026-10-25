import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { getSex } from "@/lib/athlete";
import { COACHES, seasonCoachId } from "@/lib/coaches";
import { listRuns } from "@/lib/runs-server";
import { fmtDuration, fmtKm, fmtPace, weeklyKm } from "@/lib/runs";
import { todayFor } from "@/lib/today";
import { longDate } from "@/lib/seasons";
import { RunTracker } from "@/components/correr/run-tracker";
import { WeeklyKm } from "@/components/correr/weekly-km";

export const metadata = { title: "Correr" };

export default async function Correr() {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/app/correr");
  const [sex, runs] = await Promise.all([getSex(v), listRuns(v)]);
  const coach = COACHES[seasonCoachId("running", sex)];
  const today = todayFor(v).iso;
  return (
    <div className="space-y-6 animate-rise">
      <RunTracker coachSrc={coach.hello} coachName={coach.name} />
      {runs.length > 0 && (
        <>
          <WeeklyKm weeks={weeklyKm(runs, today)} />
          <section className="space-y-3" aria-labelledby="hist">
            <h2 id="hist" className="text-xl font-extrabold text-ink">Tus carreras</h2>
            <ul className="card divide-y divide-line p-0">
              {runs.slice(0, 30).map((r) => (
                <li key={r.id}>
                  <Link href={`/app/correr/${r.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-paper/60">
                    <span className="min-w-0 flex-1"><span className="block font-bold text-ink tabular-nums">{fmtKm(r.distanceM)} km</span><span className="block text-sm text-muted">{longDate(r.day)}, {fmtDuration(r.movingS)}, {fmtPace(r.paceSKm)}/km</span></span>
                    <ArrowRight className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
