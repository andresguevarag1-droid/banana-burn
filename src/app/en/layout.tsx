import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { FunnelTracker } from "@/components/analytics";
import { LocaleCookie } from "@/components/locale-cookie";
import { LocaleProvider } from "@/lib/i18n/client";
import { SITE_URL } from "@/lib/env";
import { NAV_EN, SIGNIN_EN, SIGNUP_EN } from "./content";

// Portada pública en inglés (#287), fuera de (marketing) para tener su propio encabezado y pie. Misma regeneración por
// hora que la portada en español: los textos de la oferta cambian solos con la fecha.
export const revalidate = 3600;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: { siteName: "Banana Burn", locale: "en_US", type: "website" },
};

const LINK = "transition-colors duration-150 hover:text-ink";

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider locale="en-US">
      <LocaleCookie locale="en-US" />
      <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-xl border-b border-line/60">
        <nav aria-label="Main" className="mx-auto max-w-6xl h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
          <Logo compact />
          <div className="hidden lg:flex items-center gap-8 text-[15px] font-medium text-muted whitespace-nowrap">
            {NAV_EN.map(([href, label]) => <Link key={href} href={href} className={`${LINK} inline-flex min-h-11 items-center`}>{label}</Link>)}
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link href={SIGNIN_EN} data-cta="nav-entrar" className="btn inline-flex h-11 px-2.5 sm:px-4 text-sm sm:text-[15px] text-ink hover:bg-white/70">Sign in</Link>
            <Link href={SIGNUP_EN} data-cta="nav" className="btn-primary h-11 px-3.5 sm:px-4 text-sm whitespace-nowrap max-[400px]:px-2 max-[400px]:text-xs">Try 7 days free</Link>
          </div>
        </nav>
      </header>
      <main lang="en-US">{children}</main>
      <FunnelTracker view="page_view" perPath />
      <footer lang="en-US" className="mt-24 border-t border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 text-sm font-medium text-muted [&>a]:inline-flex [&>a]:min-h-11 [&>a]:min-w-11 [&>a]:items-center">
            <Link className={LINK} href={SIGNIN_EN}>Sign in</Link>
            <Link className={LINK} href="/en/pricing">Pricing</Link>
            <Link className={LINK} href="/privacidad">Privacy (Spanish)</Link>
            <Link className={LINK} href="/terminos">Terms (Spanish)</Link>
            <a className={LINK} href="mailto:hola@bananaburn.app">hola@bananaburn.app</a>
            {/* Selector de idioma: la portada en español. */}
            <Link className={LINK} href="/" hrefLang="es-419" lang="es-419" data-cta="idioma-es">Español</Link>
          </nav>
        </div>
        <p className="mx-auto max-w-6xl px-4 sm:px-6 pb-10 text-xs text-muted text-pretty">© {new Date().getFullYear()} Atlas Resources SRL. Banana Burn, made in Costa Rica. Not medical advice.</p>
      </footer>
    </LocaleProvider>
  );
}
