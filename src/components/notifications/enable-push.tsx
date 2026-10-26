"use client";
import { useCallback, useEffect, useState } from "react";
import { BananaFlame, Barbell, Bell, BellSlash, Check, Export, Moon, PlusSquare } from "@/components/icons";
import { useIsNativeApp } from "@/components/platform-provider";

type State = "checking" | "unsupported" | "ios-install" | "not-configured" | "default" | "denied" | "subscribed" | "working";

const SNOOZE_KEY = "bb.pushSnoozedAt";
const INSTALL_DONE_KEY = "bb.iosInstallDone";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIos = () => typeof navigator !== "undefined" && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1));
const isStandalone = () => {
  try { return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true; } catch { return false; }
};

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

/**
 * Activa Web Push con una tarjeta explicativa ANTES del permiso nativo (si el usuario dice "no" al navegador,
 * no se puede volver a preguntar). En iPhone/iPad el push solo funciona con la app instalada en inicio (iOS 16.4+).
 * `hideWhenSnoozed`: para mostrarla como banner en otras pantallas y respetar el "Ahora no".
 */
export function EnablePush({ publicKey, hideWhenSnoozed = false, onChange, hourly = false }: { publicKey?: string; hideWhenSnoozed?: boolean; onChange?: (subscribed: boolean) => void;
  /** El cron corre cada hora (NOTIFY_CRON_MODE=hourly): se puede prometer hora elegida, racha a las 8 p. m. y horas de silencio. */
  hourly?: boolean }) {
  const key = publicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const [state, setState] = useState<State>("checking");
  const [err, setErr] = useState<string | null>(null);
  const [snoozed, setSnoozed] = useState(false);
  const [installDone, setInstallDone] = useState(false);
  const native = useIsNativeApp();

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (isIos() && !isStandalone()) return setState("ios-install");
    if (!supported) return setState("unsupported");
    if (!key) return setState("not-configured");
    if (Notification.permission === "denied") return setState("denied");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub && Notification.permission === "granted" ? "subscribed" : "default");
    } catch { setState("default"); }
  }, [key]);

  useEffect(() => {
    void refresh();
    try {
      const t = Number(localStorage.getItem(SNOOZE_KEY) || 0); setSnoozed(Date.now() - t < 7 * 864e5);
      setInstallDone(localStorage.getItem(INSTALL_DONE_KEY) === "1");
    } catch { /* */ }
  }, [refresh]);

  const enable = async () => {
    setErr(null); setState("working");
    try {
      const reg = await registration();
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "default"); return; }
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error("save");
      setState("subscribed"); onChange?.(true);
    } catch {
      setErr("No pudimos activar los avisos en este dispositivo. Intenta de nuevo.");
      void refresh();
    }
  };

  const disable = async () => {
    setErr(null); setState("working");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("default"); onChange?.(false);
    } catch { setErr("No pudimos desactivar los avisos. Intenta de nuevo."); void refresh(); }
  };

  /** "Ya lo hice": este dispositivo ya instaló la app; no volvemos a mostrar los pasos aquí. */
  const markInstalled = () => { setInstallDone(true); try { localStorage.setItem(INSTALL_DONE_KEY, "1"); } catch { /* */ } };
  const snooze = () => { setSnoozed(true); try { localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch { /* */ } };

  // App nativa: sus avisos son nativos (Fase 2 de la app, docs/app-nativa.md). Web Push no funciona dentro de la app.
  if (native || state === "checking") return null;
  if (hideWhenSnoozed && (snoozed || state === "subscribed" || state === "unsupported" || state === "not-configured" || state === "denied")) return null;

  if (state === "subscribed") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-peel/30 bg-peel/5 p-3">
        <span className="grid place-items-center size-10 rounded-xl bg-peel/15 text-peel"><Bell weight="fill" className="size-5" /></span>
        <div className="flex-1 min-w-0"><p className="text-sm font-bold text-ink">Avisos activos en este dispositivo</p><p className="text-xs text-muted">{hourly ? "Máximo 2 al día, nunca en tus horas de silencio." : "Máximo 2 al día."}</p></div>
        <button onClick={disable} className="tap px-2 text-xs font-bold text-muted underline hover:text-ink">Desactivar</button>
      </div>
    );
  }

  if (state === "ios-install" && hideWhenSnoozed && installDone) return null;
  if (state === "ios-install") {
    return (
      <div className="rounded-3xl border border-line bg-cream p-4">
        <p className="flex items-center gap-2 font-extrabold text-ink"><Bell weight="duotone" className="size-5 text-banana-ink" />Avisos en iPhone</p>
        <p className="mt-1 text-sm text-muted">Apple solo permite notificaciones cuando Banana Burn está instalada en tu pantalla de inicio (iOS 16.4 o superior).</p>
        <ol className="mt-3 space-y-2 text-sm text-body">
          <li className="flex items-center gap-2"><span className="grid place-items-center size-6 rounded-full bg-banana text-xs font-bold text-ink">1</span>Abre esta página en Safari y toca <Export weight="bold" className="inline size-4" /> <b>Compartir</b></li>
          <li className="flex items-center gap-2"><span className="grid place-items-center size-6 rounded-full bg-banana text-xs font-bold text-ink">2</span>Elige <PlusSquare weight="bold" className="inline size-4" /> <b>Agregar a inicio</b></li>
          <li className="flex items-start gap-2"><span className="grid shrink-0 place-items-center size-6 rounded-full bg-banana text-xs font-bold text-ink">3</span><span className="pt-0.5">Abre la app desde el ícono de Banana Burn y activa los avisos aquí</span></li>
        </ol>
        {hideWhenSnoozed && (
          <div className="mt-4 flex items-center gap-4">
            <button onClick={markInstalled} className="pressable inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-bold text-white"><Check weight="bold" className="size-4" />Ya lo hice</button>
            <button onClick={snooze} className="tap h-11 text-xs font-bold text-muted underline hover:text-ink">Ahora no</button>
          </div>
        )}
      </div>
    );
  }

  if (state === "unsupported") return <p className="text-sm text-muted">Este navegador no soporta notificaciones push. Prueba con Chrome, Edge, Firefox o Safari actualizado. Los recordatorios por correo siguen funcionando.</p>;
  // Sin llave VAPID no hay push en esta instalación: no mostramos nada (los avisos siguen en la campanita).
  if (state === "not-configured") return null;

  if (state === "denied") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-cream p-3">
        <span className="grid place-items-center size-10 shrink-0 rounded-xl bg-white text-muted"><BellSlash weight="duotone" className="size-5" /></span>
        <p className="text-sm text-muted">Los avisos están bloqueados en este navegador. Para activarlos, toca el candado junto a la dirección, luego <b>Notificaciones</b> y <b>Permitir</b>, y recarga la página.</p>
      </div>
    );
  }

  // Tarjeta explicativa previa al permiso nativo
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
      {err && <p role="alert" className="mt-3 text-sm font-semibold text-bad">{err}</p>}
      <div className="mt-4 flex gap-2">
        <button onClick={enable} disabled={state === "working"} className="btn-primary h-11 flex-1 px-5">{state === "working" ? "Activando…" : "Activar avisos"}</button>
        {hideWhenSnoozed && <button onClick={snooze} className="btn-ghost h-11 px-5">Ahora no</button>}
      </div>
    </div>
  );
}
