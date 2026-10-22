import { createClient, getViewer } from "@/lib/supabase/server";
import { memoryRateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

/** Tablas con columna user_id (todas con RLS "propio"). */
const BY_USER = [
  "goals", "weights", "measurements", "daily_logs", "meals", "workouts", "workout_sets", "coach_messages", "xp_events", "coach_usage",
  "subscriptions", "billing_customers", "payment_events", "comp_grants",
  "notification_prefs", "notification_log", "saved_foods", "user_recipes", "notifications", "progress_photos",
  "user_challenges", "challenge_checkins", "posts", "comments", "kudos",
] as const;

/** Derecho de acceso (Ley 8968): descarga todos tus datos en JSON (incluye enlaces temporales a tus fotos). */
export async function GET() {
  const v = await getViewer();
  if (!v) return new Response("No autorizado", { status: 401 });
  // ~25 consultas y enlaces firmados por descarga: tope por persona.
  if (!memoryRateLimit(`exportar:${v.id}`, 6, 3600_000)) return new Response("Ya descargaste tus datos varias veces. Intenta en una hora.", { status: 429, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "3600" } });
  const out: Record<string, unknown> = { exportado: new Date().toISOString(), cuenta: { id: v.id, email: v.email } };
  if (!v.demo) {
    const sb = await createClient();
    const { data: profile } = await sb.from("profiles").select("*").eq("id", v.id);
    out.profiles = profile ?? [];
    for (const t of BY_USER) {
      const { data, error } = await sb.from(t).select("*").eq("user_id", v.id);
      out[t] = error ? { error: "no disponible" } : data ?? [];
    }
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
