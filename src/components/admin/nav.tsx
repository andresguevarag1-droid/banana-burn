"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { BookOpen, CreditCard, IdentificationCard, Medal, SquaresFour as LayoutDashboard, Scroll as ScrollText, ShieldWarning as ShieldAlert, Users } from "@/components/icons";

const ICONS = { resumen: LayoutDashboard, usuarios: Users, pagos: CreditCard, contenido: BookOpen, retos: Medal, comunidad: ShieldAlert, verificaciones: IdentificationCard, auditoria: ScrollText } as const;
export type NavItem = { key: keyof typeof ICONS; href: string; label: string; badge?: number };

const isActive = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));

/** Contador de pendientes: número tabular, sin punto decorativo; el texto accesible dice qué cuenta. */
function Count({ n, inverted }: { n: number; inverted?: boolean }) {
  return (
    <span className={`ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${inverted ? "bg-banana text-ink" : "bg-ember text-ink"}`}>
      {n}<span className="sr-only"> pendientes</span>
    </span>
  );
}

export function AdminSidebarNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Secciones del panel" className="mt-8">
      <ul className="space-y-0.5 text-sm">
        {items.map(({ key, href, label, badge }) => {
          const Icon = ICONS[key];
          const active = isActive(path, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-9 items-center gap-3 rounded-lg px-3 font-semibold outline-none transition-colors duration-150 focus-visible:ring-4 focus-visible:ring-banana/50 ${active ? "bg-ink text-white" : "text-muted hover:bg-paper hover:text-ink"}`}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
                {!!badge && <Count n={badge} inverted={active} />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Navegación móvil: tira horizontal desplazable; la sección activa siempre queda a la vista (sin animar el desplazamiento). */
export function AdminTabsNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }, [path]);
  return (
    <nav ref={ref} aria-label="Secciones del panel" className="-mx-4 overflow-x-auto px-4 md:hidden">
      <ul className="flex w-max gap-1 pb-2 text-sm">
        {items.map(({ key, href, label, badge }) => {
          const Icon = ICONS[key];
          const active = isActive(path, href);
          return (
            <li key={key}>
              <Link href={href} aria-current={active ? "page" : undefined}
                className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 font-semibold outline-none transition-colors duration-150 focus-visible:ring-4 focus-visible:ring-banana/50 ${active ? "bg-ink text-white" : "text-muted hover:bg-paper hover:text-ink"}`}>
                <Icon className="size-4" aria-hidden />{label}{!!badge && <Count n={badge} inverted={active} />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
