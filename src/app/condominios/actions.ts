"use server";
// Solicitud de reunión desde /condominios (0052). Pública (sin sesión): Next ya revisa que la acción venga del mismo sitio;
// aquí van el campo trampa, el límite por red (hash, sin guardar la IP), la validación (lib/condominios.ts) y la escritura
// con service_role (la tabla no tiene permisos de escritura por la API). Avisa al equipo y confirma a la persona.
import { headers } from "next/headers";
import { parseLead, roleLabel, timeLabel } from "@/lib/condominios";
import { hitLimit } from "@/lib/security/limits";
import { clientIpFrom } from "@/lib/security/ip";
import { keyPart } from "@/lib/security/db-rate-limit";
import { adminClient } from "@/lib/supabase/admin";
import { sendCondoLeadEmails } from "@/lib/email";
import { errCode, logError } from "@/lib/log";

export type LeadState = { ok: boolean; message: string; at: number } | null;

const fail = (message: string): LeadState => ({ ok: false, message, at: Date.now() });

export async function requestMeeting(_: LeadState, fd: FormData): Promise<LeadState> {
  // Campo trampa: los bots lo llenan. Se responde como si todo saliera bien y no se guarda nada.
  if (String(fd.get("website") ?? "").trim()) return { ok: true, message: "Recibido.", at: Date.now() };
  const f: Record<string, unknown> = {};
  for (const k of ["name", "role", "org", "units", "location", "email", "phone", "days", "comment", "source"]) f[k] = fd.get(k);
  f.times = fd.getAll("times");
  const parsed = parseLead(f);
  if (!parsed.ok) return fail(parsed.error);
  const lead = parsed.lead;

  const ip = clientIpFrom(await headers());
  const lim = await hitLimit("condominios:solicitud", `ip:${ip}`);
  if (!lim.ok) return fail(lim.error);

  const db = adminClient();
  if (!db) {
    // Demo o entorno sin base: el formulario responde igual para poder revisarlo.
    return { ok: true, message: "Recibido (modo demo: no se guardó).", at: Date.now() };
  }
  const { data, error } = await db.from("b2b_leads").insert({
    name: lead.name, role: lead.role, org_name: lead.org, units: lead.units, location: lead.location, email: lead.email,
    phone: lead.phone, times: lead.times, days: lead.days, comment: lead.comment, source: lead.source, ip_hash: keyPart(`b2b:${ip}`),
  }).select("id").single();
  if (error || !data) {
    logError("condominios", "insert_failed", { code: error?.code ?? "sin_fila" });
    return fail("No pudimos enviar tu solicitud. Intenta de nuevo o escríbenos a hola@bananaburn.app.");
  }
  await sendCondoLeadEmails({
    id: data.id as number, name: lead.name, role: roleLabel(lead.role), org: lead.org, units: lead.units, location: lead.location,
    email: lead.email, phone: lead.phone, times: lead.times.map(timeLabel).join(", ") || null, days: lead.days, comment: lead.comment,
  }).catch((e) => logError("condominios", "email_failed", { kind: errCode(e) }));
  return { ok: true, message: "Recibido.", at: Date.now() };
}
