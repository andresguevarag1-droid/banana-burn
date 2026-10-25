"use client";
// Formulario de /condominios. Envía a requestMeeting (server action); muestra el error junto al botón y, al terminar, un
// estado de éxito que reemplaza el formulario. Los campos conservan lo escrito si hay un error. El campo "website" es una trampa para bots (oculto para personas).
import { startTransition, useActionState } from "react";
import { CheckCircle } from "@/components/icons";
import { ROLES, TIMES } from "@/lib/condominios";
import { requestMeeting, type LeadState } from "./actions";

const label = "mb-1.5 block text-[15px] font-bold text-ink";
const opt = "text-[13px] font-semibold text-muted";

function SendButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className="btn-primary h-14! w-full text-base! disabled:opacity-70">
      {pending ? "Enviando…" : "Agendar una reunión virtual"}
    </button>
  );
}

export function LeadForm({ condo }: { condo: string | null }) {
  const [state, action, pending] = useActionState<LeadState, FormData>(requestMeeting, null);
  // Se envía con onSubmit (y no con action={...}) para que React no vacíe los campos si hay un error de validación.
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };

  if (state?.ok) {
    return (
      <div role="status" className="flex flex-col items-start justify-center rounded-[1.5rem] bg-white p-6 shadow-lift sm:p-8">
        <span className="grid size-14 place-items-center rounded-full bg-banana text-ink"><CheckCircle weight="fill" className="size-8" /></span>
        <h3 className="mt-5 text-2xl font-extrabold text-ink">Recibimos tu solicitud.</h3>
        <p className="mt-2 text-lg text-pretty">En menos de 24 horas hábiles te confirmamos el día y la hora y te enviamos el enlace de la videollamada. También te enviamos un correo de confirmación.</p>
        {state.message !== "Recibido." && <p className="mt-3 text-sm text-muted">{state.message}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[1.5rem] bg-white p-5 shadow-lift sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="l-name" className={label}>Tu nombre</label>
          <input id="l-name" name="name" required minLength={2} maxLength={80} autoComplete="name" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="l-role" className={label}>Tu cargo</label>
          <select id="l-role" name="role" required defaultValue="" className="input appearance-auto">
            <option value="" disabled>Elige una opción</option>
            {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="l-org" className={label}>Nombre del condominio</label>
          <input id="l-org" name="org" required minLength={2} maxLength={100} defaultValue={condo ?? ""} autoComplete="organization" className="input" />
        </div>
        <div>
          <label htmlFor="l-units" className={label}>Unidades o residentes <span className={opt}>(opcional)</span></label>
          <input id="l-units" name="units" maxLength={40} inputMode="numeric" placeholder="Ej.: 120 unidades" className="input" />
        </div>
        <div>
          <label htmlFor="l-portfolio" className={label}>¿Administran varios condominios? ¿Cuántos? <span className={opt}>(opcional)</span></label>
          <input id="l-portfolio" name="portfolio" maxLength={40} placeholder="Ej.: Sí, 4 condominios" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="l-loc" className={label}>Provincia y cantón <span className={opt}>(opcional)</span></label>
          <input id="l-loc" name="location" maxLength={100} placeholder="Ej.: San José, Escazú" className="input" />
        </div>
        <div>
          <label htmlFor="l-email" className={label}>Correo</label>
          <input id="l-email" name="email" type="email" required maxLength={254} autoComplete="email" className="input" />
        </div>
        <div>
          <label htmlFor="l-phone" className={label}>Teléfono o WhatsApp <span className={opt}>(opcional)</span></label>
          <input id="l-phone" name="phone" type="tel" maxLength={30} autoComplete="tel" placeholder="Ej.: 8888 8888" className="input" />
        </div>
        <fieldset className="sm:col-span-2">
          <legend className={label}>Hora que prefieres para la reunión virtual <span className={opt}>(opcional)</span></legend>
          <div className="flex flex-wrap gap-2">
            {TIMES.map(([k, l]) => (
              <label key={k} className="tap inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-cream px-4 font-semibold text-ink has-[:checked]:border-ink has-[:checked]:bg-banana has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-banana/60">
                <input type="checkbox" name="times" value={k} className="size-4 accent-ink" />{l}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <label htmlFor="l-days" className={label}>Día que prefieres para la reunión virtual <span className={opt}>(opcional)</span></label>
          <input id="l-days" name="days" maxLength={80} placeholder="Ej.: martes 3 o jueves 5" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="l-comment" className={label}>Comentario <span className={opt}>(opcional)</span></label>
          <textarea id="l-comment" name="comment" maxLength={1000} rows={3} placeholder="Cuéntanos del gimnasio del condominio o lo que quieras revisar en la reunión." className="input h-auto! py-3" />
        </div>
      </div>
      {/* Trampa para bots: fuera de la vista y del orden de tabulación. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="l-website">Sitio web</label>
        <input id="l-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <input type="hidden" name="source" value={condo ? `condominios:${condo}`.slice(0, 60) : "condominios"} />
      {state && !state.ok && <p role="alert" className="mt-4 rounded-xl bg-[#FDECEC] px-4 py-3 text-[15px] font-semibold text-bad">{state.message}</p>}
      <div className="mt-5"><SendButton pending={pending} /></div>
      <p className="mt-3 text-center text-[13px] text-muted">Usamos tus datos solo para coordinar la reunión virtual. <a href="/privacidad" className="underline underline-offset-2">Privacidad</a></p>
    </form>
  );
}
