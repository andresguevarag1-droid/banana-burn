import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isDemoMode, isSupabaseConfigured } from "@/lib/env";
import { DEFAULT_TZ, validTz } from "@/lib/today";

export async function createClient() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* Server Component: lo maneja el middleware */ }
      },
    },
  });
}

export type Role = "free" | "pro" | "coach" | "support" | "admin" | "superadmin";
export const STAFF: Role[] = ["coach", "support", "admin", "superadmin"];

export type Viewer = { demo: boolean; id: string; email: string; name: string; role: Role; plan: string; onboarded: boolean; /** Zona horaria IANA del usuario (cookie bb_tz que pone el navegador). */ tz: string; /** País (ISO 2 letras) elegido en la bienvenida. */ country: string | null };

const DEMO: Omit<Viewer, "tz"> = { demo: true, id: "demo", email: "demo@bananaburn.app", name: "Andrés", role: "superadmin", plan: "pro", onboarded: true, country: "CR" };

/** Zona horaria del navegador del usuario (la escribe <TzSync /> en una cookie). */
async function viewerTz() {
  const raw = (await cookies()).get("bb_tz")?.value;
  const tz = raw ? decodeURIComponent(raw) : null;
  return validTz(tz) ? tz : DEFAULT_TZ;
}

/** Usuario actual + perfil. En modo demo devuelve un usuario de ejemplo. */
export async function getViewer(): Promise<Viewer | null> {
  if (!isSupabaseConfigured) return isDemoMode ? { ...DEMO, tz: await viewerTz() } : null; // producción sin llaves: falla cerrada
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: p } = await sb.from("profiles").select("full_name, role, plan, onboarded, country").eq("id", user.id).maybeSingle();
  return { demo: false, id: user.id, email: user.email ?? "", name: p?.full_name || user.email?.split("@")[0] || "atleta", role: (p?.role as Role) ?? "free", plan: p?.plan ?? "free", onboarded: Boolean(p?.onboarded), tz: await viewerTz(), country: p?.country ?? null };
}
