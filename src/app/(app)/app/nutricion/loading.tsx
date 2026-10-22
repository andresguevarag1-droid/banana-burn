import { Bone, SkCard, SkHeader, SkeletonScreen } from "@/components/skeleton";

/** Nutrición: resumen de calorías y macros, comidas del día y columna de ideas. */
export default function Loading() {
  return (
    <SkeletonScreen>
      <SkHeader />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] items-start [&>*]:min-w-0">
        <div className="space-y-5">
          <SkCard className="p-5">
            <div className="flex items-end justify-between gap-4"><div><Bone className="h-4 w-24 rounded-full bg-line/50" /><Bone className="mt-2 h-10 w-40" /></div><Bone className="h-10 w-28 bg-line/50" /></div>
            <Bone className="mt-3 h-3 w-full rounded-full" />
            <div className="mt-4 grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <div key={i}><Bone className="h-3 w-14 rounded-full bg-line/50" /><Bone className="mt-1.5 h-4 w-20" /><Bone className="mt-1.5 h-1.5 w-full rounded-full" /></div>)}</div>
          </SkCard>
          {[0, 1, 2, 3].map((i) => (
            <SkCard key={i} className="overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-4 pb-2"><Bone className="h-5 w-32" /><Bone className="h-4 w-16 rounded-full bg-line/50" /></div>
              {i < 2 && <div className="px-4 py-2.5"><Bone className="h-4 w-48" /><Bone className="mt-1.5 h-3 w-28 rounded-full bg-line/50" /></div>}
              <div className="px-4 py-3"><Bone className="h-4 w-36 rounded-full bg-banana/40" /></div>
            </SkCard>
          ))}
        </div>
        <div className="space-y-3">
          <Bone className="h-[84px] w-full rounded-[1.5rem] bg-banana/40" />
          <SkCard className="p-4 space-y-3"><Bone className="h-5 w-56 max-w-full" />{[0, 1, 2, 3].map((i) => <div key={i} className="flex gap-3"><Bone className="size-7 rounded-lg bg-cream" /><Bone className="h-4 flex-1 bg-line/50" /></div>)}</SkCard>
          <SkCard className="p-4 space-y-2"><Bone className="h-4 w-32" />{[0, 1, 2, 3].map((i) => <Bone key={i} className="h-3.5 w-full rounded-full bg-line/50" />)}</SkCard>
        </div>
      </div>
    </SkeletonScreen>
  );
}
