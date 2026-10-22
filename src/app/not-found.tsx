import Link from "next/link";

export const metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <main className="min-h-dvh grid place-items-center text-center px-6 py-12">
      <div className="w-full max-w-sm animate-rise">
        <p aria-hidden className="text-7xl animate-floaty">🍌</p>
        <p className="mt-6 eyebrow">Error 404</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Esta página se resbaló</h1>
        <p className="mt-2 text-muted">El enlace está roto o la página ya no existe. Te llevamos de vuelta a lo importante.</p>
        <div className="mt-6 flex flex-col gap-2.5">
          <Link href="/app" className="btn-primary w-full h-13">Ir a mi entreno de hoy</Link>
          <Link href="/" className="btn-ghost w-full h-13">Volver al inicio</Link>
        </div>
        <p className="mt-5 text-xs text-faint">¿Algo no cuadra? Escríbenos a <a href="mailto:hola@bananaburn.app" className="tap font-semibold underline hover:text-ink">hola@bananaburn.app</a>.</p>
      </div>
    </main>
  );
}
