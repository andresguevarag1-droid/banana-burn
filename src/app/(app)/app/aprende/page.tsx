import Link from "next/link";
import { PoseImage } from "@/components/primeros-pasos/pose-image";
import { ArrowRight, Check, Clock, GraduationCap } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { getAthlete } from "@/lib/athlete";
import { getLearnState } from "@/lib/primeros-pasos-server";
import { COACHES } from "@/lib/coaches";
import { COACH_POSE, courseProgress, lessons } from "@/lib/aprende";
import { CourseList } from "@/components/primeros-pasos/course-list";

export const metadata = { title: "Aprende a entrenar" };

/** "Aprende a entrenar": 10 lecciones cortas para empezar de cero. Se puede abrir siempre desde el menú y Perfil. */
export default async function Aprende() {
  const v = (await getViewer())!;
  const [ent, a, ls] = await Promise.all([getEntitlements(v), getAthlete(v), getLearnState(v)]);
  const she = a.sex === "f";
  const coach = she ? COACHES.platanita : COACHES.banana;
  const all = lessons({ nutrition: ent.nutrition, coach: coach.name });
  const pr = courseProgress(all, ls.keys);
  return (
    <div className="max-w-2xl space-y-6 animate-enter">
      <header className="relative overflow-hidden rounded-[1.75rem] bg-banana px-5 pt-5 sm:px-7 sm:pt-7">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1 pb-5 sm:pb-7">
            <p className="inline-flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[.14em] text-ink/70"><GraduationCap weight="bold" className="size-4" />Minicurso gratis</p>
            <h1 className="mt-1 text-3xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-4xl">Aprende a entrenar</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink/80">10 lecciones cortas, una idea en cada una. Si nunca has entrenado, empieza aquí: en 5 minutos sabes todo lo que necesitas.</p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-ink"><Clock weight="bold" className="size-4" />30 segundos por lección</p>
          </div>
          <PoseImage src={she ? coach.hello : COACH_POSE.saluda} size={160} className="size-28 shrink-0 self-end object-contain object-bottom sm:size-36" />
        </div>
      </header>
      {pr.next && (
        <Link href={`/app/aprende/${pr.next.slug}`} className="pressable flex items-center gap-3 rounded-[1.5rem] bg-ink p-4 text-white shadow-lift">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-banana text-lg font-extrabold text-ink tabular-nums">{pr.next.n}</span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-banana">{pr.done ? "Sigue donde quedaste" : "Empieza aquí"}</span><span className="block font-extrabold leading-tight">{pr.next.title}</span></span>
          <ArrowRight weight="bold" className="size-5 shrink-0" />
        </Link>
      )}
      <CourseList lessons={all.map((l) => ({ slug: l.slug, n: l.n, title: l.title, idea: l.idea }))} serverKeys={ls.keys} />
      {pr.complete && (
        <section className="card flex items-start gap-3 p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-peel text-white"><Check weight="bold" className="size-6" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold text-ink">Terminaste el minicurso</h2>
            <p className="mt-0.5 text-sm text-muted">Ya sabes lo esencial. Mira todo lo que tu plan hace por ti cada semana.</p>
            <Link href="/app/incluye" className="btn-primary mt-3 h-12 px-5">Lo que incluye tu plan<ArrowRight weight="bold" className="size-5" /></Link>
          </div>
        </section>
      )}
    </div>
  );
}
