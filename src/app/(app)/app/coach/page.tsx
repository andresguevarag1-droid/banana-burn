import { createClient, getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getDaily } from "@/lib/daily";
import { getMeals, sumMeals } from "@/lib/meals";
import { Chat } from "./chat";

export const metadata = { title: "Coach IA" };

export default async function Coach() {
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  let initial: { role: "user" | "assistant"; content: string }[] = [];
  if (!v.demo) {
    const sb = await createClient();
    const { data } = await sb.from("coach_messages").select("role,content").eq("user_id", v.id).order("id", { ascending: false }).limit(20);
    initial = ((data ?? []) as typeof initial).reverse();
  }
  const d = dashboard(a);
  const [g, meals] = await Promise.all([getDaily(v, a.startWeight, a.currentWeight), getMeals(v)]);
  const protLeft = Math.max(0, Math.round(d.t.protein - g.log.protein - sumMeals(meals.today).protein));
  const lines = [
    `¡Pura vida, ${a.name}!`,
    d.plan.tpl ? (g.trainedToday ? `Ya hiciste **${d.plan.name}** hoy. Bien ahí.` : `Hoy te toca **${d.plan.name}** (${d.plan.exercises.length} ejercicios). Ayer fue ${d.yesterday.name}, así que vas fresco.`) : `Hoy es **descanso activo**: camina y estira.`,
    protLeft > 0 ? `- Te faltan **${protLeft} g de proteína** hoy.` : `- Proteína del día completa.`,
    g.streak.days > 0 ? `- Llevas **${g.streak.days} ${g.streak.days === 1 ? "día" : "días"} de racha**${g.streak.todayDone ? "" : " (regístrate hoy para no perderla)"}.` : `- Hoy empieza tu racha.`,
    d.toGo > 0 ? `- Te faltan **${d.toGo.toLocaleString("es-419", { maximumFractionDigits: 1 })} kg** para tu meta.` : `- Ya llegaste a tu meta de peso.`,
    "¿En qué te ayudo?",
  ];
  const suggest = [
    d.plan.tpl ? `No hay equipo libre para ${d.plan.exercises[0]?.name.toLowerCase()}, ¿qué hago?` : "¿Qué hago en mi día de descanso?",
    protLeft > 20 ? `Me faltan ${protLeft} g de proteína, ¿qué ceno?` : "¿Qué como antes de entrenar?",
    "Siento que me estanqué, ¿qué ajusto?",
    "Me duele el hombro en press banca",
  ];
  return <Chat initial={initial} opener={lines.join("\n")} suggest={suggest} name={a.name} />;
}
