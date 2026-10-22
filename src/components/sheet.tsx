"use client";
import { createContext, useContext, useEffect, useId, useRef } from "react";
import { X } from "@/components/icons";
import { Portal } from "@/components/portal";
import { usePresence } from "@/components/use-presence";

const TitleCtx = createContext<string | undefined>(undefined);

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

function focusables(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0 && !el.closest("[inert]"));
}

/** Título de la hoja: el diálogo lo usa como nombre accesible (aria-labelledby). */
export function SheetTitle({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const id = useContext(TitleCtx);
  return <h2 id={id} className={className}>{children}</h2>;
}

/**
 * Hoja inferior accesible (en escritorio, diálogo centrado).
 * Escape cierra, foco atrapado dentro, foco devuelto a quien la abrió, scroll del body bloqueado,
 * clic en el fondo cierra. Pon `<SheetTitle>` dentro para nombrar el diálogo; si no hay título visible usa `label`.
 * Un elemento con `data-autofocus` recibe el foco inicial; si no, el primer elemento enfocable.
 */
export function Sheet({ open, onClose, label, className = "", children }: { open: boolean; onClose: () => void; label?: string; className?: string; children: React.ReactNode }) {
  // Sigue montada 200 ms tras cerrar para la salida (más rápida que la entrada de 300 ms)
  const { mounted, closing } = usePresence(open, 200);
  if (!mounted) return null;
  return <SheetPanel onClose={onClose} label={label} className={className} closing={closing}>{children}</SheetPanel>;
}

function SheetPanel({ onClose, label, className, closing, children }: { onClose: () => void; label?: string; className: string; closing: boolean; children: React.ReactNode }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const downOnBackdrop = useRef(false);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Bloqueo de scroll del body (compensando la barra en escritorio para que nada salte)
    const body = document.body;
    const prev = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const bar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (bar > 0) body.style.paddingRight = `${bar}px`;

    // Foco inicial (el Portal monta en el siguiente efecto, así que esperamos un frame)
    let raf = 0, tries = 0;
    const focusFirst = () => {
      const p = panel.current;
      if (!p) { if (++tries < 10) raf = requestAnimationFrame(focusFirst); return; }
      const target = p.querySelector<HTMLElement>("[data-autofocus]") ?? focusables(p)[0] ?? p;
      target.focus({ preventScroll: true });
    };
    raf = requestAnimationFrame(focusFirst);

    const onKey = (e: KeyboardEvent) => {
      const p = panel.current;
      if (!p) return;
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); close.current(); return; }
      if (e.key !== "Tab") return;
      const els = focusables(p);
      if (!els.length) { e.preventDefault(); p.focus(); return; }
      const first = els[0], last = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === p || !p.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !p.contains(active))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      body.style.overflow = prev.overflow;
      body.style.paddingRight = prev.paddingRight;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <Portal>
      <div
        data-closing={closing || undefined}
        className="sheet-backdrop fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm"
        onPointerDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
        onClick={(e) => { if (!closing && e.target === e.currentTarget && downOnBackdrop.current) onClose(); downOnBackdrop.current = false; }}
      >
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={label ? undefined : titleId}
          aria-label={label}
          tabIndex={-1}
          data-closing={closing || undefined}
          className={`sheet-panel relative w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] bg-paper shadow-lift outline-none pb-[max(1.25rem,env(safe-area-inset-bottom))] ${className}`}
        >
          <div className="sticky top-0 z-10 flex h-12 shrink-0 items-start justify-center rounded-t-[2rem] bg-paper pt-3">
            <span aria-hidden className="h-1.5 w-10 rounded-full bg-line" />
            <button type="button" onClick={onClose} aria-label="Cerrar" className="pressable absolute right-2 top-2 grid place-items-center size-11 rounded-full text-muted hover:bg-white hover:text-ink">
              <X weight="bold" className="size-5" aria-hidden />
            </button>
          </div>
          <TitleCtx.Provider value={titleId}>{children}</TitleCtx.Provider>
        </div>
      </div>
    </Portal>
  );
}
