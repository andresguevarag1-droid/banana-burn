"use client";
// Paso "Instala tu LinkApp" al terminar la bienvenida (se puede saltar). Va ANTES del resumen del plan: es el momento
// en que la persona está más decidida, y sin la app instalada no le llegan los recordatorios (en iPhone, ninguno).
import { useState } from "react";
import { ArrowRight, Bell, Lightning, SquaresFour } from "@/components/icons";
import { track } from "@/components/analytics";
import { InstallHelper } from "./install-helper";
import { useInstall } from "./use-install";

const WHY: [typeof Bell, string][] = [
  [Bell, "Recordatorios de tu entreno y avisos de tu coach"],
  [Lightning, "Entras con un toque, sin buscar la página"],
  [SquaresFour, "Pantalla completa, sin la barra del navegador"],
];

export function WelcomeInstall({ name, children }: { name: string; children: React.ReactNode }) {
  const { env } = useInstall();
  const [passed, setPassed] = useState(false);
  // En la computadora y en la app ya instalada se va directo al resumen.
  if (passed || env === null || env === "standalone" || env === "desktop") return <>{children}</>;
  const next = (action: string) => { track("install_click", { where: "bienvenida", action }); setPassed(true); window.scrollTo({ top: 0 }); };
  return (
    <main className="min-h-dvh bg-paper px-6 py-10">
      <div className="mx-auto max-w-md w-full animate-rise">
        <p className="text-sm font-bold text-banana-ink">Último paso, {name}</p>
        <h1 className="mt-1 text-[32px] font-extrabold leading-tight tracking-tight text-ink text-balance">Instala tu LinkApp</h1>
        <p className="mt-2 text-muted text-pretty">Banana Burn se instala en tu pantalla de inicio en 10 segundos, sin tiendas de apps. Así funciona como cualquier app de tu celular.</p>
        <ul className="mt-4 space-y-2">
          {WHY.map(([I, t]) => (
            <li key={t} className="flex items-center gap-3 text-[15px] font-semibold text-ink"><span className="grid place-items-center size-9 shrink-0 rounded-xl bg-banana-soft text-banana-ink"><I weight="duotone" className="size-5" /></span>{t}</li>
          ))}
        </ul>
        {env.startsWith("ios") && <p className="mt-3 text-sm text-muted">En iPhone, Apple solo deja enviar recordatorios a las apps instaladas en la pantalla de inicio.</p>}
        <div className="mt-5 card p-5"><InstallHelper where="bienvenida" title={false} /></div>
        <button type="button" data-cta="bienvenida-instalada" onClick={() => next("hecho")} className="btn-primary w-full h-14 mt-6 text-base">Listo, sigamos <ArrowRight className="size-5" /></button>
        <button type="button" data-cta="bienvenida-instalar-despues" onClick={() => next("despues")} className="tap mt-3 w-full h-11 text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">Lo hago después</button>
      </div>
    </main>
  );
}
