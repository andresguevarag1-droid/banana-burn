import Anthropic from "@anthropic-ai/sdk";
import { getViewer } from "@/lib/supabase/server";
import { ruleFeedback, type Body } from "@/lib/feedback";
import { COACH_STYLE_RULE, stripEmoji } from "@/lib/coach";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const v = await getViewer();
  if (!v) return Response.json({ text: "" }, { status: 401 });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Body;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ text: ruleFeedback(b), source: "reglas" });
  try {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: process.env.COACH_MODEL || "claude-sonnet-5-5",
      max_tokens: 160,
      system: `Eres Coach Banana, entrenador personal de Banana Burn (Costa Rica). Da feedback post-entreno en 2 o 3 oraciones: específico con los datos, motivador sin exagerar, una recomendación concreta para la próxima sesión o la recuperación. Sin diagnósticos médicos. ${COACH_STYLE_RULE}`,
      messages: [{ role: "user", content: `Datos del entreno: ${JSON.stringify({ ...b, prs: (b.prs ?? []).slice(0, 5) }).slice(0, 800)}` }],
    });
    const text = stripEmoji(msg.content.map((c) => (c.type === "text" ? c.text : "")).join("")).trim();
    return Response.json({ text: text || ruleFeedback(b), source: "ia" });
  } catch {
    return Response.json({ text: ruleFeedback(b), source: "reglas" });
  }
}
