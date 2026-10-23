import { createClient, getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { isTrainingDay } from "@/lib/engine";
import { getDaily } from "@/lib/daily";
import { getMeals, sumMeals } from "@/lib/meals";
import { getEntitlements } from "@/lib/entitlements";
import { demoQuota, parseQuota, tierFromAccess, type CoachQuota } from "@/lib/coach-quota";
import { Chat } from "./chat";
import { coachOf } from "@/lib/coaches";
import { todayLine } from "@/lib/coach";

export const metadata = { title: "Coach IA" };

export default async function Coach({ searchParams }: { searchParams: Promise<{ cuota?: string; nivel?: string }> }) {
  const v = (await getViewer())!;
  const { cuota, nivel } = await searchParams;
  const a = await getAthlete(v);
  // Sin llave de Anthropic, con cuentas reales el coach todavía no responde (la demo usa respuestas de ejemplo).
  const configured = v.demo || Boolean(process.env.ANTHROPIC_API_KEY);
  let initial: { role: "user" | "assistant"; content: string; at?: string }[] = [];
  // Cupo de preguntas (0032). Sin la migración no se muestra contador (el servidor sigue con el cupo de antes).
  let quota: CoachQuota | null = null;
  if (!v.demo) {
    const sb = await createClient();
    const [{ data }, q] = await Promise.all([
      sb.from("coach_messages").select("role,content,created_at").eq("user_id", v.id).order("id", { ascending: false }).limit(20),
      sb.rpc("coach_quota_status"),
    ]);
    initial = ((data ?? []) as { role: "user" | "assistant"; content: string; created_at: string }[]).reverse().map((m) => ({ role: m.role, content: m.content, at: m.created_at }));
    quota = q.error ? null : parseQuota(q.data);
  }
  const d = dashboard(a);
  const [g, meals, ent] = await Promise.all([getDaily(v, a.startWeight, a.currentWeight), getMeals(v), getEntitlements(v)]);
  // Modo demo: el contador se simula en el navegador; ?cuota=bajo | agotado | mes muestra esos estados.
  // &nivel=entreno muestra el cupo de Entreno (con la invitación a Entreno + Nutrición). Solo en demo.
  if (v.demo) quota = demoQuota(cuota, nivel === "entreno" ? "entreno" : tierFromAccess(ent));
  // Gramos de proteína solo con nutrición: en Entreno no hay meta personal de comida.
  const protLeft = ent.nutrition ? Math.max(0, Math.round(d.t.protein - g.log.protein - sumMeals(meals.today).protein)) : 0;
  const lines = [
    `¡Hola, ${a.name.split(" ")[0] || a.name}!`,
    todayLine({ today: { name: d.plan.name, exercises: d.plan.exercises.length, training: isTrainingDay(d.plan) }, yesterday: { name: d.yesterday.name, training: isTrainingDay(d.yesterday) }, trainedToday: g.trainedToday }),
    ...(ent.nutrition ? [protLeft > 0 ? `- Te faltan **${protLeft} g de proteína** hoy.` : `- Proteína del día completa.`] : []),
    g.streak.days > 0 ? `- Llevas **${g.streak.days} ${g.streak.days === 1 ? "día" : "días"} de racha**${g.streak.todayDone ? "" : " (regístrate hoy para no perderla)"}.` : `- Hoy empieza tu racha.`,
    d.toGo > 0 ? `- Te faltan **${d.toGo.toLocaleString("es-CO", { maximumFractionDigits: 1 })} kg** para tu meta.` : `- Ya llegaste a tu meta de peso.`,
    "¿En qué te ayudo?",
  ];
  const suggest = [
    isTrainingDay(d.plan) ? `No hay equipo libre para ${d.plan.exercises[0]?.name.toLowerCase()}, ¿qué hago?` : "¿Qué hago en mi día de descanso?",
    ent.nutrition ? (protLeft > 20 ? `Me faltan ${protLeft} g de proteína, ¿qué ceno?` : "¿Qué como antes de entrenar?") : "¿Cómo mejoro mi técnica en sentadilla?",
    "Siento que me estanqué, ¿qué ajusto?",
    "Me duele el hombro en press banca",
  ];
  // Programa activo con su propia coach (Coach Platanita): ella responde, con su retrato y su saludo.
  const coach = d.program ? coachOf(d.program.meta.experience) : null;
  const persona = coach && coach.id !== "banana" ? { name: coach.name, avatar: coach.avatar } : null;
  if (persona && d.program) lines.splice(1, 0, `Soy ${persona.name}, tu coach en **${d.program.title}**.`);
  return <Chat initial={initial} opener={lines.join("\n")} suggest={suggest} name={a.name} configured={configured} quota={quota} demo={v.demo} persona={persona} />;
}
