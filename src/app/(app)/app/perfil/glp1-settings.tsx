"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateGlp1 } from "./actions";
import { MEDS, type Glp1Med } from "@/lib/glp1";

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function Glp1Settings({ on: on0, med: m0, dow: d0 }: { on: boolean; med: Glp1Med; dow: number | null }) {
  const [on, setOn] = useState(on0);
  const [med, setMed] = useState<Glp1Med>(m0);
  const [dow, setDow] = useState<number | null>(d0);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-3 cursor-pointer">
        <span><span className="block font-bold text-ink">Estoy en tratamiento con GLP-1</span><span className="block text-xs text-muted">Activa Banana Shield: proteína alta, fuerza primero y modo suave en días de náusea.</span></span>
        <input type="checkbox" role="switch" checked={on} onChange={(e) => setOn(e.target.checked)} className="size-5 accent-ink" />
      </label>
      {on && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-bold text-ink">Medicamento</span><select value={med} onChange={(e) => setMed(e.target.value as Glp1Med)} className="input h-12 mt-1">{MEDS.map((m) => <option key={m.id} value={m.id}>{m.n} ({m.ex})</option>)}</select></label>
          <label className="block"><span className="text-sm font-bold text-ink">Día de inyección</span><select value={dow ?? -1} onChange={(e) => setDow(Number(e.target.value) < 0 ? null : Number(e.target.value))} className="input h-12 mt-1"><option value={-1}>No es semanal</option>{[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}</select></label>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={() => start(async () => { const r = await updateGlp1({ on, med, dow }); setMsg(r.ok ? (r.demo ? "Demo: no se guardó." : "✅ Guardado") : r.error ?? "Error"); router.refresh(); })} className="btn-primary h-11 px-6">{pending ? "Guardando…" : "Guardar"}</button>
        {msg && <p role="status" className="text-sm font-semibold text-peel">{msg}</p>}
      </div>
      <p className="text-[11px] text-faint">No damos indicaciones de dosis. Cualquier cambio en tu medicamento, con tu médico.</p>
    </div>
  );
}
