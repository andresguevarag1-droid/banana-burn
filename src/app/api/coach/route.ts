import Anthropic from "@anthropic-ai/sdk";
import { getViewer, createClient } from "@/lib/supabase/server";
import { getAthlete } from "@/lib/athlete";
import { getEntitlements } from "@/lib/entitlements";
import { APP_LOCKED_MSG } from "@/lib/plan-access";
import { getProgress } from "@/lib/progress";
import { coachSystemBlocks, demoReply, safetyCheck, sanitizeMessages, stripEmoji } from "@/lib/coach";
import { COACH_MAX_TOKENS, parseQuota, quotaFrom, tierFromAccess, type CoachLimitBody, type CoachQuota } from "@/lib/coach-quota";
import { clientIp, isSameOrigin, memoryRateLimit } from "@/lib/security";
import { hitLimit, tooManyText } from "@/lib/security/limits";
import { AI_BUSY_MSG, addAiUsage, takeAiBudget } from "@/lib/ai-budget";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 64_000;
const MISSING = new Set(["PGRST202", "42883"]);

function textStream(gen: AsyncIterable<string>, onDone?: (full: string, failed: boolean) => Promise<void>) {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(c) {
      let full = "", failed = false;
      try { for await (const raw of gen) { const t = stripEmoji(raw); if (!t) continue; full += t; c.enqueue(enc.encode(t)); } }
      catch (e) {
        failed = true;
        // Al usuario: mensaje genérico. Al log: solo tipo/estado, sin contenido del chat (datos de salud).
        console.error("[coach] stream", e instanceof Anthropic.APIError ? `APIError ${e.status}` : e instanceof Error ? e.name : "error");
        c.enqueue(enc.encode("\n\nSe cortó la respuesta. Intenta de nuevo."));
      }
      c.close();
      if (onDone) await onDone(full, failed).catch(() => {});
    },
  });
}

/** 429 con el detalle del cupo: la pantalla muestra cuándo vuelve el coach (no es un error). */
function limitResponse(q: CoachQuota) {
  const body: CoachLimitBody = { error: "cuota", reason: q.reason === "month" ? "month" : "day", tier: q.tier, left: 0, dayLimit: q.dayLimit, monthLimit: q.monthLimit, resetsAt: q.resetsAt };
  const retry = q.resetsAt ? Math.max(1, Math.ceil((Date.parse(q.resetsAt) - Date.now()) / 1000)) : 3600;
  return Response.json(body, { status: 429, headers: { "Cache-Control": "no-store", "X-Coach-State": "limit", "Retry-After": String(Number.isFinite(retry) ? retry : 3600) } });
}

