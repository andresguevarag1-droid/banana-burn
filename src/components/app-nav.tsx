"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Barbell, BookOpen, BowlFood, ChartLine, CreditCard, DotsThree, House, Shield, ShieldCheck, SignOut, User, Users, Watch, type PhosphorIcon } from "@/components/icons";
import { BananaMedal, Monkey } from "@/components/icons/brand";
import { Logo } from "./brand";
import { NotificationBell } from "./notifications/bell";
import { Sheet, SheetTitle } from "./sheet";

type Item = { href: string; label: string; icon: PhosphorIcon | typeof Monkey; hint?: string };

const MAIN: Item[] = [
  { href: "/app", label: "Hoy", icon: House },
  { href: "/app/entrenar", label: "Entrenar", icon: Barbell },
  { href: "/app/nutricion", label: "Comida", icon: BowlFood, hint: "Calorías, recetas y menú" },
  { href: "/app/progreso", label: "Progreso", icon: ChartLine, hint: "Peso, medidas y fotos" },
  { href: "/app/comunidad", label: "Comunidad", icon: Users },
];
const EXTRA: Item[] = [
  { href: "/app/coach", label: "Coach Banana", icon: Monkey, hint: "Tu entrenador con IA" },
  { href: "/app/retos", label: "Retos", icon: BananaMedal, hint: "Desafíos de 21 y 30 días" },
  { href: "/app/ejercicios", label: "Ejercicios", icon: BookOpen, hint: `Más de ${(1300).toLocaleString("es-419")} con técnica` },
  { href: "/app/glp1", label: "Banana Shield", icon: ShieldCheck, hint: "Programa para GLP-1" },
];
/** Fuera del menú principal: solo en "Más" (todavía no conecta relojes). */
const SOON: Item = { href: "/app/conexiones", label: "Relojes", icon: Watch, hint: "Próximamente" };
/** Barra inferior en móvil: 4 secciones + Coach al centro + "Más". */
const MOBILE: Item[] = [MAIN[0], MAIN[1], EXTRA[0], MAIN[4]];

export function AppNav({ name, staff }: { name: string; staff: boolean }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  const active = (h: string) => (h === "/app" ? path === "/app" : path.startsWith(h));
  const inMore = ![...MOBILE].some((i) => active(i.href)) && path !== "/app";
  const sideLink = (on: boolean) => `pressable flex items-center gap-3 rounded-2xl px-3 h-11 font-semibold ${on ? "bg-ink text-white" : "text-muted hover:bg-white hover:text-ink"}`;

  return (
    <>
      {/* Móvil: encabezado con la campana en todas las secciones (Hoy ya tiene la suya en su encabezado). */}
      {path !== "/app" && (
        <header className="lg:hidden flex items-center justify-between px-4 pt-3 -mb-3">
          <Logo href="/app" />
          <NotificationBell />
        </header>
      )}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-line bg-cream/80 backdrop-blur px-4 py-6">
        <div className="px-2 flex items-center justify-between"><Logo href="/app" /><NotificationBell /></div>
        <nav aria-label="Menú principal" className="mt-10 space-y-1">
          {MAIN.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={sideLink(active(href))}>
              <Icon className="size-5" weight={active(href) ? "fill" : "duotone"} />{label}
            </Link>
          ))}
          <div className="my-3 border-t border-line" />
          {EXTRA.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={sideLink(active(href))}>
              <Icon className="size-5" weight={active(href) ? "fill" : "duotone"} />{label}
            </Link>
          ))}
          {staff && <Link href="/admin" className={sideLink(false)}><Shield className="size-5" weight="duotone" />Admin</Link>}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-2xl bg-white border border-line p-3">
          <Link href="/app/perfil" className="flex flex-1 min-w-0 items-center gap-3"><span className="grid place-items-center size-9 rounded-xl bg-banana font-bold text-ink">{name[0]?.toUpperCase()}</span>
          <span className="flex-1 truncate font-semibold text-ink">{name}</span></Link>
          <form action="/auth/salir" method="post"><button className="tap pressable grid place-items-center size-9 rounded-full text-muted hover:bg-cream hover:text-ink" aria-label="Cerrar sesión"><SignOut className="size-4" weight="bold" /></button></form>
        </div>
      </aside>

      <nav aria-label="Secciones" className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-white/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {MOBILE.map(({ href, label, icon: Icon }, i) => {
            const on = active(href);
            if (i === 2) return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined} className="pressable flex flex-col items-center gap-1 pt-1 pb-2.5 text-[11px] font-semibold text-ink">
                <span className={`-mt-5 grid place-items-center size-14 rounded-2xl shadow-lift ring-4 ring-white transition ${on ? "bg-banana text-ink" : "bg-ink text-banana"}`}><Icon className="size-8" weight="duotone" /></span>Coach
              </Link>
            );
            return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined} className={`pressable flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${on ? "text-ink" : "text-muted"}`}>
                <span className={`grid place-items-center h-8 w-12 rounded-full transition ${on ? "bg-banana" : ""}`}><Icon className="size-5" weight={on ? "fill" : "duotone"} /></span>{label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" aria-expanded={more} className={`pressable flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${inMore ? "text-ink" : "text-muted"}`}>
            <span className={`grid place-items-center h-8 w-12 rounded-full transition ${inMore ? "bg-banana" : ""}`}><DotsThree className="size-6" weight="bold" /></span>Más
          </button>
        </div>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} className="px-5">
        <SheetTitle className="text-xl font-extrabold text-ink">Todo Banana Burn</SheetTitle>
        <ul className="mt-4 grid grid-cols-2 gap-2">
          {[MAIN[2], MAIN[3], ...EXTRA.slice(1), { href: "/app/perfil", label: "Perfil", icon: User, hint: "Plan, avisos y cuenta" }, { href: "/app/suscripcion", label: "Suscripción", icon: CreditCard, hint: "Plan y recibos" }, SOON].map(({ href, label, icon: Icon, hint }) => (
            <li key={href}>
              <Link href={href} aria-current={active(href) ? "page" : undefined} className={`pressable flex h-full flex-col gap-2 rounded-2xl p-4 ${active(href) ? "bg-ink text-white" : "bg-white border border-line/70 text-ink hover:bg-banana-soft"}`}>
                <Icon className={`size-6 ${active(href) ? "text-banana" : "text-banana-ink"}`} weight="duotone" />
                <span className="font-extrabold leading-tight">{label}</span>
                {hint && <span className={`text-xs ${active(href) ? "text-white/70" : "text-muted"}`}>{hint}</span>}
              </Link>
            </li>
          ))}
          {staff && <li className="col-span-2"><Link href="/admin" className="pressable flex items-center gap-3 rounded-2xl bg-white border border-line/70 p-4 font-extrabold text-ink"><Shield className="size-6 text-banana-ink" weight="duotone" />Panel de administración</Link></li>}
        </ul>
        <form action="/auth/salir" method="post" className="mt-4"><button className="btn-ghost w-full"><SignOut className="size-5" weight="bold" />Cerrar sesión</button></form>
      </Sheet>
    </>
  );
}
