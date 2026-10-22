import { NextResponse } from "next/server";
import { WEBHOOK_HEADER, parseEvent, verifyWebhook } from "@/lib/onvo";
import { processWebhook } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Webhook de ONVO Pay — https://docs.onvopay.com/en/webhooks.md
 * Único camino que otorga planes pagados. Responde 2xx solo si se procesó (o ya estaba procesado);
 * cualquier otro código queda como entrega fallida en ONVO.
 */
export async function POST(req: Request) {
  const secret = process.env.ONVO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[pagos] webhook recibido pero ONVO_WEBHOOK_SECRET no está configurada");
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  if (!verifyWebhook(req.headers.get(WEBHOOK_HEADER), secret)) {
    console.warn("[pagos] webhook rechazado: secreto inválido");
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const raw = await req.text();
  const evt = parseEvent(raw);
  if (!evt) {
    console.warn("[pagos] webhook con cuerpo inválido");
    return NextResponse.json({ ok: false, error: "payload inválido" }, { status: 400 });
  }
  try {
    const r = await processWebhook(evt, raw);
    if (r.status === "error") return NextResponse.json({ ok: false }, { status: 500 });
    return NextResponse.json({ ok: true, result: r.status });
  } catch (e) {
    console.error("[pagos] webhook", evt.type, e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
