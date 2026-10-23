// Estado de la verificación de identidad en Mi perfil: invitación, en revisión, verificado o rechazado (con motivo).
import Link from "next/link";
import { ArrowRight, Clock, IdentificationCard, WarningCircle } from "@/components/icons";
import { VerifiedMark } from "@/components/community/flair";
import { DOC_LABEL, type DocType } from "@/lib/identity";
import type { MyVerification } from "@/lib/profile-power-server";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long" }) : "");

export function VerifyCard({ s }: { s: MyVerification }) {
  if (s?.status === "aprobada") {
    return (
      <section className="card flex items-center gap-3 p-4" aria-label="Verificación de identidad">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-peel/10"><VerifiedMark className="size-8" label={false} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-ink">Identidad verificada</p>
          <p className="text-sm text-muted">{DOC_LABEL[s.docType as DocType] ?? "Documento"}, desde el {fmt(s.reviewedAt)}. Ya borramos las fotos.</p>
        </div>
        <Link href="/app/perfil/verificar" className="tap inline-flex h-11 shrink-0 items-center px-2 text-sm font-bold text-muted underline hover:text-ink">Gestionar</Link>
      </section>
    );
  }
  if (s?.status === "pendiente") {
    return (
      <section className="card flex items-center gap-3 p-4" aria-label="Verificación de identidad">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-banana-soft text-banana-ink"><Clock weight="duotone" className="size-6" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-ink">Verificación en revisión</p>
          <p className="text-sm text-muted">La enviaste el {fmt(s.submittedAt)}. Te avisamos en la campanita cuando esté lista.</p>
        </div>
        <Link href="/app/perfil/verificar" className="tap inline-flex h-11 shrink-0 items-center px-2 text-sm font-bold text-muted underline hover:text-ink">Ver</Link>
      </section>
    );
  }
  return (
    <section className="card overflow-hidden" aria-labelledby="verif-t">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${s?.status === "rechazada" ? "bg-bad/10 text-bad" : "bg-ink text-banana"}`}>
          {s?.status === "rechazada" ? <WarningCircle weight="duotone" className="size-6" /> : <IdentificationCard weight="duotone" className="size-6" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="verif-t" className="font-extrabold text-ink">{s?.status === "rechazada" ? "No pudimos verificar tu identidad" : "Verifica tu identidad"}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {s?.status === "rechazada" ? <>Motivo: {s.rejectionReason ?? "sin detalle"}. Puedes enviarla de nuevo.</> : <>Gana el sello <b className="text-ink">Verificado</b> junto a tu nombre y +10 puntos de perfil. Toma 2 minutos con tu cédula, DIMEX, pasaporte o el documento de tu país.</>}
          </p>
          <Link href="/app/perfil/verificar" className="btn-primary mt-3 h-11 px-5 text-sm">{s?.status === "rechazada" ? "Enviar de nuevo" : "Verificar mi identidad"}<ArrowRight weight="bold" className="size-4" /></Link>
        </div>
      </div>
    </section>
  );
}
