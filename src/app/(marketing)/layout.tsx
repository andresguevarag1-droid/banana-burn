import Link from "next/link";
import { Logo } from "@/components/brand";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 bg-paper/80 backdrop-blur-xl border-b border-line/60">
        <nav className="mx-auto max-w-6xl h-16 px-4 sm:px-6 flex items-center justify-between">
          <Logo />
          <div className="hidden md:flex items-center gap-8 text-[15px] font-medium text-muted">
            <Link href="/#metodo" className="hover:text-ink">Método</Link>
            <Link href="/#app" className="hover:text-ink">La app</Link>
            <Link href="/precios" className="hover:text-ink">Precios</Link>
            <Link href="/#faq" className="hover:text-ink">Preguntas</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/entrar" className="hidden sm:inline-flex btn h-10 px-4 text-ink hover:bg-white/70">Entrar</Link>
            <Link href="/entrar?modo=registro" className="btn-primary h-10 px-4 text-sm">Empezar</Link>
          </div>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="border-t border-line mt-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid gap-8 sm:grid-cols-[1.5fr_1fr_1fr_1fr] text-sm">
          <div className="space-y-3">
            <Logo />
            <p className="text-muted max-w-xs">Tu entrenador personal con IA, en español y hecho en Costa Rica 🇨🇷 para toda LATAM.</p>
          </div>
          <div className="space-y-2"><p className="font-bold text-ink">Producto</p><Link className="block text-muted hover:text-ink" href="/#metodo">Método</Link><Link className="block text-muted hover:text-ink" href="/precios">Precios</Link><Link className="block text-muted hover:text-ink" href="/entrar">Entrar</Link></div>
          <div className="space-y-2"><p className="font-bold text-ink">Legal</p><Link className="block text-muted hover:text-ink" href="/privacidad">Privacidad</Link><Link className="block text-muted hover:text-ink" href="/terminos">Términos</Link></div>
          <div className="space-y-2"><p className="font-bold text-ink">Contacto</p><a className="block text-muted hover:text-ink" href="mailto:hola@bananaburn.app">hola@bananaburn.app</a></div>
        </div>
        <p className="text-center text-xs text-faint pb-8">© {new Date().getFullYear()} Banana Burn. No sustituye consejo médico.</p>
      </footer>
    </>
  );
}
