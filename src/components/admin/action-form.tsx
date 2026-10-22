"use client";
// Formularios de acciones del panel: estado accesible (aria-live), botón con pending y diálogo de confirmación nativo.
import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Check, Warning as TriangleAlert } from "@/components/icons";
import type { ActionState } from "@/app/admin/actions";
import { btnDanger, btnGhost, btnPrimary } from "@/components/admin/ui";

const btnDangerOutline = btnGhost.replace("bg-white!", "bg-white! text-bad! border-[#F3C2C4]! hover:bg-[#FDECEC]!");

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function Submit({ children, className = btnPrimary, pendingText = "Guardando…" }: { children: ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} aria-disabled={pending}>{pending ? pendingText : children}</button>;
}

export function Status({ state }: { state: ActionState }) {
  return (
    <p role="status" aria-live="polite" className={`mt-2 text-sm empty:mt-0 ${state?.ok ? "text-[#17703A]" : "text-[#B4232A]"}`}>
      {state && (state.ok ? <Check className="inline size-4 mr-1 -mt-0.5" aria-hidden /> : <TriangleAlert className="inline size-4 mr-1 -mt-0.5" aria-hidden />)}
      {state?.message}
    </p>
  );
}

/** Formulario simple con mensaje de resultado. */
export function ActionForm({ action, children, className = "", resetOnSuccess = false }: { action: Action; children: ReactNode; className?: string; resetOnSuccess?: boolean }) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && resetOnSuccess) ref.current?.reset(); }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} noValidate={false}>
      {/* El mensaje va fuera de la rejilla del formulario: no ocupa una celda ni deja hueco cuando está vacío. */}
      <div className={className}>{children}</div>
      <Status state={state} />
    </form>
  );
}

/**
 * Botón que abre un <dialog> modal con confirmación explícita (casilla obligatoria) antes de ejecutar la acción.
 * El servidor vuelve a exigir `confirm=on`, así que no se puede saltar desde el cliente.
 */
export function ConfirmAction({ action, trigger, title, description, hidden, children, confirmLabel = "Confirmar", danger = false, triggerClassName }: {
  action: Action; trigger: ReactNode; title: string; description?: ReactNode; hidden: Record<string, string | number>;
  children?: ReactNode; confirmLabel?: string; danger?: boolean; triggerClassName?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const dlg = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const uid = useId();
  useEffect(() => {
    if (state?.ok) { const t = setTimeout(() => { dlg.current?.close(); form.current?.reset(); }, 900); return () => clearTimeout(t); }
  }, [state]);
  return (
    <>
      <button type="button" className={triggerClassName ?? (danger ? btnDangerOutline : btnGhost)} onClick={() => dlg.current?.showModal()} aria-haspopup="dialog">
        {trigger}
      </button>
      <dialog ref={dlg} aria-labelledby={`${uid}-t`} aria-describedby={description ? `${uid}-d` : undefined}
        className="m-auto w-[min(calc(100vw-2rem),30rem)] max-h-[calc(100dvh-2rem)] rounded-2xl border border-line bg-white p-0 shadow-lift backdrop:bg-ink/40 transition-[opacity,scale] duration-150 ease-out starting:open:scale-[.97] starting:open:opacity-0">
        <form ref={form} action={formAction} className="space-y-4 p-5 sm:p-6">
          <h2 id={`${uid}-t`} className="text-lg font-extrabold text-ink text-balance">{title}</h2>
          {description && <div id={`${uid}-d`} className="text-sm text-muted text-pretty">{description}</div>}
          {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
          {children}
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" name="confirm" required className="mt-0.5 size-4 accent-[#1B1505]" />
            Entiendo el efecto de esta acción y quedará registrada en auditoría.
          </label>
          <Status state={state} />
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => dlg.current?.close()}>Cancelar</button>
            <Submit className={danger ? btnDanger : btnPrimary} pendingText="Aplicando…">{confirmLabel}</Submit>
          </div>
        </form>
      </dialog>
    </>
  );
}
