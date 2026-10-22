// Medallas y certificados de retos completados (Retos y Mi perfil). Solo retos realmente completados.
import { BananaMedal, BrandIcon } from "@/components/icons";
import type { Challenge } from "@/lib/challenges";
import { ChallengeCover } from "./cover";

const fmt = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric" });

export function Certificates({ done, title = "Medallas y certificados", empty = "Termina tu primer reto para ganar tu medalla y tu certificado." }: { done: { c: Challenge; at: string }[]; title?: string; empty?: string }) {
  return (
    <section className="card p-5" aria-labelledby="certs-t">
      <h2 id="certs-t" className="flex items-center gap-2 font-extrabold text-ink"><BananaMedal className="size-6 text-banana-ink" />{title}</h2>
      {done.length ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {done.map((d, i) => (
            <li key={`${d.c.id}-${i}`} className="overflow-hidden rounded-2xl border border-banana/50 bg-cream">
              <ChallengeCover c={d.c} className="h-14" chip={false}>
                <span className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-xl bg-white text-banana-ink shadow-soft"><BrandIcon name={d.c.icon} className="size-6" /></span>
              </ChallengeCover>
              <div className="p-3">
                <p className="text-[11px] font-bold uppercase tracking-[.12em] text-banana-ink">Certificado de reto</p>
                <p className="font-extrabold leading-tight text-ink">{d.c.badge}</p>
                <p className="mt-0.5 text-xs text-muted">{d.c.title}: {d.c.days} días, completado el {fmt(d.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-muted">{empty}</p>}
    </section>
  );
}
