import Link from "next/link";
import { Lightning } from "@/components/icons";

/** Atajo a entrenos exprés sin equipo de 10/20/30 min. */
export function ExpressChips({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <div>
      <p className={`flex items-center gap-1 text-xs font-bold ${tone === "dark" ? "text-white/70" : "text-ink/75"}`}><Lightning weight="fill" className={`size-3.5 ${tone === "dark" ? "text-banana" : "text-banana-ink"}`} />¿Poco tiempo? Exprés sin equipo</p>
      <div className="mt-2 flex gap-2">
        {[10, 20, 30].map((m) => (
          <Link key={m} href={`/app/entreno?expres=${m}`} className={`chip h-9 px-3.5 text-[13px] tabular-nums ${tone === "dark" ? "bg-white/10 text-white" : "bg-white/80 text-ink border border-line"}`}>{m} min</Link>
        ))}
      </div>
    </div>
  );
}
