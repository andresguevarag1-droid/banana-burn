import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { ArrowRight, Banana, Check, Monkey, MonkeyBanana, SignOut } from "@/components/icons";
import { FunnelTracker } from "@/components/analytics";
import { TRIAL_DAYS } from "@/lib/copy";
import { isSupabaseConfigured } from "@/lib/env";
import { blockedSession, getViewer } from "@/lib/supabase/server";
import { cookies, headers } from "next/headers";
import { REF_COOKIE, normalizeCode } from "@/lib/referrals";
import { LoginForm } from "./login-form";
import { offer } from "@/lib/offer";
import { requestPlatform } from "@/lib/platform-server";
import { detectInstallEnv, inAppOpenIn } from "@/lib/install-env";
import { CONDO_COOKIE, normalizeCondoCode } from "@/lib/condos";
import { getLocale } from "@/lib/i18n/server";
import { offerFor } from "@/lib/i18n/offer";
import { tr } from "@/lib/i18n/t";
import { LocaleProvider } from "@/lib/i18n/client";

export const metadata = { title: "Entrar", robots: { index: false, follow: true } };

export const dynamic = "force-dynamic";

/** Lo que trae la prueba gratis: se muestra junto al registro en escritorio. Cifras reales del producto. */
const TRIAL_INCLUDES = [
  "Rutina diaria con el peso exacto de cada serie",
  "Rutina de recomposición corporal hecha para ti",
  "Calorías y macros con comida latina de verdad",
  "Banana Shield si usas Ozempic o Mounjaro",
];

