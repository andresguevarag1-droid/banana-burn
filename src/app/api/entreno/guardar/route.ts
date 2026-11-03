import { isSameOrigin } from "@/lib/security";
import { after } from "next/server";
import { saveWorkout } from "@/app/(app)/app/entreno/actions";
import { getViewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 32_768;
const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Guardado del primer entreno a medias al cerrar la pestaña o la app (#246), con navigator.sendBeacon desde el reproductor:
 * una acción del servidor no alcanza a salir cuando la página se cierra. Es la misma acción de guardar (sesión, límite,
 * plan, validación y doble envío por hora de inicio), así que el reintento de la bandeja del teléfono no lo cuenta dos veces.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ ok: false, error: "Origen no permitido." }, 403);
  const text = await req.text().catch(() => "");
  if (!text || text.length > MAX_BODY) return json({ ok: false, error: "Entreno inválido." }, text ? 413 : 400);
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return json({ ok: false, error: "JSON inválido." }, 400); }
  if (!raw || typeof raw !== "object") return json({ ok: false, error: "Entreno inválido." }, 400);
  const input = raw as Parameters<typeof saveWorkout>[0];
  const res = await saveWorkout(input);
  // El navegador ya cerró y no ve la respuesta: el evento del embudo (0061) se registra aquí, solo si es nuevo.
  if (res.ok && !res.already && !res.demo && new URL(req.url).searchParams.get("parcial") === "1") {
    const v = await getViewer();
    if (v) after(async () => {
      const r = await adminClient()?.from("funnel_events").insert({ user_id: v.id, name: "workout_saved", path: null, props: { first_session: true, partial: true, template: String(input.template).slice(0, 40), done: input.exercises.reduce((a, e) => a + e.sets.length, 0), beacon: true } });
      if (r?.error && r.error.code !== "42P01") console.warn(JSON.stringify({ kind: "funnel_persist", code: r.error.code }));
    });
  }
  return json(res, res.ok ? 200 : 400);
}
