// Afiche A4 con el QR del enlace de un condominio afiliado (0053), para pegar en el gimnasio del condominio.
// Solo staff de soporte y administración ("leads.b2b"). El QR se genera en el servidor (sin servicios externos).
// Al imprimir se oculta la navegación del panel y la hoja ocupa un A4 completo.
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/admin-auth";
import { adminClient } from "@/lib/supabase/admin";
import { condoLink } from "@/lib/condos";
import { condoQrSvg } from "@/lib/condo-qr";
import { PageHeader } from "@/components/admin/ui";
import { PrintButton } from "@/components/admin/print-button";

export const metadata = { title: "Afiche del condominio" };
export const dynamic = "force-dynamic";

export default async function CondoPoster({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireSection("condominios");
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  let condo: { name: string; code: string } | null = null;
  if (v.demo) condo = { name: "Condominio Las Palmas", code: "las-palmas" };
  else {
    const db = adminClient();
    const { data } = db ? await db.from("condos").select("name,code").eq("id", id).maybeSingle() : { data: null };
    condo = (data as { name: string; code: string } | null) ?? null;
  }
  if (!condo) notFound();
  const url = condoLink(condo.code);
  const qr = await condoQrSvg(url);
  const short = url.replace(/^https?:\/\/(www\.)?/, "");

  return (
    <div className="space-y-5 print:space-y-0">
      <style>{"@page { size: A4; margin: 0; } @media print { html, body { background: #fff !important; } }"}</style>
      <div className="print:hidden">
        <PageHeader title={`Afiche de ${condo.name}`} desc="Imprímelo en A4 (a color) y pégalo en el gimnasio, el ascensor o el lobby. En la ventana de impresión, desactiva encabezados y pies de página." back={{ href: "/admin/condominios", label: "Condominios" }}>
          <PrintButton label="Imprimir afiche" />
        </PageHeader>
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <article aria-label={`Afiche de ${condo.name}`} className="mx-auto flex aspect-[210/297] w-full min-w-[320px] max-w-[794px] flex-col overflow-hidden rounded-2xl bg-banana text-ink shadow-lift print:h-[297mm] print:w-[210mm] print:max-w-none print:rounded-none print:shadow-none [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
          <div className="flex flex-1 flex-col px-[7%] pt-[7%]">
            <div className="flex items-center gap-[2.5%]">
              <Image src="/icons/logo.svg" alt="" width={64} height={64} unoptimized className="size-[clamp(2rem,8vw,4rem)] rounded-[22%]" />
              <p className="text-[clamp(1.1rem,4.4vw,2.2rem)] font-extrabold tracking-tight">Banana Burn</p>
            </div>
            <p className="mt-[6%] inline-flex self-start rounded-full bg-ink px-[3.5%] py-[1.2%] text-[clamp(.7rem,2.4vw,1.2rem)] font-bold text-banana">{condo.name}</p>
            <h1 className="mt-[3%] text-[clamp(1.6rem,7.6vw,3.9rem)] font-extrabold leading-[1.02] tracking-tight text-balance">Tu condominio te regala el primer mes.</h1>
            <p className="mt-[3%] max-w-[88%] text-[clamp(.85rem,3vw,1.5rem)] font-semibold leading-snug text-ink/85 text-pretty">Un entrenador personal en tu celular: tu plan de cada semana, la técnica de cada ejercicio y Coach Banana a cualquier hora.</p>
            <div className="mt-auto grid grid-cols-[1fr_auto] items-end gap-[4%] pb-[6%]">
              <div className="rounded-[1.5rem] bg-white p-[6%] shadow-lift">
                <div className="mx-auto aspect-square w-full max-w-[340px] [&_svg]:h-full [&_svg]:w-full" role="img" aria-label={`Código QR que abre ${short}`} dangerouslySetInnerHTML={{ __html: qr }} />
                <p className="mt-[5%] text-center text-[clamp(.75rem,2.6vw,1.3rem)] font-extrabold">Escanéalo con la cámara</p>
                <p className="mt-[1%] break-all text-center text-[clamp(.6rem,2vw,1rem)] font-semibold text-ink/70">{short}</p>
              </div>
              <Image src="/brand/mascota-sola.webp" alt="" width={640} height={640} className="h-auto w-[clamp(6rem,28vw,15rem)]" />
            </div>
          </div>
          <div className="bg-ink px-[7%] py-[4%] text-[clamp(.75rem,2.5vw,1.25rem)] font-bold text-white">
            30 días gratis con todo incluido. Sin tarjeta y sin cobros automáticos.
          </div>
        </article>
      </div>
    </div>
  );
}
