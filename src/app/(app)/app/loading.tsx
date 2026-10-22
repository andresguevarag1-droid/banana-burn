import { Bone, SkCard, SkeletonScreen } from "@/components/skeleton";

/** Hoy: saludo, nivel y semana, rutina + peso, tu día, retos y coach. */
export default function Loading() {
  return (
    <SkeletonScreen>
      <div className="flex items-start justify-between gap-3" aria-hidden>
        <div className="min-w-0 flex-1"><Bone className="h-4 w-36 rounded-full bg-line/50" /><Bone className="mt-2 h-8 w-60 max-w-[85%] rounded-2xl" /></div>
        <div className="flex gap-2"><Bone className="size-12 rounded-2xl" /><Bone className="size-12 rounded-2xl bg-banana/40" /></div>
      </div>
      <SkCard className="p-3.5">
        <div className="flex items-center gap-3"><Bone className="size-10 bg-banana/40" /><div className="flex-1"><Bone className="h-3 w-40 rounded-full" /><Bone className="mt-2 h-2 w-full rounded-full bg-line/50" /></div></div>
        <div className="mt-3 flex justify-between sm:hidden">{Array.from({ length: 7 }, (_, i) => <Bone key={i} className="size-8 rounded-full bg-cream" />)}</div>
      </SkCard>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        <div aria-hidden className="rounded-[1.75rem] bg-banana/30 p-5 sm:p-6">
          <Bone className="h-3 w-40 rounded-full bg-banana/50" />
          <Bone className="mt-3 h-8 w-56 max-w-[80%] rounded-2xl bg-banana/50" />
          <Bone className="mt-3 h-4 w-44 rounded-full bg-banana/40" />
          <div className="mt-4 flex flex-wrap gap-1.5">{[28, 36, 24, 32, 28].map((w, i) => <Bone key={i} className="h-8 rounded-full bg-white/60" style={{ width: `${w * 4}px` }} />)}</div>
          <Bone className="mt-5 h-14 w-full rounded-full bg-ink/15" />
        </div>
        <SkCard className="p-5">
          <Bone className="h-5 w-40" /><Bone className="mt-2 h-3 w-56 max-w-full rounded-full bg-line/50" />
          <Bone className="mt-4 h-12 w-full rounded-2xl bg-cream" />
          <div className="mt-4 pt-4 border-t border-line grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <div key={i} className="flex flex-col items-center gap-1.5"><Bone className="h-6 w-12" /><Bone className="h-3 w-16 rounded-full bg-line/50" /></div>)}</div>
        </SkCard>
      </div>
      <div aria-hidden><Bone className="h-6 w-24" /><div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <SkCard key={i} className="p-4"><Bone className="size-10 rounded-full bg-cream" /><Bone className="mt-3 h-5 w-16" /><Bone className="mt-2.5 h-9 w-full rounded-xl bg-cream" /></SkCard>)}</div></div>
      <SkCard className="p-4 flex items-center gap-3"><Bone className="size-11 shrink-0 rounded-2xl bg-ink/15" /><div className="flex-1"><Bone className="h-3 w-24 rounded-full" /><Bone className="mt-2 h-4 w-full bg-line/50" /></div></SkCard>
    </SkeletonScreen>
  );
}
