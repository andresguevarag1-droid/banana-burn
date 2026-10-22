import { Bone, SkCard, SkHeader, SkeletonScreen } from "@/components/skeleton";

/** Comunidad: pestañas, publicaciones del feed y personas para seguir. */
export default function Loading() {
  return (
    <SkeletonScreen>
      <div className="flex items-end justify-between gap-3"><SkHeader sub={false} /><Bone className="h-10 w-24 rounded-full bg-white border border-line" /></div>
      <div aria-hidden className="flex gap-1 rounded-full bg-white border border-line p-1 w-fit">{[0, 1, 2].map((i) => <Bone key={i} className={`h-10 w-24 rounded-full ${i === 0 ? "bg-ink/20" : "bg-cream"}`} />)}</div>
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] items-start [&>*]:min-w-0">
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <SkCard key={i} className="overflow-hidden">
              <div className="flex items-center gap-3 p-4 pb-2"><Bone className="size-10 rounded-full bg-banana/40" /><div className="flex-1"><Bone className="h-4 w-36" /><Bone className="mt-1.5 h-3 w-16 rounded-full bg-line/50" /></div></div>
              <div className="px-4"><Bone className="h-5 w-48" /><Bone className="mt-3 h-16 w-full rounded-2xl bg-cream" /></div>
              <div className="mt-2 flex gap-2 border-t border-line px-3 py-2"><Bone className="h-10 w-16 rounded-full bg-cream" /><Bone className="h-10 w-16 rounded-full bg-cream" /></div>
            </SkCard>
          ))}
        </div>
        <div className="space-y-4">
          <SkCard className="p-4"><Bone className="h-5 w-44" /><div className="mt-3 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-3"><Bone className="size-9 rounded-full bg-cream" /><Bone className="h-4 flex-1" /><Bone className="h-9 w-20 rounded-full" /></div>)}</div></SkCard>
          <SkCard className="p-4 space-y-2"><Bone className="h-4 w-28" /><Bone className="h-3.5 w-full rounded-full bg-line/50" /><Bone className="h-3.5 w-4/5 rounded-full bg-line/50" /></SkCard>
        </div>
      </div>
    </SkeletonScreen>
  );
}
