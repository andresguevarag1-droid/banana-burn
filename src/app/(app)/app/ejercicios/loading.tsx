import { Bone, SkCard, SkHeader, SkeletonScreen } from "@/components/skeleton";

/** Biblioteca: buscador, filtros por zona y cuadrícula de ejercicios. */
export default function Loading() {
  return (
    <SkeletonScreen>
      <SkHeader />
      <div aria-hidden className="flex gap-2"><Bone className="h-12 flex-1 rounded-2xl bg-white border border-line" /><Bone className="h-12 w-24 rounded-full" /></div>
      <div aria-hidden className="-mx-4 px-4 flex gap-1.5 overflow-hidden">{[14, 20, 18, 16, 22, 18, 20].map((w, i) => <Bone key={i} className={`h-9 shrink-0 rounded-full ${i === 0 ? "bg-ink/20" : "bg-white border border-line"}`} style={{ width: `${w * 4}px` }} />)}</div>
      <Bone className="h-4 w-28 rounded-full bg-line/50" />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 12 }, (_, i) => <SkCard key={i} className="p-3 flex items-center gap-3"><Bone className="size-12 shrink-0 rounded-2xl bg-cream" /><div className="flex-1"><Bone className="h-4 w-4/5" /><Bone className="mt-1.5 h-3 w-1/2 rounded-full bg-line/50" /></div></SkCard>)}</div>
    </SkeletonScreen>
  );
}
