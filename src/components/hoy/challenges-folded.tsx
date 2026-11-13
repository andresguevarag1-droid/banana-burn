// "Tus retos" en Hoy (#316): una línea por reto (título, día y si ya cumplió hoy) que se abre al tocarla y muestra la
// tarjeta completa con el botón de Hecho. Sin JavaScript: <details>.
import { BrandIcon, CaretDown, Check } from "@/components/icons";
import { ChallengeCard, type ChallengeView } from "@/components/challenge-card";
import { translateContent } from "@/lib/i18n/content";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { tr } from "@/lib/i18n/t";

export function ChallengesFolded({ list, locale = DEFAULT_LOCALE }: { list: ChallengeView[]; locale?: Locale }) {
  const tx = tr(locale);
  return (
    <ul className="grid gap-2">
      {list.map((v) => (
        <li key={v.ucId}>
          <details className="group">
            <summary className="tap pressable flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl border border-line/70 bg-white px-3 py-2 hover:border-ink/25 [&::-webkit-details-marker]:hidden">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-banana-soft text-banana-ink"><BrandIcon name={v.c.icon} className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-extrabold text-ink">{translateContent(locale, v.c.title)}</span>
                <span className="block text-xs font-semibold tabular-nums text-muted">{tx("Día {day} de {days}", { day: v.day, days: v.c.days })}</span>
              </span>
              {v.todayDone && <span className="chip h-8 shrink-0 bg-peel text-xs text-white"><Check weight="bold" className="size-3.5" />{tx("Hecho")}</span>}
              <CaretDown weight="bold" aria-hidden className="size-4 shrink-0 text-faint transition-transform duration-(--dur-fast) group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <div className="mt-2"><ChallengeCard v={v} compact /></div>
          </details>
        </li>
      ))}
    </ul>
  );
}
