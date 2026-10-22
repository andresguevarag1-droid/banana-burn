import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { DemoBanner } from "@/components/brand";
import { InstallPrompt } from "@/components/install-prompt";
import { TzSync } from "@/components/tz-sync";
import { getViewer, STAFF } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/app");
  if (!v.onboarded) redirect("/bienvenida");
  return (
    <div className="lg:pl-64">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-full focus:bg-ink focus:text-white focus:px-4 focus:py-2">Saltar al contenido</a>
      {v.demo && <DemoBanner />}
      <AppNav name={v.name} staff={STAFF.includes(v.role)} />
      <InstallPrompt />
      <TzSync current={v.tz} />
      <main id="contenido" tabIndex={-1} className="block mx-auto max-w-5xl min-w-0 overflow-x-clip px-4 sm:px-8 outline-none pt-6 sm:pt-10 pb-32 lg:pb-16">{children}</main>
    </div>
  );
}
