import { cache } from "react";
import { cookies } from "next/headers";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { DEFAULT_VOICE, parseVoice, type Voice } from "@/lib/voice";

/** Cookie del modo demo: ?lenguaje=basico|intermedio|tecnico (la pone el middleware o el selector del perfil). */
export const DEMO_VOICE_COOKIE = "bb_demo_lenguaje";

/**
 * Registro del lenguaje de quien mira ("Cómo te hablo", 0035). Nunca rompe la pantalla:
 * sin la columna (0035 sin correr) o con un error, se usa el intermedio.
 */
export const getVoice = cache(async function getVoice(v: Viewer): Promise<Voice> {
  if (v.demo) return parseVoice((await cookies()).get(DEMO_VOICE_COOKIE)?.value);
  try {
    const sb = await createClient();
    const { data, error } = await sb.from("profiles").select("lenguaje").eq("id", v.id).maybeSingle();
    if (error) return DEFAULT_VOICE;
    return parseVoice(data?.lenguaje);
  } catch {
    return DEFAULT_VOICE;
  }
});
