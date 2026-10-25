import Link from "next/link";
import { PoseImage } from "@/components/primeros-pasos/pose-image";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { getAthlete } from "@/lib/athlete";
import { COACHES } from "@/lib/coaches";
import { COACH_POSE, lessons, nutritionUpsell } from "@/lib/aprende";
import { LessonCheck } from "@/components/primeros-pasos/lesson-check";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = lessons({ nutrition: true }).find((x) => x.slug === slug);
  return { title: l ? `${l.title}: Aprende a entrenar` : "Aprende a entrenar" };
}

/** Una lección: una idea, un dibujo del coach, lo esencial en frases cortas y una pregunta o un "Hazlo ahora". */
export default async function Leccion({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = (await getViewer())!;
  const [ent, a] = await Promise.all([getEntitlements(v), getAthlete(v)]);
  const she = a.sex === "f";
  const coach = she ? COACHES.platanita : COACHES.banana;
  const all = lessons({ nutrition: ent.nutrition, coach: coach.name });
  const i = all.findIndex((l) => l.slug === slug);
  if (i < 0) notFound();
  const l = all[i];
  const next = all[i + 1] ?? null;
  return (
    <article className="mx-auto max-w-xl space-y-5 animate-enter">
      <div className="flex items-center justify-between gap-2">
        <Link href="/app/aprende" className="tap inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Lecciones</Link>
        <p className="text-sm font-bold text-muted tabular-nums">Lección {l.n} de {all.length}</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden><div className="h-full origin-left rounded-full bg-ink" style={{ transform: `scaleX(${l.n / all.length})` }} /></div>

      <header className="relative overflow-hidden rounded-[1.75rem] bg-banana px-5 pt-5 sm:px-6">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1 pb-5">
            <h1 className="text-[26px] font-extrabold leading-[1.1] tracking-tight text-ink text-balance sm:text-3xl">{l.title}</h1>
            <p className="mt-2 text-[17px] font-bold leading-snug text-ink text-pretty">{l.idea}</p>
          </div>
          <PoseImage src={she ? coach.hello : COACH_POSE[l.pose]} size={150} className="size-28 shrink-0 self-end object-contain object-bottom sm:size-32" />
        </div>
      </header>

      <div className="space-y-3 text-[17px] leading-relaxed text-body">
        {l.body.map((p) => <p key={p} className="text-pretty">{p}</p>)}
      </div>
      <ul className="card space-y-2 p-5">
        {l.points.map((p) => <li key={p} className="flex gap-2.5 text-[15px] font-semibold text-ink"><span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-banana-ink" />{p}</li>)}
      </ul>
      {l.slug === "comida" && !ent.nutrition && <p className="rounded-2xl bg-cream p-4 text-sm text-body">{nutritionUpsell()} <Link href="/app/suscripcion" className="font-bold text-ink underline underline-offset-2">Ver planes</Link></p>}

      <LessonCheck slug={l.slug} check={l.check} cta={l.cta} next={next ? { slug: next.slug, title: next.title } : null} />
    </article>
  );
}
