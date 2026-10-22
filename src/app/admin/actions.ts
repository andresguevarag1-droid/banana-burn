"use server";
// Mutaciones del panel. Cada acción: (1) valida la sesión y el rol en el servidor, (2) valida la entrada a mano,
// (3) muta con el cliente del usuario (RLS / RPC SECURITY DEFINER vuelven a validar), (4) escribe public.audit_log.
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient, type Role, type Viewer } from "@/lib/supabase/server";
import { authorize, DEMO_ROLE_COOKIE, getAdminViewer } from "@/lib/admin-auth";
import { checkRoleChange, ROLES, STAFF_ROLES, type Capability } from "@/lib/admin-perms";
import * as val from "@/lib/admin-validate";
import { ValidationError } from "@/lib/admin-validate";
import { EX } from "@/lib/engine/data";
import { FOODS } from "@/lib/foods";
import { demoWorld } from "@/lib/admin-demo";
import { fmtDate } from "@/lib/admin-format";

export type ActionState = { ok: boolean; message: string; at?: number } | null;

const ok = (message: string): ActionState => ({ ok: true, message, at: Date.now() });
const fail = (message: string): ActionState => ({ ok: false, message, at: Date.now() });
const DEMO_MSG = " (modo demo: no se guardó)";

type SB = Awaited<ReturnType<typeof createClient>>;
type Ctx = { v: Viewer; sb: SB | null };

/** Envoltorio común: autoriza, captura validaciones y traduce errores de Postgres. */
async function run(cap: Capability, fd: FormData, fn: (ctx: Ctx, fd: FormData) => Promise<ActionState>): Promise<ActionState> {
  const auth = await authorize(cap);
  if (!auth.ok) return fail(auth.error);
  try {
    return await fn({ v: auth.v, sb: auth.v.demo ? null : await createClient() }, fd);
  } catch (e) {
    if (e instanceof ValidationError) return fail(e.message);
    console.error("[admin action]", e);
    return fail("No se pudo completar la acción. Intenta de nuevo.");
  }
}

function pgMessage(e: { code?: string; message?: string } | null): string | null {
  if (!e) return null;
  if (e.code === "42501") return "La base de datos rechazó la acción: permisos insuficientes.";
  if (e.code === "23505") return "Ya existe un registro con ese identificador.";
  if (["42P01", "PGRST202", "PGRST205", "42883"].includes(e.code ?? "")) return "Falta aplicar la migración 0005_admin.sql en Supabase.";
  if (e.code === "P0001" && e.message) return e.message; // raise exception de nuestras funciones (mensajes en español)
  if (e.code === "23514") return "Algún valor no cumple las reglas de la base de datos.";
  return "Error de base de datos.";
}

async function audit(sb: SB, v: Viewer, action: string, target: string, meta: Record<string, unknown> = {}) {
  const { error } = await sb.from("audit_log").insert({ actor: v.id, action, target, meta });
  if (error) console.error("[audit]", error);
  return !error;
}

const confirmed = (fd: FormData) => {
  if (!val.bool(fd, "confirm")) throw new ValidationError("Confirma la acción marcando la casilla.");
};

// ─────────── Usuarios ───────────

export async function changeRole(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.role", fd, async ({ v, sb }) => {
    const target = val.id(fd, "target", { uuid: true, label: "Usuario" });
    const newRole = val.oneOf<Role>(fd, "role", ROLES, { label: "Rol" });
    const reason = val.text(fd, "reason", { label: "Motivo", required: true, min: 4, max: 300 });
    confirmed(fd);
    let targetRole: Role;
    if (!sb) targetRole = demoWorld().users.find((u) => u.id === target)?.role ?? "free";
    else {
      const { data } = await sb.from("profiles").select("role").eq("id", target).maybeSingle();
      if (!data) return fail("Usuario no encontrado.");
      targetRole = data.role as Role;
    }
    const check = checkRoleChange({ actorId: v.id, actorRole: v.role, targetId: target, targetRole, newRole });
    if (!check.ok) return fail(check.error);
    if (!sb) return ok(`Rol cambiado a ${newRole}${DEMO_MSG}`);
    const { error } = await sb.rpc("admin_set_role", { p_target: target, p_role: newRole, p_reason: reason });
    if (error) return fail(pgMessage(error)!);
    revalidatePath(`/admin/usuarios/${target}`);
    revalidatePath("/admin/usuarios");
    return ok(`Rol cambiado a ${newRole}. Quedó en auditoría.`);
  });
}

