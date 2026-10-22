import { Bone, SkCard, SkeletonScreen } from "@/components/skeleton";

/** Perfil: avatar y nivel, suscripción y bloques de ajustes. */
export default function Loading() {
  return (
    <SkeletonScreen className="space-y-5 max-w-2xl">
      <div aria-hidden className="flex items-center gap-4"><Bone className="size-16 rounded-3xl bg-banana/50" /><div className="flex-1"><Bone className="h-6 w-44" /><Bone className="mt-1.5 h-4 w-56 max-w-full rounded-full bg-line/50" /><Bone className="mt-2 h-3 w-40 rounded-full bg-banana/40" /></div></div>
      <SkCard className="p-5"><div className="flex items-center justify-between"><div><Bone className="h-3 w-24 rounded-full bg-line/50" /><Bone className="mt-2 h-5 w-32" /></div><Bone className="h-10 w-24 rounded-full bg-white border border-line" /></div><Bone className="mt-3 h-4 w-full rounded-full bg-line/50" /></SkCard>
      <SkCard className="p-5"><Bone className="h-5 w-44" /><div className="mt-4 space-y-4">{[4, 4, 3].map((n, i) => <div key={i}><Bone className="h-4 w-32" /><div className={`mt-2 grid gap-2 ${n === 4 ? "grid-cols-4" : "grid-cols-3"}`}>{Array.from({ length: n }, (_, j) => <Bone key={j} className="h-11 rounded-2xl bg-cream" />)}</div></div>)}</div></SkCard>
      {[0, 1, 2].map((i) => <SkCard key={i} className="p-5"><Bone className="h-5 w-48" /><Bone className="mt-3 h-12 w-full rounded-2xl bg-cream" /></SkCard>)}
    </SkeletonScreen>
  );
}