export default async function Entrar({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const signup = (await searchParams).modo === "registro";
  // Con sesión abierta no rebotamos a la app: mostramos con qué cuenta estás y dejamos cambiarla.
  const v = isSupabaseConfigured ? await getViewer() : null;
  const blocked = !v && (await blockedSession().catch(() => false));
  const jar = await cookies();
  const invited = signup && !v && !!normalizeCode(jar.get(REF_COOKIE)?.value);
  // Quien llega desde la página de su condominio (/c/<código>) tiene la oferta del condominio, no el 50 % del primer mes:
  // en Soho Paradisus es gratis hasta el 31 dic y luego precio normal; en los demás, el mes gratis del condominio.
  const condo = signup && !v && !!normalizeCondoCode(jar.get(CONDO_COOKIE)?.value);
  // #287: idioma de la cuenta, de la última página pública (/en) o del navegador; sin nada de eso, español.
  const locale = await getLocale();
  const t = tr(locale);
  const base = locale === "es-419" ? offer() : offerFor(locale);
  const o = condo ? { ...base, signupChecks: [t("Beneficio de tu condominio"), t("Sin tarjeta")] as [string, string], signupLine: t("Al crear tu cuenta se activa el beneficio de tu condominio.") } : base;
  // Dentro de Instagram o Facebook: sin Google (lo bloquea ahí) y con el enlace para abrirla en Safari o Chrome.
  const openIn = inAppOpenIn(detectInstallEnv((await headers()).get("user-agent") ?? ""));
  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      <FunnelTracker view="page_view" props={{ screen: signup ? "registro" : "entrar" }} />
      {signup && !v && !blocked && <FunnelTracker view="signup_view" props={{ inapp: openIn !== null }} />}
      <div className="flex flex-col px-5 sm:px-10 py-6">
        <header><Logo /></header>
        <main className="flex-1 grid place-items-center py-10">
          <div className="w-full max-w-[400px]">
            {/* Google solo si el proveedor está activo en Supabase (NEXT_PUBLIC_GOOGLE_AUTH=1); si no, el botón fallaría. */}
            {blocked ? (
              <div className="animate-rise">
                <span className="grid place-items-center size-16 rounded-2xl bg-banana-soft text-banana-ink"><MonkeyBanana className="size-10" /></span>
                <h1 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">{t("Tu cuenta está pausada")}</h1>
                <p className="mt-2 text-muted text-pretty">{t("Por ahora no puedes entrar con esta cuenta. Escríbenos a")} <a href="mailto:hola@bananaburn.app" className="font-semibold text-ink underline underline-offset-2">hola@bananaburn.app</a> {t("y te ayudamos a resolverlo.")}</p>
                <form action="/auth/salir" method="post" className="mt-8">
                  <input type="hidden" name="next" value="/entrar" />
                  <button className="btn-ghost w-full h-13"><SignOut weight="bold" className="size-5" />{t("Entrar con otra cuenta")}</button>
                </form>
              </div>
            ) : v ? (
              <div className="animate-rise">
                <span className="grid place-items-center size-16 rounded-2xl bg-banana-soft text-banana-ink"><MonkeyBanana className="size-10" /></span>
                <h1 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">{t("Ya tienes la sesión abierta")}</h1>
                <p className="mt-2 text-muted">{t("Entraste como")} <b className="text-ink break-all">{v.email}</b>.</p>
                <Link href={v.onboarded ? "/app" : "/bienvenida"} className="btn-primary w-full h-13 mt-8">{v.onboarded ? t("Ir a mi cuenta") : t("Terminar de crear mi plan")}<ArrowRight className="size-5" /></Link>
                <form action="/auth/salir" method="post" className="mt-3">
                  <input type="hidden" name="next" value="/entrar" />
                  <button className="btn-ghost w-full h-13"><SignOut weight="bold" className="size-5" />{t("Entrar con otra cuenta")}</button>
                </form>
              </div>
            ) : (
              <>
                {invited && <p className="mb-5 flex items-center gap-2 rounded-2xl bg-banana-soft px-4 py-3 text-sm font-semibold text-banana-ink"><Banana weight="fill" aria-hidden className="size-5 shrink-0" />{t("Llegaste con una invitación. Crea tu cuenta y entrena gratis {n} días.", { n: TRIAL_DAYS })}</p>}
                <LocaleProvider locale={locale}><Suspense><LoginForm configured={isSupabaseConfigured} googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1"} signupChecks={o.signupChecks} platform={await requestPlatform()} openIn={openIn} /></Suspense></LocaleProvider>
              </>
            )}
          </div>
        </main>
        <footer className="text-xs text-muted text-center text-pretty">{t("Al continuar aceptas los")} <Link href="/terminos" className="tap underline underline-offset-2 hover:text-ink">{t("Términos")}</Link> {t("y la")} <Link href="/privacidad" className="tap underline underline-offset-2 hover:text-ink">{t("Política de privacidad")}</Link>.</footer>
      </div>
      <aside className="hidden lg:flex relative overflow-hidden bg-banana p-14 flex-col justify-end">
        <Banana weight="fill" className="absolute -top-20 -right-20 size-[420px] text-ink opacity-10 rotate-12 select-none" />
        {signup ? (
          <div className="relative max-w-md">
            <p className="text-4xl font-extrabold tracking-tight text-ink leading-tight text-balance">{t("Tu prueba de {n} días trae todo incluido.", { n: TRIAL_DAYS })}</p>
            <ul className="mt-8 space-y-3 text-lg font-semibold text-ink">
              {TRIAL_INCLUDES.map((s) => <li key={s} className="flex gap-3"><Check weight="bold" aria-hidden className="mt-1 size-5 shrink-0" />{t(s)}</li>)}
            </ul>
            <p className="mt-8 flex items-center gap-2 font-semibold text-ink/70 text-pretty"><Monkey className="size-6 shrink-0" />{o.signupLine}</p>
          </div>
        ) : (
          <blockquote className="relative max-w-md">
            <p className="text-4xl font-extrabold tracking-tight text-ink leading-tight">{t("“Hoy toca Piernas de acero y pecho firme. Ayer descansaste. Tu sentadilla sube 2.5 kg.”")}</p>
            <p className="mt-6 flex items-center gap-2 font-semibold text-ink/70"><Monkey className="size-6" />{t("Coach Banana, cada mañana")}</p>
          </blockquote>
        )}
      </aside>
    </div>
  );
}
