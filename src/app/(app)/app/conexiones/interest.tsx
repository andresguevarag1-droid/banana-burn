"use client";
import { useState, useTransition } from "react";
import { Check, Plus } from "@/components/icons";
import { setDeviceInterest } from "./actions";
import type { DeviceId } from "./devices";

/** "Lo quiero": voto de interés por un reloj. Optimista con reversión si falla. */
export function InterestButton({ id, name, initial }: { id: DeviceId; name: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [err, setErr] = useState(false);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col items-end">
      <button type="button" aria-pressed={on} disabled={pending} aria-label={on ? `Quitar mi voto por ${name}` : `Quiero conectar ${name}`}
        onClick={() => { const n = !on; setOn(n); setErr(false); start(async () => { const r = await setDeviceInterest(id, n).catch(() => ({ ok: false })); if (!r.ok) { setOn(!n); setErr(true); } }); }}
        className={`tap pressable inline-flex items-center gap-1.5 h-11 px-4 rounded-full text-sm font-bold ${on ? "bg-peel/15 text-peel" : "bg-ink text-white"}`}>
        {on ? <><Check weight="bold" className="size-4" />Lo quiero</> : <><Plus weight="bold" className="size-4" />Lo quiero</>}
      </button>
      {err && <span role="alert" className="mt-1 text-[11px] font-semibold text-bad">No se guardó. Intenta de nuevo.</span>}
    </span>
  );
}
