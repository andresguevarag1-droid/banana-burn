"use server";
import { FREE_MAX_DAYS } from "@/lib/catalog-0033";
// Acciones del panel para la tienda de retos. Cada una: autoriza en el servidor (content.challenges o challenges.grant),
// valida a mano, muta con el cliente del usuario (RLS de 0018 vuelve a validar) y escribe en auditoría.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as val from "@/lib/admin-validate";
import { ValidationError } from "@/lib/admin-validate";
import { audit, DEMO_MSG, fail, ok, pgMessage, run } from "@/lib/admin-action-kit";
import { COVERS, ICONS, MAX_CHALLENGE_XP, MAX_PRICE_USD, MIN_PRICE_USD, parsePlan, type ChallengeStatus } from "@/lib/challenges";
import { parseMeta, parseSession, programErrors, weeksOf, type ProgramMeta, type ProgramSession } from "@/lib/programs";
import { authorize } from "@/lib/admin-auth";
import { EX } from "@/lib/engine";
import { searchLibrary, MUSCLE, es as esLib } from "@/lib/library";
import { knownExercise } from "@/lib/programs-server";
import type { ActionState } from "../actions";

const STATUSES: ChallengeStatus[] = ["borrador", "publicado", "oculto", "archivado"];
const VERIFY = ["manual", "workout", "steps", "protein", "water"] as const;
const DIFF = ["facil", "media", "dificil"] as const;

const refresh = (slug?: string) => {
  revalidatePath("/admin/retos", "layout");
  revalidatePath("/app/retos", "layout");
  if (slug) revalidatePath(`/app/retos/${slug}`);
};

/** Programa (0024): meta y sesiones del editor. Sin ejercicios inexistentes; para publicar, nada vacío. */
function readProgram(fd: FormData, publish: boolean): { meta: ProgramMeta; sessions: ProgramSession[] } {
  let meta: ProgramMeta | null, sessions: ProgramSession[];
  try {
    meta = parseMeta(JSON.parse(val.text(fd, "program", { max: 60_000 }) || "null"));
    const raw = JSON.parse(val.text(fd, "sessions", { max: 200_000 }) || "[]");
    sessions = (Array.isArray(raw) ? raw : []).map(parseSession).filter((x): x is ProgramSession => !!x);
  } catch { throw new ValidationError("El programa no es válido. Recarga la página e intenta de nuevo."); }
  if (!meta) throw new ValidationError("Define al menos una fase con sus semanas.");
  const m = meta;
  // Solo las sesiones que existen en el calendario (fases y días por semana actuales).
  sessions = sessions.filter((x) => x.phase <= m.phases.length && x.day <= m.daysPerWeek);
  const errs = programErrors(m, sessions, knownExercise);
  const bad = errs.filter((e) => /no existen|clave/.test(e));
  if (bad.length) throw new ValidationError(bad[0]);
  if (publish && errs.length) throw new ValidationError(`Para publicar el programa: ${errs.slice(0, 2).join(" ")}${errs.length > 2 ? ` (y ${errs.length - 2} más)` : ""}`);
  return { meta: m, sessions };
}

