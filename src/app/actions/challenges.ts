"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { todayFor } from "@/lib/today";
import { getEntitlements } from "@/lib/entitlements";
import { APP_LOCKED_MSG } from "@/lib/plan-access";
import { MAX_ACTIVE, openState } from "@/lib/challenges";
import { NUTRITION_LOCKED_MSG, challengeNeedsNutrition } from "@/lib/plan-access";
import { closeDecidedChallenges, creditChallenges, getCatalog, getOwned } from "@/lib/challenges-server";

export type JoinResult = { ok: boolean; demo?: boolean; error?: string };

/** Errores de la base de datos → mensajes para la persona (sin códigos). */
function joinError(e: { code?: string; message?: string } | null): string {
  if (!e) return "No pudimos unirte. Intenta de nuevo.";
  if (e.code === "23505") return "Ya estás en este reto.";
  if (e.code === "P0001" && /máximo|maximo/i.test(e.message ?? "")) return `Máximo ${MAX_ACTIVE} retos a la vez. Termina o abandona uno para empezar otro.`;
  if (e.code === "P0001" && /suspendid/i.test(e.message ?? "")) return "Tu cuenta tiene la comunidad pausada. Escríbenos si crees que es un error.";
  if (e.code === "42501" && /compra/i.test(e.message ?? "")) return "Compra este reto para empezarlo.";
  if (e.code === "P0001" && /abre|cerr/i.test(e.message ?? "")) return "Este reto todavía no abre o ya cerró inscripciones.";
  if (e.code === "42501") return "Tu plan no incluye retos ahora mismo. Revisa tu suscripción.";
  if (e.code === "22023") return "Ese reto ya no está disponible.";
  return "No pudimos unirte. Intenta de nuevo.";
}

export async function joinChallenge(id: string): Promise<JoinResult> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  if (typeof id !== "string" || id.length > 60) return { ok: false, error: "Ese reto ya no está disponible." };
  const catalog = await getCatalog(v.demo);
  const c = catalog.get(id);
  if (!c || c.status !== "publicado") return { ok: false, error: "Ese reto ya no está disponible." };
  const open = openState(c, todayFor(v).iso);
  if (open !== "abierto") return { ok: false, error: open === "pronto" ? "Este reto todavía no abre inscripciones." : "Este reto ya cerró inscripciones." };
  // Retos de pago: solo con compra confirmada por el webhook o cortesía (la base lo vuelve a exigir).
  if (c.priceUsd > 0 && !(await getOwned(v)).has(id)) return { ok: false, error: "Compra este reto para empezarlo." };
  if (v.demo) return { ok: true, demo: true };
  const ent = await getEntitlements(v);
  if (c.priceUsd === 0 && !ent.app) return { ok: false, error: "Tu plan no incluye retos ahora mismo. Revisa tu suscripción." };
  // Retos que se miden con la meta de proteína: necesitan el registro de comidas de Entreno + Nutrición.
  if (challengeNeedsNutrition(c) && !ent.nutrition) return { ok: false, error: NUTRITION_LOCKED_MSG };
  // Los retos ya decididos (completados, fallidos o vencidos) liberan su lugar antes de contar.
  await closeDecidedChallenges(v);
  const sb = await createClient();
  const { count } = await sb.from("user_challenges").select("*", { count: "exact", head: true }).eq("user_id", v.id).eq("status", "activo");
  if ((count ?? 0) >= MAX_ACTIVE) return { ok: false, error: `Máximo ${MAX_ACTIVE} retos a la vez. Termina o abandona uno para empezar otro.` };
  const { error } = await sb.from("user_challenges").insert({ user_id: v.id, challenge_id: id, started_on: todayFor(v).iso });
  if (error) return { ok: false, error: joinError(error) };
  await creditChallenges(v).catch(() => null);
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function checkInChallenge(ucId: string): Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  if (v.demo) return { ok: true, demo: true };
  if (!(await getEntitlements(v)).app) return { ok: false, error: APP_LOCKED_MSG };
  const n = Number(ucId);
  if (!Number.isSafeInteger(n) || n <= 0) return { ok: false };
  const sb = await createClient();
  const { data: uc } = await sb.from("user_challenges").select("id,challenge_id").eq("id", n).eq("user_id", v.id).eq("status", "activo").maybeSingle();
  const c = uc ? (await getCatalog(false)).get(uc.challenge_id as string) : undefined;
  if (!uc || c?.verify !== "manual") return { ok: false, error: "Este reto se marca solo con tus registros." };
  // La RLS (0013) solo acepta el día de hoy y retos manuales activos.
  const { data: added, error } = await sb.from("challenge_checkins").upsert({ user_challenge_id: uc.id, user_id: v.id, day: todayFor(v).iso }, { onConflict: "user_challenge_id,day", ignoreDuplicates: true }).select("day");
  if (error) return { ok: false, error: "No pudimos marcar el día. Intenta de nuevo." };
  // XP solo la primera vez del día.
  if (added?.length) await sb.from("xp_events").insert({ user_id: v.id, kind: "challenge_day", xp: 10 });
  await creditChallenges(v).catch(() => null);
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function leaveChallenge(ucId: string): Promise<{ ok: boolean; error?: string }> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  if (v.demo) return { ok: true };
  const n = Number(ucId);
  if (!Number.isSafeInteger(n) || n <= 0) return { ok: false };
  const sb = await createClient();
  const { data, error } = await sb.from("user_challenges").update({ status: "abandonado" }).eq("id", n).eq("user_id", v.id).eq("status", "activo").select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos salir del reto. Intenta de nuevo." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

/**
 * Persiste lo que la pantalla ya muestra: si hoy cumpliste un reto automático, lo acredita y cierra los retos decididos.
 * La llama la tarjeta del reto (una vez al día por navegador); el render del servidor nunca escribe.
 */
export async function syncChallenges(): Promise<{ ok: boolean; changed: boolean }> {
  const v = await getViewer();
  if (!v || v.demo) return { ok: true, changed: false };
  const r = await creditChallenges(v).catch(() => null);
  const changed = !!r && (r.credited > 0 || r.closed.length > 0);
  if (changed) revalidatePath("/app", "layout");
  return { ok: !!r, changed };
}
