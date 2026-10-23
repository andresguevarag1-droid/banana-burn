import Link from "next/link";
import { getViewer } from "@/lib/supabase/server";
import { getMyVerification } from "@/lib/profile-power-server";
import { ArrowLeft, Clock, ShieldCheck } from "@/components/icons";
import { VerifiedMark } from "@/components/community/flair";
import { DOC_LABEL, type DocType } from "@/lib/identity";
import { COUNTRY_NAME } from "@/lib/countries";
import { VerifyFlow, WithdrawButton } from "./flow";

export const metadata = { title: "Verificar mi identidad" };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric" }) : "");

export default async function Verificar() {
  const v = (await getViewer())!;
  const s = await getMyVerification(v).catch(() => null);
  return (
    <div className="space-y-5 animate-enter max-w-2xl">
      <Link href="/app/perfil" className="tap inline-flex h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Mi perfil</Link>
      <header>
        <p className="eyebrow">Perfil verificado</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink text-balance">Verifica tu identidad</h1>
        <p className="mt-1 text-muted text-pretty">Con el sello <b className="text-ink">Verificado</b> la tropa sabe que detrás de tu perfil hay una persona real. Suma 10 puntos a tu perfil y se ve junto a tu nombre en publicaciones, comentarios y el ranking.</p>
      </header>

      {s?.status === "aprobada" ? (
        <section className="card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-peel/10"><VerifiedMark className="size-9" label={false} /></span>
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-ink">Tu identidad está verificada</p>
              <p className="text-sm text-muted">{DOC_LABEL[s.docType as DocType] ?? "Documento"} ({COUNTRY_NAME[s.country] ?? s.country}), aprobada el {fmt(s.reviewedAt)}.</p>
            </div>
          </div>
          <p className="rounded-2xl bg-cream p-3 text-sm text-body">{s.filesDeleted ? "Ya borramos las fotos de tu documento y tu nombre como aparece en él." : "Estamos borrando las fotos de tu documento."} Solo guardamos el tipo de documento, el país, sus últimos 3 caracteres y el resultado.</p>
          <WithdrawButton label="Retirar mi verificación" confirm="Pierdes el sello Verificado y sus 10 puntos de perfil. Borramos todo lo que queda de tu verificación." />
        </section>
      ) : s?.status === "pendiente" ? (
        <section className="card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-banana-soft text-banana-ink"><Clock weight="duotone" className="size-8" /></span>
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-ink">Tu verificación está en revisión</p>
              <p className="text-sm text-muted">La enviaste el {fmt(s.submittedAt)}. Te avisamos en la campanita cuando esté lista. Si no alcanzamos a revisarla en 30 días, borramos las fotos y puedes enviarla de nuevo.</p>
            </div>
          </div>
          <WithdrawButton label="Retirar y borrar mis fotos" confirm="Borramos tus fotos y cancelamos la revisión. Puedes volver a enviarla cuando quieras." />
        </section>
      ) : (
        <>
          {s?.status === "rechazada" && (
            <p role="status" className="card border-bad/30 bg-bad/5 p-4 text-sm text-ink"><b>No pudimos verificar tu identidad.</b> Motivo: {s.rejectionReason ?? "sin detalle"}. Ya borramos las fotos; puedes enviarlas de nuevo.</p>
          )}
          <VerifyFlow userId={v.id} demo={v.demo} defaultCountry={v.country ?? "CR"} />
        </>
      )}

      <p className="flex items-start gap-2 text-xs text-muted"><ShieldCheck weight="duotone" className="mt-0.5 size-4 shrink-0 text-peel" />Tratamos tus datos según la Ley N.º 8968 de Costa Rica. Más detalle en la <Link href="/privacidad#identidad" className="underline">política de privacidad</Link>.</p>
    </div>
  );
}
