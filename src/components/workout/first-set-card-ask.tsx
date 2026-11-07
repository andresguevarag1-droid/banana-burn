"use client";
// Pedido de tarjeta tras la primera serie (#280): ya sintió que funciona. Una línea en el descanso que no interrumpe; un toque
// abre el formulario en una hoja encima del entreno (no se sale del entreno). "Cerrar" la oculta en este teléfono.
// Hoy no se cobra nada: con la prueba en curso, guardar la tarjeta programa el cobro al terminarla (saveCard).
import { useEffect, useRef, useState } from "react";
import { CheckCircle, CreditCard, X } from "@/components/icons";
import { CardForm, type CardSaved } from "@/components/pagos/card-form";
import { firstWorkoutOffer } from "@/lib/first-workout-offer";
import { PROMO_TERMS } from "@/lib/trial";
import { usd2 } from "@/lib/num";

/** La línea del pedido, para la pantalla de descanso (fondo oscuro). `onSeen` avisa la primera vez que se muestra. */
export function FirstSetCardLine({ onOpen, onClose, onSeen }: { onOpen: () => void; onClose: () => void; onSeen?: () => void }) {
  const o = firstWorkoutOffer();
  const seen = useRef(onSeen);
  useEffect(() => { seen.current?.(); }, []);
  return (
    <div className="mt-3 flex w-full items-start gap-2 rounded-[1.25rem] bg-white/[.09] p-3 text-left ring-1 ring-white/10">
      <CreditCard weight="duotone" aria-hidden className="mt-0.5 size-5 shrink-0 text-banana" />
      <p className="min-w-0 flex-1 text-[15px] font-semibold text-white/85 text-pretty">
        Tu primer mes a <span className="tabular-nums">{usd2(o.monthFirst)}</span> si dejas tu tarjeta hoy. Hoy no se cobra nada.{" "}
        <button type="button" onClick={onOpen} data-cta="primera-serie-tarjeta" className="tap inline-flex min-h-11 items-center font-extrabold text-banana underline underline-offset-4">Dejar mi tarjeta</button>
      </p>
      <button type="button" onClick={onClose} aria-label="Cerrar" data-cta="primera-serie-tarjeta-cerrar" className="tap -mr-1 -mt-1 grid size-11 shrink-0 place-items-center rounded-xl text-white/60 hover:text-white"><X weight="bold" className="size-5" /></button>
    </div>
  );
}

/** El formulario de la tarjeta encima del entreno: Entreno mensual con el 50 % del primer mes. */
export function FirstSetCardSheet({ onClose, onSaved }: { onClose: () => void; onSaved: (r: CardSaved) => void }) {
  const o = firstWorkoutOffer();
  const [done, setDone] = useState(false);
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus({ preventScroll: true }); }, [done]);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="primera-serie-tarjeta" className="fixed inset-0 z-[70] overflow-y-auto bg-paper">
      <div className="mx-auto max-w-md space-y-4 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {done ? (<>
          <h2 id="primera-serie-tarjeta" ref={head} tabIndex={-1} className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-ink outline-none text-balance"><CheckCircle weight="duotone" className="size-7 shrink-0 text-peel" />Listo, tu tarjeta quedó guardada</h2>
          <p className="text-body text-pretty">Hoy no se cobra nada. Al terminar tu prueba se cobra tu primer mes de {o.name}: <b className="tabular-nums">{usd2(o.monthFirst)}</b>, salvo que canceles antes desde Mi plan. Te avisamos 2 días antes.</p>
          <button type="button" onClick={onClose} className="btn-banana h-14 w-full text-base">Seguir entrenando</button>
        </>) : (<>
          <div className="flex items-start justify-between gap-3">
            <h2 id="primera-serie-tarjeta" ref={head} tabIndex={-1} className="text-2xl font-extrabold tracking-tight text-ink outline-none text-balance">Tu primer mes a {usd2(o.monthFirst)} si dejas tu tarjeta hoy</h2>
            <button type="button" onClick={onClose} aria-label="Volver al entreno" className="tap -mr-2 grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:text-ink"><X weight="bold" className="size-5" /></button>
          </div>
          <p className="text-body text-pretty">{o.name} mensual: <b className="tabular-nums">{usd2(o.monthFirst)}</b> el primer mes, después <span className="tabular-nums">{usd2(o.month)}</span> al mes. Precios en USD, IVA incluido.</p>
          <CardForm choice={{ plan: o.plan, billing: "mes" }} demo={false} submitLabel="Dejar mi tarjeta" onSaved={(r) => { onSaved(r); setDone(true); }}
            note={<><b>Hoy no se cobra nada.</b> Se cobra al terminar tu prueba, salvo que canceles antes desde Mi plan. Te avisamos 2 días antes.</>} />
          <p className="text-xs text-muted text-pretty">{PROMO_TERMS}</p>
          <button type="button" onClick={onClose} className="btn-ghost h-12 w-full">Seguir entrenando</button>
        </>)}
      </div>
    </div>
  );
}
