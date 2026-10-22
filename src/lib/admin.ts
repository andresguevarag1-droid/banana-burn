import { createClient, type Viewer } from "@/lib/supabase/server";

export type AdminUser = { id: string; full_name: string | null; role: string; plan: string; onboarded: boolean; created_at: string };

const DEMO_USERS: AdminUser[] = [
  { id: "1", full_name: "Andrés Guevara", role: "superadmin", plan: "pro", onboarded: true, created_at: "2026-10-19T10:00:00Z" },
  { id: "2", full_name: "Usuaria beta 1", role: "free", plan: "free", onboarded: true, created_at: "2026-10-20T15:30:00Z" },
  { id: "3", full_name: "Usuario beta 2", role: "pro", plan: "pro", onboarded: false, created_at: "2026-10-21T08:10:00Z" },
];

export async function adminStats(v: Viewer) {
  if (v.demo) return { users: 3, pro: 2, onboarded: 2, workouts7: 9, weights7: 14 };
  const sb = await createClient();
  const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const c = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const [users, pro, onboarded, workouts7, weights7] = await Promise.all([
    c(sb.from("profiles").select("*", { count: "exact", head: true })),
    c(sb.from("profiles").select("*", { count: "exact", head: true }).neq("plan", "free")),
    c(sb.from("profiles").select("*", { count: "exact", head: true }).eq("onboarded", true)),
    c(sb.from("workouts").select("*", { count: "exact", head: true }).gte("day", since)),
    c(sb.from("weights").select("*", { count: "exact", head: true }).gte("day", since)),
  ]);
  return { users, pro, onboarded, workouts7, weights7 };
}

export async function adminUsers(v: Viewer, q?: string): Promise<AdminUser[]> {
  if (v.demo) return DEMO_USERS.filter((u) => !q || u.full_name?.toLowerCase().includes(q.toLowerCase()));
  const sb = await createClient();
  let query = sb.from("profiles").select("id,full_name,role,plan,onboarded,created_at").order("created_at", { ascending: false }).limit(100);
  if (q) query = query.ilike("full_name", `%${q}%`);
  const { data } = await query;
  return (data as AdminUser[]) ?? [];
}
