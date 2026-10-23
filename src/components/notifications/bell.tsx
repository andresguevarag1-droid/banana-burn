"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Banana, BananaFlame, Barbell, Bell as BellIcon, ChartLine, Checks, CreditCard, Heart, MonkeyBanana, type PhosphorIcon } from "@/components/icons";
import { usePresence } from "@/components/use-presence";
import { listNotifications, markNotificationsRead, type InAppNotification } from "@/app/actions/notifications";

const ICON: Record<string, { I: PhosphorIcon | typeof Banana; tile: string }> = {
  recordatorio: { I: Barbell, tile: "bg-banana-soft text-banana-ink" },
  racha: { I: BananaFlame, tile: "bg-ember/10 text-ember-ink" },
  semanal: { I: ChartLine, tile: "bg-sky/10 text-sky" },
  reactivacion_3: { I: Banana, tile: "bg-banana-soft text-banana-ink" },
  reactivacion_7: { I: Heart, tile: "bg-ember/10 text-ember-ink" },
  pago_fallido: { I: CreditCard, tile: "bg-bad/10 text-bad" },
  test: { I: BellIcon, tile: "bg-ink text-banana" },
};
const FALLBACK = { I: Banana, tile: "bg-banana-soft text-banana-ink" };

const rtf = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat("es", { numeric: "auto" }) : null;
function ago(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  if (!rtf) return "";
  if (Math.abs(s) < 60) return "ahora";
  if (Math.abs(s) < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (Math.abs(s) < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

/** Campanita de avisos in-app: contador de no leídos, lista y "marcar como leído". */
export function NotificationBell({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pop = usePresence(open, 120);

  const load = useCallback(async () => {
    try { const r = await listNotifications(); setItems(r.items); setUnread(r.unread); } catch { /* sin red */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
    const onFocus = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onFocus);
    const t = setInterval(onFocus, 120_000);
    return () => { document.removeEventListener("visibilitychange", onFocus); clearInterval(t); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const markRead = (ids?: number[]) => {
    const now = new Date().toISOString();
    setItems((xs) => xs.map((x) => (!ids || ids.includes(x.id) ? { ...x, read_at: x.read_at ?? now } : x)));
    setUnread((n) => (ids ? Math.max(0, n - items.filter((x) => ids.includes(x.id) && !x.read_at).length) : 0));
    void markNotificationsRead(ids);
  };

  return (
    <div ref={box} className={`relative ${className}`}>
      <button onClick={() => { setOpen((o) => !o); if (!open) void load(); }} className="tap pressable relative grid place-items-center size-10 rounded-full bg-white border border-line text-ink hover:bg-cream" aria-label={unread ? `Avisos: ${unread} sin leer` : "Avisos"} aria-expanded={open} aria-haspopup="dialog">
        <BellIcon weight="duotone" className="size-5" />
        {unread > 0 && <span className="absolute -top-1 -right-1 grid place-items-center min-w-5 h-5 px-1 rounded-full bg-ember text-ink text-[11px] font-bold ring-2 ring-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {pop.mounted && (
        <div role="dialog" aria-label="Avisos" data-closing={pop.closing || undefined} className="popover fixed inset-x-3 top-16 z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96 card shadow-lift overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="font-extrabold text-ink">Avisos</p>
            {unread > 0 && <button onClick={() => markRead()} className="tap inline-flex items-center gap-1 text-xs font-bold text-banana-ink hover:text-ink"><Checks weight="bold" className="size-4" />Marcar todo leído</button>}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {!loaded && [0, 1, 2].map((i) => <li key={i} aria-hidden className="flex gap-3 px-4 py-3"><span className="size-9 shrink-0 rounded-xl bg-cream animate-pulse" /><span className="flex-1 space-y-2 pt-1"><span className="block h-3 w-2/3 rounded bg-cream animate-pulse" /><span className="block h-3 w-1/2 rounded bg-cream animate-pulse" /></span></li>)}
            {!loaded && <li className="sr-only">Cargando avisos</li>}
            {loaded && !items.length && <li className="p-6 flex flex-col items-center text-center text-sm text-muted"><span className="grid place-items-center size-12 mb-2 rounded-2xl bg-banana-soft text-banana-ink"><MonkeyBanana className="size-7" /></span><span className="font-semibold text-ink">Nada nuevo por ahora</span><span className="text-xs">Aquí verás tus recordatorios y logros.</span></li>}
            {items.map((n) => {
              const inner = (
                <div className={`flex gap-3 px-4 py-3 transition-colors hover:bg-cream ${n.read_at ? "" : "bg-banana-soft/30"}`}>
                  {(() => { const k = ICON[n.kind] ?? FALLBACK; return <span className={`grid place-items-center size-9 shrink-0 rounded-xl ${k.tile}`}><k.I weight="duotone" className="size-5" /></span>; })()}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-ink">{n.title}</span>
                    {n.body && <span className="block text-sm text-muted line-clamp-2">{n.body}</span>}
                    <span className="block mt-0.5 text-[11px] text-faint">{ago(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ember" role="img" aria-label="Sin leer" />}
                </div>
              );
              const onClick = () => { if (!n.read_at) markRead([n.id]); setOpen(false); };
              return (
                <li key={n.id} className="border-b border-line/60 last:border-0">
                  {n.url?.startsWith("/") ? <Link href={n.url} onClick={onClick}>{inner}</Link> : <button onClick={onClick} className="w-full text-left">{inner}</button>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
