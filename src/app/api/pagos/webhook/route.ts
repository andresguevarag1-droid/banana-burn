import { NextResponse } from "next/server";
import { WEBHOOK_HEADER, parseEvent, verifyWebhook } from "@/lib/onvo";
import { processWebhook } from "@/lib/billing";
import { errCode, logError, logWarn } from "@/lib/log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Webhook de ONVO Pay: https://docs.onvopay.com/en/webhooks.md
 * Único camino que otorga planes pagados. Responde 2xx solo si se procesó (o ya estaba procesado);
 * cualquier otro código queda como entrega fallida en ONVO.
 */
export async function POST(req: Request) {
  const secret = process.env.ONVO_WEBHOOK_SECRET;
  if (!secret) {
    logError("pagos:webhook", "secret_missing");
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  if (!verifyWebhook(req.headers.get(WEBHOOK_HEADER), secret)) {
    logWarn("pagos:webhook", "bad_secret");
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const raw = await req.text();
  const evt = parseEvent(raw);
  if (!evt) {
    logWarn("pagos:webhook", "bad_payload");
    return NextResponse.json({ ok: false, error: "payload inválido" }, { status: 400 });
  }
  try {
    const r = await processWebhook(evt, raw);
    if (r.status === "error") { logError("pagos:webhook", "process_error", { type: evt.type.slice(0, 60) }); return NextResponse.json({ ok: false }, { status: 500 }); }
    return NextResponse.json({ ok: true, result: r.status });
  } catch (e) {
    logError("pagos:webhook", "exception", { type: evt.type.slice(0, 60), kind: errCode(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
