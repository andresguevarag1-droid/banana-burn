import { NextResponse } from "next/server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { cancelSubscription, OnvoError } from "@/lib/onvo";
import { isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "progreso";

/**
 * Derecho de supresión (Ley 8968). Orden:
 *  1. Cancela en ONVO las suscripciones que aún cobran (si falla, NO borramos: el usuario seguiría pagando sin cuenta).
 *  2. Borra todas sus fotos de Storage (carpeta `${uid}/`): Storage no se borra en cascada con auth.users.
 *  3. Borra el usuario en Auth; las tablas públicas caen en cascada (payment_events conserva el registro contable con user_id nulo).
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== "BORRAR") return NextResponse.json({ ok: false, error: "Escribe BORRAR para confirmar." }, { status: 400 });
  if (v.demo) return NextResponse.json({ ok: true, demo: true });
  const admin = adminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "El borrado no está configurado todavía. Escríbenos a hola@bananaburn.app y lo hacemos en 48 h." }, { status: 503 });

  // 1) Suscripciones que todavía pueden cobrar.
  const { data: subs } = await admin.from("subscriptions").select("id,provider_subscription_id,status").eq("user_id", v.id).in("status", ["active", "trialing", "past_due", "incomplete"]);
  for (const s of subs ?? []) {
    if (!s.provider_subscription_id) continue;
    try {
      await cancelSubscription(s.provider_subscription_id as string);
    } catch (e) {
      if (!(e instanceof OnvoError && e.status === 404)) {
        console.error(JSON.stringify({ scope: "cuenta", msg: "no se pudo cancelar en ONVO antes de borrar", userId: v.id, status: e instanceof OnvoError ? e.status : null }));
        return NextResponse.json({ ok: false, error: "No pudimos cancelar tu suscripción con el procesador de pagos. Intenta de nuevo o escríbenos a hola@bananaburn.app." }, { status: 502 });
      }
    }
  }

  // 2) Fotos de progreso (paginado).
  try {
    for (let guard = 0; guard < 50; guard++) {
      const { data: files, error } = await admin.storage.from(BUCKET).list(v.id, { limit: 100 });
      if (error) throw error;
      if (!files?.length) break;
      const { error: rmErr } = await admin.storage.from(BUCKET).remove(files.map((f) => `${v.id}/${f.name}`));
      if (rmErr) throw rmErr;
      if (files.length < 100) break;
    }
  } catch {
    console.error(JSON.stringify({ scope: "cuenta", msg: "no se pudieron borrar las fotos", userId: v.id }));
    return NextResponse.json({ ok: false, error: "No pudimos borrar tus fotos. Intenta de nuevo o escríbenos a hola@bananaburn.app." }, { status: 500 });
  }

  // 3) Cuenta y datos en cascada.
  const { error } = await admin.auth.admin.deleteUser(v.id);
  if (error) {
    console.error(JSON.stringify({ scope: "cuenta", msg: "deleteUser falló", userId: v.id, code: error.status ?? null }));
    return NextResponse.json({ ok: false, error: "No se pudo borrar la cuenta." }, { status: 500 });
  }
  await (await createClient()).auth.signOut().catch(() => {});
  return NextResponse.json({ ok: true });
}
