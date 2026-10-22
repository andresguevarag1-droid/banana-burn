"use client";
// Formularios de acciones del panel: estado accesible (aria-live), botón con pending y diálogo de confirmación nativo.
import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Check, TriangleAlert } from "lucide-react";
import type { ActionState } from "@/app/admin/actions";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function Submit({ children, className = "btn-primary h-10! px-4! text-sm!", pendingText = "Guardando…" }: { children: ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} aria-disabled={pending}>{pending ? pendingText : children}</button>;
}

export function Status({ state }: { state: ActionState }) {
  return (
    <p role="status" aria-live="polite" className={`text-sm min-h-5 ${state?.ok ? "text-[#17703A]" : "text-[#B4232A]"}`}>
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
    <form ref={ref} action={formAction} className={className} noValidate={false}>
      {children}
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
      <button type="button" className={triggerClassName ?? (danger ? "btn h-10! px-4! text-sm! border border-[#F3C2C4] bg-white text-[#B4232A] hover:bg-[#FDECEC]" : "btn-ghost h-10! px-4! text-sm!")} onClick={() => dlg.current?.showModal()} aria-haspopup="dialog">
        {trigger}
      </button>
      <dialog ref={dlg} aria-labelledby={`${uid}-t`} aria-describedby={description ? `${uid}-d` : undefined}
        className="m-auto w-[min(92vw,30rem)] rounded-[1.5rem] border border-line bg-white p-0 shadow-lift backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]">
        <form ref={form} action={formAction} className="p-6 space-y-4">
          <h2 id={`${uid}-t`} className="text-lg font-extrabold text-ink">{title}</h2>
          {description && <div id={`${uid}-d`} className="text-sm text-muted">{description}</div>}
          {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
          {children}
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" name="confirm" required className="mt-0.5 size-4 accent-[#1B1505]" />
            Entiendo el efecto de esta acción y quedará registrada en auditoría.
          </label>
          <Status state={state} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost h-10! px-4! text-sm!" onClick={() => dlg.current?.close()}>Cancelar</button>
            <Submit className={danger ? "btn h-10! px-4! text-sm! bg-bad text-white hover:brightness-95" : "btn-primary h-10! px-4! text-sm!"} pendingText="Aplicando…">{confirmLabel}</Submit>
          </div>
        </form>
      </dialog>
    </>
  );
}
