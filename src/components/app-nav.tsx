"use client";
import { ViewSwitch } from "@/components/view-switch";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Barbell, BookOpen, BowlFood, ChartLine, Compass, CreditCard, DotsThree, Gift, House, Lifebuoy, Lock, ShieldCheck, SignOut, Sparkle, User, Users, Watch, type PhosphorIcon } from "@/components/icons";
import { BananaCoin, BananaMedal, Monkey } from "@/components/icons/brand";
import { Logo } from "./brand";
import { NotificationBell } from "./notifications/bell";
import { Sheet, SheetTitle } from "./sheet";
import { openGuide } from "./guide/guide-provider";
import { useNewsDot } from "./novedades/news-store";

/** `nutri`: sección de Entreno + Nutrición. En Entreno se ve con candado y abre la invitación a mejorar el plan. */
type Item = { href: string; label: string; icon: PhosphorIcon | typeof Monkey; hint?: string; nutri?: boolean };
const NUTRI_HINT = "Incluido en Entreno + Nutrición";

const MAIN: Item[] = [
  { href: "/app", label: "Hoy", icon: House },
  { href: "/app/entrenar", label: "Entrenar", icon: Barbell },
  { href: "/app/nutricion", label: "Comida", icon: BowlFood, hint: "Calorías, recetas y menú", nutri: true },
  { href: "/app/progreso", label: "Progreso", icon: ChartLine, hint: "Peso, medidas y fotos" },
  { href: "/app/comunidad", label: "Comunidad", icon: Users },
];
const EXTRA: Item[] = [
  { href: "/app/coach", label: "Coach Banana", icon: Monkey, hint: "Tu entrenador 24/7" },
  { href: "/app/retos", label: "Programas y retos", icon: BananaMedal, hint: "Programas Premium y retos gratis" },
  { href: "/app/niveles", label: "Niveles", icon: BananaCoin, hint: "XP, racha y recompensas" },
  { href: "/app/ejercicios", label: "Ejercicios", icon: BookOpen, hint: `Más de ${(1300).toLocaleString("es-CO")} con técnica` },
  { href: "/app/glp1", label: "Banana Shield", icon: ShieldCheck, hint: "Programa para GLP-1", nutri: true },
  { href: "/app/referidos", label: "Invita y gana", icon: Gift, hint: "1 mes gratis por cada 3 amigos" },
  { href: "/app/soporte", label: "Ayuda y reportes", icon: Lifebuoy, hint: "Reporta un problema y sigue tu caso" },
  { href: "/app/novedades", label: "Novedades", icon: Sparkle, hint: "Lo nuevo en la app" },
];
const NEWS_HREF = "/app/novedades";
/** Fuera del menú principal: solo en "Más" (todavía no conecta relojes). */
const SOON: Item = { href: "/app/conexiones", label: "Relojes", icon: Watch, hint: "Próximamente" };
/** Barra inferior en móvil: 4 secciones + Coach al centro + "Más". */
const MOBILE: Item[] = [MAIN[0], MAIN[1], EXTRA[0], MAIN[4]];

