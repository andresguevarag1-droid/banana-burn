import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { INTENT_COOKIE, decodeIntent } from "@/lib/checkout-intent";
import { isCountry } from "@/lib/countries";
import { trialEnd } from "@/lib/copy";
import { Wizard } from "./wizard";
import { TzSync } from "@/components/tz-sync";
import type { Goal } from "./goal";
import { betaLive } from "@/lib/plans";
import { isOnvoConfigured } from "@/lib/onvo";
import { betaDates } from "@/components/beta-notice";

export const metadata = { title: "Bienvenida", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";


export default async function Bienvenida({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/bienvenida");

  // Lo que el visitante eligió en la landing viaja en cookies; se leen aquí para que el wizard
  // arranque igual en el servidor y en el navegador (sin leer document.cookie al hidratar).
  const jar = await cookies();
  const goal = jar.get("bb_objetivo")?.value;
  const initialGoal: Goal | null = goal === "grasa" || goal === "recomp" || goal === "fuerza" ? goal : null;
  const glp1 = jar.get("bb_programa")?.value === "glp1";
  const intent = decodeIntent(jar.get(INTENT_COOKIE)?.value);

  // Prueba gratis (7 días desde el registro, o el período de prueba del servicio) y si hoy tiene nutrición: misma regla
  // que el resto de la app (entitlements.ts). Con plan pagado o del equipo no hay prueba que mostrar.
  // Desde el fin de la beta, una cuenta nueva sin prueba todavía elige plan y guarda su tarjeta al final (cardStep "trial").
  let trialEndsAt: string | null = null, trialBeta = false, nutrition = true, cardRequired = false;
  if (v.demo) {
    cardRequired = !betaLive();
    trialEndsAt = cardRequired ? null : trialEnd(new Date().toISOString())?.toISOString() ?? null;
  } else {
    const ent = await getEntitlements(v);
    nutrition = ent.nutrition || ent.cardStep === "trial";
    cardRequired = ent.cardStep === "trial";
    if (ent.trial) { trialEndsAt = ent.trial.endsAt; trialBeta = Boolean(ent.trial.beta); }
  }
  // Solo demo: ?vista=tarjeta abre directo el paso de la tarjeta (con datos de ejemplo) para revisarlo.
  const vista = (await searchParams).vista;
  const startOnCard = v.demo && cardRequired && vista === "tarjeta";
  // Solo demo: ?vista=lenguaje abre el paso de experiencia y "Cómo te hablo" para revisarlo.
  const startOnVoice = v.demo && vista === "lenguaje";

  return (
    <>
      <TzSync current={v.tz} />
      <Wizard name={v.demo ? "Andrés" : v.name} demo={v.demo} initialGoal={initialGoal} glp1={glp1} country={isCountry(v.country) ? v.country : null} intent={intent} trialEndsAt={trialEndsAt} trialBeta={trialBeta} nutrition={nutrition} cardRequired={cardRequired} payments={isOnvoConfigured()} startOnCard={startOnCard} startOnVoice={startOnVoice} betaFirstPaid={betaDates().firstPaid} />
    </>
  );
}
