import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MagnifyingGlass as Search } from "@/components/icons";
import { DemoBanner, Logo } from "@/components/brand";
import { AdminSidebarNav, AdminTabsNav, type NavItem } from "@/components/admin/nav";
import { RoleBadge } from "@/components/admin/ui";
import { getAdminViewer } from "@/lib/admin-auth";
import { canSee, isStaff, ROLE_LABEL, STAFF_ROLES, type Section } from "@/lib/admin-perms";
import { openReportsCount } from "@/lib/admin";
import { setDemoRole } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s | Admin Banana Burn" }, robots: { index: false, follow: false } };

const NAV: (Omit<NavItem, "badge"> & { key: Section })[] = [
  { key: "resumen", href: "/admin", label: "Resumen" },
  { key: "usuarios", href: "/admin/usuarios", label: "Usuarios" },
  { key: "pagos", href: "/admin/pagos", label: "Pagos" },
  { key: "contenido", href: "/admin/contenido", label: "Contenido" },
  { key: "comunidad", href: "/admin/comunidad", label: "Comunidad" },
  { key: "auditoria", href: "/admin/auditoria", label: "Auditoría" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const v = await getAdminViewer();
  if (!v) redirect("/entrar?next=/admin");
  if (!isStaff(v.role)) redirect("/app");
  const reports = canSee(v.role, "comunidad") ? await openReportsCount(v) : 0;
  const items: NavItem[] = NAV.filter((n) => canSee(v.role, n.key)).map((n) => ({ ...n, badge: n.key === "comunidad" ? reports : undefined }));

  return (
    <div className="min-h-dvh bg-[#FAF7EE]">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">Saltar al contenido</a>
      {v.demo && <DemoBanner />}
      <div className="flex">
        <aside className="hidden md:flex sticky top-0 h-dvh w-60 shrink-0 flex-col border-r border-line bg-white px-3 py-5" aria-label="Navegación del panel">
          <div className="flex items-center gap-2 px-2"><Logo href="/admin" small /><span className="chip h-5 bg-ink px-2 text-[11px] text-white">Admin</span></div>
          <AdminSidebarNav items={items} />
          <div className="mt-auto space-y-3 px-1">
            {v.demo && (
              <form action={setDemoRole} className="rounded-xl bg-paper/70 p-3">
                <label htmlFor="demo-role" className="block text-xs font-semibold text-muted">Simular rol (solo demo)</label>
                <div className="mt-1.5 flex gap-1.5">
                  <select id="demo-role" name="role" defaultValue={v.role} className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-ink focus:ring-4 focus:ring-banana/40">
                    {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <button className="h-9 rounded-lg bg-ink px-3 text-xs font-bold text-white outline-none transition-transform duration-150 ease-out active:scale-[.97] focus-visible:ring-4 focus-visible:ring-banana/50">Usar</button>
                </div>
              </form>
            )}
            <Link href="/app" className="flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-4 focus-visible:ring-banana/50"><ArrowLeft className="size-4" aria-hidden />Volver a la app</Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-x-clip">
          <header className="sticky top-0 z-30 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-8">
            <div className="flex h-14 items-center gap-3 md:h-16">
              <Link href="/admin" aria-label="Banana Burn, panel de administración" className="shrink-0 rounded-[10px] outline-none focus-visible:ring-4 focus-visible:ring-banana/50 md:hidden">
                <Image src="/icons/logo.svg" alt="" width={32} height={32} unoptimized className="size-8 rounded-[10px]" />
              </Link>
              <form action="/admin/usuarios" role="search" className="relative min-w-0 flex-1 md:max-w-md">
                <label htmlFor="admin-search" className="sr-only">Buscar usuarios por nombre, correo o ID</label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
                <input id="admin-search" name="q" type="search" placeholder="Buscar usuarios" autoComplete="off" enterKeyHint="search"
                  className="h-10 w-full rounded-full border border-line bg-paper/60 pl-9 pr-4 text-sm text-ink placeholder:text-faint outline-none transition-[border-color,box-shadow,background-color] duration-150 focus:border-ink focus:bg-white focus:ring-4 focus:ring-banana/40" />
              </form>
              <div className="ml-auto flex shrink-0 items-center gap-2 text-sm">
                <Link href="/app" className="md:hidden inline-flex h-11 items-center gap-1 rounded-full px-2 font-semibold text-muted outline-none hover:bg-paper hover:text-ink focus-visible:ring-4 focus-visible:ring-banana/50"><ArrowLeft className="size-4" aria-hidden />App<span className="sr-only"> (volver)</span></Link>
                <span className="hidden max-w-48 truncate text-muted lg:inline" title={v.email}>{v.email}</span>
                <RoleBadge role={v.role} />
              </div>
            </div>
            <AdminTabsNav items={items} />
          </header>
          <main id="admin-main" className="max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
