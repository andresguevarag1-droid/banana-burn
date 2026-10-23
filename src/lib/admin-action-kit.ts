// Utilidades de las acciones del panel (solo servidor, NO es un módulo "use server": nada de aquí se expone al cliente).
// Mismo patrón que src/app/admin/actions.ts: autoriza en el servidor, valida, muta con el cliente del usuario (RLS/RPC
// revalidan) y escribe public.audit_log.
import "server-only";
import { errCode, logError } from "@/lib/log";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { authorize } from "@/lib/admin-auth";
import type { Capability } from "@/lib/admin-perms";
import { ValidationError } from "@/lib/admin-validate";
import type { ActionState } from "@/app/admin/actions";

export type SB = Awaited<ReturnType<typeof createClient>>;
export type Ctx = { v: Viewer; sb: SB | null };

export const ok = (message: string): ActionState => ({ ok: true, message, at: Date.now() });
export const fail = (message: string): ActionState => ({ ok: false, message, at: Date.now() });
export const DEMO_MSG = " (modo demo: no se guardó)";

export async function run(cap: Capability, fd: FormData, fn: (ctx: Ctx, fd: FormData) => Promise<ActionState>): Promise<ActionState> {
  const auth = await authorize(cap);
  if (!auth.ok) return fail(auth.error);
  try {
    return await fn({ v: auth.v, sb: auth.v.demo ? null : await createClient() }, fd);
  } catch (e) {
    if (e instanceof ValidationError) return fail(e.message);
    logError("admin-retos", "action_failed", { kind: errCode(e) });
    return fail("No se pudo completar la acción. Intenta de nuevo.");
  }
}

export function pgMessage(e: { code?: string; message?: string } | null): string {
  if (!e) return "Error de base de datos.";
  if (e.code === "42501") return "La base de datos rechazó la acción: permisos insuficientes.";
  if (e.code === "23505") return "Ya existe un reto con ese identificador.";
  if (["42P01", "PGRST202", "PGRST205", "42883", "42703", "PGRST204"].includes(e.code ?? "")) return "Falta aplicar la migración 0018_tienda_retos.sql en Supabase.";
  if (e.code === "P0001" && e.message) return e.message;
  if (e.code === "23514") return "Algún valor no cumple las reglas de la base de datos (precio, minutos, comodines o XP).";
  return "Error de base de datos.";
}

export async function audit(sb: SB, v: Viewer, action: string, target: string, meta: Record<string, unknown> = {}) {
  const { error } = await sb.from("audit_log").insert({ actor: v.id, action, target, meta });
  if (error) logError("audit", "insert_failed", { code: error.code });
  return !error;
}
