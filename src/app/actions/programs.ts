"use server";
// Acciones de la persona sobre sus programas. La base (RPC program_* de 0024) valida todo otra vez: sesión, compra,
// acceso a la app, un solo programa activo y la fecha de "hoy". Aquí solo se traducen los errores.
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { todayFor } from "@/lib/today";
import { getEntitlements } from "@/lib/entitlements";
import { getCatalog, getOwned } from "@/lib/challenges-server";
import { getProgramStates } from "@/lib/programs-server";
import { isProgram } from "@/lib/challenges";
import { startPlan } from "@/lib/programs";
import { APP_LOCKED_MSG } from "@/lib/plan-access";

export type ProgramResult = { ok: boolean; demo?: boolean; error?: string; conflict?: { slug: string; title: string }; result?: string };

const SLUG = /^[a-z0-9-]{2,60}$/;

function msg(e: { code?: string; message?: string } | null): string {
  if (!e) return "No pudimos guardar el cambio. Intenta de nuevo.";
  const m = e.message ?? "";
  if (e.code === "42501" && /compra/i.test(m)) return "Compra este programa para empezarlo.";
  if (e.code === "42501" && /plan/i.test(m)) return APP_LOCKED_MSG;
  if (e.code === "P0001" && /activo/i.test(m)) return "Ya tienes un programa activo. Pausa ese primero.";
  if (e.code === "P0001" && /sesiones/i.test(m)) return "Este programa todavía no tiene sesiones.";
  if (e.code === "P0001" && /terminas/i.test(m)) return "Todavía no terminas el programa.";
  if (e.code === "22023") return /fecha/i.test(m) ? "Revisa la fecha y la hora de tu teléfono." : "Este programa ya no está disponible.";
  if (["42883", "PGRST202", "42P01"].includes(e.code ?? "")) return "Los programas todavía no están activos. Intenta más tarde.";
  return "No pudimos guardar el cambio. Intenta de nuevo.";
}

const refresh = (slug: string) => { revalidatePath("/app", "layout"); revalidatePath(`/app/retos/${slug}`); };

/** Empieza, reanuda o reinicia un programa. Con otro activo devuelve `conflict` salvo que `pauseCurrent` sea true. */
export async function startProgram(slug: string, pauseCurrent = false): Promise<ProgramResult> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  if (typeof slug !== "string" || !SLUG.test(slug)) return { ok: false, error: "Este programa ya no está disponible." };
  const [catalog, owned, states, ent] = await Promise.all([getCatalog(v.demo), getOwned(v), getProgramStates(v), getEntitlements(v)]);
  const c = catalog.get(slug);
  if (!c || !isProgram(c)) return { ok: false, error: "Este programa ya no está disponible." };
  if (c.priceUsd > 0 && !owned.has(slug)) return { ok: false, error: "Compra este programa para empezarlo." };
  if (!ent.app) return { ok: false, error: APP_LOCKED_MSG };
  const plan = startPlan(states, slug);
  if (plan.conflict && !pauseCurrent) return { ok: false, conflict: { slug: plan.conflict, title: catalog.get(plan.conflict)?.title ?? "tu programa actual" } };
  if (v.demo) return { ok: true, demo: true, result: plan.action };
  const { data, error } = await (await createClient()).rpc("program_start", { p_slug: slug, p_day: todayFor(v).iso, p_pause_current: pauseCurrent });
  if (error) return error.code === "P0001" && /activo/i.test(error.message ?? "") ? { ok: false, conflict: { slug: plan.conflict ?? "", title: catalog.get(plan.conflict ?? "")?.title ?? "tu programa actual" } } : { ok: false, error: msg(error) };
  refresh(slug);
  return { ok: true, result: String(data ?? plan.action) };
}

export async function pauseProgram(slug: string): Promise<ProgramResult> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  if (typeof slug !== "string" || !SLUG.test(slug)) return { ok: false, error: "Este programa ya no está disponible." };
  if (v.demo) return { ok: true, demo: true };
  const { error } = await (await createClient()).rpc("program_pause", { p_slug: slug, p_day: todayFor(v).iso });
  if (error) return { ok: false, error: error.code === "P0001" ? "Este programa no está activo." : msg(error) };
  refresh(slug);
  return { ok: true };
}

export async function leaveProgram(slug: string): Promise<ProgramResult> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  if (typeof slug !== "string" || !SLUG.test(slug)) return { ok: false, error: "Este programa ya no está disponible." };
  if (v.demo) return { ok: true, demo: true };
  const { error } = await (await createClient()).rpc("program_leave", { p_slug: slug });
  if (error) return { ok: false, error: error.code === "P0001" ? "Este programa ya no está en curso." : msg(error) };
  refresh(slug);
  return { ok: true };
}

export async function finishProgram(slug: string): Promise<ProgramResult> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  if (typeof slug !== "string" || !SLUG.test(slug)) return { ok: false, error: "Este programa ya no está disponible." };
  if (v.demo) return { ok: true, demo: true };
  const { error } = await (await createClient()).rpc("program_finish", { p_slug: slug, p_day: todayFor(v).iso });
  if (error) return { ok: false, error: msg(error) };
  refresh(slug);
  return { ok: true };
}
