import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Users, Dumbbell, Apple, CreditCard, ScrollText, ArrowLeft } from "lucide-react";
import { DemoBanner, Logo } from "@/components/brand";
import { getViewer, STAFF } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s · Admin Banana Burn" }, robots: { index: false } };

const NAV = [
  { href: "/admin", label: "Resumen", icon: BarChart3 },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin#programas", label: "Programas", icon: Dumbbell, soon: true },
  { href: "/admin#alimentos", label: "Alimentos", icon: Apple, soon: true },
  { href: "/admin#pagos", label: "Pagos ONVO", icon: CreditCard, soon: true },
  { href: "/admin#auditoria", label: "Auditoría", icon: ScrollText, soon: true },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/admin");
  if (!STAFF.includes(v.role)) redirect("/app");
  return (
    <div className="min-h-dvh bg-[#FAF7EE]">
      {v.demo && <DemoBanner />}
      <div className="flex">
        <aside className="hidden md:flex sticky top-0 h-dvh w-60 flex-col border-r border-line bg-white px-3 py-5">
          <div className="px-2 flex items-center gap-2"><Logo href="/admin" small /><span className="chip bg-ink text-white h-5 text-[10px]">ADMIN</span></div>
          <nav className="mt-8 space-y-0.5 text-sm">
            {NAV.map(({ href, label, icon: Icon, soon }) => (
              <Link key={label} href={href} className="flex items-center gap-3 rounded-xl px-3 h-10 font-semibold text-muted hover:bg-paper hover:text-ink">
                <Icon className="size-4" />{label}{soon && <span className="ml-auto text-[10px] text-faint">pronto</span>}
              </Link>
            ))}
          </nav>
          <Link href="/app" className="mt-auto flex items-center gap-2 px-3 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" />Volver a la app</Link>
        </aside>
        <main className="flex-1 min-w-0 px-4 sm:px-8 py-8">
          <div className="md:hidden mb-6 flex items-center justify-between"><Logo href="/admin" small /><Link href="/admin/usuarios" className="text-sm font-semibold">Usuarios</Link></div>
          <p className="text-xs font-semibold text-muted mb-1">Sesión: {v.email} · rol <b className="text-ink">{v.role}</b></p>
          {children}
        </main>
      </div>
    </div>
  );
}
