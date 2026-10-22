import Anthropic from "@anthropic-ai/sdk";
import { getViewer, createClient } from "@/lib/supabase/server";
import { getAthlete } from "@/lib/athlete";
import { getProgress } from "@/lib/progress";
import { coachSystem, demoReply, safetyCheck, sanitizeMessages, stripEmoji } from "@/lib/coach";
import { clientIp, isSameOrigin, memoryRateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 64_000;
const LIMIT_TEXT = "Llegaste al límite de mensajes de hoy. Mañana seguimos.";

function textStream(gen: AsyncIterable<string>, onDone?: (full: string) => Promise<void>) {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(c) {
      let full = "";
      try { for await (const raw of gen) { const t = stripEmoji(raw); if (!t) continue; full += t; c.enqueue(enc.encode(t)); } }
      catch (e) {
        // Al usuario: mensaje genérico. Al log: solo tipo/estado, sin contenido del chat (datos de salud).
        console.error("[coach] stream", e instanceof Anthropic.APIError ? `APIError ${e.status}` : e instanceof Error ? e.name : "error");
        c.enqueue(enc.encode("\n\nSe cortó la respuesta. Intenta de nuevo."));
      }
      c.close();
      if (onDone) await onDone(full).catch(() => {});
    },
  });
}

async function* fake(text: string) { for (const w of text.split(/(?<=\s)/)) { yield w; await new Promise((r) => setTimeout(r, 18)); } }

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new Response("Origen no permitido", { status: 403 });
  const v = await getViewer();
  if (!v) return new Response("No autorizado", { status: 401 });
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return new Response("Mensaje demasiado largo", { status: 413 });
  const body = (await req.json().catch(() => null)) as { messages?: unknown } | null;
  const messages = sanitizeMessages(body?.messages);
  const last = messages.at(-1);
  if (!last || last.role !== "user") return new Response("Mensaje vacío", { status: 400 });

  const headers = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };
  // Las respuestas de seguridad (urgencias) nunca se bloquean ni gastan cupo.
  const urgent = safetyCheck(last.content, v.country);
  if (urgent) return new Response(textStream(fake(urgent)), { headers });

  // Sin llave de Anthropic: con cuentas reales el coach aún no está listo (no se gasta cupo ni se responden frases de ejemplo);
  // en modo demo se mantienen las respuestas de ejemplo.
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key && !v.demo) return new Response("El coach se está configurando. Vuelve en un rato.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Coach-State": "setup" } });

  // Cupo diario en el servidor: con Supabase, contador atómico que el usuario no puede editar (coach_consume, 0012);
  // en modo demo, límite en memoria por IP. Aplica también al camino sin llave de Anthropic.
  const sb = v.demo ? null : await createClient();
  if (sb) {
    const { data: left, error } = await sb.rpc("coach_consume", { p_kind: "chat" });
    if (error) {
      console.error("[coach] cupo", error.code);
      // Migración 0012 aún sin aplicar (función inexistente): cupo en memoria en vez de apagar el coach.
      if (error.code !== "PGRST202" && error.code !== "42883") return new Response("El coach no está disponible ahora. Intenta en un momento.", { status: 503 });
      if (!memoryRateLimit(`coach:${v.id}`, 40, 24 * 3600_000)) return new Response(textStream(fake(LIMIT_TEXT)), { headers });
    }
    if (typeof left === "number" && left < 0) return new Response(textStream(fake(LIMIT_TEXT)), { headers });
  } else if (!memoryRateLimit(`coach:${clientIp(req)}`, 40, 24 * 3600_000)) {
    return new Response(textStream(fake(LIMIT_TEXT)), { headers });
  }

  if (!key) {
    const a0 = await getAthlete(v);
    return new Response(textStream(fake(demoReply(last.content, a0.name?.split(" ")[0] ?? "", v.country))), { headers });
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
