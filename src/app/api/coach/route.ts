import Anthropic from "@anthropic-ai/sdk";
import { getViewer, createClient } from "@/lib/supabase/server";
import { getAthlete } from "@/lib/athlete";
import { getProgress } from "@/lib/progress";
import { coachSystem, demoReply } from "@/lib/coach";
import { crToday } from "@/lib/today";

export const runtime = "nodejs";
export const maxDuration = 60;

type Msg = { role: "user" | "assistant"; content: string };
const DAILY_LIMIT = 40;

function textStream(gen: AsyncIterable<string>, onDone?: (full: string) => Promise<void>) {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(c) {
      let full = "";
      try { for await (const t of gen) { full += t; c.enqueue(enc.encode(t)); } }
      catch { c.enqueue(enc.encode("\n\n⚠️ Se cortó la respuesta. Intenta de nuevo.")); }
      c.close();
      if (onDone) await onDone(full).catch(() => {});
    },
  });
}

async function* fake(text: string) { for (const w of text.split(/(?<=\s)/)) { yield w; await new Promise((r) => setTimeout(r, 18)); } }

export async function POST(req: Request) {
  const v = await getViewer();
  if (!v) return new Response("No autorizado", { status: 401 });
  const body = (await req.json().catch(() => null)) as { messages?: Msg[] } | null;
  const messages = (body?.messages ?? []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-16).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  const last = messages.at(-1);
  if (!last || last.role !== "user") return new Response("Mensaje vacío", { status: 400 });

  const key = process.env.ANTHROPIC_API_KEY;
  const headers = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };
  if (!key) return new Response(textStream(fake(demoReply(last.content))), { headers });

  const sb = v.demo ? null : await createClient();
  if (sb) {
    const { count } = await sb.from("coach_messages").select("*", { count: "exact", head: true }).eq("user_id", v.id).eq("role", "user").gte("created_at", crToday().iso + "T06:00:00Z");
    if ((count ?? 0) >= DAILY_LIMIT) return new Response(textStream(fake("Llegaste al límite de mensajes de hoy 🙏 Mañana seguimos.")), { headers });
  }

  const a = await getAthlete(v);
  const p = await getProgress(v);
  const client = new Anthropic({ apiKey: key });
  const stream = client.messages.stream({
    model: process.env.COACH_MODEL || "claude-sonnet-5-5",
    max_tokens: 700,
    system: coachSystem(a, p.weights, p.workouts),
    messages,
  });
  async function* text() {
    for await (const ev of stream) if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text;
  }
  return new Response(textStream(text(), async (full) => {
    if (!sb) return;
    await sb.from("coach_messages").insert([{ user_id: v.id, role: "user", content: last.content }, { user_id: v.id, role: "assistant", content: full }]);
  }), { headers });
}
