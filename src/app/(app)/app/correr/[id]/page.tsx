import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { getRun } from "@/lib/runs-server";
import { fmtDuration, fmtKm, fmtPace } from "@/lib/runs";
import { longDate } from "@/lib/seasons";
import { RunMap } from "@/components/correr/run-map";
import { RunShare, RunDelete } from "@/components/correr/run-actions";

export const metadata = { title: "Tu carrera" };

function PaceChart({ splits }: { splits: { km: number; seconds: number }[] }) {
  const full = splits.map((s, i) => ({ km: s.km, pace: Number.isInteger(s.km) ? s.seconds : Math.round(s.seconds / (s.km - (splits[i - 1]?.km ?? 0))) }));
  if (full.length < 2) return null;
  const lo = Math.min(...full.map((s) => s.pace)) - 15, hi = Math.max(...full.map((s) => s.pace)) + 15;
  const W = 320, H = 120;
  const x = (i: number) => 16 + (i / (full.length - 1)) * (W - 32);
  const y = (p: number) => 10 + ((p - lo) / (hi - lo)) * (H - 30);
  return (
    <figure className="card p-5 space-y-2">
      <figcaption className="text-xl font-extrabold text-ink">Ritmo por kilómetro</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Ritmo por kilómetro: ${full.map((s) => `km ${s.km}, ${fmtPace(s.pace)}`).join("; ")}`}>
        <polyline points={full.map((s, i) => `${x(i)},${y(s.pace)}`).join(" ")} fill="none" stroke="#C2410C" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {full.map((s, i) => <g key={s.km}><circle cx={x(i)} cy={y(s.pace)} r={4} fill="#C2410C" /><text x={x(i)} y={H - 4} textAnchor="middle" fontSize="10" fill="#6B6B6B">{s.km}</text></g>)}
      </svg>
      <p className="text-xs text-muted">Más arriba es más rápido.</p>
    </figure>
  );
}

export default async function Carrera({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await getViewer();
  if (!v) redirect(`/entrar?next=/app/correr/${id}`);
  const r = await getRun(v, id);
  if (!r) notFound();
  return (
    <div className="space-y-5 animate-rise">
      <Link href="/app/correr" className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Correr</Link>
      <header><h1 className="text-3xl font-extrabold tracking-tight text-ink">{fmtKm(r.distanceM)} km</h1><p className="text-muted">{longDate(r.day)}</p></header>
      <section className="card grid grid-cols-3 gap-3 p-5 text-center">
        <div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted">Tiempo</p><p className="text-2xl font-extrabold tabular-nums text-ink">{fmtDuration(r.movingS)}</p></div>
        <div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted">Ritmo</p><p className="text-2xl font-extrabold tabular-nums text-ink">{fmtPace(r.paceSKm)}</p></div>
        <div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted">Km</p><p className="text-2xl font-extrabold tabular-nums text-ink">{fmtKm(r.distanceM)}</p></div>
      </section>
      <RunMap track={r.track} />
      <p className="text-xs text-muted">Por tu privacidad, el mapa no muestra los primeros ni los últimos 200 m. Solo tú ves tus carreras.</p>
      {r.splits.length > 0 && (
        <ol className="card divide-y divide-line p-0" aria-label="Parciales">
          {r.splits.map((s) => <li key={s.km} className="flex justify-between px-5 py-2.5 text-sm"><span className="font-bold text-ink">{Number.isInteger(s.km) ? `Km ${s.km}` : `Últimos ${Math.round((s.km % 1) * 1000)} m`}</span><span className="tabular-nums text-body">{Number.isInteger(s.km) ? `${fmtPace(s.seconds)}/km` : fmtDuration(s.seconds)}</span></li>)}
        </ol>
      )}
      <PaceChart splits={r.splits} />
      <RunShare km={fmtKm(r.distanceM)} time={fmtDuration(r.movingS)} pace={fmtPace(r.paceSKm)} day={longDate(r.day)} splits={r.splits.filter((s) => Number.isInteger(s.km)).map((s) => s.seconds)} />
      <RunDelete id={r.id} />
    </div>
  );
}
