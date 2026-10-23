import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { ArrowRight, Banana, Check, Monkey, MonkeyBanana, SignOut } from "@/components/icons";
import { FunnelTracker } from "@/components/analytics";
import { TRIAL_DAYS } from "@/lib/copy";
import { isSupabaseConfigured } from "@/lib/env";
import { getViewer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { REF_COOKIE, normalizeCode } from "@/lib/referrals";
import { LoginForm } from "./login-form";
import { offer } from "@/lib/offer";

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
  const invited = signup && !v && !!normalizeCode((await cookies()).get(REF_COOKIE)?.value);
  const o = offer();
  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      <FunnelTracker view="page_view" props={{ screen: signup ? "registro" : "entrar" }} />
      <div className="flex flex-col px-5 sm:px-10 py-6">
        <header><Logo /></header>
        <main className="flex-1 grid place-items-center py-10">
          <div className="w-full max-w-[400px]">
            {/* Google solo si el proveedor está activo en Supabase (NEXT_PUBLIC_GOOGLE_AUTH=1); si no, el botón fallaría. */}
            {v ? (
              <div className="animate-rise">
                <span className="grid place-items-center size-16 rounded-2xl bg-banana-soft text-banana-ink"><MonkeyBanana className="size-10" /></span>
                <h1 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">Ya tienes la sesión abierta</h1>
                <p className="mt-2 text-muted">Entraste como <b className="text-ink break-all">{v.email}</b>.</p>
                <Link href={v.onboarded ? "/app" : "/bienvenida"} className="btn-primary w-full h-13 mt-8">{v.onboarded ? "Ir a mi cuenta" : "Terminar de crear mi plan"}<ArrowRight className="size-5" /></Link>
                <form action="/auth/salir" method="post" className="mt-3">
                  <input type="hidden" name="next" value="/entrar" />
                  <button className="btn-ghost w-full h-13"><SignOut weight="bold" className="size-5" />Entrar con otra cuenta</button>
                </form>
              </div>
            ) : (
              <>
                {invited && <p className="mb-5 flex items-center gap-2 rounded-2xl bg-banana-soft px-4 py-3 text-sm font-semibold text-banana-ink"><Banana weight="fill" aria-hidden className="size-5 shrink-0" />Llegaste con una invitación. Crea tu cuenta y entrena gratis {TRIAL_DAYS} días.</p>}
                <Suspense><LoginForm configured={isSupabaseConfigured} googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1"} signupChecks={o.signupChecks} /></Suspense>
              </>
            )}
          </div>
        </main>
        <footer className="text-xs text-muted text-center text-pretty">Al continuar aceptas los <Link href="/terminos" className="tap underline underline-offset-2 hover:text-ink">Términos</Link> y la <Link href="/privacidad" className="tap underline underline-offset-2 hover:text-ink">Política de privacidad</Link>.</footer>
      </div>
      <aside className="hidden lg:flex relative overflow-hidden bg-banana p-14 flex-col justify-end">
        <Banana weight="fill" className="absolute -top-20 -right-20 size-[420px] text-ink opacity-10 rotate-12 select-none" />
        {signup ? (
          <div className="relative max-w-md">
            <p className="text-4xl font-extrabold tracking-tight text-ink leading-tight text-balance">Tu prueba de {TRIAL_DAYS} días trae todo incluido.</p>
            <ul className="mt-8 space-y-3 text-lg font-semibold text-ink">
              {TRIAL_INCLUDES.map((t) => <li key={t} className="flex gap-3"><Check weight="bold" aria-hidden className="mt-1 size-5 shrink-0" />{t}</li>)}
            </ul>
            <p className="mt-8 flex items-center gap-2 font-semibold text-ink/70 text-pretty"><Monkey className="size-6 shrink-0" />{o.signupLine}</p>
          </div>
        ) : (
          <blockquote className="relative max-w-md">
            <p className="text-4xl font-extrabold tracking-tight text-ink leading-tight">“Hoy toca Piernas de acero y pecho firme. Ayer descansaste. Tu sentadilla sube 2.5 kg.”</p>
            <p className="mt-6 flex items-center gap-2 font-semibold text-ink/70"><Monkey className="size-6" />Coach Banana, cada mañana</p>
          </blockquote>
        )}
      </aside>
    </div>
  );
}
