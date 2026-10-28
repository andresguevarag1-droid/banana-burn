"use server";
// Avisos al dueño (0059): preferencias propias y botón de prueba. Solo superadmin ("alerts.manage"), verificado en el
// servidor; la base lo vuelve a exigir con RLS (admin_notify_prefs: solo la fila propia y solo superadmin).
import { revalidatePath } from "next/cache";
import { DEMO_MSG, audit, fail, ok, run } from "@/lib/admin-action-kit";
import type { ActionState } from "@/app/admin/actions";
import { adminClient } from "@/lib/supabase/admin";
import { hasDevices, loadDevices, sendPush } from "@/lib/push";
import { sendEmail } from "@/lib/email/send";
import { avisoAdmin } from "@/lib/email/templates";
import { ALERT_KINDS, alertText, isAlertKind, normalizePrefs, type AdminEvent, type Prefs } from "@/lib/admin-avisos";
import { limitError } from "@/lib/security/limits";

export async function saveAlertPrefs(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("alerts.manage", fd, async ({ v, sb }) => {
    const kinds = fd.getAll("kinds").map(String).filter(isAlertKind);
    const prefs: Prefs = {
      push: fd.get("push") === "on",
      email: fd.get("email") === "on",
      email_mode: fd.get("email_mode") === "instante" ? "instante" : "resumen",
      in_app: fd.get("in_app") === "on",
      daily_summary: fd.get("daily_summary") === "on",
      kinds: ALERT_KINDS.filter((k) => kinds.includes(k)),
    };
    if (!sb) return ok(`Guardado${DEMO_MSG}`);
    const { error } = await sb.from("admin_notify_prefs").upsert({ user_id: v.id, ...prefs, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) return fail(["42P01", "PGRST205"].includes(error.code ?? "") ? "Falta aplicar la migración 0059_avisos_admin.sql en Supabase." : "No se pudo guardar.");
    await audit(sb, v, "avisos.preferencias", v.id, { push: prefs.push, email: prefs.email, email_mode: prefs.email_mode, kinds: prefs.kinds.length });
    revalidatePath("/admin/notificaciones");
    return ok("Guardado. Así te van a llegar los avisos.");
  });
}

/** Manda un aviso de prueba solo a quien lo pide, por los canales que tenga encendidos, y dice qué llegó. */
export async function testAlert(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("alerts.manage", fd, async ({ v, sb }) => {
    if (!sb) return ok(`Prueba enviada${DEMO_MSG}`);
    const lim = await limitError("admin", `aviso-prueba:${v.id}`);
    if (lim) return fail(lim);
    const db = adminClient();
    if (!db) return fail("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
    const { data: row } = await sb.from("admin_notify_prefs").select("push,email,email_mode,in_app,daily_summary,kinds").eq("user_id", v.id).maybeSingle();
    const p = normalizePrefs(row as Partial<Prefs> | null);
    const ev: AdminEvent = { id: 0, event_key: "prueba", kind: "prueba", user_id: null, amount_minor: null, currency: null, data: {}, created_at: new Date().toISOString() };
    const t = alertText(ev, null);
    const parts: string[] = [];
    if (p.push) {
      const d = (await loadDevices(db, [v.id])).get(v.id);
      const n = hasDevices(d) ? await sendPush(db, d!, { title: t.title, body: t.body, url: t.url, tag: `aviso-prueba-${Date.now()}` }) : 0;
      parts.push(n ? `push a ${n} ${n === 1 ? "dispositivo" : "dispositivos"}` : "push: ningún dispositivo con avisos activos (actívalos arriba en este teléfono)");
    }
    if (p.in_app) {
      const { error } = await db.from("notifications").insert({ user_id: v.id, kind: "aviso_admin", title: t.title, body: t.body, url: t.url });
      parts.push(error ? "campanita: no se pudo" : "campanita de la app");
    }
    if (p.email && v.email) {
      const r = await sendEmail(v.email, avisoAdmin({ title: t.title, body: t.body, url: t.url }), { idempotencyKey: `aviso-prueba/${v.id}/${Math.floor(Date.now() / 60_000)}`, tags: { kind: "aviso_admin" } });
      parts.push(r.ok ? "correo" : r.skipped ? "correo: sin proveedor configurado" : "correo: no se pudo");
    }
    return parts.length ? ok(`Prueba enviada: ${parts.join(", ")}.`) : fail("Tienes todos los canales apagados. Enciende al menos uno y guarda.");
  });
}
