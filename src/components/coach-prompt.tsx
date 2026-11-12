"use client";
import Link from "next/link";
import { CoachPic } from "@/components/coach-pic";
import { Monkey } from "@/components/icons";
import { track } from "@/components/analytics";
import { useT } from "@/lib/i18n/client";
import { COACH_PROMPTS, COACH_PROMPT_QUESTION, coachPromptAnswers, coachPromptHref, type CoachPromptWhere } from "@/lib/coach-prompt";

/** Burbuja del coach con respuestas de un toque (#198): cada una abre el coach con esa pregunta ya enviada. */
export function CoachPrompt({ where, home = false, coach = null, className = "" }: { where: CoachPromptWhere; home?: boolean; coach?: { name: string; avatar: string } | null; className?: string }) {
  const t = useT();
  return (
    <section className={`text-left ${className}`} aria-label={t("{coach} te pregunta", { coach: coach?.name ?? "Coach Banana" })}>
      <div className="flex items-end gap-2">
        {coach ? <CoachPic src={coach.avatar} size={36} className="size-9 shrink-0 rounded-xl object-cover" />
          : <span aria-hidden className="grid place-items-center size-9 shrink-0 rounded-xl bg-ink text-banana"><Monkey className="size-6" /></span>}
        <div className="max-w-[85%] rounded-3xl rounded-bl-lg px-4 py-3 bg-banana-soft/70 border border-banana/40">
          <p className="text-xs font-bold text-muted">{coach?.name ?? "Coach Banana"}</p>
          <p className="text-[15px] font-semibold text-ink leading-snug">{t(COACH_PROMPT_QUESTION)}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 pl-11">
        {coachPromptAnswers(home).map((id) => (
          <Link key={id} href={coachPromptHref(id, where)} onClick={() => track("coach_prompt_tap", { where, answer: id })}
            className="pressable min-h-11 inline-flex items-center rounded-2xl bg-white border border-line px-3.5 py-2 text-sm font-semibold text-ink hover:border-ink">
            {t(COACH_PROMPTS[id].label)}
          </Link>
        ))}
      </div>
    </section>
  );
}
