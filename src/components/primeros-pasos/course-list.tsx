"use client";
// Lista de lecciones con su marca de "leída" (servidor + este dispositivo).
import Link from "next/link";
import { CaretRight, Check } from "@/components/icons";
import { lessonDone } from "@/lib/aprende";
import { useLearnKeys } from "./learn-store";

export function CourseList({ lessons, serverKeys }: { lessons: { slug: string; n: number; title: string; idea: string }[]; serverKeys: readonly string[] }) {
  const { keys } = useLearnKeys(serverKeys);
  const done = lessons.filter((l) => lessonDone(keys, l.slug)).length;
  return (
    <section aria-labelledby="lecciones-t">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="lecciones-t" className="text-lg font-extrabold text-ink">Lecciones</h2>
        <p className="text-sm font-bold text-muted tabular-nums">{done} de {lessons.length} leídas</p>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={lessons.length} aria-valuenow={done} aria-label="Lecciones leídas">
        <div className="h-full origin-left rounded-full bg-ink transition-transform duration-300 ease-[cubic-bezier(.23,1,.32,1)]" style={{ transform: `scaleX(${done / lessons.length})` }} />
      </div>
      <ol className="card divide-y divide-line">
        {lessons.map((l) => {
          const ok = lessonDone(keys, l.slug);
          return (
            <li key={l.slug}>
              <Link href={`/app/aprende/${l.slug}`} className="pressable flex items-center gap-3 p-4">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-sm font-extrabold tabular-nums ${ok ? "bg-peel text-white" : "bg-banana-soft text-banana-ink"}`}>{ok ? <Check weight="bold" className="size-4" aria-label="Leída" /> : l.n}</span>
                <span className="min-w-0 flex-1"><span className="block font-extrabold leading-tight text-ink">{l.title}</span><span className="mt-0.5 block text-sm text-muted text-pretty">{l.idea}</span></span>
                <CaretRight weight="bold" className="size-5 shrink-0 text-faint" />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
