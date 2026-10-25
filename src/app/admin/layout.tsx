import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MagnifyingGlass as Search, User } from "@/components/icons";
import { ViewSwitch } from "@/components/view-switch";
import { DemoBanner, Logo } from "@/components/brand";
import { AdminSidebarNav, AdminTabsNav, type NavItem } from "@/components/admin/nav";
import { RoleBadge } from "@/components/admin/ui";
import { getAdminViewer } from "@/lib/admin-auth";
import { canSee, isStaff, ROLE_LABEL, STAFF_ROLES, type Section } from "@/lib/admin-perms";
import { openReportsCount } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

/** Verificaciones de identidad pendientes (0030). Sin la migración o sin permiso: 0. */
async function pendingVerifications(demo: boolean): Promise<number> {
  if (demo) return 2;
  const { data, error } = await (await createClient()).rpc("admin_identity_queue", { p_status: "pendiente" });
  return error ? 0 : ((data ?? []) as unknown[]).length;
}
import { setDemoRole } from "./actions";
import { openSupportCount } from "@/lib/support-server";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s | Admin Banana Burn" }, robots: { index: false, follow: false } };

const NAV: (Omit<NavItem, "badge"> & { key: Section })[] = [
  { key: "resumen", href: "/admin", label: "Resumen" },
  { key: "usuarios", href: "/admin/usuarios", label: "Usuarios" },
  { key: "soporte", href: "/admin/soporte", label: "Soporte" },
  { key: "pagos", href: "/admin/pagos", label: "Pagos" },
  { key: "contenido", href: "/admin/contenido", label: "Contenido" },
  { key: "retos", href: "/admin/retos", label: "Retos" },
  { key: "comunidad", href: "/admin/comunidad", label: "Comunidad" },
  { key: "verificaciones", href: "/admin/verificaciones", label: "Verificaciones" },
  { key: "auditoria", href: "/admin/auditoria", label: "Auditoría" },
  { key: "referidores", href: "/admin/referidores", label: "Referidores" },
  { key: "condominios", href: "/admin/condominios", label: "Condominios" },
  { key: "salud", href: "/admin/salud", label: "Salud" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const v = await getAdminViewer();
  if (!v) redirect("/entrar?next=/admin");
  if (!isStaff(v.role)) redirect("/app");
  const [reports, verifs, tickets] = await Promise.all([canSee(v.role, "comunidad") ? openReportsCount(v) : 0, canSee(v.role, "verificaciones") ? pendingVerifications(v.demo).catch(() => 0) : 0, canSee(v.role, "soporte") ? openSupportCount(v).then((c) => c.open).catch(() => 0) : 0]);
  const items: NavItem[] = NAV.filter((n) => canSee(v.role, n.key)).map((n) => ({ ...n, badge: n.key === "comunidad" ? reports : n.key === "verificaciones" ? verifs : n.key === "soporte" ? tickets : undefined }));

  return (
    <div className="min-h-dvh bg-[#FAF7EE]">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">Saltar al contenido</a>
      {v.demo && <DemoBanner />}
      <div className="flex">
        <aside className="hidden md:flex sticky top-0 h-dvh w-60 shrink-0 flex-col border-r border-line bg-white px-3 py-5" aria-label="Navegación del panel">
          <div className="flex items-center gap-2 px-2"><Logo href="/admin" small /><span className="chip h-5 bg-ink px-2 text-[11px] text-white">Admin</span></div>
          <AdminSidebarNav items={items} />
          <div className="mt-3 shrink-0 space-y-3 px-1">
            {v.demo && (
              <form action={setDemoRole} className="rounded-xl bg-paper/70 p-3">
                <label htmlFor="demo-role" className="block text-xs font-semibold text-muted">Simular rol (solo demo)</label>
                <div className="mt-1.5 flex gap-1.5">
                  <select id="demo-role" name="role" defaultValue={v.role} className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-ink focus:ring-4 focus:ring-banana/40">
                    {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <button className="h-11 rounded-lg bg-ink px-3 text-xs font-bold text-white outline-none transition-transform duration-150 ease-out active:scale-[.97] focus-visible:ring-4 focus-visible:ring-banana/50">Usar</button>
                </div>
              </form>
            )}
            <ViewSwitch current="admin" compact />
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-x-clip">
          <header className="sticky top-0 z-30 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-8">
            <div className="flex h-14 items-center gap-3 md:h-16">
              <Link href="/admin" aria-label="Banana Burn, panel de administración" className="grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-banana/50 md:hidden">
                <Image src="/icons/logo.svg" alt="" width={32} height={32} unoptimized className="size-8 rounded-[10px]" />
              </Link>
              <form action="/admin/usuarios" role="search" className="relative min-w-0 flex-1 md:max-w-md">
                <label htmlFor="admin-search" className="sr-only">Buscar usuarios por nombre, correo o ID</label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
                <input id="admin-search" name="q" type="search" placeholder="Buscar usuarios" autoComplete="off" enterKeyHint="search"
                  className="h-11 w-full rounded-full border border-line bg-paper/60 pl-9 pr-4 text-sm text-ink placeholder:text-faint outline-none transition-[border-color,box-shadow,background-color] duration-150 focus:border-ink focus:bg-white focus:ring-4 focus:ring-banana/40" />
              </form>
              <div className="ml-auto flex shrink-0 items-center gap-2 text-sm">
                {/* En teléfonos angostos solo el ícono: así la búsqueda conserva espacio para escribir. */}
                <Link href="/app" aria-label="Vista usuario" className="md:hidden inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-line px-3 font-bold text-ink outline-none hover:bg-paper focus-visible:ring-4 focus-visible:ring-banana/50"><User weight="duotone" className="size-4" aria-hidden /><span className="hidden sm:inline">Vista usuario</span></Link>
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
