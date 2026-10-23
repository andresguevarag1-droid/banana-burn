"use client";
import { netMessage } from "@/lib/action-client";
import { useActionState } from "react";
import { logWeight, saveProfile, type FormState } from "./actions";
import type { Athlete } from "@/lib/athlete";

function Msg({ s }: { s: FormState }) {
  if (s.ok) return <p className="text-sm font-semibold text-peel">{s.ok}</p>;
  if (s.error) return <p role="alert" className="text-sm font-semibold text-bad">{s.error}</p>;
  return null;
}

export function WeightForm({ last }: { last: number }) {
  const [s, act, pending] = useActionState((st: FormState, fd: FormData) => logWeight(st, fd).catch((): FormState => ({ error: netMessage() })), {});
  return (
    <form action={act} className="space-y-3">
      <div className="flex gap-2">
        <input name="kg" inputMode="decimal" defaultValue={last} className="input h-13 text-xl font-bold" aria-label="Peso en kg" />
        <button disabled={pending} className="btn-primary h-13 px-6 shrink-0">Guardar</button>
      </div>
      <Msg s={s} />
    </form>
  );
}

function F({ label, ...p }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block space-y-1.5"><span className="text-sm font-semibold text-ink">{label}</span><input {...p} className="input h-12" /></label>;
}

/** Solo los campos del formulario: el resto del perfil (GLP-1, país, entreno) no viaja al navegador desde aquí. */
export type ProfileFormData = Pick<Athlete, "name" | "dob" | "heightCm" | "startWeight" | "goalWeight" | "goalDate" | "mode" | "sex">;
export function ProfileForm({ a }: { a: ProfileFormData }) {
  const [s, act, pending] = useActionState((st: FormState, fd: FormData) => saveProfile(st, fd).catch((): FormState => ({ error: netMessage() })), {});
  return (
    <form action={act} className="grid gap-4 sm:grid-cols-2">
      <F label="Nombre" name="full_name" defaultValue={a.name} />
      <F label="Fecha de nacimiento" name="dob" type="date" defaultValue={a.dob} required />
      <F label="Estatura (cm)" name="height_cm" inputMode="decimal" defaultValue={a.heightCm} required />
      <label className="block space-y-1.5"><span className="text-sm font-semibold text-ink">Sexo</span>
        <select name="sex" className="input h-12" defaultValue={a.sex}><option value="m">Hombre</option><option value="f">Mujer</option></select></label>
      <F label="Peso inicial (kg)" name="start_weight" inputMode="decimal" defaultValue={a.startWeight} required />
      <F label="Peso meta (kg)" name="goal_weight" inputMode="decimal" defaultValue={a.goalWeight} required />
      <F label="Fecha meta" name="goal_date" type="date" defaultValue={a.goalDate} required />
      <label className="block space-y-1.5"><span className="text-sm font-semibold text-ink">Modo</span>
        <select name="mode" className="input h-12" defaultValue={a.mode}><option value="acelerada">Acelerada (−500 kcal)</option><option value="recomp">Recomposición (−200 kcal)</option><option value="fuerza">Ganar fuerza (+250 kcal)</option></select></label>
      <label className="sm:col-span-2 flex gap-3 items-start text-sm text-muted">
        <input type="checkbox" name="health_consent" required className="mt-1 size-4 accent-ink" />
        Autorizo a Banana Burn a procesar mis datos de salud (peso, medidas, alimentación) para personalizar mi plan, según la Ley 8968. Puedo retirar este consentimiento y borrar mis datos cuando quiera.
      </label>
      <div className="sm:col-span-2 flex items-center gap-4"><button disabled={pending} className="btn-primary h-12 px-6">Calcular mi plan</button><Msg s={s} /></div>
    </form>
  );
}
