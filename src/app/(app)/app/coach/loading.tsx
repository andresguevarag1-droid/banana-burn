import { Bone, SkeletonScreen } from "@/components/skeleton";

/** Coach: encabezado, burbuja de bienvenida, sugerencias y caja de mensaje. */
export default function Loading() {
  return (
    <SkeletonScreen className="flex flex-col min-h-[calc(100dvh-9rem)] lg:min-h-[calc(100dvh-6rem)]">
      <div aria-hidden className="flex items-center gap-3 pb-4 border-b border-line"><Bone className="size-12 rounded-2xl bg-banana/50" /><div><Bone className="h-5 w-36" /><Bone className="mt-1.5 h-4 w-56 rounded-full bg-line/50" /></div></div>
      <div aria-hidden className="flex-1 py-5 space-y-4">
        <div className="max-w-[88%] w-96 rounded-3xl rounded-bl-lg bg-banana-soft/60 border border-banana/30 p-4 space-y-2.5">{["w-40", "w-full", "w-11/12", "w-4/5", "w-2/3"].map((w, i) => <Bone key={i} className={`h-4 ${w} rounded-full bg-banana/30`} />)}</div>
        <div className="flex flex-wrap gap-2">{[56, 64, 48, 52].map((w, i) => <Bone key={i} className="h-11 rounded-full bg-white border border-line" style={{ width: `${w * 4}px`, maxWidth: "100%" }} />)}</div>
      </div>
      <div aria-hidden className="sticky bottom-24 lg:bottom-6 flex gap-2 rounded-full bg-white border border-line p-1.5 shadow-lift"><Bone className="h-11 flex-1 rounded-full bg-cream" /><Bone className="size-11 rounded-full bg-ink/20" /></div>
    </SkeletonScreen>
  );
}
