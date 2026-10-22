import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, getViewer } from "@/lib/supabase/server";
import { INTENT_COOKIE, decodeIntent } from "@/lib/checkout-intent";
import { isCountry } from "@/lib/countries";
import { trialEnd } from "@/lib/copy";
import { Wizard } from "./wizard";
import { TzSync } from "@/components/tz-sync";
import type { Goal } from "./goal";

export const metadata = { title: "Bienvenida", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PAID = ["entreno", "completo", "pro"];

export default async function Bienvenida() {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/bienvenida");

  // Lo que el visitante eligió en la landing viaja en cookies; se leen aquí para que el wizard
  // arranque igual en el servidor y en el navegador (sin leer document.cookie al hidratar).
  const jar = await cookies();
  const goal = jar.get("bb_objetivo")?.value;
  const initialGoal: Goal | null = goal === "grasa" || goal === "recomp" || goal === "fuerza" ? goal : null;
  const glp1 = jar.get("bb_programa")?.value === "glp1";
  const intent = decodeIntent(jar.get(INTENT_COOKIE)?.value);

  // Prueba gratis: 7 días con todo desde que se creó la cuenta, solo si no tiene plan pagado ni es del equipo.
  let trialEndsAt: string | null = null;
  if (v.demo) trialEndsAt = trialEnd(new Date().toISOString())?.toISOString() ?? null;
  else if (!PAID.includes(v.plan) && v.role === "free") {
    const { data } = await (await createClient()).from("profiles").select("created_at").eq("id", v.id).maybeSingle();
    const end = trialEnd(data?.created_at as string | undefined);
    if (end && end.getTime() > Date.now()) trialEndsAt = end.toISOString();
  }

  return (
    <>
      <TzSync current={v.tz} />
      <Wizard name={v.demo ? "Andrés" : v.name} demo={v.demo} initialGoal={initialGoal} glp1={glp1} country={isCountry(v.country) ? v.country : null} intent={intent} trialEndsAt={trialEndsAt} />
    </>
  );
}
