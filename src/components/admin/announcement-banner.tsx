// Banner de anuncios para la app (/app). Uso: `<AnnouncementBanner />` en un Server Component (p. ej. arriba de "Hoy").
// Lee public.announcements vía getLiveAnnouncements(): RLS filtra vigencia y audiencia; en demo muestra ejemplos.
import Link from "next/link";
import { Megaphone } from "@/components/icons";
import { getLiveAnnouncements, type LiveAnnouncement } from "@/lib/admin-content";

const TONES: Record<string, string> = {
  banana: "bg-banana-soft border-[#F2D35B] text-ink",
  ember: "bg-[#FFE9DF] border-[#FFC3A8] text-ink",
  sky: "bg-[#E6EEFD] border-[#BCD0FA] text-ink",
  peel: "bg-[#E8F6EE] border-[#B5E2C6] text-ink",
};

export function AnnouncementCard({ a }: { a: LiveAnnouncement }) {
  return (
    <aside aria-label="Anuncio" className={`flex items-start gap-3 rounded-2xl border p-4 ${TONES[a.tone] ?? TONES.banana}`}>
      <Megaphone className="size-5 shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-snug">{a.title}</p>
        {a.body && <p className="mt-0.5 text-sm text-body">{a.body}</p>}
      </div>
      {a.cta_label && a.cta_href && (
        a.cta_href.startsWith("/")
          ? <Link href={a.cta_href} className="btn-primary h-9! px-4! text-sm! shrink-0">{a.cta_label}</Link>
          : <a href={a.cta_href} target="_blank" rel="noopener noreferrer" className="btn-primary h-9! px-4! text-sm! shrink-0">{a.cta_label}</a>
      )}
    </aside>
  );
}

export async function AnnouncementBanner({ max = 1 }: { max?: number }) {
  const list = (await getLiveAnnouncements()).slice(0, max);
  if (!list.length) return null;
  return <div className="space-y-2">{list.map((a) => <AnnouncementCard key={a.id} a={a} />)}</div>;
}
