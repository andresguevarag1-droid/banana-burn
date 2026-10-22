"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Barbell, Lock, Scales } from "@/components/icons";
import { MonkeyBanana } from "@/components/icons/brand";
import { Pricing } from "@/components/pricing";
import { FunnelTracker } from "@/components/analytics";
import { createClient } from "@/lib/supabase/client";
import { progressLine, recommendPlan, type TrialUsage } from "@/lib/copy";

/** Rutas que siempre se pueden abrir sin plan: la cuenta y el pago. */
export const ALWAYS_OPEN = ["/app/perfil", "/app/suscripcion"];
export const isAlwaysOpen = (path: string) => ALWAYS_OPEN.some((p) => path === p || path.startsWith(p + "/"));

/**
 * Lo que la persona hizo en su prueba, leído con su propia sesión (RLS: solo sus filas).
 * Entrenos terminados (sin contar descansos), primer y último peso, si registró comidas y si usa GLP-1.
 */
async function loadUsage(): Promise<TrialUsage | null> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const [w, first, last, meals, prof] = await Promise.all([
    sb.from("workouts").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("finished_at", "is", null).neq("template", "descanso"),
    sb.from("weights").select("kg").eq("user_id", user.id).order("day", { ascending: true }).limit(1).maybeSingle(),
    sb.from("weights").select("kg").eq("user_id", user.id).order("day", { ascending: false }).limit(1).maybeSingle(),
    sb.from("meals").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    sb.from("profiles").select("glp1").eq("id", user.id).maybeSingle(),
  ]);
  const kg = (r: { data: { kg: unknown } | null }) => (r.data && Number.isFinite(Number(r.data.kg)) ? Number(r.data.kg) : null);
  return { workouts: w.count ?? 0, firstKg: kg(first), lastKg: kg(last), meals: meals.count ?? 0, glp1: Boolean(prof.data?.glp1) };
}

/**
 * Muro de planes: la prueba gratis terminó y no hay plan vigente. Nada se borra; perfil y suscripción siguen abiertos.
 * Muestra lo que la persona ya logró (cifras reales) y destaca el plan que encaja con lo que usó.
 * El acceso real lo valida el servidor (entitlements y has_app_access en la base de datos); esto es la pantalla.
 */
export function PlanGate({ locked, trialEndedOn, children }: { locked: boolean; trialEndedOn: string | null; children: React.ReactNode }) {
  const path = usePathname();
  const show = locked && !isAlwaysOpen(path);
  const [usage, setUsage] = useState<TrialUsage | null>(null);
  useEffect(() => {
    if (!show || usage) return;
    loadUsage().then(setUsage).catch(() => {});
  }, [show, usage]);

  if (!show) return <>{children}</>;
  const line = usage ? progressLine(usage) : null;
  const rec = usage ? recommendPlan(usage) : "completo";
  const reason = usage ? (usage.glp1 ? "Incluye Banana Shield, que usaste en tu prueba" : usage.meals > 0 ? "Incluye la nutrición que usaste en tu prueba" : "Lo que usaste en tu prueba: entreno y coach") : undefined;

  return (
    <div className="animate-enter space-y-8">
      <FunnelTracker view="plan_wall_view" />
      <header className="mx-auto max-w-2xl text-center">
        <span className="mx-auto grid place-items-center size-20 rounded-[1.75rem] bg-banana-soft text-banana-ink" aria-hidden><MonkeyBanana className="size-12" /></span>
        <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">{line ? `${line}. No pares ahora.` : "Tu prueba gratis terminó"}</h1>
        <p className="mt-2 text-muted text-pretty">
          {line ? `Tu prueba gratis terminó${trialEndedOn ? ` el ${trialEndedOn}` : ""}. ` : trialEndedOn ? `Terminó el ${trialEndedOn}. ` : ""}
          Tu plan, tus entrenos y tu progreso siguen guardados. Elige un plan y sigues mañana donde lo dejaste.
        </p>
        {usage && (usage.workouts > 0 || (usage.firstKg != null && usage.lastKg != null)) && (
          <ul className="mt-5 inline-flex flex-wrap justify-center gap-2 text-sm font-semibold text-ink">
            {usage.workouts > 0 && <li className="chip bg-white border border-line"><Barbell weight="duotone" aria-hidden className="size-4 text-banana-ink" />{usage.workouts} {usage.workouts === 1 ? "entreno terminado" : "entrenos terminados"}</li>}
            {usage.firstKg != null && usage.lastKg != null && <li className="chip bg-white border border-line"><Scales weight="duotone" aria-hidden className="size-4 text-banana-ink" />De {usage.firstKg.toLocaleString("es-419")} a {usage.lastKg.toLocaleString("es-419")} kg</li>}
          </ul>
        )}
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted"><Lock weight="bold" className="size-3.5" />No se borra nada mientras decides.</p>
      </header>
      <Pricing recommended={rec} loggedIn reason={reason} />
      <div className="flex flex-col items-center gap-1">
        <Link href="/app/suscripcion" data-cta="wall-mi-plan" className="tap inline-flex items-center text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">Ver mi plan y pagos</Link>
        <Link href="/app/perfil" data-cta="wall-perfil" className="tap inline-flex items-center text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">Ir a mi perfil</Link>
      </div>
    </div>
  );
}
