"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Barbell, CircleNotch, CreditCard, Lock, Scales, WarningCircle } from "@/components/icons";
import { TRIAL_CARD_LINE, type CardStep, type ChargePhase } from "@/lib/trial";
import { MonkeyBanana } from "@/components/icons/brand";
import { Pricing } from "@/components/pricing";
import { FunnelTracker } from "@/components/analytics";
import { createClient } from "@/lib/supabase/client";
import { progressLine, recommendPlan, type TrialUsage } from "@/lib/copy";

import { isAlwaysOpen } from "@/lib/access-gate";

/** Rutas que siempre se pueden abrir sin plan (la cuenta, el pago e "Invita y gana"): ver access-gate.ts. */
export { ALWAYS_OPEN, isAlwaysOpen } from "@/lib/access-gate";

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
 * El acceso real lo valida el servidor: el middleware no ejecuta las secciones pagadas sin acceso (access-gate.ts), las acciones
 * piden `ent.app` y la base lo repite con RLS (has_app_access). Esto es la pantalla.
 */
export function PlanGate({ locked, trialEndedOn, cardStep = "none", chargePhase = null, children }: { locked: boolean; trialEndedOn: string | null; cardStep?: CardStep; chargePhase?: ChargePhase | null; children: React.ReactNode }) {
  const path = usePathname();
  const show = locked && !isAlwaysOpen(path);
  const [usage, setUsage] = useState<TrialUsage | null>(null);
  useEffect(() => {
    if (!show || usage || cardStep === "trial") return;
    loadUsage().then(setUsage).catch(() => {});
  }, [show, usage, cardStep]);

  if (!show) return <>{children}</>;
  // Tarjeta guardada (0026): cuenta nueva sin prueba, cobro rechazado, cobro en curso o cuenta de la beta después del 1 de noviembre.
  if (cardStep === "trial") return <CardWall icon="card" title="Empieza tu prueba gratis de 7 días" body={`Elige tu plan y guarda tu tarjeta. ${TRIAL_CARD_LINE}`} cta="Elegir plan y empezar" />;
  if (chargePhase === "procesando") return <Processing />;
  const failed = chargePhase === "reintento" || chargePhase === "fallido";
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
      {(failed || cardStep === "pay") && (
        <div className="mx-auto max-w-md rounded-[1.5rem] border-2 border-ink bg-white p-5 text-center">
          <p className="flex items-center justify-center gap-2 font-extrabold text-ink">{failed ? <WarningCircle weight="duotone" className="size-5 text-bad" /> : <CreditCard weight="duotone" className="size-5 text-banana-ink" />}{failed ? "No pudimos cobrar tu plan" : "Guarda tu tarjeta para seguir"}</p>
          <p className="mt-1 text-sm text-muted text-pretty">{failed ? "Cambia tu tarjeta en Mi plan y sigues hoy, sin perder nada." : "La versión de prueba terminó. Guardas tu tarjeta, eliges tu plan y se cobra hoy."}</p>
          <Link href="/app/suscripcion#tarjeta" data-cta={failed ? "wall-cambiar-tarjeta" : "wall-guardar-tarjeta"} className="btn-banana mt-4 h-12 w-full">{failed ? "Cambiar tarjeta" : "Guardar tarjeta"}<ArrowRight weight="bold" className="size-4" /></Link>
          <p className="mt-3 text-xs text-muted">O paga con otra tarjeta eligiendo un plan aquí abajo.</p>
        </div>
      )}
      <Pricing recommended={rec} loggedIn reason={reason} />
      <div className="flex flex-col items-center gap-1">
        <Link href="/app/suscripcion" data-cta="wall-mi-plan" className="tap inline-flex items-center text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">Ver mi plan y pagos</Link>
        <Link href="/app/perfil" data-cta="wall-perfil" className="tap inline-flex items-center text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">Ir a mi perfil</Link>
      </div>
    </div>
  );
}

/** Muro de la prueba con tarjeta: un solo paso claro hacia Mi plan, donde se elige el plan y se guarda la tarjeta. */
function CardWall({ title, body, cta }: { icon: "card"; title: string; body: string; cta: string }) {
  return (
    <div className="animate-enter mx-auto max-w-md space-y-5 py-6 text-center">
      <FunnelTracker view="plan_wall_view" props={{ kind: "prueba_con_tarjeta" }} />
      <span className="mx-auto grid place-items-center size-20 rounded-[1.75rem] bg-banana-soft text-banana-ink" aria-hidden><MonkeyBanana className="size-12" /></span>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink text-balance">{title}</h1>
      <p className="text-muted text-pretty">{body}</p>
      <Link href="/app/suscripcion#tarjeta" data-cta="wall-empezar-prueba" className="btn-banana h-14 w-full text-base">{cta}<ArrowRight weight="bold" className="size-5" /></Link>
      <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-muted"><Lock weight="bold" className="size-3.5" />Te avisamos 2 días antes del cobro.</p>
    </div>
  );
}

/** Cobro enviado a ONVO: esperamos el webhook y refrescamos solos durante un minuto. */
function Processing() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => { n++; router.refresh(); if (n >= 12) clearInterval(t); }, 5000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <div aria-live="polite" className="animate-enter mx-auto max-w-md space-y-4 py-10 text-center">
      <CircleNotch weight="bold" className="mx-auto size-10 animate-spin text-banana-ink motion-reduce:animate-none" aria-hidden />
      <h1 className="text-2xl font-extrabold tracking-tight text-ink text-balance">Estamos confirmando el cobro de tu plan</h1>
      <p className="text-muted text-pretty">Suele tardar unos segundos. Esta pantalla se actualiza sola.</p>
      <Link href="/app/suscripcion" className="tap inline-flex h-11 items-center text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">Ver mi plan</Link>
    </div>
  );
}
