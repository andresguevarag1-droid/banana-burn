import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";

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

export type Viewer = { demo: boolean; id: string; email: string; name: string; role: Role; plan: string };

const DEMO: Viewer = { demo: true, id: "demo", email: "demo@bananaburn.app", name: "Andrés", role: "superadmin", plan: "pro" };

/** Usuario actual + perfil. En modo demo devuelve un usuario de ejemplo. */
export async function getViewer(): Promise<Viewer | null> {
  if (!isSupabaseConfigured) return DEMO;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: p } = await sb.from("profiles").select("full_name, role, plan").eq("id", user.id).maybeSingle();
  return { demo: false, id: user.id, email: user.email ?? "", name: p?.full_name || user.email?.split("@")[0] || "atleta", role: (p?.role as Role) ?? "free", plan: p?.plan ?? "free" };
}
