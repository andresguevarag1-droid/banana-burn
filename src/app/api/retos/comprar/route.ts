import { NextResponse } from "next/server";
import { getViewer } from "@/lib/supabase/server";
import { isSameOrigin, memoryRateLimit, singleFlight } from "@/lib/security";
import { BillingError } from "@/lib/billing";
import { startChallengeCheckout } from "@/lib/challenge-purchase";
import { adminClient } from "@/lib/supabase/admin";
import { dbRateLimit } from "@/lib/security/db-rate-limit";
import { errInfo } from "@/lib/security/log";

export const dynamic = "force-dynamic";

/** Inicia la compra de un reto Premium. Body: { slug } -> { url } de nuestra página de pago con el SDK de ONVO. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "Inicia sesión para continuar." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { slug?: unknown };
  const slug = typeof body.slug === "string" && /^[a-z0-9-]{2,60}$/.test(body.slug) ? body.slug : null;
  if (!slug) return NextResponse.json({ ok: false, error: "Reto inválido." }, { status: 400 });
  if (v.demo) return NextResponse.json({ ok: false, demo: true, error: "Modo demo: aquí no se cobra. En la app real pagas con tarjeta en USD." }, { status: 409 });
  // Cada intento crea un cobro en ONVO: límite en memoria (por instancia) y en la base (compartido, 0023).
  if (!memoryRateLimit(`reto-compra:${v.id}`, 10, 10 * 60_000) || !(await dbRateLimit(adminClient(), `reto-compra:${v.id}`, 3600, 20)))
    return NextResponse.json({ ok: false, error: "Demasiados intentos. Espera unos minutos e intenta de nuevo." }, { status: 429 });
  try {
    const { url } = await singleFlight(`reto-compra:${v.id}:${slug}`, () => startChallengeCheckout(v, slug));
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[pagos-retos] checkout", errInfo(e));
    return NextResponse.json({ ok: false, error: "No pudimos iniciar el pago. Intenta de nuevo en un momento." }, { status: 502 });
  }
}
