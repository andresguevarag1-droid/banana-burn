import Link from "next/link";
import { Logo } from "@/components/brand";

const NAV = [
  ["/#metodo", "Método"],
  ["/#app", "La app"],
  ["/glp1", "GLP-1"],
  ["/precios", "Precios"],
  ["/#faq", "Preguntas"],
] as const;

const LINK = "transition-colors duration-150 hover:text-ink";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-xl border-b border-line/60">
        <nav aria-label="Principal" className="mx-auto max-w-6xl h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <Logo />
          <div className="hidden md:flex items-center gap-8 text-[15px] font-medium text-muted">
            {NAV.map(([href, label]) => <Link key={href} href={href} className={LINK}>{label}</Link>)}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/entrar" className="hidden sm:inline-flex btn h-10 px-4 text-ink hover:bg-white/70">Entrar</Link>
            <Link href="/entrar?modo=registro" className="btn-primary h-10 px-4 text-sm">Crear mi plan</Link>
          </div>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="mt-24 border-t border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <nav aria-label="Pie de página" className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-muted">
            <Link className={LINK} href="/precios">Precios</Link>
            <Link className={LINK} href="/glp1">Banana Shield</Link>
            <Link className={LINK} href="/privacidad">Privacidad</Link>
            <Link className={LINK} href="/terminos">Términos</Link>
            <a className={LINK} href="mailto:hola@bananaburn.app">hola@bananaburn.app</a>
          </nav>
        </div>
        <p className="mx-auto max-w-6xl px-4 sm:px-6 pb-10 text-xs text-muted">© {new Date().getFullYear()} Banana Burn, hecho en Costa Rica. No sustituye consejo médico.</p>
      </footer>
    </>
  );
}
