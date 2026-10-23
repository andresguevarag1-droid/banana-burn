"use client";
import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Bug, ChatCircleText, CheckCircle, Flask, WarningCircle } from "@/components/icons";
import { Sheet, SheetTitle } from "@/components/sheet";
import { ProgressBar } from "@/components/progress-bar";
import { sendFeedback, type FeedbackState } from "@/app/actions/testers";
import { FEEDBACK_KINDS, FEEDBACK_MAX, daysLeftLabel, type TesterPhase } from "@/lib/testers";

const fmt = (iso: string | null, tz: string) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: tz }); } catch { return ""; }
};

export type TesterCardProps = { phase: TesterPhase; until: string | null; daysLeft: number; used: number; tz: string };

/**
 * Tarjeta de tester en Hoy: días que quedan del mes de cortesía y la entrada a "Reportar algo".
 * Faltando 3 días, un aviso amable (sin urgencia falsa); al terminar, el agradecimiento y qué pasa ahora.
 */
export function TesterCard({ phase, until, daysLeft, used, tz }: TesterCardProps) {
  const [open, setOpen] = useState(false);
  if (phase === "ninguno") return null;
  const date = fmt(until, tz);

  if (phase === "terminado") {
    return (
      <section aria-labelledby="tester-fin" className="card p-5">
        <div className="flex items-start gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-ink text-banana"><Flask weight="duotone" className="size-7" aria-hidden /></span>
          <div className="min-w-0">
            <p className="eyebrow">Tester de la beta</p>
            <h2 id="tester-fin" className="mt-0.5 text-lg font-extrabold leading-snug text-ink text-balance">Gracias por ayudarnos a probar Banana Burn</h2>
            <p className="mt-1 text-sm text-muted text-pretty">Tu mes de tester terminó el {date}. Tus datos, récords y medallas siguen guardados, y tu insignia de Tester beta se queda en tus logros. Para seguir registrando, elige un plan cuando quieras.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/app/suscripcion" className="btn-primary h-11 px-5 text-sm">Ver planes <ArrowRight weight="bold" className="size-4" /></Link>
          <button type="button" onClick={() => setOpen(true)} className="btn-ghost h-11 px-4 text-sm"><ChatCircleText weight="duotone" className="size-4" />Contarnos algo</button>
        </div>
        <FeedbackSheet open={open} onClose={() => setOpen(false)} />
      </section>
    );
  }

  const soon = phase === "pronto";
  return (
    <section aria-labelledby="tester-t" className="relative overflow-hidden rounded-[1.5rem] bg-ink p-5 text-white">
      <Flask weight="duotone" aria-hidden className="pointer-events-none absolute -right-6 -top-6 size-36 rotate-12 text-banana opacity-[.08] select-none" />
      <div className="relative flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[.14em] text-banana"><Flask weight="fill" className="size-3.5" aria-hidden />Tester de la beta</p>
        {!soon && <p className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm font-extrabold tabular-nums text-banana">{daysLeft.toLocaleString("es-419")} días</p>}
      </div>
      <h2 id="tester-t" className="relative mt-2 text-xl font-extrabold leading-tight tracking-tight text-balance">
        {soon ? (daysLeft <= 1 ? "Hoy es tu último día de tester" : `Te quedan ${daysLeft} días de tester`) : "Tienes Entreno + Nutrición gratis"}
      </h2>
      <p className="relative mt-1 text-sm text-[#E9E1C9] text-pretty">
        {soon ? `Tu mes gratis termina el ${date}. Si algo te faltó contarnos, este es buen momento. Después vuelves a las reglas normales y eliges un plan si quieres seguir.`
          : `Hasta el ${date}, como agradecimiento por probar la beta. Si algo falla o se te ocurre una idea, cuéntanos.`}
      </p>
      <ProgressBar value={used} min={0.03} className="relative mt-4 h-2" track="bg-white/15" fill="bg-banana" label={`Mes de tester: ${daysLeftLabel(daysLeft)}${daysLeft > 1 ? " restantes" : ""}`} />
      <div className="relative mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(true)} className="btn-banana h-11 px-5 text-sm"><Bug weight="duotone" className="size-4" />Reportar algo</button>
        <Link href="/app/perfil" className="tap inline-flex h-11 items-center gap-1 px-2 text-sm font-bold text-[#E9E1C9] hover:text-white">Ver mi insignia <ArrowRight weight="bold" className="size-3.5" /></Link>
      </div>
      <FeedbackSheet open={open} onClose={() => setOpen(false)} />
    </section>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-disabled={pending} className="btn-primary h-12 w-full">{pending ? "Enviando…" : "Enviar"}</button>;
}

/** Hoja de "Reportar algo": tipo, texto y la pantalla desde donde se manda. Lo recibe el equipo en el panel. */
export function FeedbackSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, action] = useActionState<FeedbackState, FormData>(sendFeedback, null);
  const [kind, setKind] = useState<string>("error");
  const [len, setLen] = useState(0);
  // Envío correcto: queda el agradecimiento hasta cerrar; al reabrir, el formulario vuelve vacío.
  const [thanksAt, setThanksAt] = useState<number | null>(null);
  const path = usePathname();
  const uid = useId();
  useEffect(() => { if (state?.ok && state.at) setThanksAt(state.at); }, [state]);
  const close = () => { onClose(); setTimeout(() => { setThanksAt(null); setLen(0); setKind("error"); }, 220); };
  const sent = thanksAt !== null && state?.ok;
  return (
    <Sheet open={open} onClose={close} className="sm:max-w-md">
      <div className="p-5 pb-6 text-ink">
        <SheetTitle className="text-xl font-extrabold tracking-tight">Reportar algo</SheetTitle>
        <p className="mt-1 text-sm text-muted text-pretty">Un error, algo que se ve raro o una idea. Una frase basta: nos llega directo y lo revisamos.</p>
        {sent ? (
          <div className="mt-5 rounded-2xl bg-banana-soft p-4 text-center animate-fade" role="status">
            <CheckCircle weight="fill" className="mx-auto size-8 text-peel" aria-hidden />
            <p className="mt-2 font-extrabold">{state!.message}</p>
            <button type="button" onClick={close} className="btn-ghost mt-4 h-11 px-5 text-sm">Cerrar</button>
          </div>
        ) : (
          <form action={action} className="mt-4 space-y-4">
            <input type="hidden" name="page" value={path ?? ""} />
            <fieldset>
              <legend className="mb-2 text-sm font-bold">¿Qué quieres contarnos?</legend>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_KINDS.map(([k, l]) => (
                  <label key={k} className={`pressable tap inline-flex h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-bold transition-colors duration-150 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-banana/50 ${kind === k ? "border-ink bg-ink text-banana" : "border-line bg-white text-ink hover:border-ink/25"}`}>
                    <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />{l}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor={`${uid}-b`} className="mb-1.5 block text-sm font-bold">{kind === "error" ? "¿Qué pasó y dónde?" : kind === "idea" ? "¿Qué te gustaría?" : "Cuéntanos"}</label>
              <textarea id={`${uid}-b`} name="body" required minLength={3} maxLength={FEEDBACK_MAX} rows={4} data-autofocus onChange={(e) => setLen(e.target.value.length)}
                placeholder={kind === "error" ? "p. ej. al guardar mi peso se quedó cargando" : kind === "idea" ? "p. ej. poder repetir el entreno de ayer" : "Lo que quieras contarnos"}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-[16px] text-ink placeholder:text-faint outline-none transition-[border-color,box-shadow] duration-150 focus:border-ink focus:ring-4 focus:ring-banana/40" />
              <p className="mt-1 text-right text-xs text-muted tabular-nums" aria-live="polite">{len.toLocaleString("es-419")} / {FEEDBACK_MAX.toLocaleString("es-419")}</p>
            </div>
            {state && !state.ok && <p role="alert" className="flex items-center gap-1.5 text-sm font-semibold text-bad"><WarningCircle weight="fill" className="size-4 shrink-0" />{state.message}</p>}
            <SendButton />
          </form>
        )}
      </div>
    </Sheet>
  );
}
