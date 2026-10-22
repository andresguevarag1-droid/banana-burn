/** Piezas de esqueleto para los loading.tsx: bloques que imitan la forma de cada pantalla, sin spinners. */

export function Bone({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  // Sin clases en conflicto: el color y el radio por defecto solo aplican si no vienen en className.
  const base = `${/(^|\s)bg-/.test(className) ? "" : "bg-line/70 "}${/(^|\s)rounded/.test(className) ? "" : "rounded-xl "}`;
  return <div aria-hidden style={style} className={`animate-pulse ${base}${className}`} />;
}

/** Contenedor accesible: anuncia "Cargando…" una vez y oculta los bloques al lector de pantalla. */
export function SkeletonScreen({ className = "space-y-5", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  );
}

/** Encabezado típico: eyebrow, título grande y una línea de apoyo. */
export function SkHeader({ sub = true, eyebrow = true }: { sub?: boolean; eyebrow?: boolean }) {
  return (
    <div aria-hidden>
      {eyebrow && <Bone className="h-3 w-24 rounded-full bg-banana/40" />}
      <Bone className={`${eyebrow ? "mt-3" : ""} h-9 w-64 max-w-[80%] rounded-2xl`} />
      {sub && <Bone className="mt-3 h-4 w-80 max-w-[90%] rounded-full bg-line/50" />}
    </div>
  );
}

/** Tarjeta vacía con la misma piel que `card`. */
export function SkCard({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return <div aria-hidden className={`card ${className}`}>{children}</div>;
}

/** Esqueleto genérico para pantallas sin uno propio. */
export function GenericSkeleton() {
  return (
    <SkeletonScreen>
      <SkHeader />
      <SkCard className="p-5 space-y-3"><Bone className="h-5 w-40" /><Bone className="h-4 w-full bg-line/50" /><Bone className="h-4 w-4/5 bg-line/50" /></SkCard>
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => <SkCard key={i} className="p-5 space-y-3"><Bone className="h-5 w-32" /><Bone className="h-4 w-full bg-line/50" /><Bone className="h-10 w-28 rounded-full" /></SkCard>)}
      </div>
    </SkeletonScreen>
  );
}
