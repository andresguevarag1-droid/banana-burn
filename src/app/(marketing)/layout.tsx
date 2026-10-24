import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { MobileMenu } from "./mobile-menu";
import { FunnelTracker } from "@/components/analytics";
import { SITE_URL } from "@/lib/env";
import { ogImage } from "./seo";
import { GLP1, TRIAL_DAYS } from "@/lib/copy";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: { siteName: "Banana Burn", locale: "es_419", type: "website", images: [ogImage("Baja grasa sin perder músculo", "Tu entrenador personal en el celular, con rutina de recomposición corporal.")] },
  twitter: { card: "summary_large_image", images: [ogImage("Baja grasa sin perder músculo", "Tu entrenador personal en el celular, con rutina de recomposición corporal.").url] },
};

const NAV = [
  ["/#como-funciona", "Cómo funciona"],
  ["/#comparar", "Comparar"],
  ["/glp1", GLP1],
  ["/#precios", "Precios"],
  ["/#faq", "Preguntas"],
] as const;

import { BetaStrip } from "@/components/beta-notice";

// Las páginas públicas se regeneran cada hora: la franja de la versión de prueba se quita sola al terminar.
export const revalidate = 3600;

const LINK = "transition-colors duration-150 hover:text-ink";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BetaStrip />
      <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-xl border-b border-line/60">
        <nav aria-label="Principal" className="mx-auto max-w-6xl h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
          <Logo compact />
          <div className="hidden lg:flex items-center gap-8 text-[15px] font-medium text-muted whitespace-nowrap">
            {NAV.map(([href, label]) => <Link key={href} href={href} className={`${LINK} inline-flex min-h-11 items-center`}>{label}</Link>)}
          </div>
          {/* "Entrar" siempre visible; bajo 400 px el logo queda solo en ícono para que todo quepa desde 320 px. */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link href="/entrar" data-cta="nav-entrar" className="btn inline-flex h-11 px-2.5 sm:px-4 text-sm sm:text-[15px] text-ink hover:bg-white/70">Entrar</Link>
            <Link href="/entrar?modo=registro" data-cta="nav" className="btn-primary h-11 px-3.5 sm:px-4 text-sm whitespace-nowrap">Empezar gratis<span className="sr-only"> {TRIAL_DAYS} días</span></Link>
            <MobileMenu items={NAV} />
          </div>
        </nav>
      </header>
      <main>{children}</main>
      <FunnelTracker view="page_view" perPath />
      <footer className="mt-24 border-t border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <nav aria-label="Pie de página" className="flex flex-wrap gap-x-6 text-sm font-medium text-muted [&>a]:inline-flex [&>a]:min-h-11 [&>a]:min-w-11 [&>a]:items-center">
            <Link className={LINK} href="/entrar">Entrar</Link>
            <Link className={LINK} href="/precios">Precios</Link>
            <Link className={LINK} href="/glp1">Banana Shield</Link>
            <Link className={LINK} href="/privacidad">Privacidad</Link>
            <Link className={LINK} href="/terminos">Términos</Link>
            <a className={LINK} href="mailto:hola@bananaburn.app">hola@bananaburn.app</a>
          </nav>
        </div>
        <p className="mx-auto max-w-6xl px-4 sm:px-6 pb-10 text-xs text-muted text-pretty">© {new Date().getFullYear()} Atlas Resources SRL. Banana Burn, hecho en Costa Rica para toda Latinoamérica. No sustituye consejo médico. LinkApp es una marca registrada en Costa Rica, usada con permiso.</p>
      </footer>
    </>
  );
}