export async function grantComp(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.comp", fd, async ({ sb }) => {
    const target = val.id(fd, "target", { uuid: true, label: "Usuario" });
    const plan = val.oneOf(fd, "plan", ["entreno", "completo"] as const, { label: "Plan" });
    const expires = val.date(fd, "expires", { label: "Vencimiento", required: true })!;
    const reason = val.text(fd, "reason", { label: "Motivo", required: true, min: 4, max: 300 });
    const t = Date.parse(expires);
    if (t <= Date.now()) return fail("El vencimiento debe ser una fecha futura.");
    if (t > Date.now() + 366 * 864e5) return fail("Una cortesía puede durar máximo 1 año.");
    if (!sb) return ok(`Cortesía otorgada hasta ${fmtDate(expires)}${DEMO_MSG}`);
    const { error } = await sb.rpc("admin_grant_comp", { p_target: target, p_plan: plan, p_expires: expires, p_reason: reason });
    if (error) return fail(pgMessage(error)!);
    revalidatePath(`/admin/usuarios/${target}`);
    return ok(`Cortesía otorgada hasta ${fmtDate(expires)}.`);
  });
}

export async function revokeComp(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.comp", fd, async ({ sb }) => {
    const target = val.id(fd, "target", { uuid: true, label: "Usuario" });
    const grant = val.int(fd, "grant", { required: true, min: 1, label: "Cortesía" })!;
    confirmed(fd);
    if (!sb) return ok(`Cortesía revocada${DEMO_MSG}`);
    const { error } = await sb.rpc("admin_revoke_comp", { p_grant: grant, p_reason: val.text(fd, "reason", { max: 300 }) || null });
    if (error) return fail(pgMessage(error)!);
    revalidatePath(`/admin/usuarios/${target}`);
    return ok("Cortesía revocada y plan restaurado.");
  });
}

export async function resetOnboarding(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.onboarding", fd, async ({ sb }) => {
    const target = val.id(fd, "target", { uuid: true, label: "Usuario" });
    const reason = val.text(fd, "reason", { label: "Motivo", required: true, min: 4, max: 300 });
    confirmed(fd);
    if (!sb) return ok(`Bienvenida reiniciada${DEMO_MSG}`);
    const { error } = await sb.rpc("admin_reset_onboarding", { p_target: target, p_reason: reason });
    if (error) return fail(pgMessage(error)!);
    revalidatePath(`/admin/usuarios/${target}`);
    return ok("Bienvenida reiniciada: el usuario la verá en su próximo ingreso.");
  });
}

// ─────────── Contenido: ejercicios ───────────

export async function saveExercise(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("content.exercises", fd, async ({ v, sb }) => {
    const exercise_id = val.id(fd, "exercise_id", { label: "Ejercicio" });
    if (!(exercise_id in EX)) return fail("Ese ejercicio no existe en el motor.");
    const name = val.text(fd, "name", { label: "Nombre", max: 80 }) || null;
    const cues = val.lines(fd, "cues", { max: 8, maxLen: 140 });
    const enabled = val.bool(fd, "enabled");
    if (!sb) return ok(`Ejercicio guardado${DEMO_MSG}`);
    const { error } = await sb.from("exercise_overrides").upsert({ exercise_id, name, cues, enabled, updated_by: v.id, updated_at: new Date().toISOString() });
    if (error) return fail(pgMessage(error)!);
    await audit(sb, v, "exercise.update", `exercise:${exercise_id}`, { name, cues: cues.length, enabled });
    revalidatePath("/admin/contenido");
    return ok("Ejercicio guardado.");
  });
}

