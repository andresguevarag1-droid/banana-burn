"use client";
// Tarjeta de Hoy: "Instala tu LinkApp" mientras no esté instalada. Se cierra y vuelve como máximo cada 3 días.
// Nunca aparece en la app instalada. En la computadora no aparece (ahí la tarjeta no ayuda: se instala en el celular).
import { useEffect, useState } from "react";
import Image from "next/image";
import { Bell, X } from "@/components/icons";
import { installCardDue } from "@/lib/install-env";
import { InstallHelper } from "./install-helper";
import { useInstall } from "./use-install";

const KEY = "bb.installCardDismissedAt";

export function InstallCard() {
  const { env } = useInstall();
  const [due, setDue] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { const t = Number(localStorage.getItem(KEY) || 0); setDue(installCardDue(t || null)); } catch { setDue(true); }
  }, []);
  if (!env || env === "standalone" || env === "desktop" || !due) return null;
  const close = () => { setDue(false); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* */ } };
  return (
    <section aria-labelledby="instala-title" className="relative overflow-hidden rounded-[1.5rem] bg-banana p-5">
      <button type="button" onClick={close} className="tap pressable absolute right-2 top-2 grid place-items-center size-11 rounded-full text-ink/70 hover:text-ink" aria-label="Ahora no"><X weight="bold" className="size-5" /></button>
      <div className="flex items-start gap-3 pr-8">
        <Image src="/icons/icon-192.png" alt="" width={48} height={48} className="size-12 shrink-0 rounded-2xl shadow-[0_6px_14px_-8px_rgb(27_21_5/.5)]" />
        <div className="min-w-0">
          <h2 id="instala-title" className="text-lg font-extrabold leading-tight text-ink">Instala tu LinkApp en el celular</h2>
          <p className="mt-1 text-sm text-ink/80">Entra con un toque, a pantalla completa, y recibe los recordatorios de tu entreno y los avisos de tu coach{env.startsWith("ios") ? " (en iPhone solo llegan con la app instalada)" : ""}.</p>
        </div>
      </div>
      {open ? (
        <div className="mt-4 rounded-2xl bg-white p-4"><InstallHelper where="hoy" title={false} /></div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn-primary mt-4 h-12 w-full"><Bell weight="bold" className="size-5" />Ver cómo instalarla</button>
      )}
    </section>
  );
}
