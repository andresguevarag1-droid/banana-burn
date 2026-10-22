import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { getAthlete } from "@/lib/athlete";
import { BODY, DS_ID, EQUIP, MUSCLE, es, getLibEx, mediaUrl, similar } from "@/lib/library";
import { TECH } from "@/lib/engine/technique";
import { ExerciseMotion } from "@/components/exercise-motion";
import { RichTip } from "@/components/rich-tip";

export default async function Ejercicio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = getLibEx(id);
  if (!e) notFound();
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const ours = Object.entries(DS_ID).find(([, d]) => d === id)?.[0];
  const tech = ours ? TECH[ours] : null;
  const gif = mediaUrl(e);
  const alts = similar(e, a.equipment);
  return (
    <article className="space-y-5 animate-rise max-w-3xl">
      <Link href="/app/ejercicios" className="text-sm font-semibold text-muted">← Biblioteca</Link>
      <header>
        <p className="eyebrow">{es(BODY, e.bp)} · {es(EQUIP, e.eq)}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">{e.n}</h1>
        {e.n !== e.en && <p className="text-sm text-faint">{e.en}</p>}
      </header>
      <div className="rounded-[1.75rem] bg-banana p-4">
        {gif ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gif} alt={`Demostración: ${e.n}`} width={180} height={180} className="mx-auto rounded-2xl bg-white" />
        ) : tech ? (
          <div className="rounded-2xl bg-white/75 px-4 pt-6 pb-2"><ExerciseMotion anim={tech.anim} className="mx-auto h-56 max-w-[300px]" /></div>
        ) : (
          <p className="py-10 text-center text-5xl" aria-hidden>🏋️</p>
        )}
        {gif && <p className="mt-2 text-center text-[11px] text-ink/70">© Gym visual — gymvisual.com</p>}
      </div>
      <section className="card p-5">
        <h2 className="font-extrabold text-ink">Músculos</h2>
        <p className="mt-1 text-body"><b className="text-ink capitalize">{es(MUSCLE, e.t)}</b>{e.m2.length > 0 && <> · también {e.m2.map((m) => es(MUSCLE, m)).join(", ")}</>}</p>
      </section>
      <section className="card p-5">
        <h2 className="font-extrabold text-ink">Cómo hacerlo</h2>
        <ol className="mt-3 space-y-2">{(tech?.how ?? e.s).map((s, i) => <li key={i} className="flex gap-2.5"><span className="grid place-items-center size-6 shrink-0 rounded-full bg-banana text-xs font-bold text-ink">{i + 1}</span><span>{s}</span></li>)}</ol>
        {tech?.cues && <div className="mt-4 flex flex-wrap gap-2">{tech.cues.map((c) => <span key={c} className="chip bg-peel/10 text-peel">✓ {c}</span>)}</div>}
        {tech?.mono && <p className="mt-3 rounded-2xl bg-cream p-3 text-sm">🐒 <RichTip text={tech.mono} /></p>}
        <p className="mt-4 text-xs text-muted">Tempo 3-1-1: baja en 3 s, pausa 1 s, sube con fuerza. Si sientes dolor (no ardor muscular), para y consulta.</p>
      </section>
      {alts.length > 0 && (
        <section>
          <h2 className="font-extrabold text-ink mb-2">Alternativas para el mismo músculo</h2>
          <ul className="grid gap-2 sm:grid-cols-2">{alts.map((x) => <li key={x.id}><Link href={`/app/ejercicios/${x.id}`} className="card p-3 block hover:shadow-lift"><span className="block font-bold text-ink">{x.n}</span><span className="text-xs text-muted">{es(EQUIP, x.eq)}</span></Link></li>)}</ul>
        </section>
      )}
    </article>
  );
}
