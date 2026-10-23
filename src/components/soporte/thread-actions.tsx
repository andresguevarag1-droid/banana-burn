"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowCounterClockwise, CheckCircle, PaperPlaneTilt, WarningCircle } from "@/components/icons";
import { replyTicket, ticketAction } from "@/app/actions/support";
import { safeAction } from "@/lib/action-client";
import { MESSAGE_MAX, REOPEN_DAYS } from "@/lib/support";

/** Responder en el caso (mientras esté abierto) y "Ya se resolvió" o "Reabrir" (hasta 7 días después). */
export function ThreadActions({ ticketId, canReply, canConfirm, canReopen, needInfo }: { ticketId: number; canReply: boolean; canConfirm: boolean; canReopen: boolean; needInfo: boolean }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const uid = useId();
  const run = (p: () => Promise<{ ok: boolean; error?: string; demo?: boolean }>, okText: string, after?: () => void) => start(async () => {
    const r = await safeAction(p());
    if (!r.ok) { setMsg({ ok: false, text: r.error ?? "No se pudo. Intenta de nuevo." }); return; }
    setMsg({ ok: true, text: r.demo ? `${okText} (modo demo: no se guardó).` : okText });
    after?.();
    if (!r.demo) router.refresh();
  });
  return (
    <div className="space-y-3">
      {canReply && (
        <form onSubmit={(e) => { e.preventDefault(); if (!text.trim() || pending) return; run(() => replyTicket(ticketId, text), "Mensaje enviado", () => setText("")); }} className="card space-y-3 p-4">
          <label htmlFor={`${uid}-r`} className="block text-sm font-bold text-ink">{needInfo ? "Responde lo que te pedimos" : "Agregar un mensaje"}</label>
          <textarea id={`${uid}-r`} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={MESSAGE_MAX} placeholder="Escribe aquí" className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-[16px] text-ink placeholder:text-faint outline-none transition-[border-color,box-shadow] duration-150 focus:border-ink focus:ring-4 focus:ring-banana/40" />
          <button type="submit" disabled={pending || !text.trim()} aria-disabled={pending || !text.trim()} className="btn-primary h-11 px-5 text-sm"><PaperPlaneTilt weight="fill" className="size-4" aria-hidden />{pending ? "Enviando…" : "Enviar"}</button>
        </form>
      )}
      {(canConfirm || canReopen) && (
        <div className="flex flex-wrap gap-2">
          {canConfirm && <button type="button" disabled={pending} onClick={() => run(() => ticketAction(ticketId, "confirmar"), "Gracias, cerramos tu reporte")} className="btn-ghost h-11 px-4 text-sm"><CheckCircle weight="duotone" className="size-4 text-peel" aria-hidden />Ya se resolvió</button>}
          {canReopen && <button type="button" disabled={pending} onClick={() => run(() => ticketAction(ticketId, "reabrir"), "Reabrimos tu reporte")} className="btn-ghost h-11 px-4 text-sm"><ArrowCounterClockwise weight="bold" className="size-4" aria-hidden />Sigue pasando, reabrir</button>}
          {canReopen && <p className="w-full text-xs text-muted">Puedes reabrirlo hasta {REOPEN_DAYS} días después de resuelto.</p>}
        </div>
      )}
      <p role="status" aria-live="polite" className={`flex items-center gap-1.5 text-sm font-semibold empty:hidden ${msg?.ok ? "text-peel" : "text-bad"}`}>{msg && (msg.ok ? <CheckCircle weight="fill" className="size-4" aria-hidden /> : <WarningCircle weight="fill" className="size-4" aria-hidden />)}{msg?.text}</p>
    </div>
  );
}
