import { Flask } from "@/components/icons";

/**
 * Insignia "Tester" de la beta: ink con texto banana (la marca del estado especial), con el matraz como ícono.
 * No es un rol: la ve la comunidad mientras dura el mes de tester. `compact` para listas (publicaciones y comentarios).
 */
export function TesterBadge({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-ink font-bold text-banana whitespace-nowrap align-middle ${compact ? "h-5 px-1.5 text-[11px]" : "h-6 px-2 text-xs"} ${className}`} title="Tester de la beta: ayuda a probar Banana Burn">
      <Flask weight="fill" className={compact ? "size-3" : "size-3.5"} aria-hidden />
      Tester
    </span>
  );
}
