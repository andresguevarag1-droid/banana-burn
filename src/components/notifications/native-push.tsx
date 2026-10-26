"use client";
// Avisos dentro de la app nativa (src/lib/native/push.ts): la misma tarjeta que en la web, con el permiso del sistema.
// Aparece en los mismos momentos con contexto (después de entrenar en Hoy, en Perfil, Avisos y en Tus primeros pasos).
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BananaFlame, Barbell, Bell, BellSlash, Moon } from "@/components/icons";
import { nativePlatform } from "@/lib/platform";

type State = "checking" | "unavailable" | "prompt" | "granted" | "off" | "denied" | "working";
const SNOOZE_KEY = "bb.pushSnoozedAt";

export function NativePush({ hideWhenSnoozed = false, onChange, hourly = false }: { hideWhenSnoozed?: boolean; onChange?: (on: boolean) => void; hourly?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [snoozed, setSnoozed] = useState(false);
  const refresh = useCallback(() => import("@/lib/native/push").then((m) => m.pushState()).then(setState).catch(() => setState("unavailable")), []);
  useEffect(() => {
    void refresh();
    try { setSnoozed(Boolean(localStorage.getItem(SNOOZE_KEY))); } catch { /* */ }
  }, [refresh]);

  const enable = async () => {
    setState("working");
    const next = await import("@/lib/native/push").then((m) => m.enableNativePush((p) => router.push(p))).catch(() => "unavailable" as const);
    setState(next);
    if (next === "granted") onChange?.(true);
  };
  const disable = async () => {
    setState("working");
    await import("@/lib/native/push").then((m) => m.forgetNativePush({ off: true })).catch(() => {});
    setState("off");
    onChange?.(false);
  };
  const snooze = () => { setSnoozed(true); try { localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch { /* */ } };

  if (state === "checking" || state === "unavailable") return null;
  if (hideWhenSnoozed && (snoozed || state === "granted" || state === "denied")) return null;

  if (state === "granted") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-peel/30 bg-peel/5 p-3">
        <span className="grid place-items-center size-10 rounded-xl bg-peel/15 text-peel"><Bell weight="fill" className="size-5" /></span>
        <div className="flex-1 min-w-0"><p className="text-sm font-bold text-ink">Avisos activos en este teléfono</p><p className="text-xs text-muted">{hourly ? "Máximo 2 al día, nunca en tus horas de silencio." : "Máximo 2 al día."}</p></div>
        <button onClick={disable} className="tap px-2 text-xs font-bold text-muted underline hover:text-ink">Desactivar</button>
      </div>
    );
  }

  if (state === "denied") {
    const where = nativePlatform() === "ios" ? "Ajustes, Banana Burn, Notificaciones" : "Ajustes, Apps, Banana Burn, Notificaciones";
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-cream p-3">
        <span className="grid place-items-center size-10 shrink-0 rounded-xl bg-white text-muted"><BellSlash weight="duotone" className="size-5" /></span>
        <p className="text-sm text-muted">Los avisos están apagados para Banana Burn. Para activarlos, abre <b>{where}</b> y permítelos.</p>
      </div>
    );
  }

  // Antes del permiso del sistema (o con los avisos apagados desde aquí): para qué sirven, en una tarjeta.
  return (
    <div className="rounded-3xl border-2 border-banana bg-banana-soft/40 p-4">
      <div className="flex items-start gap-3">
        <span className="grid place-items-center size-11 shrink-0 rounded-2xl bg-banana text-ink"><Bell weight="duotone" className="size-6" /></span>
        <div className="min-w-0">
          <p className="font-extrabold text-ink">Que no se te pase ningún entreno</p>
          <ul className="mt-2 space-y-1 text-sm text-body">
            <li className="flex items-center gap-2"><Barbell weight="duotone" className="size-4 shrink-0 text-banana-ink" />{hourly ? "Qué te toca hoy, a la hora que elijas" : "Qué te toca hoy, en la mañana"}</li>
            {hourly && <li className="flex items-center gap-2"><BananaFlame className="size-4 shrink-0 text-ember-ink" />Un empujón a las 8 p. m. si tu racha está en juego</li>}
            <li className="flex items-center gap-2"><Moon weight="duotone" className="size-4 shrink-0 text-banana-ink" />{hourly ? "Máximo 2 al día y nunca en tus horas de silencio" : "Máximo 2 al día"}</li>
          </ul>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={enable} disabled={state === "working"} className="btn-primary h-12 flex-1 px-5">{state === "working" ? "Activando" : "Activar avisos"}</button>
        {hideWhenSnoozed && <button onClick={snooze} className="btn-ghost h-12 px-5">Ahora no</button>}
      </div>
    </div>
  );
}
