import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { BODY, DS_ID, EQUIP, MUSCLE, animFor, es, getLibEx, isStrength, mediaUrl, patternOf, similar } from "@/lib/library";
import { TECH } from "@/lib/engine/technique";
import { ExerciseMotion } from "@/components/exercise-motion";
import { RichTip } from "@/components/rich-tip";
import { ArrowLeft, ArrowRight, ArrowsLeftRight, Barbell, Check, Monkey } from "@/components/icons";
import { getVoice } from "@/lib/voice-server";
import { strengthCue } from "@/lib/voice";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const e = getLibEx((await params).id);
  return { title: e ? e.n : "Ejercicio" };
}

export default async function Ejercicio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = getLibEx(id);
  if (!e) notFound();
  const v = (await getViewer())!;
  const [a, voice] = await Promise.all([getAthlete(v), getVoice(v)]);
  const ours = Object.entries(DS_ID).find(([, d]) => d === id)?.[0];
  const tech = ours ? TECH[ours] : null;
  const gif = mediaUrl(e);
  const anim = gif || tech ? null : animFor(e);
  const alts = similar(e, a.equipment);

  // ¿Este ejercicio está hoy en tu rutina, o puede reemplazar uno de hoy (mismo patrón de movimiento)?
  const today = dashboard(a).plan.exercises;
  const pat = patternOf(e.en);
  const inToday = ours ? today.find((x) => x.id === ours) : undefined;
  const swapFor = !inToday && pat !== "other" && pat !== "stretch"
    ? today.find((x) => { const lib = DS_ID[x.id] ? getLibEx(DS_ID[x.id]) : null; return lib && patternOf(lib.en) === pat; })
    : undefined;

  return (
    <article className="space-y-5 animate-enter max-w-3xl">
      <Link href="/app/ejercicios" className="tap inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Biblioteca</Link>
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink text-balance">{e.n}</h1>
        {e.n.toLowerCase() !== e.en.toLowerCase() && <p className="text-sm text-muted">{e.en}</p>}
        <p className="mt-2 flex flex-wrap gap-1.5"><span className="chip bg-white border border-line text-ink">{es(BODY, e.bp)}</span><span className="chip bg-white border border-line text-ink">{es(EQUIP, e.eq)}</span></p>
      </header>

      {inToday && (
        <Link href="/app/entreno" className="card p-4 flex items-center gap-3">
          <span className="grid place-items-center size-11 shrink-0 rounded-2xl bg-banana text-ink"><Barbell weight="duotone" className="size-6" /></span>
          <span className="flex-1 min-w-0"><span className="block font-extrabold text-ink">Está en tu entreno de hoy</span><span className="block text-sm text-muted">{inToday.cfg.sets} series de {inToday.cfg.lo} a {inToday.cfg.hi}{inToday.cfg.unit === "s" ? " s" : inToday.cfg.unit === "m" ? " m" : " reps"}</span></span>
          <span className="inline-flex items-center gap-1 text-sm font-bold text-ink">Ver en mi entreno de hoy<ArrowRight weight="bold" className="size-4" /></span>
        </Link>
      )}
      {swapFor && (
        <Link href={`/app/entreno?cambiar=${encodeURIComponent(swapFor.id)}&por=${encodeURIComponent(`ds:${e.id}`)}`} className="card p-4 flex items-center gap-3">
          <span className="grid place-items-center size-11 shrink-0 rounded-2xl bg-banana-soft text-banana-ink"><ArrowsLeftRight weight="bold" className="size-6" /></span>
          <span className="flex-1 min-w-0"><span className="block font-extrabold text-ink">Hoy tienes {swapFor.name}</span><span className="block text-sm text-muted">Mismo patrón de movimiento: puedes usar este en su lugar.</span></span>
          <span className="inline-flex items-center gap-1 text-sm font-bold text-ink">Cambiar por este<ArrowRight weight="bold" className="size-4" /></span>
        </Link>
      )}

      {gif ? (
        <div className="rounded-[1.75rem] bg-banana p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gif} alt={`Demostración: ${e.n}`} width={180} height={180} className="mx-auto rounded-2xl bg-white" />
          <p className="mt-2 text-center text-[11px] text-ink/70">© Gym visual (gymvisual.com)</p>
        </div>
      ) : tech ? (
        <div className="rounded-[1.75rem] bg-banana p-4"><div className="rounded-2xl bg-white/75 px-4 pt-6 pb-2"><ExerciseMotion anim={tech.anim} mus={tech.mus} cues={tech.cues} className="mx-auto h-64 sm:h-80 max-w-[360px]" /></div></div>
      ) : anim ? (
        <div className="rounded-[1.75rem] bg-banana p-4">
          <div className="rounded-2xl bg-white/75 px-4 pt-6 pb-2"><ExerciseMotion anim={anim} mus={es(MUSCLE, e.t)} className="mx-auto h-64 sm:h-80 max-w-[360px]" /></div>
          <p className="mt-2 text-center text-xs font-semibold text-ink/75">Referencia del patrón de movimiento. Sigue los pasos para los detalles de esta variante.</p>
        </div>
      ) : null}

      <section className="card p-5">
        <h2 className="font-extrabold text-ink">Cómo hacerlo</h2>
        <ol className="mt-3 space-y-2">{(tech?.how ?? e.s).map((s, i) => <li key={i} className="flex gap-2.5"><span className="grid place-items-center size-6 shrink-0 rounded-full bg-banana text-xs font-bold text-ink">{i + 1}</span><span>{s}</span></li>)}</ol>
        {tech?.cues && <div className="mt-4 flex flex-wrap gap-2">{tech.cues.map((c) => <span key={c} className="chip bg-peel/10 text-peel"><Check weight="bold" className="size-3.5" />{c}</span>)}</div>}
        {tech?.mono && <p className="mt-3 flex gap-2.5 rounded-2xl bg-cream p-3 text-sm"><Monkey className="size-6 shrink-0 text-banana-ink" /><span><RichTip text={tech.mono} /></span></p>}
        <p className="mt-4 text-xs text-muted">{isStrength(e) ? `${strengthCue(voice)} ` : ""}Si sientes dolor (no ardor muscular), para y consulta.</p>
      </section>
      <section className="card p-5">
        <h2 className="font-extrabold text-ink">Músculos</h2>
        <p className="mt-1 text-body"><b className="text-ink">{cap(es(MUSCLE, e.t))}</b>{e.m2.length > 0 && <>, también {e.m2.map((m) => es(MUSCLE, m)).join(", ")}</>}</p>
      </section>
      {alts.length > 0 && (
        <section>
          <h2 className="font-extrabold text-ink mb-2">Alternativas con el mismo movimiento</h2>
          <ul className="grid gap-2 sm:grid-cols-2">{alts.map((x) => <li key={x.id}><Link href={`/app/ejercicios/${x.id}`} className="card p-3 block"><span className="block font-bold text-ink">{x.n}</span><span className="text-xs text-muted">{cap(es(MUSCLE, x.t))}, {es(EQUIP, x.eq).toLowerCase()}</span></Link></li>)}</ul>
        </section>
      )}
    </article>
  );
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
