// Estado de carga compartido por todas las secciones del panel.
export default function AdminLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Cargando la sección…</span>
      <div className="space-y-2" aria-hidden>
        <div className="h-8 w-48 animate-pulse rounded-xl bg-line" />
        <div className="h-4 w-full max-w-md animate-pulse rounded-lg bg-line/70" />
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="card h-24 animate-pulse bg-white" />)}
      </div>
      <div className="card h-72 animate-pulse bg-white" aria-hidden />
    </div>
  );
}
