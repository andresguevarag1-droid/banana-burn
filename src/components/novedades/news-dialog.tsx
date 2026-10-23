"use client";
// "Lo nuevo en Banana Burn": al entrar a Hoy, todo lo que cambió desde la última visita (las versiones juntas, la más
// nueva arriba), filtrado por el plan de la persona. Pantalla completa en el celular y diálogo centrado en escritorio.
//
// Cuándo se abre solo (una vez por versión):
//   - En Hoy (/app), con versiones sin ver y sin el muro de planes.
//   - Nunca en la misma visita que la guía de la app (la persona nueva recibe la guía; la próxima visita, las novedades),
//     ni encima de un regalo, la bienvenida de tester o cualquier otro diálogo abierto (subida de nivel).
//   - Se marca como visto al abrirse: si cierra la pestaña, no vuelve a saltar. Cerrar o tocar Entendido, igual.
// Teclado: Tab queda dentro, Esc cierra. Movimiento: entra con la curva de cajón; con movimiento reducido, solo fundidos.
// Demo: /app?novedades=1 lo abre con todo el historial (solo para revisar la pantalla; no marca nada).
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "@/components/icons";
import { Portal } from "@/components/portal";
import { usePresence } from "@/components/use-presence";
import { useGuide } from "@/components/guide/guide-provider";
import { shouldAutoOpen } from "@/lib/guide";
import { NOVEDADES, countLabel, unseenReleases, type Release } from "@/lib/novedades";
import { ReleaseBlock } from "./news-list";
import { readLocalSeen, rememberSeen } from "./news-store";

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
const focusables = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);

/** Versión de la guía vista en este dispositivo (la misma clave que usa GuideProvider). */
function readGuideLocal(): number | null {
  try { const v = Number(localStorage.getItem("bb.guia.version")); return Number.isFinite(v) && v > 0 ? v : null; } catch { return null; }
}

/** Espera corta antes de abrir: deja que la página se asiente y que la guía o una celebración tomen su turno. */
const SETTLE_MS = 900;

export function NewsLauncher({ releases, seenId, seenAt, createdAt, persisted, locked, busy, demo, guideSeenVersion }: {
  /** Historial que ve esta persona (ya filtrado por plan). */
  releases: Release[];
  seenId: string | null;
  seenAt: string | null;
  createdAt: string | null;
  persisted: boolean;
  /** Muro de planes: no se abre solo. */
  locked: boolean;
  /** Otra pantalla grande en esta visita (regalo, bienvenida de tester): espera a la próxima. */
  busy: boolean;
  demo: boolean;
  /** Versión de la guía vista según el servidor (0031): si la guía se va a abrir en esta visita, las novedades esperan. */
  guideSeenVersion: number | null;
}) {
  const path = usePathname();
  const guide = useGuide();
  const guideOpen = useRef(false);
  guideOpen.current = Boolean(guide?.guideOpen);
  const [show, setShow] = useState<Release[] | null>(null);
  const [open, setOpen] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || path !== "/app") return;
    const force = demo && new URLSearchParams(window.location.search).get("novedades") === "1";
    const unseen = force ? releases : unseenReleases(releases, { seenId, seenAt, createdAt, localId: readLocalSeen() });
    if (!unseen.length) { done.current = true; return; }
    if (!force) {
      if (locked || busy) { done.current = true; return; }
      // Persona nueva (o sin la guía vista): esta visita es de la guía.
      if (shouldAutoOpen({ seenVersion: guideSeenVersion, localVersion: readGuideLocal(), locked, busy, path })) { done.current = true; return; }
    }
    const t = setTimeout(() => {
      done.current = true;
      if (!force && (guideOpen.current || document.querySelector('[role="dialog"][aria-modal="true"]'))) return;
      setShow(unseen);
      setOpen(true);
      if (!force) rememberSeen(NOVEDADES[0].id, persisted);
    }, force ? 300 : SETTLE_MS);
    return () => clearTimeout(t);
  }, [path, releases, seenId, seenAt, createdAt, persisted, locked, busy, demo, guideSeenVersion]);

  const close = useCallback(() => setOpen(false), []);
  return <NewsDialog open={open} releases={show ?? []} onClose={close} />;
}

export function NewsDialog({ open, releases, onClose }: { open: boolean; releases: Release[]; onClose: () => void }) {
  const { mounted, closing } = usePresence(open, 200);
  if (!mounted || !releases.length) return null;
  return <Panel releases={releases} onClose={onClose} closing={closing} />;
}

