import Link from "next/link";
import { ArrowLeft } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { ReportForm } from "@/components/soporte/report-form";
import { feedbackPage } from "@/lib/testers";
import { SUPPORT_CATEGORIES } from "@/lib/support";

export const metadata = { title: "Reportar un problema", robots: { index: false } };

export default async function NuevoReporte({ searchParams }: { searchParams: Promise<{ desde?: string; origen?: string; categoria?: string }> }) {
  const v = (await getViewer())!;
  const sp = await searchParams;
  const cat = SUPPORT_CATEGORIES.some(([k]) => k === sp.categoria) ? sp.categoria! : "app";
  return (
    <div className="max-w-2xl space-y-5 animate-enter">
      <Link href="/app/soporte" className="tap inline-flex h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" aria-hidden />Mis reportes</Link>
      <header>
        <p className="eyebrow">Ayuda</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink text-balance">Reportar un problema</h1>
        <p className="mt-1 text-sm text-muted text-pretty">Cuéntanos qué pasó. Te avisamos cuando lo recibimos, cuando lo trabajamos y cuando queda resuelto.</p>
      </header>
      <ReportForm userId={v.id} demo={v.demo} page={feedbackPage(sp.desde)} origin={(sp.origen ?? "soporte").slice(0, 12)} defaultCategory={cat} />
    </div>
  );
}
