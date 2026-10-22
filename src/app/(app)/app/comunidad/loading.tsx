import { Bone, SkCard, SkeletonScreen } from "@/components/skeleton";

/** La tropa: encabezado de marca con tu semana, pestañas, compositor y publicaciones. */
export default function Loading() {
  return (
    <SkeletonScreen>
      <div aria-hidden className="rounded-[1.75rem] bg-ink p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex-1"><Bone className="h-9 w-40 rounded-2xl bg-white/15" /><Bone className="mt-3 h-4 w-60 max-w-full rounded-full bg-white/10" /><Bone className="mt-3 h-6 w-32 rounded-full bg-white/10" /></div>
          <Bone className="size-24 sm:size-32 rounded-[2rem] bg-banana/50" />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <Bone key={i} className="h-20 rounded-2xl bg-white/10" />)}</div>
      </div>
      <div aria-hidden className="flex items-center gap-2">
        <div className="grid flex-1 grid-cols-3 gap-1 rounded-full bg-white border border-line p-1 sm:flex-none sm:w-96">{[0, 1, 2].map((i) => <Bone key={i} className={`h-11 rounded-full ${i === 0 ? "bg-ink/20" : "bg-cream"}`} />)}</div>
        <Bone className="size-11 rounded-full bg-white border border-line" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] items-start [&>*]:min-w-0">
        <div className="space-y-4">
          <SkCard className="p-3 sm:p-4">
            <div className="flex gap-3"><Bone className="size-10 rounded-full bg-banana/40" /><Bone className="h-12 flex-1 rounded-2xl bg-cream" /></div>
            <div className="mt-3 flex flex-wrap gap-2">{[36, 20, 24, 20, 24].map((w, i) => <Bone key={i} className="h-11 rounded-full bg-cream" style={{ width: `${w * 4}px` }} />)}</div>
          </SkCard>
          {[0, 1].map((i) => (
            <SkCard key={i} className="overflow-hidden">
              <div className="flex items-center gap-3 p-4 pb-2"><Bone className="size-10 rounded-full bg-banana/40" /><div className="flex-1"><Bone className="h-4 w-36" /><Bone className="mt-1.5 h-3 w-24 rounded-full bg-line/50" /></div></div>
              <div className="px-4"><Bone className="h-4 w-full rounded-full bg-line/50" /><Bone className="mt-3 h-36 w-full rounded-2xl bg-ink/15" /></div>
              <div className="mt-3 flex gap-2 border-t border-line px-3 py-2"><Bone className="h-11 w-20 rounded-full bg-cream" /><Bone className="h-11 w-16 rounded-full bg-cream" /></div>
            </SkCard>
          ))}
        </div>
        <div className="space-y-4">
          <SkCard className="p-4"><Bone className="h-5 w-44" /><div className="mt-3 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-3"><Bone className="size-10 rounded-full bg-cream" /><Bone className="h-4 flex-1" /><Bone className="h-11 w-24 rounded-full bg-banana/40" /></div>)}</div></SkCard>
        </div>
      </div>
    </SkeletonScreen>
  );
}
