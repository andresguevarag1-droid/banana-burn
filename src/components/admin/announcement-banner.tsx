// Banner de anuncios para la app (/app). Uso: `<AnnouncementBanner />` en un Server Component (p. ej. arriba de "Hoy").
// Lee public.announcements vía getLiveAnnouncements(): RLS filtra vigencia y audiencia; en demo muestra ejemplos.
import Link from "next/link";
import { Megaphone } from "@/components/icons";
import { getLiveAnnouncements, type LiveAnnouncement } from "@/lib/admin-content";
import { translateContent } from "@/lib/i18n/content";
import { tr } from "@/lib/i18n/t";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";

const TONES: Record<string, string> = {
  banana: "bg-banana-soft border-[#F2D35B] text-ink",
  ember: "bg-[#FFF6CC] border-[#FFD978] text-ink",
  sky: "bg-[#E6EEFD] border-[#BCD0FA] text-ink",
  peel: "bg-[#E8F6EE] border-[#B5E2C6] text-ink",
};

export function AnnouncementCard({ a, locale = DEFAULT_LOCALE }: { a: LiveAnnouncement; locale?: Locale }) {
  const tc = (s: string) => translateContent(locale, s);
  return (
    <aside aria-label={tr(locale)("Anuncio")} className={`flex items-start gap-3 rounded-2xl border p-4 ${TONES[a.tone] ?? TONES.banana}`}>
      <Megaphone className="size-5 shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-snug">{tc(a.title)}</p>
        {a.body && <p className="mt-0.5 text-sm text-body">{tc(a.body)}</p>}
      </div>
      {a.cta_label && a.cta_href && (
        a.cta_href.startsWith("/")
          ? <Link href={a.cta_href} className="btn-primary h-11! px-4! text-sm! shrink-0">{tc(a.cta_label)}</Link>
          : <a href={a.cta_href} target="_blank" rel="noopener noreferrer" className="btn-primary h-11! px-4! text-sm! shrink-0">{tc(a.cta_label)}</a>
      )}
    </aside>
  );
}

/**
 * `locale`: idioma de la cuenta (#309). El equipo escribe los anuncios en español; en inglés solo salen los que tienen
 * su título en el diccionario (src/lib/i18n/en/today.ts), para que nadie vea un aviso a medias en otro idioma.
 */
export async function AnnouncementBanner({ max = 1, locale = DEFAULT_LOCALE }: { max?: number; locale?: Locale }) {
  const list = (await getLiveAnnouncements()).filter((a) => locale === DEFAULT_LOCALE || translateContent(locale, a.title) !== a.title).slice(0, max);
  if (!list.length) return null;
  return <div className="space-y-2">{list.map((a) => <AnnouncementCard key={a.id} a={a} locale={locale} />)}</div>;
}
