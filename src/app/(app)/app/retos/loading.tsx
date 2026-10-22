import { Bone, SkCard, SkHeader, SkeletonScreen } from "@/components/skeleton";

/** Retos: retos en curso, catálogo para unirse y medallas. */
export default function Loading() {
  return (
    <SkeletonScreen className="space-y-6">
      <SkHeader />
      <div className="space-y-3"><Bone className="h-5 w-24" /><div className="grid gap-3 lg:grid-cols-2">{[0, 1].map((i) => <div key={i} aria-hidden className="rounded-[1.5rem] bg-banana/30 p-5"><div className="flex items-center gap-3"><Bone className="size-12 rounded-2xl bg-white/70" /><div className="flex-1"><Bone className="h-3 w-24 rounded-full bg-banana/50" /><Bone className="mt-2 h-5 w-40 bg-banana/50" /><Bone className="mt-2 h-2 w-full rounded-full bg-white/70" /></div></div><Bone className="mt-3 h-14 w-full rounded-2xl bg-white/70" /></div>)}</div></div>
      <div className="space-y-3"><Bone className="h-5 w-36" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <SkCard key={i} className="p-5"><div className="flex items-center gap-3"><Bone className="size-12 rounded-2xl bg-cream" /><div className="flex-1"><Bone className="h-4 w-32" /><Bone className="mt-1.5 h-3 w-20 rounded-full bg-line/50" /></div></div><Bone className="mt-3 h-4 w-full bg-line/50" /><Bone className="mt-1.5 h-4 w-3/4 bg-line/50" /><Bone className="mt-4 h-12 w-full rounded-full" /></SkCard>)}</div></div>
      <SkCard className="p-5"><Bone className="h-5 w-44" /><Bone className="mt-3 h-4 w-64 max-w-full rounded-full bg-line/50" /></SkCard>
    </SkeletonScreen>
  );
}
