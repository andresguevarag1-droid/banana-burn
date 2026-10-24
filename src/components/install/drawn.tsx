// Dibujos simples (no capturas) de los botones de Safari y Chrome para explicar cómo instalar la LinkApp.
// Son íconos genéricos del sistema dibujados a mano en SVG: no imitan una pantalla real.

/** Botón Compartir de Safari: cuadrado abierto con flecha hacia arriba. */
export function ShareGlyph({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" /><path d="M7.5 7.5 12 3l4.5 4.5" /><path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" />
    </svg>
  );
}

/** "Agregar a inicio": cuadrado redondeado con un más. */
export function AddHomeGlyph({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

/** Menú de tres puntos (Chrome en Android y otras apps). */
export function DotsGlyph({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <circle cx="12" cy="5.5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="18.5" r="1.8" />
    </svg>
  );
}

/** Mini teléfono con la barra de Safari y el botón Compartir resaltado (paso 1). */
export function SafariBarDrawing({ highlight = "share" }: { highlight?: "share" | "none" }) {
  return (
    <svg viewBox="0 0 160 96" className="w-full h-auto" role="img" aria-label="Barra inferior de Safari con el botón Compartir">
      <rect x="1" y="1" width="158" height="94" rx="16" fill="#FFFBF0" stroke="#E9DFC2" strokeWidth="2" />
      <rect x="14" y="16" width="132" height="22" rx="11" fill="#fff" stroke="#E9DFC2" />
      <text x="80" y="31" textAnchor="middle" fontSize="10" fontWeight="700" fill="#1B1505" fontFamily="inherit">bananaburn.app</text>
      <g fill="none" stroke="#6B6150" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M26 66l-6 6 6 6" /><path d="M48 66l6 6-6 6" />
        <path d="M118 63h12v16h-12z" /><path d="M134 66v12" />
      </g>
      {highlight === "share" && <circle cx="80" cy="72" r="15" fill="#FFD60A" />}
      <g transform="translate(70 61)" fill="none" stroke="#1B1505" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2v11" /><path d="M6 6l4-4 4 4" /><path d="M7 9H5.5A1.5 1.5 0 0 0 4 10.5v7A1.5 1.5 0 0 0 5.5 19h9a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 14.5 9H13" />
      </g>
    </svg>
  );
}
