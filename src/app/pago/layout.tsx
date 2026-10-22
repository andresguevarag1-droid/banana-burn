import Link from "next/link";
import { ShieldCheck } from "@/components/icons";
import { Logo } from "@/components/brand";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default function PagoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-line/60 bg-paper/80 backdrop-blur-xl">
        <nav className="mx-auto max-w-xl h-16 px-4 flex items-center justify-between" aria-label="Pago">
          <Logo href="/app" />
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted"><ShieldCheck weight="duotone" className="size-4 text-peel" />Pago seguro con ONVO Pay</span>
        </nav>
      </header>
      <main className="flex-1 mx-auto w-full max-w-xl px-4 py-8 sm:py-12">{children}</main>
      <footer className="pb-8 px-4 flex flex-wrap items-center justify-center gap-x-4 text-xs text-muted">
        <span>¿Dudas con tu pago? <a href="mailto:hola@bananaburn.app" className="tap underline underline-offset-2 hover:text-ink">hola@bananaburn.app</a></span>
        <Link href="/terminos" className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-ink">Términos</Link>
      </footer>
    </div>
  );
}