export async function resetExercise(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("content.exercises", fd, async ({ v, sb }) => {
    const exercise_id = val.id(fd, "exercise_id", { label: "Ejercicio" });
    if (!sb) return ok(`Ejercicio restaurado al original${DEMO_MSG}`);
    const { error } = await sb.from("exercise_overrides").delete().eq("exercise_id", exercise_id);
    if (error) return fail(pgMessage(error)!);
    await audit(sb, v, "exercise.reset", `exercise:${exercise_id}`);
    revalidatePath("/admin/contenido");
    return ok("Ejercicio restaurado al original.");
  });
}

// ─────────── Contenido: alimentos ───────────

const FOOD_GROUPS = ["tica", "prot", "carb", "fruta", "bebida", "rapida", "extra"] as const;

export async function saveFood(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("content.foods", fd, async ({ v, sb }) => {
    const id = val.int(fd, "id", { min: 1 });
    const row = {
      name: val.text(fd, "name", { label: "Nombre", required: true, min: 2, max: 80 }),
      portion: val.text(fd, "portion", { label: "Porción", max: 40 }) || null,
      kcal: val.int(fd, "kcal", { label: "Kcal", required: true, min: 0, max: 5000 }),
      protein: val.num(fd, "protein", { label: "Proteína", min: 0, max: 500 }) ?? 0,
      carbs: val.num(fd, "carbs", { label: "Carbohidratos", min: 0, max: 500 }) ?? 0,
      fat: val.num(fd, "fat", { label: "Grasa", min: 0, max: 500 }) ?? 0,
      country: (val.text(fd, "country", { max: 2 }) || "CR").toUpperCase(),
      grp: val.oneOf(fd, "grp", FOOD_GROUPS, { fallback: "extra" }),
      verified: val.bool(fd, "verified"),
      updated_at: new Date().toISOString(),
    };
    if (!/^[A-Z]{2}$/.test(row.country)) return fail("País debe ser un código de 2 letras (CR, PA, MX…).");
    const kcalFromMacros = row.protein * 4 + row.carbs * 4 + row.fat * 9;
    if (row.verified && row.kcal && Math.abs(kcalFromMacros - row.kcal) / row.kcal > 0.35)
      return fail(`Las kcal (${row.kcal}) no cuadran con los macros (~${Math.round(kcalFromMacros)}). Revisa antes de marcar como verificado.`);
    if (!sb) return ok(`Alimento ${id ? "actualizado" : "creado"}${DEMO_MSG}`);
    const res = id ? await sb.from("foods").update(row).eq("id", id).select("id").single()
                   : await sb.from("foods").insert({ ...row, slug: val.slugify(row.name) }).select("id").single();
    if (res.error) return fail(pgMessage(res.error)!);
    await audit(sb, v, id ? "food.update" : "food.create", `food:${res.data.id}`, { name: row.name, verified: row.verified });
    revalidatePath("/admin/contenido");
    return ok(id ? "Alimento actualizado." : "Alimento creado.");
  });
}

export async function deleteFood(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("content.foods", fd, async ({ v, sb }) => {
    const id = val.int(fd, "id", { required: true, min: 1, label: "Alimento" })!;
    confirmed(fd);
    if (!sb) return ok(`Alimento eliminado${DEMO_MSG}`);
    const { data, error } = await sb.from("foods").delete().eq("id", id).select("name").maybeSingle();
    if (error) return fail(pgMessage(error)!);
    await audit(sb, v, "food.delete", `food:${id}`, { name: data?.name });
    revalidatePath("/admin/contenido");
    return ok("Alimento eliminado.");
  });
}

