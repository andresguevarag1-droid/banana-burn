import { Bone } from "@/components/skeleton";

/** Reproductor a pantalla completa: barra superior, ejercicio, series y botón inferior. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="fixed inset-0 z-50 flex flex-col bg-paper">
      <span className="sr-only">Cargando…</span>
      <div aria-hidden className="px-4 pt-[max(.75rem,env(safe-area-inset-top))] pb-2.5 border-b border-line/60">
        <div className="flex items-center justify-between gap-3">
          <Bone className="size-10 rounded-full bg-white border border-line" />
          <div className="flex flex-col items-center gap-1.5"><Bone className="h-4 w-36 rounded-full" /><Bone className="h-3 w-24 rounded-full bg-line/50" /></div>
          <Bone className="h-10 w-12 rounded-full bg-banana/50" />
        </div>
        <div className="mt-2.5 flex gap-1">{Array.from({ length: 6 }, (_, i) => <Bone key={i} className="h-2 flex-1 rounded-full" />)}</div>
      </div>
      <div aria-hidden className="flex-1 overflow-hidden">
        <div className="mx-auto max-w-xl px-4 pt-4">
          <div className="flex gap-3">
            <Bone className="h-[112px] w-[96px] shrink-0 rounded-3xl bg-banana/40" />
            <div className="flex-1 flex flex-col justify-center gap-2"><Bone className="h-3 w-32 rounded-full bg-line/50" /><Bone className="h-6 w-full max-w-60 rounded-xl" /><Bone className="h-4 w-28 rounded-full" /><div className="flex gap-1.5"><Bone className="h-7 w-20 rounded-full bg-white border border-line" /><Bone className="h-7 w-20 rounded-full bg-white border border-line" /></div></div>
          </div>
          <Bone className="mt-3 h-4 w-full rounded-full bg-line/50" />
          <div className="mt-3 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`rounded-3xl border p-2 pl-3 flex items-center gap-2 ${i === 0 ? "bg-white border-ink/30" : "bg-white/70 border-line"}`}>
                <Bone className="h-5 w-9 rounded-lg" />
                <Bone className="h-12 flex-1 rounded-2xl bg-cream" />
                <Bone className="h-12 flex-1 rounded-2xl bg-cream" />
                <Bone className="size-14 shrink-0 rounded-2xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div aria-hidden className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-line bg-white/95">
        <Bone className="mx-auto h-14 w-full max-w-xl rounded-full" />
      </div>
    </div>
  );
}
