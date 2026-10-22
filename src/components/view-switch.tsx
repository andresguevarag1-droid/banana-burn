import Link from "next/link";
import { Shield, User } from "@/components/icons";

/** Cambio de vista para el staff: la app como la ve un usuario o el panel de administración. */
export function ViewSwitch({ current, className = "" }: { current: "usuario" | "admin"; className?: string }) {
  const item = (on: boolean) =>
    `pressable flex flex-1 items-center justify-center gap-1.5 rounded-full h-10 px-3 text-sm font-bold transition-colors duration-150 ${on ? "bg-ink text-white" : "text-muted hover:text-ink"}`;
  return (
    <div role="group" aria-label="Cambiar de vista" className={`flex gap-1 rounded-full border border-line bg-white p-1 ${className}`}>
      <Link href="/app" aria-current={current === "usuario" ? "page" : undefined} className={item(current === "usuario")}><User weight="duotone" className="size-4" />Vista usuario</Link>
      <Link href="/admin" aria-current={current === "admin" ? "page" : undefined} className={item(current === "admin")}><Shield weight="duotone" className="size-4" />Vista admin</Link>
    </div>
  );
}
