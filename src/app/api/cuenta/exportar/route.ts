import { createClient, getViewer } from "@/lib/supabase/server";
import { EXPORT_BY_USER } from "@/lib/account-export";
import { hitLimit, tooManyText } from "@/lib/security/limits";

export const dynamic = "force-dynamic";

/** Derecho de acceso (Ley 8968): descarga todos tus datos en JSON (incluye enlaces temporales a tus fotos). */
export async function GET() {
  const v = await getViewer();
  if (!v) return new Response("No autorizado", { status: 401 });
  // ~30 consultas y enlaces firmados por descarga: tope por persona.
  // Compartido entre instancias (antes solo en memoria, por instancia).
  const lim = await hitLimit("cuenta:exportar", v.id);
  if (!lim.ok) return tooManyText(lim);
  const out: Record<string, unknown> = { exportado: new Date().toISOString(), cuenta: { id: v.id, email: v.email } };
  if (!v.demo) {
    const sb = await createClient();
    const { data: profile } = await sb.from("profiles").select("*").eq("id", v.id);
    out.profiles = profile ?? [];
    for (const t of EXPORT_BY_USER) {
      const { data, error } = await sb.from(t).select("*").eq("user_id", v.id);
      out[t] = error ? { error: "no disponible" } : data ?? [];
    }
    // Tarjeta guardada (0026): solo lo que guardamos y la persona puede leer. El número de la tarjeta lo tiene ONVO.
    const card = await sb.from("payment_methods").select("brand,last4,exp_month,exp_year,status,created_at,updated_at").eq("user_id", v.id);
    out.payment_methods = card.error ? { error: "no disponible" } : card.data ?? [];
    const [fl1, fl2, rp, push] = await Promise.all([
      sb.from("follows").select("*").eq("follower", v.id),
      sb.from("follows").select("*").eq("followee", v.id),
      sb.from("reports").select("id,target_type,target_id,reason,details,status,created_at").eq("reporter", v.id),
      // Sin las llaves criptográficas del navegador: solo qué dispositivos tienen avisos.
      sb.from("push_subscriptions").select("id,user_agent,created_at,last_used_at").eq("user_id", v.id),
    ]);
    out.follows = { sigues: fl1.data ?? [], te_siguen: fl2.data ?? [] };
    out.reports = rp.data ?? [];
    out.push_subscriptions = push.data ?? [];
    // Referidos (0025): a quién invitaste (solo inicial y estado), tus recompensas y lo que guardamos para evitar abusos.
    const [mine, rewards] = await Promise.all([sb.rpc("my_referrals"), sb.from("referral_rewards").select("group_no,months,plan,created_at,upgraded_at,revoked_at").eq("referrer", v.id)]);
    out.referidos = { invitados: mine.data ?? [], recompensas: rewards.data ?? [] };
    // Soporte (0034): la conversación de tus reportes, con los mensajes que puedes leer en la app.
    const msgs = await sb.from("support_messages").select("ticket_id,author_kind,body,created_at").eq("internal", false).order("created_at");
    out.support_messages = msgs.error ? { error: "no disponible" } : msgs.data ?? [];
    out.referral_signals = "Para evitar abusos guardamos una firma (HMAC) del prefijo de tu red al abrir Invita y gana. No guardamos tu IP.";
    out.card_fingerprints = "Si guardaste una tarjeta, guardamos una huella de ella (un resumen sha256 que no se puede revertir) para que la promoción del primer mes sea una por tarjeta. No es el número de tu tarjeta.";
    out.coach_quota_tickets = "Por cada pregunta a Coach Banana guardamos un comprobante interno (fecha, sin el texto) por 2 días, para devolverte la pregunta si la respuesta falla. Tus conteos están en coach_usage.";
    const photos = (out.progress_photos as { path?: string }[] | undefined) ?? [];
    const paths = Array.isArray(photos) ? photos.map((p) => p.path).filter((p): p is string => typeof p === "string") : [];
    if (paths.length) {
      const { data: signed } = await sb.storage.from("progreso").createSignedUrls(paths, 60 * 60);
      out.fotos_enlaces_1h = (signed ?? []).map((s) => ({ path: s.path, url: s.signedUrl }));
    }
  } else out.nota = "Modo demo: no hay datos reales.";
  return new Response(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="banana-burn-mis-datos-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
