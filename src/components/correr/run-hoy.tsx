// Resumen de running en Hoy: aparece si corriste en las últimas 3 semanas o tienes la Temporada Running.
// km de la semana, mejor ritmo y lo que sigue. Hoy nunca se rompe por esto: si algo falla, no aparece.
import Link from "next/link";
import { ArrowRight, Sneaker } from "@/components/icons";
import type { Viewer } from "@/lib/supabase/server";
import { getRunningView } from "@/lib/running-server";
import { weekRecap } from "@/lib/run-badges";
import { fmtPace } from "@/lib/runs";
import { addDays } from "@/lib/run-plan";
import { translateContent } from "@/lib/i18n/content";
import { tr } from "@/lib/i18n/t";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";

/** `locale`: idioma de la cuenta (#309). Los títulos del plan de running salen en español si no están en el diccionario. */
export async function RunHoy({ v, locale = DEFAULT_LOCALE }: { v: Viewer; locale?: Locale }) {
  const t = tr(locale), tc = (s: string) => translateContent(locale, s);
  try {
    const r = await getRunningView(v);
    const recent = r.runs.some((x) => x.day >= addDays(r.today, -21));
    if (!recent && !r.owned) return null;
    const w = weekRecap(r.runs, r.today);
    const next = r.owned && r.next ? (r.next.status === "hoy" ? t("Hoy: {title}, {detail}", { title: tc(r.next.title).toLowerCase(), detail: tc(r.next.detail) }) : t("Siguiente: {title}", { title: tc(r.next.title).toLowerCase() }))
      : r.daysToRace != null ? t(r.daysToRace === 1 && locale !== DEFAULT_LOCALE ? "Falta 1 día para tu carrera" : "Faltan {n} días para tu carrera", { n: r.daysToRace }) : null;
    return (
      <Link href="/app/correr" className="card flex items-center gap-4 p-4 transition-transform duration-150 active:scale-[.99]" aria-label={t("Banana Run: tu semana de running")}>
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--run)] text-white"><Sneaker weight="duotone" className="size-6" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold text-ink">{t(!w.runs ? "Esta semana: {km} km" : w.runs === 1 ? "Esta semana: {km} km, 1 carrera" : "Esta semana: {km} km, {n} carreras", { km: w.km, n: w.runs })}</span>
          <span className="block truncate text-sm text-muted">{[w.bestPace ? t("Mejor ritmo {pace}/km", { pace: fmtPace(w.bestPace) }) : null, next].filter(Boolean).join(". ") || t("Sal a correr y registra tu carrera.")}</span>
        </span>
        <ArrowRight className="size-5 shrink-0 text-muted" />
      </Link>
    );
  } catch (e) {
    console.error("[running] hoy", e instanceof Error ? e.name : "error");
    return null;
  }
}
