import { Bone, SkCard, SkeletonScreen } from "@/components/skeleton";

/** Perfil de la tropa: portada, avatar, cifras y publicaciones. */
export default function Loading() {
  return (
    <SkeletonScreen className="space-y-5 max-w-2xl">
      <Bone className="h-5 w-24 rounded-full" />
      <SkCard className="overflow-hidden">
        <Bone className="h-32 sm:h-40 rounded-none bg-ink/80" />
        <div className="px-5 pb-5">
          <Bone className="relative z-10 -mt-12 size-24 rounded-full bg-banana/60 ring-4 ring-white" />
          <Bone className="mt-3 h-8 w-56 rounded-2xl" />
          <Bone className="mt-2 h-4 w-28 rounded-full bg-line/50" />
          <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">{[0, 1, 2, 3, 4].map((i) => <Bone key={i} className="h-14 rounded-2xl bg-cream" />)}</div>
        </div>
      </SkCard>
      <SkCard className="p-4"><Bone className="h-5 w-24" /><div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">{[0, 1, 2].map((i) => <Bone key={i} className="h-14 rounded-2xl bg-banana-soft" />)}</div></SkCard>
      <SkCard className="p-4"><Bone className="h-5 w-40" /><Bone className="mt-3 h-36 w-full rounded-2xl bg-ink/15" /></SkCard>
    </SkeletonScreen>
  );
}
