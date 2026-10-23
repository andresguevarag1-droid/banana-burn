import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Paperclip } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { getMyTicket } from "@/lib/support-server";
import { CATEGORY_LABEL, ticketNumber, timeline, userCan, type SupportCategory } from "@/lib/support";
import { StatusChip, Timeline } from "@/components/soporte/status";
import { ThreadActions } from "@/components/soporte/thread-actions";

export const metadata = { title: "Mi reporte", robots: { index: false } };

const fmt = (iso: string, tz: string) => new Date(iso).toLocaleString("es-419", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz });

export default async function Reporte({ params }: { params: Promise<{ id: string }> }) {
  const v = (await getViewer())!;
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) notFound();
  const d = await getMyTicket(v, n);
  if (!d) notFound();
  const { t, messages, events } = d;
  const can = userCan(t);
  return (
    <div className="max-w-2xl space-y-5 animate-enter">
      <Link href="/app/soporte" className="tap inline-flex h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" aria-hidden />Mis reportes</Link>
      {v.demo && <p className="rounded-2xl bg-banana-soft p-3 text-sm font-semibold text-banana-ink">Modo demo: reporte de ejemplo, no se guarda nada.</p>}
      <header>
        <p className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold tabular-nums text-muted">{ticketNumber(t.id)}</span><StatusChip status={t.status} /></p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink text-balance">{t.title}</h1>
        <p className="text-sm text-muted">{CATEGORY_LABEL[t.category as SupportCategory] ?? t.category}, enviado el {fmt(t.created_at, v.tz)}</p>
      </header>

      <div className="grid gap-5 sm:grid-cols-[1fr_14rem]">
        <section aria-labelledby="conv" className="min-w-0 space-y-3 sm:order-1">
          <h2 id="conv" className="sr-only">Conversación</h2>
          <article className="card p-4">
            <p className="text-xs font-bold text-muted">Tú, {fmt(t.created_at, v.tz)}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] text-body">{t.body}</p>
            {t.attachment_path && <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted"><Paperclip className="size-4" aria-hidden />Captura adjunta (solo la ve el equipo)</p>}
          </article>
          <ol className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className={`rounded-2xl p-4 ${m.author_kind === "equipo" ? "bg-ink text-white" : "border border-line bg-white sm:ml-8"}`}>
                <p className={`text-xs font-bold ${m.author_kind === "equipo" ? "text-banana" : "text-muted"}`}>{m.author_kind === "equipo" ? `Equipo Banana Burn${m.author_name ? `, ${m.author_name.split(" ")[0]}` : ""}` : "Tú"}, {fmt(m.created_at, v.tz)}</p>
                <p className={`mt-1 whitespace-pre-wrap break-words text-[15px] ${m.author_kind === "equipo" ? "text-[#F4EEDC]" : "text-body"}`}>{m.body}</p>
              </li>
            ))}
          </ol>
          {t.status === "necesita_info" && <p className="rounded-2xl bg-ember/10 p-3 text-sm font-semibold text-ink">Te pedimos un dato más. Respóndenos aquí y seguimos.</p>}
          {t.status === "resuelto" && <p className="rounded-2xl bg-peel/10 p-3 text-sm font-semibold text-ink">Lo marcamos como resuelto. Confírmanos si ya funciona o reábrelo si sigue pasando.</p>}
          <ThreadActions ticketId={t.id} canReply={can.reply} canConfirm={can.confirm && t.status === "resuelto"} canReopen={can.reopen} needInfo={t.status === "necesita_info"} />
        </section>
        <aside className="card h-fit p-4 sm:order-2" aria-label="Estado">
          <p className="mb-3 text-sm font-extrabold text-ink">Estado</p>
          <Timeline steps={timeline(t, events)} tz={v.tz} />
        </aside>
      </div>
    </div>
  );
}
