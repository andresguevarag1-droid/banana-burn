import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { DemoBanner, Logo } from "@/components/brand";
import { AdminSidebarNav, AdminTabsNav, type NavItem } from "@/components/admin/nav";
import { RoleBadge } from "@/components/admin/ui";
import { getAdminViewer } from "@/lib/admin-auth";
import { canSee, isStaff, ROLE_LABEL, STAFF_ROLES, type Section } from "@/lib/admin-perms";
import { openReportsCount } from "@/lib/admin";
import { setDemoRole } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s · Admin Banana Burn" }, robots: { index: false, follow: false } };

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
          <div className="px-2 flex items-center gap-2"><Logo href="/admin" small /><span className="chip bg-ink text-white h-5 text-[10px]">ADMIN</span></div>
          <AdminSidebarNav items={items} />
          <div className="mt-auto space-y-3 px-1">
            {v.demo && (
              <form action={setDemoRole} className="rounded-2xl border border-dashed border-line p-3">
                <label htmlFor="demo-role" className="block text-[11px] font-bold uppercase tracking-wider text-muted">Simular rol (demo)</label>
                <div className="mt-1.5 flex gap-1.5">
                  <select id="demo-role" name="role" defaultValue={v.role} className="h-9 flex-1 min-w-0 rounded-xl border border-line bg-white px-2 text-sm text-ink focus:outline-none focus:ring-4 focus:ring-banana/40">
                    {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <button className="h-9 rounded-xl bg-ink px-3 text-xs font-bold text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-banana/50">Ver</button>
                </div>
              </form>
            )}
            <Link href="/app" className="flex items-center gap-2 px-2 text-sm font-semibold text-muted hover:text-ink rounded-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-banana/50"><ArrowLeft className="size-4" aria-hidden />Volver a la app</Link>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur px-4 sm:px-8">
            <div className="flex h-16 items-center gap-3">
              <div className="md:hidden"><Logo href="/admin" small /></div>
              <form action="/admin/usuarios" role="search" className="relative flex-1 max-w-md ml-auto md:ml-0">
                <label htmlFor="admin-search" className="sr-only">Buscar usuarios por nombre, correo o ID</label>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
                <input id="admin-search" name="q" type="search" placeholder="Buscar usuarios…" autoComplete="off"
                  className="h-10 w-full rounded-full border border-line bg-paper/60 pl-10 pr-4 text-sm text-ink placeholder:text-faint outline-none focus:border-ink focus:bg-white focus:ring-4 focus:ring-banana/40" />
              </form>
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="text-muted truncate max-w-48" title={v.email}>{v.email}</span>
                <RoleBadge role={v.role} />
              </div>
              <div className="sm:hidden"><RoleBadge role={v.role} /></div>
            </div>
            <AdminTabsNav items={items} />
          </header>
          <main id="admin-main" className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1400px]">{children}</main>
        </div>
      </div>
    </div>
  );
}
