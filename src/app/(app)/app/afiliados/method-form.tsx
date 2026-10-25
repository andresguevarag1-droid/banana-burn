"use client";
import { useActionState, useState } from "react";
import { saveMethod, type MethodState } from "./actions";

/** Formulario del método de pago. Lo guardado se muestra enmascarado; para cambiarlo se escribe de nuevo completo. */
export function MethodForm({ current }: { current: { kind: "sinpe" | "iban"; masked: string; holder: string } | null }) {
  const [state, action, pending] = useActionState<MethodState, FormData>(saveMethod, null);
  const [open, setOpen] = useState(!current);
  const [kind, setKind] = useState<"sinpe" | "iban">(current?.kind ?? "sinpe");
  if (!open) return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="font-bold text-ink">{current!.masked}</p><p className="text-sm text-muted">A nombre de {current!.holder}</p></div>
      <button type="button" className="btn-ghost h-11 px-4" onClick={() => setOpen(true)}>Cambiar</button>
      {state?.ok && <p className="w-full text-sm font-semibold text-peel" role="status">{state.msg}</p>}
    </div>
  );
  return (
    <form action={action} className="space-y-3">
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-ink">¿Cómo te pagamos?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["sinpe", "iban"] as const).map((k) => (
            <label key={k} className={`flex h-12 cursor-pointer items-center justify-center rounded-2xl border-2 text-sm font-bold transition-colors duration-150 ${kind === k ? "border-ink bg-ink text-white" : "border-line text-ink"}`}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {k === "sinpe" ? "SINPE Móvil" : "Transferencia (IBAN)"}
            </label>
          ))}
        </div>
      </fieldset>
      {kind === "sinpe" ? (
        <label className="block text-sm font-bold text-ink">Número de SINPE Móvil
          <input name="sinpe_phone" inputMode="numeric" autoComplete="tel-national" required pattern="[0-9 \-]{8,10}" placeholder="8888 8888" className="input mt-1 h-12 w-full font-normal" />
        </label>
      ) : (
        <label className="block text-sm font-bold text-ink">IBAN
          <input name="iban" required autoCapitalize="characters" placeholder="CR00 0000 0000 0000 0000 00" className="input mt-1 h-12 w-full font-mono font-normal" />
        </label>
      )}
      <label className="block text-sm font-bold text-ink">Nombre del titular
        <input name="holder_name" required minLength={2} maxLength={120} autoComplete="name" defaultValue={current?.holder ?? ""} className="input mt-1 h-12 w-full font-normal" />
      </label>
      <label className="block text-sm font-bold text-ink">Cédula o identificación <span className="font-normal text-muted">(opcional, la piden algunos bancos)</span>
        <input name="id_number" maxLength={20} className="input mt-1 h-12 w-full font-normal" />
      </label>
      {state && <p className={`text-sm font-semibold ${state.ok ? "text-peel" : "text-ember-ink"}`} role={state.ok ? "status" : "alert"}>{state.msg}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary h-12 flex-1">{pending ? "Guardando…" : "Guardar método de pago"}</button>
        {current && <button type="button" className="btn-ghost h-12 px-4" onClick={() => setOpen(false)}>Cancelar</button>}
      </div>
      <p className="text-xs text-muted">Solo el dueño de Banana Burn ve estos datos, para hacerte el pago. Después de guardarlos, aquí se muestran ocultos.</p>
    </form>
  );
}