/** Lee y valida el formulario del editor. Pura respecto a la BD (lanza ValidationError con mensajes en español). */
function readForm(fd: FormData) {
  const title = val.text(fd, "title", { label: "Título", required: true, min: 3, max: 80 });
  const kind = val.oneOf(fd, "kind", ["reto", "programa"] as const, { fallback: "reto" });
  const statusEarly = val.oneOf(fd, "status", STATUSES, { label: "Estado" });
  const prog = kind === "programa" ? readProgram(fd, statusEarly === "publicado") : null;
  const days = prog ? weeksOf(prog.meta) * 7 : val.int(fd, "days", { label: "Duración", required: true, min: 1, max: 365 })!;
  const verify = prog ? ("workout" as const) : val.oneOf(fd, "verify", VERIFY, { label: "Verificación" });
  const price = val.num(fd, "price_usd", { label: "Precio", min: 0, max: MAX_PRICE_USD }) ?? 0;
  if (!prog && price === 0 && statusEarly === "publicado" && days > FREE_MAX_DAYS) throw new ValidationError(`Un reto gratis publicado dura como máximo ${FREE_MAX_DAYS} días.`);
  if (price > 0 && price < MIN_PRICE_USD) throw new ValidationError(`El precio mínimo de un reto de pago es $${MIN_PRICE_USD.toFixed(2)} (mínimo de ONVO).`);
  const startMode = val.oneOf(fd, "start_mode", ["libre", "fecha"] as const, { fallback: "libre" });
  const startDate = startMode === "fecha" ? val.date(fd, "start_date", { label: "Fecha de inicio", required: true }) : null;
  const status = statusEarly;
  const grace = prog ? 0 : val.int(fd, "grace", { label: "Comodines", min: 0, max: 60 }) ?? 0;
  if (grace >= days) throw new ValidationError("Los comodines deben ser menos que los días del reto.");
  const icon = val.text(fd, "icon", { max: 24 }) || "medal";
  if (!ICONS.includes(icon)) throw new ValidationError("Ícono inválido.");
  const onvo = val.text(fd, "onvo_price_id", { label: "ID de precio de ONVO", max: 80 }) || null;
  if (onvo && !/^[A-Za-z0-9_\-]+$/.test(onvo)) throw new ValidationError("El ID de precio de ONVO solo lleva letras, números, guiones y guiones bajos.");
  let plan: ReturnType<typeof parsePlan>;
  try { plan = parsePlan(JSON.parse(val.text(fd, "plan", { max: 200_000 }) || "[]"), days); } catch { throw new ValidationError("El plan día a día no es válido."); }
  if (!prog && status === "publicado" && plan.length < days) throw new ValidationError(`Para publicar, el plan debe tener los ${days} días (tiene ${plan.length}). Usa los ayudantes para rellenarlo.`);
  return {
    row: {
      title, days, verify, status, icon, grace,
      description: val.text(fd, "description", { label: "Descripción", max: 600 }) || null,
      price_usd: Math.round(price * 100) / 100,
      onvo_price_id: onvo,
      difficulty: val.oneOf(fd, "difficulty", DIFF, { fallback: "media" }),
      minutes: val.int(fd, "minutes", { label: "Minutos al día", required: true, min: 1, max: 240 })!,
      cover: val.oneOf(fd, "cover", COVERS, { fallback: "banana" }),
      xp: val.int(fd, "xp", { label: "XP al completar", required: true, min: 0, max: MAX_CHALLENGE_XP })!,
      steps_goal: verify === "steps" ? val.int(fd, "steps_goal", { label: "Meta de pasos", required: true, min: 1000, max: 50000 }) : null,
      badge: val.text(fd, "badge", { label: "Medalla", required: true, min: 3, max: 60 }),
      reward_title: val.text(fd, "reward_title", { label: "Título de recompensa", max: 40 }) || null,
      start_mode: startMode, start_date: startDate ? startDate.slice(0, 10) : null,
      featured: val.bool(fd, "featured"), coming_soon: val.bool(fd, "coming_soon"),
      safety_note: val.text(fd, "safety_note", { label: "Nota de seguridad", max: 600 }) || null,
      sort: val.int(fd, "sort", { label: "Orden", min: 0, max: 9999 }) ?? 0,
      ...(prog ? { kind, program: prog.meta } : { kind }),
    },
    plan, prog,
  };
}

/** Guarda las sesiones de un programa: inserta o actualiza las del editor y borra las que ya no están. */
async function saveSessions(sb: NonNullable<Parameters<Parameters<typeof run>[2]>[0]["sb"]>, slug: string, sessions: ProgramSession[], by: string) {
  const now = new Date().toISOString();
  if (sessions.length) {
    const { error } = await sb.from("program_sessions").upsert(sessions.map((x) => ({ slug, phase: x.phase, day: x.day, title: x.title, focus: x.focus, optional: !!x.optional, exercises: x.exercises, updated_by: by, updated_at: now })), { onConflict: "slug,phase,day" });
    if (error) return error;
  }
  const { data: have } = await sb.from("program_sessions").select("phase,day").eq("slug", slug);
  const keep = new Set(sessions.map((x) => `${x.phase}.${x.day}`));
  for (const r of (have ?? []) as { phase: number; day: number }[]) {
    if (keep.has(`${r.phase}.${r.day}`)) continue;
    const { error } = await sb.from("program_sessions").delete().eq("slug", slug).eq("phase", r.phase).eq("day", r.day);
    if (error) return error;
  }
  return null;
}