/** Carga la base local (src/lib/foods.ts) a public.foods cuando la tabla está vacía. */
export async function seedFoods(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("content.foods", fd, async ({ v, sb }) => {
    if (!sb) return ok(`Se cargarían ${FOODS.length} alimentos${DEMO_MSG}`);
    const { count } = await sb.from("foods").select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return fail("La tabla ya tiene alimentos; la carga inicial solo se permite con la tabla vacía.");
    const rows = FOODS.map((f) => ({ name: f.n, portion: f.p, kcal: f.k, protein: f.pr, carbs: f.c, fat: f.f, country: "CR", verified: true, slug: f.id, grp: f.g }));
    const { error } = await sb.from("foods").insert(rows);
    if (error) return fail(pgMessage(error)!);
    await audit(sb, v, "food.seed", "foods", { count: rows.length });
    revalidatePath("/admin/contenido");
    return ok(`${rows.length} alimentos cargados.`);
  });
}

// ─────────── Contenido: retos ───────────

export async function saveChallenge(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("content.challenges", fd, async ({ v, sb }) => {
    const idRaw = val.text(fd, "id");
    if (idRaw && sb && !val.isUuid(idRaw)) return fail("Reto inválido.");
    const title = val.text(fd, "title", { label: "Título", required: true, min: 3, max: 80 });
    const slug = val.slugify(val.text(fd, "slug", { max: 60 }) || title);
    if (slug.length < 2) return fail("El identificador (slug) es muy corto.");
    const row = {
      slug, title,
      description: val.text(fd, "description", { label: "Descripción", max: 600 }) || null,
      days: val.int(fd, "days", { label: "Días", required: true, min: 1, max: 365 })!,
      rules: val.json(fd, "rules", { label: "Reglas" }),
      active: val.bool(fd, "active"),
      sort: val.int(fd, "sort", { label: "Orden", min: 0, max: 999 }) ?? 0,
      updated_at: new Date().toISOString(),
    };
    if (!sb) return ok(`Reto ${idRaw ? "actualizado" : "creado"}${DEMO_MSG}`);
    const res = idRaw ? await sb.from("challenges_catalog").update(row).eq("id", idRaw).select("id").single()
                      : await sb.from("challenges_catalog").insert({ ...row, created_by: v.id }).select("id").single();
    if (res.error) return fail(pgMessage(res.error)!);
    await audit(sb, v, idRaw ? "challenge.update" : "challenge.create", `challenge:${res.data.id}`, { title, slug, active: row.active, days: row.days });
    revalidatePath("/admin/contenido");
    return ok(idRaw ? "Reto actualizado." : "Reto creado.");
  });
}

export async function deleteChallenge(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("content.challenges", fd, async ({ v, sb }) => {
    const id = val.text(fd, "id", { required: true, max: 64, label: "Reto" });
    confirmed(fd);
    if (!sb) return ok(`Reto eliminado${DEMO_MSG}`);
    if (!val.isUuid(id)) return fail("Reto inválido.");
    const { data, error } = await sb.from("challenges_catalog").delete().eq("id", id).select("title").maybeSingle();
    if (error) return fail(pgMessage(error)!);
    await audit(sb, v, "challenge.delete", `challenge:${id}`, { title: data?.title });
    revalidatePath("/admin/contenido");
    return ok("Reto eliminado.");
  });
}

// ─────────── Contenido: anuncios ───────────