/** `program`: programa activo (0024). Se marca en el menú con un distintivo discreto. */
/** `news`: novedades sin ver (0036). Pone un punto "Nuevo" en Novedades y en "Más". */
export function AppNav({ name, staff, nutrition, program = null, news = null }: { name: string; staff: boolean; nutrition: boolean; program?: { slug: string; title: string; mode?: string | null } | null; news?: { latestId: string | null; unseen: boolean; persisted: boolean } | null }) {
  const path = usePathname();
  const newsDot = useNewsDot(news);
  const newMark = (i: Item) => (newsDot && i.href === NEWS_HREF ? <span className="ml-auto rounded-full bg-banana px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink">Nuevo<span className="sr-only"> (hay novedades sin ver)</span></span> : null);
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  const active = (h: string) => (h === "/app" ? path === "/app" : path.startsWith(h));
  const inMore = ![...MOBILE].some((i) => active(i.href)) && path !== "/app";
  const locked = (i: Item) => Boolean(i.nutri) && !nutrition;
  const lockMark = (i: Item) => (locked(i) ? <><Lock weight="bold" aria-hidden className="ml-auto size-4 shrink-0 opacity-70" /><span className="sr-only"> ({NUTRI_HINT})</span></> : null);
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
        {program && (
          <Link href={`/app/retos/${program.slug}/progreso`} className="pressable mt-6 flex items-center gap-2.5 rounded-2xl bg-ink px-3 py-2.5 text-white hover:bg-black">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-[var(--program,var(--color-banana))]" />
            <span className="min-w-0"><span className="block text-[10px] font-extrabold uppercase tracking-[.12em] text-banana">{program.mode ?? "Programa activo"}</span><span className="block truncate text-sm font-bold">{program.title}</span></span>
          </Link>
        )}
        <nav aria-label="Menú principal" className={`${program ? "mt-4" : "mt-8"} -mx-2 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 py-2`}>
          {MAIN.map((it) => { const { href, label, icon: Icon } = it; return (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={sideLink(active(href))}>
              <Icon className="size-5" weight={active(href) ? "fill" : "duotone"} />{label}{lockMark(it)}
            </Link>
          ); })}
          <div className="my-3 border-t border-line" />
          {EXTRA.map((it) => { const { href, label, icon: Icon } = it; return (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={sideLink(active(href))}>
              <Icon className="size-5" weight={active(href) ? "fill" : "duotone"} />{label}{lockMark(it)}{newMark(it)}
            </Link>
          ); })}
        </nav>
        {staff && <ViewSwitch current="usuario" compact className="mt-3 shrink-0" />}
        <div className="mt-3 shrink-0 flex items-center gap-3 rounded-2xl bg-white border border-line p-3">
          <Link href="/app/perfil" className="pressable -my-1 flex min-h-11 flex-1 min-w-0 items-center gap-3 rounded-xl"><span className="grid place-items-center size-9 rounded-xl bg-banana font-bold text-ink">{name[0]?.toUpperCase()}</span>
          <span className="flex-1 truncate font-semibold text-ink">{name}</span></Link>
          {/* Guía de la app: botón compacto para no alargar el menú lateral */}
          <button type="button" onClick={openGuide} aria-haspopup="dialog" aria-label="Guía de la app" title="Guía de la app" className="tap pressable grid place-items-center size-9 rounded-full text-muted hover:bg-cream hover:text-ink"><Compass className="size-5" weight="duotone" aria-hidden /></button>
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
                <span className={`relative grid place-items-center h-8 w-12 rounded-full transition ${on ? "bg-banana" : ""}`}><Icon className="size-5" weight={on ? "fill" : "duotone"} />
                  {program && href === "/app/entrenar" && <span aria-hidden className="absolute right-2 top-0.5 size-2 rounded-full bg-ember ring-2 ring-white" />}
                </span>{label}{program && href === "/app/entrenar" && <span className="sr-only"> (programa activo: {program.title})</span>}
              </Link>
            );
          })}
          <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" aria-expanded={more} aria-controls={more ? "menu-mas" : undefined} className={`pressable flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${inMore ? "text-ink" : "text-muted"}`}>
            <span className={`relative grid place-items-center h-8 w-12 rounded-full transition ${inMore ? "bg-banana" : ""}`}><DotsThree className="size-6" weight="bold" />
              {newsDot && <span aria-hidden className="absolute right-2 top-0.5 size-2 rounded-full bg-ember ring-2 ring-white" />}
            </span>Más{newsDot && <span className="sr-only"> (hay novedades sin ver)</span>}
          </button>
        </div>
      </nav>

      <Sheet id="menu-mas" open={more} onClose={() => setMore(false)} className="px-5">
        <SheetTitle className="text-xl font-extrabold text-ink">Todo Banana Burn</SheetTitle>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {[MAIN[2], MAIN[3], ...EXTRA.slice(1), { href: "/app/perfil", label: "Perfil", icon: User, hint: "Plan, avisos y cuenta" }, { href: "/app/suscripcion", label: "Suscripción", icon: CreditCard, hint: "Plan y recibos" }, SOON].map((it: Item) => { const { href, label, icon: Icon } = it; const hint = locked(it) ? NUTRI_HINT : program && href === "/app/retos" ? `Programa activo: ${program.title}` : it.hint; return (
            <li key={href}>
              <Link href={href} aria-current={active(href) ? "page" : undefined} className={`pressable flex h-full flex-col gap-1.5 rounded-2xl p-3.5 ${active(href) ? "bg-ink text-white" : "bg-white border border-line/70 text-ink hover:bg-banana-soft"}`}>
                <span className="flex items-center justify-between gap-2"><Icon className={`size-6 ${active(href) ? "text-banana" : "text-banana-ink"}`} weight="duotone" />{locked(it) && <Lock weight="bold" aria-hidden className="size-4 opacity-70" />}{newMark(it)}</span>
                <span className="font-extrabold leading-tight">{label}</span>
                {hint && <span className={`text-xs ${active(href) ? "text-white/70" : "text-muted"}`}>{hint}</span>}
              </Link>
            </li>
          ); })}
          <li>
            {/* La hoja se cierra primero (200 ms) y luego se abre la guía: así no se pisan el bloqueo de scroll ni el foco. */}
            <button type="button" aria-haspopup="dialog" onClick={() => { setMore(false); setTimeout(openGuide, 220); }} className="pressable flex h-full w-full flex-col gap-1.5 rounded-2xl border border-line/70 bg-white p-3.5 text-left text-ink hover:bg-banana-soft">
              <Compass className="size-6 text-banana-ink" weight="duotone" aria-hidden />
              <span className="font-extrabold leading-tight">Guía de la app</span>
              <span className="text-xs text-muted">Cómo usar Banana Burn</span>
            </button>
          </li>
          {staff && <li className="col-span-2"><p className="mb-2 text-xs font-bold text-muted">Eres parte del equipo</p><ViewSwitch current="usuario" /></li>}
        </ul>
        <form action="/auth/salir" method="post" className="mt-4"><button className="btn-ghost w-full"><SignOut className="size-5" weight="bold" />Cerrar sesión</button></form>
      </Sheet>
    </>
  );
}
