"use server";
// Opinión del tercer entreno (#238, 0065). Escribe con el cliente de la persona: RLS deja solo la propia y una por cuenta.
import { getViewer, createClient } from "@/lib/supabase/server";
import { parseTestimonial } from "@/lib/testimonials";
import { limitError } from "@/lib/security/limits";
import { errCode, logError } from "@/lib/log";

export type TestimonialResult = { ok: boolean; error?: string };

const FAILED = "No pudimos guardar tu opinión. Intenta de nuevo.";

export async function sendTestimonial(raw: unknown): Promise<TestimonialResult> {
  try {
    const v = await getViewer();
    if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
    const input = parseTestimonial(raw);
    if (!input) return { ok: false, error: "Elige de 1 a 5 estrellas (el texto llega hasta 200 caracteres)." };
    if (v.demo) return { ok: true };
    const lim = await limitError("testimonio", v.id);
    if (lim) return { ok: false, error: lim };
    const sb = await createClient();
    const { error } = await sb.from("testimonials").insert({ stars: input.stars, text: input.text, publish_ok: input.publishOk });
    // Ya la había dejado (otra pestaña, doble toque): la primera manda.
    if (error && error.code !== "23505") { logError("testimonio", "insert_failed", { code: error.code }); return { ok: false, error: FAILED }; }
    return { ok: true };
  } catch (e) {
    logError("testimonio", "insert_failed", { kind: errCode(e) });
    return { ok: false, error: FAILED };
  }
}