export async function saveAnnouncement(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("content.announcements", fd, async ({ v, sb }) => {
    const idRaw = val.text(fd, "id");
    if (idRaw && sb && !val.isUuid(idRaw)) return fail("Anuncio inválido.");
    const cta_href = val.text(fd, "cta_href", { label: "Enlace", max: 200 }) || null;
    if (cta_href && !/^(\/[\w\-/?=&#.%]*|https:\/\/[^\s]+)$/.test(cta_href)) return fail("El enlace debe empezar con / (ruta interna) o https://");
    const row = {
      title: val.text(fd, "title", { label: "Título", required: true, min: 3, max: 90 }),
      body: val.text(fd, "body", { label: "Texto", max: 400 }) || null,
      audience: val.oneOf(fd, "audience", ["todos", "free", "pago", "staff"] as const, { label: "Audiencia" }),
      tone: val.oneOf(fd, "tone", ["banana", "ember", "sky", "peel"] as const, { fallback: "banana" }),
      cta_label: val.text(fd, "cta_label", { label: "Texto del botón", max: 30 }) || null,
      cta_href,
      starts_at: val.date(fd, "starts_at", { label: "Inicio" }),
      ends_at: val.date(fd, "ends_at", { label: "Fin" }),
      active: val.bool(fd, "active"),
      updated_at: new Date().toISOString(),
    };
    if (row.starts_at && row.ends_at && Date.parse(row.ends_at) <= Date.parse(row.starts_at)) return fail("El fin debe ser posterior al inicio.");
    if (!!row.cta_label !== !!row.cta_href) return fail("El botón necesita texto y enlace (o ninguno).");
    if (!sb) return ok(`Anuncio ${idRaw ? "actualizado" : "creado"}${DEMO_MSG}`);
    const res = idRaw ? await sb.from("announcements").update(row).eq("id", idRaw).select("id").single()
                      : await sb.from("announcements").insert({ ...row, created_by: v.id }).select("id").single();
    if (res.error) return fail(pgMessage(res.error)!);
    await audit(sb, v, idRaw ? "announcement.update" : "announcement.create", `announcement:${res.data.id}`, { title: row.title, audience: row.audience, active: row.active });
    revalidatePath("/admin/contenido");
    return ok(idRaw ? "Anuncio actualizado." : "Anuncio creado.");
  });
}

export async function deleteAnnouncement(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("content.announcements", fd, async ({ v, sb }) => {
    const id = val.text(fd, "id", { required: true, max: 64, label: "Anuncio" });
    confirmed(fd);
    if (!sb) return ok(`Anuncio eliminado${DEMO_MSG}`);
    if (!val.isUuid(id)) return fail("Anuncio inválido.");
    const { data, error } = await sb.from("announcements").delete().eq("id", id).select("title").maybeSingle();
    if (error) return fail(pgMessage(error)!);
    await audit(sb, v, "announcement.delete", `announcement:${id}`, { title: data?.title });
    revalidatePath("/admin/contenido");
    return ok("Anuncio eliminado.");
  });
}

// ─────────── Comunidad ───────────

export async function moderateReport(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("community.moderate", fd, async ({ v, sb }) => {
    const id = val.int(fd, "id", { required: true, min: 1, label: "Reporte" })!;
    const decision = val.oneOf(fd, "decision", ["resuelto", "oculto", "descartado", "abierto"] as const, { label: "Decisión" });
    const note = val.text(fd, "note", { label: "Nota", max: 300 }) || null;
    if (decision === "oculto" && !note) return fail("Para ocultar contenido escribe una nota con el motivo.");
    const label = { resuelto: "resuelto", oculto: "oculto", descartado: "descartado", abierto: "reabierto" }[decision];
    if (!sb) return ok(`Reporte ${label}${DEMO_MSG}`);
    const reopen = decision === "abierto";
    const { data, error } = await sb.from("reports").update({
      status: decision, resolution_note: note, resolved_by: reopen ? null : v.id, resolved_at: reopen ? null : new Date().toISOString(),
    }).eq("id", id).select("target_type,target_id").single();
    if (error) return fail(pgMessage(error)!);
    await audit(sb, v, `report.${decision === "oculto" ? "hide" : decision === "abierto" ? "reopen" : decision === "resuelto" ? "resolve" : "dismiss"}`, `report:${id}`, { target_type: data.target_type, target_id: data.target_id, note });
    revalidatePath("/admin/comunidad");
    return ok(`Reporte ${label}.`);
  });
}

// ─────────── Solo demo: simular rol ───────────

export async function setDemoRole(fd: FormData): Promise<void> {
  const v = await getAdminViewer();
  if (!v?.demo) return; // en producción el rol viene únicamente de la base de datos
  const r = String(fd.get("role") ?? "");
  const store = await cookies();
  if (STAFF_ROLES.includes(r as Role)) store.set(DEMO_ROLE_COOKIE, r, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 86400 });
  else store.delete(DEMO_ROLE_COOKIE);
  revalidatePath("/admin", "layout");
}
