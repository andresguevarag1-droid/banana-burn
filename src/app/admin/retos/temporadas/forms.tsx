"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { btnGhost, btnPrimary, Field, inputSm, textareaSm } from "@/components/admin/ui";
import { createSeasonFromDraft, generateSeasonDraft, updateSeasonDraft } from "./actions";

function Submit({ children, ghost, name, value }: { children: React.ReactNode; ghost?: boolean; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" name={name} value={value} disabled={pending} className={`${ghost ? btnGhost : btnPrimary} ${pending ? "opacity-60" : ""}`}>{pending ? "Un momento..." : children}</button>;
}
const Msg = ({ s }: { s: { ok: boolean; message: string } | null }) => <p role="status" aria-live="polite" className={s ? `text-sm font-semibold ${s.ok ? "text-[#17703A]" : "text-[#B4232A]"}` : "sr-only"}>{s?.message}</p>;

export function GenerateDraft({ slug }: { slug: string }) {
  const [s, act] = useActionState(generateSeasonDraft, null);
  return (
    <form action={act} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="slug" value={slug} />
      <Submit>Borrador de la próxima temporada</Submit>
      <Msg s={s} />
    </form>
  );
}

export function EditDraft({ id, title, notes }: { id: number; title: string; notes: string }) {
  const [s, act] = useActionState(updateSeasonDraft, null);
  const [c, create] = useActionState(createSeasonFromDraft, null);
  return (
    <div className="space-y-3">
      <form action={act} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <Field label="Título" htmlFor={`t-${id}`}><input id={`t-${id}`} name="title" defaultValue={title} maxLength={80} required className={`${inputSm} w-full`} /></Field>
        <Field label="Notas para revisar" htmlFor={`n-${id}`}><textarea id={`n-${id}`} name="notes" defaultValue={notes} rows={6} maxLength={3800} className={`${textareaSm} w-full`} /></Field>
        <div className="flex flex-wrap gap-2"><Submit ghost name="status" value="borrador">Guardar</Submit><Submit ghost name="status" value="descartado">Descartar</Submit></div>
        <Msg s={s} />
      </form>
      <form action={create} className="space-y-2 border-t border-line pt-3">
        <input type="hidden" name="id" value={id} />
        <p className="text-sm text-muted">Crea la temporada en la tienda como borrador. No la ve nadie hasta que la publiques desde Retos.</p>
        <Submit>Crear en la tienda como borrador</Submit>
        <Msg s={c} />
      </form>
    </div>
  );
}
