"use client";
// Revisión de una verificación: fotos con enlaces de 60 segundos (se ocultan solas), aprobar o rechazar con motivo.
import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, Warning } from "@/components/icons";
import { btnDanger, btnGhost, btnPrimary, inputSm } from "@/components/admin/ui";
import { decideIdentity, viewIdentityDocs } from "./actions";

const REASONS = ["La foto del documento está borrosa", "El nombre no coincide con el documento", "Los últimos 3 no coinciden", "La selfie no muestra el documento", "El documento está vencido"];

export function Review({ userId, name }: { userId: string; name: string }) {
  const [docs, setDocs] = useState<{ front: string; selfie: string; left: number } | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const rid = useId();

  // Cuenta regresiva: al vencer el enlace, las fotos se ocultan (no quedan en pantalla).
  useEffect(() => {
    if (!docs) return;
    if (docs.left <= 0) { setDocs(null); return; }
    const t = setTimeout(() => setDocs((d) => (d ? { ...d, left: d.left - 1 } : d)), 1000);
    return () => clearTimeout(t);
  }, [docs]);

  const open = () => start(async () => {
    setMsg(null);
    const r = await viewIdentityDocs(userId).catch(() => ({ ok: false as const, error: "Sin conexión." }));
    if (r.ok) setDocs({ front: r.front, selfie: r.selfie, left: r.expiresIn }); else setMsg({ ok: false, t: r.error });
  });
  const decide = (approve: boolean) => start(async () => {
    setMsg(null);
    const r = await decideIdentity(userId, approve, reason).catch(() => ({ ok: false, message: "Sin conexión." }));
    setMsg({ ok: r.ok, t: r.message });
    if (r.ok) { setDocs(null); setRejecting(false); router.refresh(); }
  });

  return (
    <div className="space-y-3">
      {docs ? (
        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <figure className="overflow-hidden rounded-xl border border-line bg-paper"><img src={docs.front} alt={`Frente del documento de ${name}`} referrerPolicy="no-referrer" className="aspect-[16/10] w-full object-contain" /><figcaption className="px-3 py-1.5 text-xs font-semibold text-muted">Frente del documento</figcaption></figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <figure className="overflow-hidden rounded-xl border border-line bg-paper"><img src={docs.selfie} alt={`Selfie de ${name} con el documento`} referrerPolicy="no-referrer" className="aspect-[16/10] w-full object-contain" /><figcaption className="px-3 py-1.5 text-xs font-semibold text-muted">Selfie con el documento</figcaption></figure>
          </div>
          <p className="text-xs text-muted" aria-live="polite">Las fotos se ocultan en {docs.left} s. <button type="button" onClick={() => setDocs(null)} className="font-semibold underline">Ocultar ya</button></p>
        </div>
      ) : (
        <button type="button" onClick={open} disabled={pending} className={btnGhost}><Eye weight="duotone" className="size-4" aria-hidden />{pending ? "Abriendo…" : "Ver fotos (60 s)"}</button>
      )}

      {rejecting ? (
        <div className="space-y-2 rounded-xl bg-[#FDECEC]/60 p-3">
          <label htmlFor={rid} className="block text-xs font-bold text-ink">Motivo del rechazo (la persona lo va a leer)</label>
          <div className="flex flex-wrap gap-1.5">{REASONS.map((r) => <button key={r} type="button" onClick={() => setReason(r)} className={`tap h-9 rounded-full border px-3 text-xs font-semibold transition-[background-color,transform] duration-150 ease-out active:scale-[.97] ${reason === r ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/30"}`}>{r}</button>)}</div>
          <input id={rid} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} maxLength={300} className={inputSm} placeholder="O escribe el motivo" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => decide(false)} disabled={pending || reason.trim().length < 4} className={btnDanger}>{pending ? "Guardando…" : "Rechazar y borrar fotos"}</button>
            <button type="button" onClick={() => setRejecting(false)} className={btnGhost}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Decisión sobre ${name}`}>
          <button type="button" onClick={() => decide(true)} disabled={pending} className={btnPrimary}><Check weight="bold" className="size-4" aria-hidden />Aprobar y borrar fotos</button>
          <button type="button" onClick={() => setRejecting(true)} disabled={pending} className={btnGhost}>Rechazar</button>
        </div>
      )}
      {msg && <p role="status" className={`flex items-center gap-1.5 text-sm font-semibold ${msg.ok ? "text-[#17703A]" : "text-[#B4232A]"}`}>{msg.ok ? <Check className="size-4" aria-hidden /> : <Warning className="size-4" aria-hidden />}{msg.t}</p>}
    </div>
  );
}
