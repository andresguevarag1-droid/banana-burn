"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CreditCard, LayoutDashboard, ScrollText, ShieldAlert, Users } from "lucide-react";

const ICONS = { resumen: LayoutDashboard, usuarios: Users, pagos: CreditCard, contenido: BookOpen, comunidad: ShieldAlert, auditoria: ScrollText } as const;
export type NavItem = { key: keyof typeof ICONS; href: string; label: string; badge?: number };

const isActive = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));

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
                className={`relative flex items-center gap-3 rounded-xl px-3 h-10 font-semibold outline-none transition focus-visible:ring-4 focus-visible:ring-banana/50 ${active ? "bg-ink text-white" : "text-muted hover:bg-paper hover:text-ink"}`}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
                {!!badge && <span className={`ml-auto min-w-5 h-5 px-1.5 grid place-items-center rounded-full text-[11px] font-bold ${active ? "bg-banana text-ink" : "bg-ember text-white"}`} aria-label={`${badge} pendientes`}>{badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Navegación móvil: tira horizontal desplazable. */
export function AdminTabsNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Secciones del panel" className="md:hidden -mx-4 px-4 overflow-x-auto border-b border-line bg-white">
      <ul className="flex gap-1 py-2 text-sm w-max">
        {items.map(({ key, href, label, badge }) => {
          const Icon = ICONS[key];
          const active = isActive(path, href);
          return (
            <li key={key}>
              <Link href={href} aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3 h-9 font-semibold whitespace-nowrap outline-none focus-visible:ring-4 focus-visible:ring-banana/50 ${active ? "bg-ink text-white" : "text-muted hover:bg-paper"}`}>
                <Icon className="size-4" aria-hidden />{label}{!!badge && <span className="ml-0.5 rounded-full bg-ember text-white text-[10px] px-1.5">{badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
