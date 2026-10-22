"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CaretDown, CaretUp, Copy, Eye, EyeSlash } from "@phosphor-icons/react/dist/ssr";
import { rowAction } from "@/components/admin/ui";
import { duplicateChallenge, moveChallenge, setChallengeStatus } from "./actions";

function Btn({ children, label }: { children: React.ReactNode; label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-label={label} title={label} className={`${rowAction} h-10! min-w-10 justify-center gap-1 ${pending ? "opacity-60" : ""}`}>{children}</button>;
}

function Mini({ action, fields, label, children }: { action: typeof moveChallenge; fields: Record<string, string>; label: string; children: React.ReactNode }) {
  const [state, act] = useActionState(action, null);
  return (
    <form action={act} className="relative inline-flex">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Btn label={label}>{children}</Btn>
      <span role="status" aria-live="polite" className={state && !state.ok ? "absolute right-0 top-full z-10 mt-1 w-56 rounded-lg bg-white p-2 text-xs text-[#B4232A] shadow-lift" : "sr-only"}>{state?.message}</span>
    </form>
  );
}

export function MoveButtons({ id, first, last }: { id: string; first: boolean; last: boolean }) {
  return (
    <span className="inline-flex">
      {!first ? <Mini action={moveChallenge} fields={{ id, dir: "arriba" }} label="Subir en el orden"><CaretUp weight="bold" className="size-4" /></Mini> : <span className="inline-block w-10" />}
      {!last ? <Mini action={moveChallenge} fields={{ id, dir: "abajo" }} label="Bajar en el orden"><CaretDown weight="bold" className="size-4" /></Mini> : <span className="inline-block w-10" />}
    </span>
  );
}

export function QuickActions({ id, status }: { id: string; status: string }) {
  return (
    <span className="inline-flex flex-nowrap justify-end gap-1">
      <Mini action={duplicateChallenge} fields={{ id }} label="Duplicar como borrador"><Copy className="size-4" />Duplicar</Mini>
      {status === "publicado"
        ? <Mini action={setChallengeStatus} fields={{ id, status: "oculto" }} label="Ocultar de la tienda"><EyeSlash className="size-4" />Ocultar</Mini>
        : status === "oculto" ? <Mini action={setChallengeStatus} fields={{ id, status: "publicado" }} label="Volver a mostrar en la tienda"><Eye className="size-4" />Mostrar</Mini> : null}
    </span>
  );
}
