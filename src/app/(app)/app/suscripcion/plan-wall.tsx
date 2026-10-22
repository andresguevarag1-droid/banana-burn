"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Lock } from "@/components/icons";
import { MonkeyBanana } from "@/components/icons/brand";
import { Pricing } from "@/components/pricing";

/** Rutas que siempre se pueden abrir sin plan: la cuenta y el pago. */
export const ALWAYS_OPEN = ["/app/perfil", "/app/suscripcion"];
export const isAlwaysOpen = (path: string) => ALWAYS_OPEN.some((p) => path === p || path.startsWith(p + "/"));

/**
 * Muro de planes: la prueba gratis terminó y no hay plan vigente. Nada se borra; perfil y suscripción siguen abiertos.
 * El acceso real lo valida el servidor (entitlements y has_app_access en la base de datos); esto es la pantalla.
 */
export function PlanGate({ locked, trialEndedOn, children }: { locked: boolean; trialEndedOn: string | null; children: React.ReactNode }) {
  const path = usePathname();
  if (!locked || isAlwaysOpen(path)) return <>{children}</>;
  return (
    <div className="animate-enter space-y-8">
      <header className="mx-auto max-w-2xl text-center">
        <span className="mx-auto grid place-items-center size-20 rounded-[1.75rem] bg-banana-soft text-banana-ink" aria-hidden><MonkeyBanana className="size-12" /></span>
        <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">Tu prueba gratis terminó</h1>
        <p className="mt-2 text-muted text-pretty">
          {trialEndedOn ? <>Terminó el {trialEndedOn}. </> : null}Tu plan, tus entrenos y tu progreso siguen guardados. Elige un plan para seguir donde lo dejaste.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-faint"><Lock weight="bold" className="size-3.5" />No se borra nada mientras decides.</p>
      </header>
      <Pricing />
      <div className="flex flex-col items-center gap-3">
        <Link href="/app/suscripcion" className="btn-primary h-12 px-6">Ver mi plan y pagos<ArrowRight weight="bold" className="size-5" /></Link>
        <Link href="/app/perfil" className="tap text-sm font-semibold text-muted underline hover:text-ink">Ir a mi perfil</Link>
      </div>
    </div>
  );
}
