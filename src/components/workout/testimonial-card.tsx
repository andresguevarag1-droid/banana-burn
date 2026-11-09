"use client";
// Opinión del tercer entreno (#238): 1 a 5 estrellas, un texto opcional de 200 caracteres y el permiso para publicarla,
// sin marcar. Sale una sola vez por cuenta (la base guarda una por cuenta; la página solo la pide en el tercer entreno).
import { useState, useTransition } from "react";
import { Check, Star } from "@/components/icons";
import { FunnelTracker, track } from "@/components/analytics";
import { TESTIMONIAL_MAX, TESTIMONIAL_PUBLISH_LABEL, TESTIMONIAL_QUESTION } from "@/lib/testimonials";
import { sendTestimonial } from "@/app/(app)/app/entreno/testimonial-action";
import { useLang } from "./use-lang";

export function TestimonialAsk() {
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [publishOk, setPublishOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  if (sent) return <TestimonialThanks />;
  function submit() {
    if (!stars || pending) return;
    setError(null);
    start(async () => {
      const r = await sendTestimonial({ stars, text, publishOk });
      if (!r.ok) { setError(r.error ?? "No pudimos guardar tu opinión. Intenta de nuevo."); return; }
      track("testimonial_sent", { stars, with_text: !!text.trim(), publish_ok: publishOk });
      setSent(true);
    });
  }
  return <TestimonialForm stars={stars} onStars={setStars} text={text} onText={setText} publishOk={publishOk} onPublishOk={setPublishOk} pending={pending} error={error} onSubmit={submit} />;
}

export function TestimonialThanks() {
  const { t } = useLang();
  return (
    <p role="status" className="mt-3 flex gap-2.5 rounded-2xl bg-cream p-3 text-left text-sm text-ink">
      <Check weight="bold" className="size-5 shrink-0 text-banana-ink" /><span>{t("Gracias por contarnos. Tu opinión nos ayuda a mejorar Banana Burn.")}</span>
    </p>
  );
}

/** La tarjeta en sí (sin estado, para probarla). */
export function TestimonialForm({ stars, onStars, text, onText, publishOk, onPublishOk, pending = false, error = null, onSubmit }: {
  stars: number; onStars: (n: number) => void; text: string; onText: (t: string) => void; publishOk: boolean; onPublishOk: (v: boolean) => void;
  pending?: boolean; error?: string | null; onSubmit: () => void;
}) {
  const { t } = useLang();
  return (
    <section aria-labelledby="testimonial-title" className="mt-3 card p-4 text-left">
      <FunnelTracker view="testimonial_view" />
      <h2 id="testimonial-title" className="text-lg font-extrabold text-ink text-balance">{t(TESTIMONIAL_QUESTION)}</h2>
      <fieldset className="mt-2">
        <legend className="text-sm text-muted">{t("Toca de 1 a 5 estrellas.")}</legend>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="tap grid size-11 cursor-pointer place-items-center rounded-xl has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-banana/50">
              <input type="radio" name="testimonial-stars" value={n} checked={stars === n} onChange={() => onStars(n)} className="sr-only" aria-label={n === 1 ? t("1 estrella") : t("{n} estrellas", { n })} />
              <Star aria-hidden weight={n <= stars ? "fill" : "regular"} className={`size-8 ${n <= stars ? "text-banana-ink" : "text-faint"}`} />
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor="testimonial-text" className="mt-3 block text-sm font-bold text-ink">{t("Cuéntanos más")} <span className="font-semibold text-muted">{t("(opcional)")}</span></label>
      <textarea id="testimonial-text" value={text} onChange={(e) => onText(e.target.value)} maxLength={TESTIMONIAL_MAX} rows={3}
        className="mt-1 w-full resize-none rounded-2xl border border-line bg-white p-3 text-[15px] text-ink outline-none focus:border-ink focus:ring-4 focus:ring-banana/40" />
      <p className="text-right text-xs text-muted tabular-nums">{text.length}/{TESTIMONIAL_MAX}</p>
      <label className="mt-1 flex cursor-pointer items-start gap-2.5 text-sm text-body">
        <input type="checkbox" checked={publishOk} onChange={(e) => onPublishOk(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-ink" />
        <span>{t(TESTIMONIAL_PUBLISH_LABEL)}</span>
      </label>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-ember-ink">{t(error)}</p>}
      <button type="button" onClick={onSubmit} disabled={!stars || pending} data-cta="testimonio-enviar" className="btn-banana mt-3 h-13 w-full text-base font-extrabold">{pending ? t("Enviando…") : t("Enviar opinión")}</button>
    </section>
  );
}
