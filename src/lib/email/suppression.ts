import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { errCode, logError } from "@/lib/log";

// Correos suprimidos (0072): a quien rebotó o marcó spam no se le vuelve a escribir (decisión del dueño, 15 nov 2026).
// - syncSuppressions (cron de recordatorios, cada hora): lee los envíos recientes de Resend y guarda las direcciones con
//   last_event bounced o complained. Sin webhook ni secretos nuevos: usa la misma RESEND_API_KEY.
// - isSuppressed: sendEmail la consulta antes de cada envío. Si la base no responde, se manda igual (no se cortan los
//   correos de pago por una base lenta); Resend además suprime por su lado los rebotes permanentes.

/** last_event de Resend que suprimen la dirección. */
export const SUPPRESS_EVENTS: Record<string, "bounced" | "complained"> = { bounced: "bounced", complained: "complained" };
const DAY_MS = 864e5;

export type ResendListItem = { id: string; to?: string[] | null; created_at?: string; last_event?: string | null };

/** Direcciones a suprimir de una página de la lista de Resend (puro, para las pruebas). */
export function suppressionsFrom(items: ResendListItem[]): { email: string; reason: "bounced" | "complained" }[] {
  const out = new Map<string, "bounced" | "complained">();
  for (const it of items) {
    const reason = SUPPRESS_EVENTS[String(it.last_event ?? "").toLowerCase()];
    if (!reason) continue;
    for (const to of it.to ?? []) {
      const email = String(to).trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320 && out.get(email) !== "complained") out.set(email, reason);
    }
  }
  return [...out].map(([email, reason]) => ({ email, reason }));
}

/** Lee la lista de envíos de Resend (más nuevos primero) y guarda los rebotes y quejas. Días: 30 si la tabla está vacía, si no 3. */
export async function syncSuppressions(opts: { deadline: number; now?: Date }): Promise<{ pages: number; saved: number } | null> {
  const key = process.env.RESEND_API_KEY, db = adminClient();
  if (!key || !db) return null;
  try {
    const { count } = await db.from("email_suppressions").select("email", { count: "exact", head: true });
    const since = (opts.now ?? new Date()).getTime() - (count ? 3 : 30) * DAY_MS;
    let after: string | undefined, pages = 0, saved = 0;
    while (Date.now() < opts.deadline && pages < 40) {
      const url = `https://api.resend.com/emails?limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5_000), cache: "no-store" });
      if (!res.ok) { logError("email:supresion", `resend_${res.status}`); break; }
      const page = (await res.json().catch(() => ({}))) as { data?: ResendListItem[]; has_more?: boolean };
      const items = page.data ?? [];
      pages++;
      const rows = suppressionsFrom(items);
      if (rows.length) {
        const { error } = await db.from("email_suppressions").upsert(rows, { onConflict: "email", ignoreDuplicates: true });
        if (error) { logError("email:supresion", "upsert_failed"); break; }
        saved += rows.length;
      }
      const last = items.at(-1);
      if (!page.has_more || !last || Date.parse(last.created_at ?? "") < since) break;
      after = last.id;
    }
    return { pages, saved };
  } catch (e) {
    logError("email:supresion", "sync_failed", { kind: errCode(e) });
    return null;
  }
}

/** true si la dirección rebotó o marcó spam. Ante un error de la base devuelve false (se manda igual). */
export async function isSuppressed(to: string): Promise<boolean> {
  const db = adminClient();
  if (!db) return false;
  try {
    const { data, error } = await db.from("email_suppressions").select("email").eq("email", to.trim().toLowerCase()).maybeSingle();
    return !error && Boolean(data);
  } catch {
    return false;
  }
}
