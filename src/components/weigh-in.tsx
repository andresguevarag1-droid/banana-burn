"use client";
import { netMessage } from "@/lib/action-client";
import { useActionState, useState } from "react";
import { CheckCircle, CircleNotch, Minus, Plus } from "@/components/icons";
import { logWeight, type FormState } from "@/app/(app)/app/progreso/actions";

export function WeighIn({ last, compact = false }: { last: number; compact?: boolean }) {
  const [kg, setKg] = useState(last);
  const [s, act, pending] = useActionState((st: FormState, fd: FormData) => logWeight(st, fd).catch((): FormState => ({ error: netMessage() })), {});
  const fmt = (n: number) => n.toLocaleString("es-419", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const bump = (d: number) => { setKg((k) => Math.round((k + d) * 10) / 10); try { navigator.vibrate?.(10); } catch { /* */ } };
  if (s.ok) return <p role="status" className="flex items-center gap-2 font-bold text-peel py-2"><CheckCircle weight="fill" className="size-5 shrink-0" />{s.ok}</p>;
  return (
    <form action={act} className={`flex items-center gap-2 ${compact ? "" : "flex-wrap"}`}>
      <input type="hidden" name="kg" value={kg} />
      <div className="flex items-center rounded-2xl bg-cream h-12 flex-1 min-w-[170px]">
        <button type="button" onClick={() => bump(-0.1)} className="grid place-items-center w-11 h-full text-muted" aria-label="Restar 0,1 kg"><Minus weight="bold" className="size-4" /></button>
        <p className="flex-1 text-center text-xl font-extrabold text-ink tabular-nums">{fmt(kg)} <span className="text-sm text-faint">kg</span></p>
        <button type="button" onClick={() => bump(0.1)} className="grid place-items-center w-11 h-full text-muted" aria-label="Sumar 0,1 kg"><Plus weight="bold" className="size-4" /></button>
      </div>
      <button disabled={pending} className="btn-primary h-12 px-5">{pending ? <><CircleNotch weight="bold" className="size-5 animate-spin" /><span className="sr-only">Guardando</span></> : "Guardar"}</button>
      {s.error && <p role="alert" className="w-full text-sm font-semibold text-bad">{s.error}</p>}
    </form>
  );
}