/** Cupo restante en cabeceras, para que la pantalla actualice el contador sin otra consulta. */
function quotaHeaders(q: CoachQuota | null): Record<string, string> {
  if (!q || q.left === null) return {};
  return { "X-Coach-Left": String(q.left), "X-Coach-Day-Used": String(q.dayUsed), "X-Coach-Month-Used": String(q.monthUsed) };
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
  // El coach es parte del plan (las respuestas de urgencia de arriba nunca se bloquean): sin plan ni prueba vigente no
  // responde ni gasta cupo. coach_take_quota (0032) lo repite en la base.
  const ent = await getEntitlements(v);
  if (!ent.app) return new Response(APP_LOCKED_MSG, { status: 402, headers: { ...headers, "X-Coach-State": "locked" } });

  // Sin llave de Anthropic: con cuentas reales el coach aún no está listo (no se gasta cupo ni se responden frases de ejemplo);
  // en modo demo se mantienen las respuestas de ejemplo.
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key && !v.demo) return new Response("El coach se está configurando. Vuelve en un rato.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Coach-State": "setup" } });
  // Ráfagas (doble envío, scripts): freno compartido por persona antes de tocar el cupo. No gasta preguntas.
  const burst = await hitLimit("coach:chat", v.demo ? `ip:${clientIp(req)}` : v.id);
  if (!burst.ok) return tooManyText(burst);

  // Cupo por plan en el servidor (0032): la base revisa el plan, suma 1 de forma atómica solo si queda cupo y devuelve
  // un ticket para devolver la pregunta si la respuesta falla. Nadie edita su contador por la API.
  // En modo demo no hay costo (respuestas de ejemplo): solo un freno en memoria por IP; la pantalla simula el contador.
  const sb = v.demo ? null : await createClient();
  let quota: CoachQuota | null = null;
  let ticket: string | null = null;
  if (sb) {
    const { data, error } = await sb.rpc("coach_take_quota", { p_kind: "chat" });
    if (error && MISSING.has(error.code ?? "")) {
      // 0032 aún sin aplicar: el cupo diario de antes (coach_consume, 0012/0013) para no apagar el coach.
      const old = await sb.rpc("coach_consume", { p_kind: "chat" });
      if (old.error) {
        console.error("[coach] cupo", old.error.code);
        if (!MISSING.has(old.error.code ?? "")) return new Response("El coach no está disponible ahora. Intenta en un momento.", { status: 503 });
        if (!memoryRateLimit(`coach:${v.id}`, 40, 24 * 3600_000)) return limitResponse(quotaFrom(tierFromAccess(ent), 1e6, 0));
      } else if (typeof old.data === "number" && old.data < 0) return limitResponse(quotaFrom(tierFromAccess(ent), 1e6, 0));
    } else if (error) {
      console.error("[coach] cupo", error.code);
      return new Response("El coach no está disponible ahora. Intenta en un momento.", { status: 503 });
    } else {
      const q = parseQuota(data);
      if (!q) return new Response("El coach no está disponible ahora. Intenta en un momento.", { status: 503 });
      if (q.reason === "locked") return new Response(APP_LOCKED_MSG, { status: 402, headers: { ...headers, "X-Coach-State": "locked" } });
      if (!q.ok) return limitResponse(q);
      quota = q; ticket = q.ticket;
      if (q.tier === "staff") console.info(JSON.stringify({ scope: "coach", msg: "pregunta de staff (sin tope)", day_used: q.dayUsed }));
    }
  } else if (!memoryRateLimit(`coach:${clientIp(req)}`, 40, 24 * 3600_000)) {
    return limitResponse(quotaFrom(tierFromAccess(ent), 1e6, 0));
  }
  const out = { ...headers, ...quotaHeaders(quota) };
  /** Respuesta fallida antes de mandar texto: la pregunta se devuelve (una vez, con el ticket). */
  const refund = async () => {
    if (!sb || !ticket) return;
    const { error } = await sb.rpc("coach_refund_quota", { p_ticket: ticket });
    if (error) console.error("[coach] devolver cupo", error.code);
  };

  // Tope diario global (0040): si se llegó, la pregunta se devuelve a la persona y nadie gasta más hoy.
  if (key && !(await takeAiBudget("chat"))) {
    await refund();
    return new Response(AI_BUSY_MSG, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Coach-State": "busy" } });
  }

  if (!key) {
    const a0 = await getAthlete(v);
    return new Response(textStream(fake(demoReply(last.content, a0.name?.split(" ")[0] ?? "", v.country))), { headers: out });
  }

  const [a, p] = await Promise.all([getAthlete(v), getProgress(v)]);
  // Tiempo límite por debajo de maxDuration: si Anthropic no responde, la persona ve un aviso claro y no un chat colgado.
  const client = new Anthropic({ apiKey: key, timeout: 40_000, maxRetries: 1 });
  let stream: ReturnType<typeof client.messages.stream>;
  try {
    stream = client.messages.stream({
      model: process.env.COACH_MODEL || "claude-sonnet-5-5",
      max_tokens: COACH_MAX_TOKENS,
      // Las reglas (fijas por plan) van en caché; los datos del atleta, aparte.
      system: coachSystemBlocks(a, p.weights, p.workouts, { nutrition: ent.nutrition }),
      messages,
    });
  } catch (e) {
    console.error("[coach] inicio", e instanceof Error ? e.name : "error");
    await refund();
    await addAiUsage("chat", {}, { refund: true });
    return new Response("El coach no está disponible ahora. Intenta en un momento.", { status: 503 });
  }
  const usage = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };
  async function* text() {
    for await (const ev of stream) {
      if (ev.type === "message_start") {
        const u = ev.message.usage;
        usage.in = u.input_tokens; usage.cacheRead = u.cache_read_input_tokens ?? 0; usage.cacheWrite = u.cache_creation_input_tokens ?? 0;
      } else if (ev.type === "message_delta") usage.out = ev.usage.output_tokens;
      else if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text;
    }
  }
  return new Response(textStream(text(), async (full) => {
    // Solo conteos de tokens (sin contenido): para vigilar el costo por pregunta.
    console.info(JSON.stringify({ scope: "coach", msg: "tokens", ...usage, tier: quota?.tier ?? null }));
    // Tope global: se suman los tokens reales; sin texto, la llamada reservada se devuelve.
    await addAiUsage("chat", usage, { refund: !full.trim() && usage.out === 0 });
    if (!full.trim()) { await refund(); return; }
    if (!sb) return;
    await sb.from("coach_messages").insert([{ user_id: v.id, role: "user", content: last.content }, { user_id: v.id, role: "assistant", content: full }]);
  }), { headers: out });
}