export async function saveStoreChallenge(_: ActionState, fd: FormData): Promise<ActionState> {
  let created: string | null = null;
  const res = await run("content.challenges", fd, async ({ v, sb }) => {
    const id = val.text(fd, "id", { max: 64 });
    if (id && sb && !val.isUuid(id)) return fail("Reto inválido.");
    const { row, plan, prog } = readForm(fd);
    if (!sb) return ok(`Reto ${id ? "guardado" : "creado"}${DEMO_MSG}`);
    let slug: string, uuid: string;
    if (id) {
      // El identificador no cambia al editar: lo guardan las inscripciones y compras.
      const { data, error } = await sb.from("challenges_catalog").update({ ...row, updated_by: v.id }).eq("id", id).select("id,slug").single();
      if (error) return fail(pgMessage(error));
      slug = data.slug; uuid = data.id;
    } else {
      slug = val.slugify(val.text(fd, "slug", { max: 60 }) || row.title);
      if (slug.length < 2) return fail("El identificador (slug) es muy corto.");
      const { data, error } = await sb.from("challenges_catalog").insert({ ...row, slug, rules: {}, created_by: v.id, updated_by: v.id }).select("id,slug").single();
      if (error) return fail(pgMessage(error));
      slug = data.slug; uuid = data.id;
    }
    if (prog) {
      const se = await saveSessions(sb, slug, prog.sessions, v.id);
      if (se) return fail(pgMessage(se));
    } else {
      const { error: pe } = await sb.from("challenge_plans").upsert({ slug, days: plan, updated_by: v.id, updated_at: new Date().toISOString() }, { onConflict: "slug" });
      if (pe) return fail(pgMessage(pe));
    }
    await audit(sb, v, id ? "challenge.update" : "challenge.create", `challenge:${slug}`, {
      title: row.title, status: row.status, price_usd: row.price_usd, days: row.days, kind: row.kind,
      ...(prog ? { weeks: weeksOf(prog.meta), sessions: prog.sessions.length, exercises: prog.sessions.reduce((a, x) => a + x.exercises.length, 0), nutrition: prog.meta.nutrition?.mode ?? null } : { plan_days: plan.length }),
    });
    refresh(slug);
    if (!id) created = uuid;
    return ok(id ? "Reto guardado. Quedó en auditoría." : "Reto creado. Quedó en auditoría.");
  });
  if (created) redirect(`/admin/retos/${created}?nuevo=1`); // fuera de run(): redirect() lanza una excepción de Next
  return res;
}

export async function setChallengeStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("content.challenges", fd, async ({ v, sb }) => {
    const id = val.text(fd, "id", { required: true, max: 64, label: "Reto" });
    const status = val.oneOf(fd, "status", STATUSES, { label: "Estado" });
    if (!sb) return ok(`Estado cambiado a ${status}${DEMO_MSG}`);
    if (!val.isUuid(id)) return fail("Reto inválido.");
    if (status === "publicado") {
      const first = await sb.from("challenges_catalog").select("slug,days,kind,program").eq("id", id).maybeSingle();
      const { data: c } = first.error ? await sb.from("challenges_catalog").select("slug,days").eq("id", id).maybeSingle() : first;
      const cc = c as { slug: string; days: number; kind?: string; program?: unknown } | null;
      if (cc?.kind === "programa") {
        const { data: ss } = await sb.from("program_sessions").select("phase,day,title,focus,optional,exercises").eq("slug", cc.slug);
        const errs = programErrors(parseMeta(cc.program), (ss ?? []).map(parseSession).filter((x): x is ProgramSession => !!x), knownExercise);
        if (errs.length) return fail(`Para publicar el programa: ${errs[0]}`);
      } else {
        const { data: p } = cc ? await sb.from("challenge_plans").select("days").eq("slug", cc.slug).maybeSingle() : { data: null };
        if (!cc || parsePlan(p?.days, cc.days).length < cc.days) return fail("Para publicar, completa el plan de todos los días en el editor.");
      }
    }
    const { data, error } = await sb.from("challenges_catalog").update({ status, updated_by: v.id }).eq("id", id).select("slug,title").single();
    if (error) return fail(pgMessage(error));
    await audit(sb, v, "challenge.status", `challenge:${data.slug}`, { title: data.title, status });
    refresh(data.slug);
    return ok(status === "oculto" ? "Reto oculto: ya no aparece en la tienda. Quien ya está inscrito puede terminarlo." : status === "publicado" ? "Reto publicado en la tienda." : `Estado: ${status}.`);
  });
}

export async function duplicateChallenge(_: ActionState, fd: FormData): Promise<ActionState> {
  let created: string | null = null;
  const res = await run("content.challenges", fd, async ({ v, sb }) => {
    const id = val.text(fd, "id", { required: true, max: 64, label: "Reto" });
    if (!sb) return ok(`Reto duplicado como borrador${DEMO_MSG}`);
    if (!val.isUuid(id)) return fail("Reto inválido.");
    const { data: src, error } = await sb.from("challenges_catalog").select("*").eq("id", id).single();
    if (error || !src) return fail(pgMessage(error));
    const { data: taken } = await sb.from("challenges_catalog").select("slug").like("slug", `${src.slug}-copia%`);
    const used = new Set(((taken ?? []) as { slug: string }[]).map((x) => x.slug));
    let slug = `${src.slug}-copia`.slice(0, 60);
    for (let i = 2; used.has(slug); i++) slug = `${src.slug}-copia-${i}`.slice(0, 60);
    const { id: _i, created_at: _c, updated_at: _u, active: _a, ...rest } = src as Record<string, unknown>;
    void _i; void _c; void _u; void _a;
    const { data: ins, error: e2 } = await sb.from("challenges_catalog").insert({ ...rest, slug, title: `${String(src.title).slice(0, 72)} (copia)`, status: "borrador", featured: false, created_by: v.id, updated_by: v.id }).select("id").single();
    if (e2) return fail(pgMessage(e2));
    const { data: p } = await sb.from("challenge_plans").select("days").eq("slug", src.slug).maybeSingle();
    if (p) await sb.from("challenge_plans").insert({ slug, days: p.days, updated_by: v.id });
    if (src.kind === "programa") {
      const { data: ss } = await sb.from("program_sessions").select("phase,day,title,focus,optional,exercises").eq("slug", src.slug);
      if (ss?.length) await sb.from("program_sessions").insert(ss.map((x) => ({ ...x, slug, updated_by: v.id })));
    }
    await audit(sb, v, "challenge.duplicate", `challenge:${slug}`, { from: src.slug });
    refresh();
    created = ins.id as string;
    return ok("Reto duplicado como borrador.");
  });
  if (created) redirect(`/admin/retos/${created}?nuevo=1`);
  return res;
}

