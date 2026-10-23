import { Bone, SkCard, SkHeader, SkeletonScreen } from "@/components/skeleton";

/** Niveles: nivel actual, meta semanal de XP, XP por día y la escalera de niveles. */
export default function Loading() {
  return (
    <SkeletonScreen className="space-y-6">
      <SkHeader />
      <SkCard className="p-5"><div className="flex items-center gap-4"><Bone className="size-16 rounded-2xl bg-banana/40" /><div className="flex-1"><Bone className="h-5 w-40" /><Bone className="mt-2 h-3 w-full rounded-full bg-line/50" /></div></div></SkCard>
      <SkCard className="p-5"><Bone className="h-5 w-36" /><div className="mt-4 grid grid-cols-7 items-end gap-2 h-28">{[40, 70, 20, 90, 55, 30, 65].map((h, i) => <Bone key={i} className="w-full rounded-md bg-line/60" style={{ height: `${h}%` }} />)}</div></SkCard>
      <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <SkCard key={i} className="p-4"><Bone className="h-4 w-28" /><Bone className="mt-2 h-3 w-full rounded-full bg-line/50" /></SkCard>)}</div>
    </SkeletonScreen>
  );
}
