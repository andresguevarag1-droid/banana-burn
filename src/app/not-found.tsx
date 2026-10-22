import Link from "next/link";
import { MonkeyBanana } from "@/components/icons";

export const metadata = { title: "Página no encontrada", robots: { index: false } };

export default function NotFound() {
  return (
    <main className="min-h-dvh grid place-items-center text-center px-6 py-12">
      <div className="w-full max-w-sm animate-rise">
        <span className="mx-auto grid place-items-center size-24 rounded-[2rem] bg-banana-soft text-banana-ink"><MonkeyBanana className="size-16" /></span>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink text-balance">Esta página se resbaló</h1>
        <p className="mt-2 text-muted text-pretty">El enlace está roto o la página ya no existe. Te llevamos de vuelta a lo importante.</p>
        <div className="mt-6 flex flex-col gap-2.5">
          <Link href="/" className="btn-primary w-full h-13">Volver al inicio</Link>
          <Link href="/app" className="btn-ghost w-full h-13">Ya tengo cuenta: ir a mi entreno</Link>
        </div>
        <p className="mt-5 text-xs text-faint">¿Algo no cuadra? Escríbenos a <a href="mailto:hola@bananaburn.app" className="tap font-semibold underline hover:text-ink">hola@bananaburn.app</a>.</p>
      </div>
    </main>
  );
}