export async function moveChallenge(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("content.challenges", fd, async ({ v, sb }) => {
    const id = val.text(fd, "id", { required: true, max: 64, label: "Reto" });
    const dir = val.oneOf(fd, "dir", ["arriba", "abajo"] as const, { label: "Dirección" });
    if (!sb) return ok(`Orden cambiado${DEMO_MSG}`);
    if (!val.isUuid(id)) return fail("Reto inválido.");
    const { data: all, error } = await sb.from("challenges_catalog").select("id,slug,sort").order("sort").order("created_at");
    if (error) return fail(pgMessage(error));
    const list = (all ?? []) as { id: string; slug: string; sort: number }[];
    const i = list.findIndex((x) => x.id === id), j = dir === "arriba" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return ok("Ya está en el extremo.");
    [list[i], list[j]] = [list[j], list[i]];
    // Reescribe el orden en pasos de 10 (estable aunque hubiera empates).
    for (let k = 0; k < list.length; k++) {
      if (list[k].sort === (k + 1) * 10) continue;
      const { error: e } = await sb.from("challenges_catalog").update({ sort: (k + 1) * 10 }).eq("id", list[k].id);
      if (e) return fail(pgMessage(e));
    }
    await audit(sb, v, "challenge.reorder", `challenge:${list[j].slug}`, { dir, position: j + 1 });
    refresh();
    return ok("Orden actualizado.");
  });
}

/** Cortesía: regala un reto (normalmente de pago) a un usuario por correo o ID. La RPC valida el rol y audita. */
export async function grantChallenge(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("challenges.grant", fd, async ({ sb }) => {
    const slug = val.text(fd, "slug", { required: true, max: 60, label: "Reto" });
    const who = val.text(fd, "who", { required: true, max: 120, label: "Correo o ID del usuario" }).trim();
    const reason = val.text(fd, "reason", { label: "Motivo", required: true, min: 4, max: 300 });
    if (!sb) return ok(`Reto regalado a ${who}${DEMO_MSG}`);
    let target = val.isUuid(who) ? who : null;
    if (!target) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(who)) return fail("Escribe un correo válido o el ID del usuario.");
      const { data, error } = await sb.rpc("admin_list_users", { p_q: who, p_limit: 5, p_offset: 0 });
      if (error) return fail(pgMessage(error));
      const hit = ((data ?? []) as { id: string; email: string | null }[]).find((u) => (u.email ?? "").toLowerCase() === who.toLowerCase());
      if (!hit) return fail("No encontramos un usuario con ese correo.");
      target = hit.id;
    }
    const { error } = await sb.rpc("admin_grant_challenge", { p_target: target, p_slug: slug, p_reason: reason });
    if (error) return fail(pgMessage(error));
    refresh(slug);
    return ok("Reto regalado. Ya puede empezarlo. Quedó en auditoría.");
  });
}

export type ExerciseHit = { id: string; name: string; muscle: string; eq: string };

/** Buscador de ejercicios del editor de programas: primero los del motor, después la biblioteca. Solo editores. */
export async function searchExercises(q: string): Promise<ExerciseHit[]> {
  const auth = await authorize("content.challenges");
  if (!auth.ok || typeof q !== "string") return [];
  const t = q.trim().slice(0, 40);
  if (t.length < 2) return [];
  const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const nq = norm(t);
  const engine = Object.entries(EX).filter(([id, e]) => norm(e.n).includes(nq) || id === t).slice(0, 6).map(([id, e]) => ({ id, name: e.n, muscle: e.m, eq: "Motor" }));
  const lib = searchLibrary({ q: t, per: 12 }).items.map((x) => ({ id: `ds:${x.id}`, name: x.n, muscle: esLib(MUSCLE, x.t), eq: x.eq }));
  return [...engine, ...lib].slice(0, 14);
}
