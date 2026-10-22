import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { DemoBanner } from "@/components/brand";
import { InstallPrompt } from "@/components/install-prompt";
import { getViewer, STAFF } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/app");
  if (!v.onboarded) redirect("/bienvenida");
  return (
    <div className="lg:pl-64">
      {v.demo && <DemoBanner />}
      <AppNav name={v.name} staff={STAFF.includes(v.role)} />
      <InstallPrompt />
      <div className="mx-auto max-w-5xl min-w-0 overflow-x-clip px-4 sm:px-8 pt-6 sm:pt-10 pb-32 lg:pb-16">{children}</div>
    </div>
  );
}
