"use client";
// "Instala tu LinkApp": la ayuda para instalar Banana Burn en la pantalla de inicio, según dónde está abierta.
//   Android (Chrome, Edge, Samsung): botón Instalar nativo, o el menú de tres puntos si el navegador no lo ofrece.
//   iPhone en Safari: 3 pasos dibujados (Compartir, Agregar a inicio, Agregar).
//   iPhone o Android dentro de Instagram o Facebook (de donde llega la gente de los anuncios): primero abrirla en
//   Safari o Chrome, con botón para copiar el enlace.
//   Computadora: código QR para abrirla en el celular.
import { useEffect, useRef, useState } from "react";
import { Check, Copy, DeviceMobile } from "@/components/icons";
import { track } from "@/components/analytics";
import { AddHomeGlyph, DotsGlyph, SafariBarDrawing, ShareGlyph } from "./drawn";
import { useInstall } from "./use-install";
import type { InstallEnv } from "@/lib/install-env";

const SITE = "https://www.bananaburn.app";

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid place-items-center size-7 shrink-0 rounded-full bg-banana text-sm font-extrabold text-ink tabular-nums">{n}</span>
      <span className="pt-0.5 text-[15px] leading-snug text-body">{children}</span>
    </li>
  );
}

function CopyLink({ path }: { path: string }) {
  const [ok, setOk] = useState(false);
  const url = `${SITE}${path}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch {
      // Algunas WebViews no dejan usar el portapapeles: seleccionamos el texto para copiarlo a mano.
      const i = document.getElementById("bb-install-url") as HTMLInputElement | null; i?.select();
    }
    setOk(true); track("install_click", { action: "copy_link" });
    setTimeout(() => setOk(false), 2500);
  };
  return (
    <div className="mt-3 flex items-center gap-2">
      <input id="bb-install-url" readOnly value={url} aria-label="Enlace de Banana Burn" className="min-w-0 flex-1 h-12 rounded-2xl border border-line bg-white px-3 text-sm font-semibold text-ink" />
      <button type="button" onClick={copy} className="btn-primary h-12 px-4 shrink-0">{ok ? <><Check weight="bold" className="size-4" />Copiado</> : <><Copy weight="bold" className="size-4" />Copiar</>}</button>
    </div>
  );
}

/** Contenido según el navegador. `qrSvg`: el QR ya generado en el servidor (para computadora). */
function Body({ env, canPrompt, onPrompt, qrSvg, path }: { env: InstallEnv; canPrompt: boolean; onPrompt: () => void; qrSvg?: string; path: string }) {
  if (env === "standalone") {
    return <p className="flex items-center gap-2 text-[15px] font-semibold text-ink"><Check weight="bold" className="size-5 text-peel" />Ya la tienes instalada. Ábrela siempre desde tu pantalla de inicio.</p>;
  }
  if (env === "ios-inapp" || env === "android-inapp") {
    const browser = env === "ios-inapp" ? "Safari" : "Chrome";
    return (
      <>
        <p className="text-[15px] text-body">Estás viendo Banana Burn dentro de otra app (por ejemplo Instagram o Facebook). Desde aquí no se puede instalar. Ábrela en <b className="text-ink">{browser}</b>:</p>
        <ol className="mt-3 space-y-3">
          <Step n={1}>Toca el menú <DotsGlyph className="inline size-4 -mt-0.5 text-ink" /> de esta pantalla (arriba o abajo a la derecha).</Step>
          <Step n={2}>Elige <b className="text-ink">Abrir en {browser}</b> o <b className="text-ink">Abrir en el navegador</b>.</Step>
          <Step n={3}>{env === "ios-inapp" ? <>Ya en Safari, toca <ShareGlyph className="inline size-4 -mt-1 text-ink" /> <b className="text-ink">Compartir</b> y luego <b className="text-ink">Agregar a inicio</b>.</> : <>Ya en Chrome, toca <b className="text-ink">Instalar app</b>.</>}</Step>
        </ol>
        {path.includes("entrar=") && <p className="mt-3 text-sm font-semibold text-ink">Allá entras con un toque, sin contraseña.</p>}
        <p className="mt-3 text-sm text-muted">¿No ves la opción? Copia el enlace y pégalo en {browser}.</p>
        <CopyLink path={path} />
      </>
    );
  }
  if (env === "ios-safari" || env === "ios-browser") {
    return (
      <>
        <div className="mx-auto max-w-[220px]"><SafariBarDrawing /></div>
        <ol className="mt-4 space-y-3">
          <Step n={1}>Toca <ShareGlyph className="inline size-[18px] -mt-1 text-ink" /> <b className="text-ink">Compartir</b>{env === "ios-safari" ? " en la barra de abajo." : " (en Chrome está arriba a la derecha)."}</Step>
          <Step n={2}>Baja y elige <AddHomeGlyph className="inline size-[18px] -mt-1 text-ink" /> <b className="text-ink">Agregar a inicio</b>.</Step>
          <Step n={3}>Toca <b className="text-ink">Agregar</b>. Listo: Banana Burn queda como app en tu pantalla.</Step>
        </ol>
      </>
    );
  }
  if (env === "android") {
    return (
      <>
        {canPrompt ? (
          <button type="button" onClick={onPrompt} className="btn-banana w-full h-14 text-base"><DeviceMobile weight="bold" className="size-5" />Instalar Banana Burn</button>
        ) : (
          <ol className="space-y-3">
            <Step n={1}>Toca el menú <DotsGlyph className="inline size-4 -mt-0.5 text-ink" /> de Chrome (arriba a la derecha).</Step>
            <Step n={2}>Elige <b className="text-ink">Instalar app</b> o <b className="text-ink">Agregar a pantalla principal</b>.</Step>
            <Step n={3}>Confirma con <b className="text-ink">Instalar</b>.</Step>
          </ol>
        )}
      </>
    );
  }
  // Computadora.
  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      {qrSvg ? <div className="size-40 shrink-0 rounded-2xl bg-white p-2.5 border border-line [&_svg]:size-full" role="img" aria-label="Código QR para abrir bananaburn.app en tu celular" dangerouslySetInnerHTML={{ __html: qrSvg }} /> : null}
      <ol className="space-y-3">
        <Step n={1}>Apunta la cámara de tu celular a este código.</Step>
        <Step n={2}>Abre el enlace (en iPhone, con Safari).</Step>
        <Step n={3}>Sigue los pasos para agregarla a tu pantalla de inicio.</Step>
      </ol>
    </div>
  );
}

/**
 * Dentro de Instagram o Facebook, con sesión: la dirección de esta página pasa a llevar un pase de navegador
 * (lib/handoff.ts). "Abrir en Safari/Chrome" abre esa misma dirección y allá se entra con un toque, sin contraseña.
 * Devuelve la ruta con el pase (para el enlace copiado) o null.
 */
function useHandoff(inApp: boolean): string | null {
  const [pass, setPass] = useState<string | null>(null);
  useEffect(() => {
    if (!inApp || !location.pathname.startsWith("/app")) return;
    let off = false;
    fetch("/api/cuenta/pase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ next: location.pathname + location.search }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { path?: string | null } | null) => {
        if (off || !j?.path) return;
        try { history.replaceState(history.state, "", j.path); } catch { /* */ }
        setPass(j.path);
      })
      .catch(() => { /* sin pase: queda el enlace normal */ });
    return () => { off = true; };
  }, [inApp]);
  return pass;
}

/**
 * Ayuda completa para instalar. `where` va a la analítica (landing, bienvenida, hoy, perfil).
 * `path`: a dónde lleva el enlace copiado (por defecto /app, o /entrar desde la landing).
 */
export function InstallHelper({ where, qrSvg, path = "/app", title = true }: { where: string; qrSvg?: string; path?: string; title?: boolean }) {
  const { env, canPrompt, prompt } = useInstall();
  const seen = useRef(false);
  const pass = useHandoff(env === "ios-inapp" || env === "android-inapp");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (env && !seen.current) { seen.current = true; track("install_view", { where, env }); }
  }, [env, where]);
  if (!env) return <div className="min-h-40" aria-hidden />;
  const onPrompt = async () => {
    track("install_click", { where, action: "native_prompt" });
    if (await prompt()) { setDone(true); track("app_installed", { where, env }); }
  };
  return (
    <div>
      {title && (
        <p className="mb-3 text-sm font-semibold text-muted">
          {env === "desktop" ? "Ábrela en tu celular" : env === "standalone" || done ? "Instalada" : "Toma 10 segundos"}
        </p>
      )}
      {done ? <p className="flex items-center gap-2 text-[15px] font-semibold text-ink"><Check weight="bold" className="size-5 text-peel" />Lista. Búscala en tu pantalla de inicio.</p> : <Body env={env} canPrompt={canPrompt} onPrompt={onPrompt} qrSvg={qrSvg} path={pass ?? path} />}
    </div>
  );
}
