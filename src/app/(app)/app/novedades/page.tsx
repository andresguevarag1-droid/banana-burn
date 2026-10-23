import Image from "next/image";
import { getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { getActiveProgram } from "@/lib/programs-server";
import { getNewsState } from "@/lib/novedades-server";
import { NEWS_STAFF_ROLES, countLabel, newsView } from "@/lib/novedades";
import { ReleaseBlock } from "@/components/novedades/news-list";
import { MarkNewsSeen } from "@/components/novedades/mark-seen";

export const metadata = { title: "Novedades" };

/** Historial completo de Novedades, filtrado por el plan de la persona. Abrirla cuenta como visto. */
export default async function Novedades() {
  const v = (await getViewer())!;
  const [ent, prog, state] = await Promise.all([getEntitlements(v), getActiveProgram(v).catch(() => null), getNewsState(v).catch(() => ({ seenId: null, seenAt: null, createdAt: null, persisted: false }))]);
  const { releases, unseenIds } = newsView({ nutrition: ent.nutrition, plan: ent.plan, program: Boolean(prog && ent.app), staff: NEWS_STAFF_ROLES.includes(v.role) }, state);
  const fresh = new Set(unseenIds);
  const newCount = releases.filter((r) => fresh.has(r.id)).reduce((n, r) => n + r.items.length, 0);
  return (
    <div className="max-w-2xl space-y-8 animate-enter">
      <header className="relative overflow-hidden rounded-[1.75rem] bg-banana px-5 pt-5 sm:px-7 sm:pt-7">
        <div className="flex items-end gap-4">
          <div className="min-w-0 flex-1 pb-5 sm:pb-7">
            <p className="text-[12px] font-extrabold uppercase tracking-[.14em] text-ink/70">{newCount ? `${countLabel(newCount)} para ti` : "Estás al día"}</p>
            <h1 className="mt-1 text-3xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-4xl">Novedades</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink/80">Todo lo que mejoramos en Banana Burn y cómo te ayuda, de lo más nuevo a lo más viejo.</p>
          </div>
          <Image src="/brand/mascota-sola.webp" alt="" width={140} height={140} priority className="size-28 shrink-0 self-end object-contain object-bottom sm:size-36" />
        </div>
      </header>
      {releases.map((r) => <ReleaseBlock key={r.id} r={r} isNew={fresh.has(r.id)} headingLevel={2} />)}
      <MarkNewsSeen persisted={state.persisted} />
    </div>
  );
}
