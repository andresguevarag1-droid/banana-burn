import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { INTENT_COOKIE, decodeIntent } from "@/lib/checkout-intent";
import { isCountry } from "@/lib/countries";
import { Wizard } from "./wizard";
import { TzSync } from "@/components/tz-sync";
import type { Goal } from "./goal";
import { BETA_GRACE_UNTIL, betaLive } from "@/lib/plans";
import { isOnvoConfigured } from "@/lib/onvo";
import { betaDates } from "@/components/beta-notice";
import { cardRequiredDemo } from "@/lib/card-required";
import { getPrefs } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";

export const metadata = { title: "Bienvenida", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";


export default async function Bienvenida({ searchParams }: { searchParams: Promise<{ vista?: string; tarjeta?: string }> }) {
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
  // #269: cuenta creada desde el 1 de diciembre de 2026 sin su cobro listo: la tarjeta es obligatoria para empezar la prueba.
  // Solo demo: ?tarjeta=obligatoria lo muestra.
  const params = await searchParams;
  let cardRequired = false;
  if (v.demo) {
    // Demo igual que una cuenta real: la beta hasta su fin, o una cuenta nueva con sus 7 días.
    const beta = betaLive();
    trialEndsAt = beta ? BETA_GRACE_UNTIL : new Date(Date.now() + 7 * 864e5).toISOString();
    trialBeta = beta;
    cardOffer = true;
    chargeAt = trialEndsAt;
    cardRequired = cardRequiredDemo(true, params.tarjeta);
  } else {
    const ent = await getEntitlements(v);
    cardRequired = ent.cardStep === "card";
    nutrition = ent.nutrition || ent.cardStep === "trial" || cardRequired;
    cardOffer = ent.cardStep === "trial" || ent.cardStep === "beta";
    if (ent.trial) { trialEndsAt = ent.trial.endsAt; trialBeta = Boolean(ent.trial.beta); }
    chargeAt = cardOffer ? (ent.cardStep === "beta" ? BETA_GRACE_UNTIL : trialEndsAt) : cardRequired ? ent.trialEndsAt ?? null : null;
  }
  // #254: la bienvenida ya no ofrece la tarjeta. Primero el primer entreno (el resumen muestra la oferta, #199) y la tarjeta
  // siempre está en Mi plan. El paso solo se abre en la demo con ?vista=tarjeta, para revisarlo.
  // Solo demo: ?vista=tarjeta abre directo el paso de la tarjeta (con datos de ejemplo) para revisarlo.
  const vista = params.vista;
  // #269: si ya guardó su plan y cerró la bienvenida en la tarjeta, al volver abre directo en ese paso.
  const resumeCard = cardRequired && !v.demo && v.onboarded;
  const startOnCard = v.demo && cardOffer && vista === "tarjeta";
  // Solo demo: ?vista=lenguaje abre el paso de experiencia para revisarlo ("Cómo te hablo" está en Perfil desde #255).
  const startOnVoice = v.demo && vista === "lenguaje";
  // #287: idioma de la cuenta (o el de /en y el navegador); las unidades guardadas solo si ya terminó la bienvenida.
  const prefs = await getPrefs();

  return (
    <>
      <TzSync current={v.tz} />
      <LocaleProvider locale={prefs.locale} units={prefs.units}><Wizard locale={prefs.locale} units={v.onboarded ? prefs.units : null} name={v.name} demo={v.demo} initialGoal={initialGoal} glp1={glp1} country={isCountry(v.country) ? v.country : null} intent={intent} trialEndsAt={trialEndsAt} trialBeta={trialBeta} nutrition={nutrition} cardOffer={startOnCard} cardRequired={cardRequired} onboarded={resumeCard} chargeAt={chargeAt} payments={isOnvoConfigured()} startOnCard={startOnCard || resumeCard} startOnVoice={startOnVoice} betaFirstPaid={betaDates().firstPaid} betaLastFree={betaDates().lastFree} /></LocaleProvider>
    </>
  );
}
