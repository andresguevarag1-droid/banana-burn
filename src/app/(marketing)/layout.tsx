import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { MobileMenu } from "./mobile-menu";
import { SITE_URL } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: { siteName: "Banana Burn", locale: "es_LA", type: "website", images: [{ url: "/landing/og.png", width: 1200, height: 630, alt: "Banana Burn, tu entrenador personal con IA" }] },
  twitter: { card: "summary_large_image", images: ["/landing/og.png"] },
};

const NAV = [
  ["/#como-funciona", "Cómo funciona"],
  ["/#comparar", "Comparar"],
  ["/glp1", "GLP-1"],
  ["/#precios", "Precios"],
  ["/#faq", "Preguntas"],
] as const;

const LINK = "transition-colors duration-150 hover:text-ink";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-xl border-b border-line/60">
        <nav aria-label="Principal" className="mx-auto max-w-6xl h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <Logo />
          <div className="hidden lg:flex items-center gap-8 text-[15px] font-medium text-muted whitespace-nowrap">
            {NAV.map(([href, label]) => <Link key={href} href={href} className={LINK}>{label}</Link>)}
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/entrar" data-cta="nav-entrar" className="btn h-10 px-3 sm:px-4 text-[15px] text-ink hover:bg-white/70">Entrar</Link>
            <Link href="/entrar?modo=registro" data-cta="nav" className="btn-primary h-10 px-3.5 sm:px-4 text-sm whitespace-nowrap">Crear mi plan</Link>
            <MobileMenu items={NAV} />
          </div>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="mt-24 border-t border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <nav aria-label="Pie de página" className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-muted">
            <Link className={LINK} href="/entrar">Entrar</Link>
            <Link className={LINK} href="/precios">Precios</Link>
            <Link className={LINK} href="/glp1">Banana Shield</Link>
            <Link className={LINK} href="/privacidad">Privacidad</Link>
            <Link className={LINK} href="/terminos">Términos</Link>
            <a className={LINK} href="mailto:hola@bananaburn.app">hola@bananaburn.app</a>
          </nav>
        </div>
        <p className="mx-auto max-w-6xl px-4 sm:px-6 pb-10 text-xs text-muted">© {new Date().getFullYear()} Banana Burn, hecho en Latinoamérica. No sustituye consejo médico.</p>
      </footer>
    </>
  );
}
