import Link from "next/link";
import { ArrowRight, Bug, ChatCircleText, Flask } from "@/components/icons";
import { ProgressBar } from "@/components/progress-bar";
import { daysLeftLabel, type TesterPhase } from "@/lib/testers";

/** "Reportar algo" abre el formulario de soporte, marcado como de tester (0034). */
const REPORT_HREF = "/app/soporte/nuevo?origen=tester&desde=/app";

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
          <Link href={REPORT_HREF} className="btn-ghost h-11 px-4 text-sm"><ChatCircleText weight="duotone" className="size-4" aria-hidden />Contarnos algo</Link>
        </div>
      </section>
    );
  }

  const soon = phase === "pronto";
  return (
    <section aria-labelledby="tester-t" className="relative overflow-hidden rounded-[1.5rem] bg-ink p-5 text-white">
      <Flask weight="duotone" aria-hidden className="pointer-events-none absolute -right-6 -top-6 size-36 rotate-12 text-banana opacity-[.08] select-none" />
      <div className="relative flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[.14em] text-banana"><Flask weight="fill" className="size-3.5" aria-hidden />Tester de la beta</p>
        {!soon && <p className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm font-extrabold tabular-nums text-banana">{daysLeft.toLocaleString("es-CO")} días</p>}
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
        <Link href={REPORT_HREF} className="btn-banana h-11 px-5 text-sm"><Bug weight="duotone" className="size-4" aria-hidden />Reportar algo</Link>
        <Link href="/app/perfil" className="tap inline-flex h-11 items-center gap-1 px-2 text-sm font-bold text-[#E9E1C9] hover:text-white">Ver mi insignia <ArrowRight weight="bold" className="size-3.5" /></Link>
      </div>
    </section>
  );
}
