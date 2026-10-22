"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, Salad, LineChart, Sparkles, Shield, LogOut, Users, Trophy, Watch } from "lucide-react";
import { Logo } from "./brand";

const TABS = [
  { href: "/app", label: "Hoy", icon: Home },
  { href: "/app/entrenar", label: "Entrenar", icon: Dumbbell },
  { href: "/app/nutricion", label: "Comida", icon: Salad },
  { href: "/app/comunidad", label: "Comunidad", icon: Users },
  { href: "/app/progreso", label: "Progreso", icon: LineChart },
];
const EXTRA = [
  { href: "/app/coach", label: "Coach IA", icon: Sparkles },
  { href: "/app/retos", label: "Retos", icon: Trophy },
  { href: "/app/conexiones", label: "Relojes", icon: Watch },
];

export function AppNav({ name, staff }: { name: string; staff: boolean }) {
  const path = usePathname();
  const active = (h: string) => (h === "/app" ? path === "/app" : path.startsWith(h));
  return (
    <>
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-line bg-cream/80 backdrop-blur px-4 py-6">
        <div className="px-2"><Logo href="/app" /></div>
        <nav className="mt-10 space-y-1">
          {TABS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`flex items-center gap-3 rounded-2xl px-3 h-11 font-semibold transition ${active(href) ? "bg-ink text-white" : "text-muted hover:bg-white hover:text-ink"}`}>
              <Icon className="size-5" />{label}
            </Link>
          ))}
          <div className="my-3 border-t border-line" />
          {EXTRA.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`flex items-center gap-3 rounded-2xl px-3 h-11 font-semibold transition ${active(href) ? "bg-ink text-white" : "text-muted hover:bg-white hover:text-ink"}`}>
              <Icon className="size-5" />{label}
            </Link>
          ))}
          {staff && <Link href="/admin" className="flex items-center gap-3 rounded-2xl px-3 h-11 font-semibold text-muted hover:bg-white hover:text-ink"><Shield className="size-5" />Admin</Link>}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-2xl bg-white border border-line p-3">
          <Link href="/app/perfil" className="flex flex-1 min-w-0 items-center gap-3"><span className="grid place-items-center size-9 rounded-full bg-banana font-bold text-ink">{name[0]?.toUpperCase()}</span>
          <span className="flex-1 truncate font-semibold text-ink">{name}</span></Link>
          <form action="/auth/salir" method="post"><button className="text-muted hover:text-ink" aria-label="Cerrar sesión"><LogOut className="size-4" /></button></form>
        </div>
      </aside>
      {!path.startsWith("/app/coach") && (
        <Link href="/app/coach" className="lg:hidden fixed right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 grid place-items-center size-14 rounded-full bg-ink text-banana shadow-lift active:scale-95 transition" aria-label="Hablar con el Coach IA">
          <Sparkles className="size-6" />
        </Link>
      )}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-white/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {TABS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${active(href) ? "text-ink" : "text-faint"}`}>
              <span className={`grid place-items-center h-8 w-12 rounded-full transition ${active(href) ? "bg-banana" : ""}`}><Icon className="size-5" /></span>{label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
