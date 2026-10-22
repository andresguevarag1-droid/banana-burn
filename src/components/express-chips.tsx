import Link from "next/link";

/** Atajo a entrenos exprés sin equipo de 10/20/30 min. */
export function ExpressChips({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`text-xs font-bold ${tone === "dark" ? "text-white/70" : "text-ink/60"}`}>⚡ ¿Poco tiempo? Exprés sin equipo:</span>
      {[10, 20, 30].map((m) => (
        <Link key={m} href={`/app/entreno?expres=${m}`} className={`chip h-8 px-3 text-[13px] ${tone === "dark" ? "bg-white/10 text-white" : "bg-white/80 text-ink border border-line"}`}>{m} min</Link>
      ))}
    </div>
  );
}
