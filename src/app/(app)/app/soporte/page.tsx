import Link from "next/link";
import { ArrowRight, CaretRight, ChatCircleText, Lifebuoy, Plus } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { getMyTickets } from "@/lib/support-server";
import { CATEGORY_LABEL, isOpen, ticketNumber, type SupportCategory } from "@/lib/support";
import { StatusChip } from "@/components/soporte/status";

export const metadata = { title: "Mis reportes", robots: { index: false } };

const fmt = (iso: string, tz: string) => new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "short", timeZone: tz });

export default async function MisReportes() {
  const v = (await getViewer())!;
  const { tickets, unavailable } = await getMyTickets(v);
  const open = tickets.filter((t) => isOpen(t.status));
  return (
    <div className="max-w-2xl space-y-5 animate-enter">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Ayuda</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink text-balance">Mis reportes</h1>
          <p className="mt-1 text-sm text-muted text-pretty">Cada reporte tiene su número y te avisamos cuando lo recibimos, cuando lo trabajamos y cuando queda resuelto.</p>
        </div>
        <Link href="/app/soporte/nuevo?origen=soporte" className="btn-primary h-12 px-5"><Plus weight="bold" className="size-4" aria-hidden />Reportar un problema</Link>
      </header>
      {v.demo && <p className="rounded-2xl bg-banana-soft p-3 text-sm font-semibold text-banana-ink">Modo demo: reportes de ejemplo, no se guarda nada.</p>}
      {unavailable && <p className="rounded-2xl bg-ember/10 p-4 text-sm text-ink">Los reportes todavía no están activos. Escríbenos a <a className="font-bold underline" href="mailto:hola@bananaburn.app">hola@bananaburn.app</a>.</p>}
      {tickets.length ? (
        <ul className="grid gap-3 [&>*]:min-w-0" aria-label={`Tus reportes: ${tickets.length}, ${open.length} abiertos`}>
          {tickets.map((t) => {
            const fresh = !!t.last_staff_at && t.last_staff_at > t.last_user_at && isOpen(t.status);
            return (
              <li key={t.id}>
                <Link href={`/app/soporte/${t.id}`} className="card pressable flex items-center gap-3 p-4 hover:border-ink/25">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-banana-soft text-banana-ink"><ChatCircleText weight="duotone" className="size-6" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold tabular-nums text-muted">{ticketNumber(t.id)}</span><StatusChip status={t.status} />{fresh && <span className="chip h-7 bg-ink text-banana">Respuesta nueva</span>}</span>
                    <span className="mt-1 block truncate font-extrabold text-ink">{t.title}</span>
                    <span className="block text-xs text-muted">{CATEGORY_LABEL[t.category as SupportCategory] ?? t.category}, actualizado el {fmt(t.updated_at, v.tz)}</span>
                  </span>
                  <CaretRight weight="bold" className="size-5 shrink-0 text-faint" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : !unavailable && (
        <section className="card p-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-banana-soft text-banana-ink"><Lifebuoy weight="duotone" className="size-8" aria-hidden /></span>
          <p className="mt-3 font-extrabold text-ink">No tienes reportes</p>
          <p className="mt-1 text-sm text-muted">Si algo falla o tienes una duda con tu cuenta, cuéntanos y te respondemos aquí.</p>
          <Link href="/app/soporte/nuevo?origen=soporte" className="tap mt-3 inline-flex h-11 items-center gap-1 text-sm font-bold text-banana-ink hover:text-ink">Reportar un problema <ArrowRight weight="bold" className="size-3.5" aria-hidden /></Link>
        </section>
      )}
      <p className="text-center text-xs text-muted">¿Prefieres correo? Escríbenos a <a className="underline" href="mailto:hola@bananaburn.app">hola@bananaburn.app</a>.</p>
    </div>
  );
}