function Panel({ releases, onClose, closing }: { releases: Release[]; onClose: () => void; closing: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const close = useRef(onClose);
  const titleId = useId();
  const bodyId = useId();
  useEffect(() => { close.current = onClose; }, [onClose]);
  const items = releases.reduce((n, r) => n + r.items.length, 0);

  // Bloqueo del scroll de la página y foco al botón principal; al cerrar, el foco vuelve a donde estaba.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const body = document.body;
    const prev = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const sb = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (sb > 0) body.style.paddingRight = `${sb}px`;
    let raf = 0, tries = 0;
    const focusFirst = () => {
      const p = panel.current;
      if (!p) { if (++tries < 10) raf = requestAnimationFrame(focusFirst); return; }
      (p.querySelector<HTMLElement>("[data-autofocus]") ?? p).focus({ preventScroll: true });
    };
    raf = requestAnimationFrame(focusFirst);
    return () => {
      cancelAnimationFrame(raf);
      body.style.overflow = prev.overflow;
      body.style.paddingRight = prev.paddingRight;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = panel.current;
      if (!p) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close.current(); return; }
      if (e.key !== "Tab") return;
      const els = focusables(p);
      if (!els.length) { e.preventDefault(); p.focus(); return; }
      const first = els[0], end = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === p || !p.contains(active))) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && (active === end || !p.contains(active))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  // Avance de lectura: una barra fina arriba que se llena al bajar (sin estado de React: no re-renderiza al hacer scroll).
  useEffect(() => {
    const s = scroller.current, b = bar.current;
    if (!s || !b) return;
    const upd = () => {
      const max = s.scrollHeight - s.clientHeight;
      b.style.transform = `scaleX(${max <= 4 ? 1 : Math.min(1, Math.max(0.04, s.scrollTop / max))})`;
    };
    upd();
    s.addEventListener("scroll", upd, { passive: true });
    window.addEventListener("resize", upd);
    return () => { s.removeEventListener("scroll", upd); window.removeEventListener("resize", upd); };
  }, []);

  return (
    <Portal>
      <div data-closing={closing || undefined} className="sheet-backdrop fixed inset-0 z-[90] flex items-stretch justify-center bg-ink/45 backdrop-blur-sm sm:items-center sm:p-6"
        onClick={(e) => { if (!closing && e.target === e.currentTarget) onClose(); }}>
        <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} tabIndex={-1} data-closing={closing || undefined}
          className="sheet-panel relative flex h-[100dvh] w-full flex-col overflow-hidden bg-paper outline-none sm:h-[min(760px,calc(100dvh-3rem))] sm:max-w-2xl sm:rounded-[2rem] sm:shadow-lift">
          {/* Barra de avance de lectura */}
          <span aria-hidden className="absolute inset-x-0 top-0 z-10 h-1 bg-line/70">
            <span ref={bar} className="block h-full origin-left bg-banana transition-transform duration-(--dur-fast) ease-out" style={{ transform: "scaleX(.04)" }} />
          </span>

          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {/* Encabezado con Coach Banana */}
            <header className="relative bg-banana px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5 sm:px-8 sm:pt-7">
              <button type="button" onClick={onClose} aria-label="Cerrar novedades" className="pressable absolute right-2 top-[max(.5rem,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full text-ink hover:bg-white/50 sm:right-4 sm:top-4">
                <X weight="bold" className="size-5" aria-hidden />
              </button>
              <div className="flex items-end gap-4 pr-10">
                <Image src="/brand/mascota-sola.webp" alt="" width={112} height={112} priority className="-mb-5 size-24 shrink-0 object-contain drop-shadow-[0_6px_10px_rgb(27_21_5/.25)] sm:size-28" />
                <div className="min-w-0 pb-1">
                  <p className="text-[12px] font-extrabold uppercase tracking-[.14em] text-ink/70">{countLabel(items)} desde tu última visita</p>
                  <h2 id={titleId} className="mt-1 text-[26px] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-3xl">Lo nuevo en Banana Burn</h2>
                </div>
              </div>
            </header>
            <div className="space-y-8 px-4 pt-8 pb-6 sm:px-8">
              <p id={bodyId} className="text-[15px] leading-relaxed text-body">Coach Banana te cuenta qué cambió y cómo te ayuda. Toca el enlace de cada novedad para probarla.</p>
              {releases.map((r) => <ReleaseBlock key={r.id} r={r} onNavigate={onClose} />)}
            </div>
          </div>

          {/* Pie: Entendido y el historial completo */}
          <div className="shrink-0 border-t border-line/80 bg-paper px-4 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:pb-5">
            <Link href="/app/novedades" onClick={onClose} className="tap hidden min-h-11 items-center text-sm font-bold text-muted underline-offset-4 hover:text-ink hover:underline sm:inline-flex">Ver todas las novedades</Link>
            <button type="button" data-autofocus onClick={onClose} className="btn-primary h-12 w-full sm:w-44">Entendido</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
