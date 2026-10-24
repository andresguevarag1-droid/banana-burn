import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { INTENT_COOKIE, decodeIntent } from "@/lib/checkout-intent";
import { isCountry } from "@/lib/countries";
import { Wizard } from "./wizard";
import { TzSync } from "@/components/tz-sync";
import type { Goal } from "./goal";
import { BETA_ENDS_AT, betaLive } from "@/lib/plans";
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
  // 0043: si todavía no dejó su tarjeta (beta o prueba corriendo), al final se ofrece dejarla lista con 50 % el primer mes.
  let trialEndsAt: string | null = null, trialBeta = false, nutrition = true, cardOffer = false, chargeAt: string | null = null;
  if (v.demo) {
    // Demo igual que una cuenta real: la beta hasta su fin, o una cuenta nueva con sus 7 días.
    const beta = betaLive();
    trialEndsAt = beta ? BETA_ENDS_AT : new Date(Date.now() + 7 * 864e5).toISOString();
    trialBeta = beta;
    cardOffer = true;
    chargeAt = trialEndsAt;
  } else {
    const ent = await getEntitlements(v);
    nutrition = ent.nutrition || ent.cardStep === "trial";
    cardOffer = ent.cardStep === "trial" || ent.cardStep === "beta";
    if (ent.trial) { trialEndsAt = ent.trial.endsAt; trialBeta = Boolean(ent.trial.beta); }
    chargeAt = cardOffer ? (ent.cardStep === "beta" ? BETA_ENDS_AT : trialEndsAt) : null;
  }
  // Solo demo: ?vista=tarjeta abre directo el paso de la tarjeta (con datos de ejemplo) para revisarlo.
  const vista = (await searchParams).vista;
  const startOnCard = v.demo && cardOffer && vista === "tarjeta";
  // Solo demo: ?vista=lenguaje abre el paso de experiencia y "Cómo te hablo" para revisarlo.
  const startOnVoice = v.demo && vista === "lenguaje";

  return (
    <>
      <TzSync current={v.tz} />
      <Wizard name={v.name} demo={v.demo} initialGoal={initialGoal} glp1={glp1} country={isCountry(v.country) ? v.country : null} intent={intent} trialEndsAt={trialEndsAt} trialBeta={trialBeta} nutrition={nutrition} cardOffer={cardOffer} chargeAt={chargeAt} payments={isOnvoConfigured()} startOnCard={startOnCard} startOnVoice={startOnVoice} betaFirstPaid={betaDates().firstPaid} betaLastFree={betaDates().lastFree} />
    </>
  );
}
