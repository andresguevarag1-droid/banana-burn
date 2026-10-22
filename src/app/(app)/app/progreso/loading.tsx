import { Bone, SkCard, SkHeader, SkeletonScreen } from "@/components/skeleton";

/** Progreso: curva de peso, ajuste del coach, totales, medidas, fotos y fuerza. */
export default function Loading() {
  return (
    <SkeletonScreen className="space-y-6">
      <SkHeader />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
        <SkCard className="p-5"><Bone className="h-5 w-20" /><Bone className="mt-4 h-56 w-full rounded-2xl bg-cream" /></SkCard>
        <div className="space-y-4">
          <SkCard className="p-5 space-y-2"><Bone className="h-3 w-40 rounded-full bg-line/50" /><Bone className="h-6 w-4/5" /><Bone className="h-4 w-full bg-line/50" /></SkCard>
          <SkCard className="p-5"><Bone className="h-5 w-28" /><Bone className="mt-3 h-12 w-full rounded-2xl bg-cream" /></SkCard>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <SkCard key={i} className="p-4 flex flex-col items-center gap-2"><Bone className="size-6 rounded-full bg-cream" /><Bone className="h-7 w-12" /><Bone className="h-3 w-20 rounded-full bg-line/50" /></SkCard>)}</div>
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        {[0, 1].map((i) => <SkCard key={i} className="p-5"><Bone className="h-5 w-32" /><Bone className="mt-4 h-36 w-full rounded-2xl bg-cream" /></SkCard>)}
      </div>
      <div><Bone className="h-5 w-52" /><div className="mt-3 grid gap-3 grid-cols-2 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <SkCard key={i} className="p-4"><Bone className="h-4 w-20 rounded-full bg-line/50" /><Bone className="mt-2 h-7 w-16" /><Bone className="mt-2 h-3 w-14 rounded-full bg-line/50" /></SkCard>)}</div></div>
    </SkeletonScreen>
  );
}
