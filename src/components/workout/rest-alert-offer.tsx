"use client";
// Dentro de la app nativa, en el primer descanso: ofrece el aviso de fin de descanso con la pantalla bloqueada. Es el
// momento con contexto para pedir el permiso de avisos (el mismo que usan los recordatorios push). Se pregunta una vez.
import { useEffect, useState } from "react";
import { Bell } from "@/components/icons";
import { useIsNativeApp } from "@/components/platform-provider";
import { store } from "./device";

const ASKED_KEY = "bb.restAlert.asked";

export function RestAlertOffer() {
  const native = useIsNativeApp();
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    if (!native || store.get(ASKED_KEY)) return;
    let alive = true;
    import("@/lib/native/device").then((m) => m.notifyPermission()).then((p) => { if (alive && p === "prompt") setAsk(true); }).catch(() => {});
    return () => { alive = false; };
  }, [native]);
  if (!ask) return null;
  const close = () => { store.set(ASKED_KEY, Date.now()); setAsk(false); };
  const enable = () => { close(); void import("@/lib/native/device").then((m) => m.requestNotify()).catch(() => {}); };
  return (
    <div className="mt-4 flex items-start gap-3 rounded-[1.5rem] bg-white/[.09] p-3.5 ring-1 ring-white/10">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-banana text-ink"><Bell weight="fill" className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold leading-tight">¿Te avisamos al terminar el descanso?</p>
        <p className="mt-0.5 text-[13px] font-semibold text-white/75">Suena aunque bloquees la pantalla o cambies de app.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={enable} className="btn-banana h-12 px-5 text-[15px]">Sí, avísame</button>
          <button type="button" onClick={close} className="tap pressable h-12 rounded-full px-4 text-[15px] font-bold text-white/75 hover:text-white">Ahora no</button>
        </div>
      </div>
    </div>
  );
}
