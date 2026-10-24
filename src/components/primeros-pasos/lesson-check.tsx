"use client";
// Cierre de una lección: una pregunta fácil (con la explicación al responder) o un "Hazlo ahora". Al terminar se marca
// como leída y se ofrece la siguiente.
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, X } from "@/components/icons";
import { lessonKey, type LessonCheck as Q } from "@/lib/aprende";
import { learn } from "./learn-store";

export function LessonCheck({ slug, check, cta, next }: { slug: string; check: Q | null; cta: { href: string; label: string } | null; next: { slug: string; title: string } | null }) {
  const [pick, setPick] = useState<number | null>(null);
  const [read, setRead] = useState(false);
  const right = check && pick === check.correct;
  const finished = check ? right : read;
  const done = () => { learn(lessonKey(slug)); setRead(true); };

  return (
    <section aria-label="Comprueba lo que aprendiste" className="space-y-4">
      {check && (
        <fieldset className="card p-5">
          <legend className="sr-only">Pregunta</legend>
          <p className="text-xs font-bold uppercase tracking-[.1em] text-muted">Pregunta rápida</p>
          <p className="mt-1 text-lg font-extrabold leading-snug text-ink">{check.q}</p>
          <div className="mt-3 grid gap-2">
            {check.options.map((o, i) => {
              const chosen = pick === i, ok = i === check.correct;
              const tone = pick === null ? "bg-white border-line hover:border-ink/30" : chosen && ok ? "bg-peel/15 border-peel" : chosen ? "bg-ember/10 border-ember" : ok && right ? "bg-white border-line" : "bg-white border-line opacity-80";
              return (
                <button key={o} type="button" disabled={!!right} onClick={() => { setPick(i); if (i === check.correct) learn(lessonKey(slug)); }}
                  aria-pressed={chosen} className={`pressable flex min-h-13 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[15px] font-bold text-ink ${tone}`}>
                  <span className="flex-1">{o}</span>
                  {chosen && (ok ? <Check weight="bold" className="size-5 shrink-0 text-peel" /> : <X weight="bold" className="size-5 shrink-0 text-ember-ink" />)}
                </button>
              );
            })}
          </div>
          <p aria-live="polite" className="mt-3 text-[15px] text-body">
            {pick === null ? null : right ? <><b className="text-ink">Correcto.</b> {check.explain}</> : <><b className="text-ink">Casi.</b> Intenta otra vez.</>}
          </p>
        </fieldset>
      )}
      {!check && !read && <button type="button" onClick={done} className="btn-primary h-13 w-full">Lo entendí</button>}
      {cta && (finished || !check) && <Link href={cta.href} onClick={() => { if (!check) done(); }} className="btn-ghost h-13 w-full">{cta.label}<ArrowRight weight="bold" className="size-5" /></Link>}
      {finished && (next
        ? <Link href={`/app/aprende/${next.slug}`} className="btn-primary h-13 w-full">Siguiente: {next.title}<ArrowRight weight="bold" className="size-5" /></Link>
        : <Link href="/app/incluye" className="btn-primary h-13 w-full">Terminaste. Mira lo que incluye tu plan<ArrowRight weight="bold" className="size-5" /></Link>)}
    </section>
  );
}
