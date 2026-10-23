"use server";
import { after } from "next/server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { feedbackError, feedbackPage, FEEDBACK_KIND_LABEL, type FeedbackKind } from "@/lib/testers";
import { sendFeedbackToTeam } from "@/lib/email";
import { errCode, logError } from "@/lib/log";

/** La persona cerró la bienvenida de tester: no se vuelve a mostrar (tester_mark_seen, 0029: solo sus filas). */
export async function markTesterSeen(): Promise<{ ok: boolean }> {
  const v = await getViewer();
  if (!v) return { ok: false };
  if (v.demo) return { ok: true };
  const { error } = await (await createClient()).rpc("tester_mark_seen");
  return { ok: !error };
}

export type FeedbackState = { ok: boolean; message: string; at?: number } | null;

/**
 * "Reportar algo" desde la app. La base decide si viene de un tester (submit_feedback, 0029) y limita a 10 por día.
 * El equipo recibe un aviso por correo después de responder (si hay Resend configurado).
 */
export async function sendFeedback(_: FeedbackState, fd: FormData): Promise<FeedbackState> {
  const v = await getViewer();
  if (!v) return { ok: false, message: "Tu sesión expiró. Vuelve a entrar.", at: Date.now() };
  const kind = String(fd.get("kind") ?? "");
  const body = String(fd.get("body") ?? "").slice(0, 2000);
  const err = feedbackError(kind, body);
  if (err) return { ok: false, message: err, at: Date.now() };
  const page = feedbackPage(String(fd.get("page") ?? ""));
  if (v.demo) return { ok: true, message: "Gracias, lo recibimos. (Modo demo: no se guardó.)", at: Date.now() };
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("submit_feedback", { p_kind: kind, p_body: body.trim(), p_page: page });
    if (error) {
      if (error.code === "P0001" && error.message) return { ok: false, message: error.message, at: Date.now() };
      if (["PGRST202", "42883", "42P01"].includes(error.code ?? "")) return { ok: false, message: "Los reportes todavía no están activos. Escríbenos a hola@bananaburn.app.", at: Date.now() };
      logError("reportes", "submit_failed", { code: error.code });
      return { ok: false, message: "No se pudo enviar. Intenta de nuevo en un momento.", at: Date.now() };
    }
    const id = Number(data);
    const { data: row } = await sb.from("feedback_reports").select("from_tester").eq("id", id).maybeSingle();
    after(() => sendFeedbackToTeam({ reportId: id, userId: v.id, name: v.name, email: v.email, kind: FEEDBACK_KIND_LABEL[kind as FeedbackKind], body: body.trim(), page, tester: !!row?.from_tester }).then(() => {}, () => {}));
    return { ok: true, message: "Gracias, lo recibimos. Lo revisamos y, si hace falta, te escribimos.", at: Date.now() };
  } catch (e) {
    logError("reportes", "submit_failed", { kind: errCode(e) });
    return { ok: false, message: "No se pudo enviar. Intenta de nuevo en un momento.", at: Date.now() };
  }
}
