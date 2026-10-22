// Datos de ejemplo del panel (modo demo, sin Supabase).
// FUENTE ÚNICA: una sola lista sembrada de usuarios (plan, periodicidad, estado de la suscripción, alta, último cobro,
// actividad). Resumen, cohortes, Usuarios, Pagos y la ficha se derivan de aquí, así los números siempre cuadran.
// Deterministas: misma semilla y mismo "hoy" (crToday) → mismos datos en cada render.
import { crToday } from "@/lib/today";
import { addDays, crDay, nextRenewal, RETENTION_WINDOWS, type SubRow } from "@/lib/admin-kpis";
import { profilePlanFor } from "@/lib/onvo";
import type { Billing, PlanId } from "@/lib/plans";
import type { Role } from "@/lib/supabase/server";

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_F = ["María José", "Valeria", "Sofía", "Camila", "Fernanda", "Mariana", "Gabriela", "Natalia", "Paula", "Laura", "Melissa", "Daniela", "Priscilla", "Karla", "Raquel", "Adriana", "Tatiana", "Marcela", "Yendry", "Hazel", "Sharon", "Fabiola", "Silvia", "Andrea"];
const FIRST_M = ["José Pablo", "Daniel", "Luis Diego", "Diego", "Carlos", "Pablo", "Jorge", "Esteban", "Kevin", "Ricardo", "Alonso", "Mauricio", "Fabián", "Randall", "Óscar", "Allan", "Josué", "Bryan", "Gerardo", "Andrés", "Adrián", "Rodolfo", "Marco", "Sebastián"];
const LAST = ["Rodríguez", "Jiménez", "Mora", "Vargas", "Solano", "Rojas", "Alfaro", "Chaves", "Quesada", "Castro", "Arias", "Herrera", "Calderón", "Salazar", "Brenes", "Monge", "Ramírez", "Araya", "Sánchez", "Villalobos", "Umaña", "Zúñiga", "Campos", "Segura", "Madrigal", "Badilla", "Cordero", "Fallas", "Porras", "Ulate"];

export type DemoComp = { plan: PlanId; reason: string; starts_at: string; expires_at: string };
export type DemoUser = {
  id: string; full_name: string; email: string; role: Role; plan: string; onboarded: boolean; created_at: string;
  country: string; goal_type: string; equipment: string; train_days: number;
  /** Días con cualquier actividad (entreno, pesaje, registro o comida). */
  days: Set<string>;
  /** Subconjunto de `days` con entreno. */
  workouts: Set<string>;
  weights: { day: string; kg: number }[];
  goal: { start_weight: number; goal_weight: number; goal_date: string; mode: string } | null;
  billing: Billing | null;
  sub: SubRow | null;
  comp: DemoComp | null;
};
export type DemoFailedPayment = { id: string; user_id: string; amount: number; status: string; created_at: string; failure_reason: string };
export type DemoWorld = { key: string; users: DemoUser[]; subs: SubRow[]; failedPayments: DemoFailedPayment[] };

export const demoUuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");

const PRICE: Record<PlanId, Record<Billing, number>> = { entreno: { mes: 9.99, anual: 59.99 }, completo: { mes: 14.99, anual: 89.99 } };
const FAIL_REASONS = ["Fondos insuficientes", "Tarjeta vencida", "Rechazada por el banco emisor"];
const STAFF: { name: string; email: string; role: Role; ago: number }[] = [
  { name: "Andrés Guevara", email: "demo@bananaburn.app", role: "superadmin", ago: 160 },
  { name: "Mónica Salas", email: "monica@bananaburn.app", role: "admin", ago: 150 },
  { name: "Jonathan Mena", email: "jonathan@bananaburn.app", role: "coach", ago: 140 },
  { name: "Ana Lucía Pérez", email: "analucia@bananaburn.app", role: "support", ago: 120 },
];
const N = 132;

let cache: DemoWorld | null = null;

export function demoWorld(): DemoWorld {
  const today = crToday().iso;
  if (cache?.key === today) return cache;
  const now = new Date(`${today}T12:00:00-06:00`);
  const r = rng(2026);
  const hex = (n: number) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("");
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const users: DemoUser[] = [];
  const subs: SubRow[] = [];
  const failedPayments: DemoFailedPayment[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < N; i++) {
    const staff = STAFF[i];
    // Altas sesgadas hacia hoy (crecimiento), hasta ~5 meses atrás.
    const ago = staff ? staff.ago : Math.floor(Math.pow(r(), 1.45) * 150);
    const signup = addDays(today, -ago);
    let full_name = staff?.name ?? "";
    while (!full_name || usedNames.has(full_name)) {
      const fem = r() < 0.58; // la app atrae más mujeres
      full_name = `${pick(fem ? FIRST_F : FIRST_M)} ${pick(LAST)}`;
    }
    usedNames.add(full_name);
    const email = staff?.email ?? `${slug(full_name)}${r() < 0.5 ? Math.floor(r() * 90 + 10) : ""}@${pick(["gmail.com", "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "ice.co.cr"])}`;
    const onboarded = !!staff || (ago > 1 ? r() > 0.12 : r() > 0.45);

    // ── Suscripción (una por usuario que alguna vez pagó; la más reciente) ──
    let sub: SubRow | null = null;
    let billing: Billing | null = null;
    if (!staff && onboarded && r() < 0.4) {
      const plan: PlanId = r() < 0.62 ? "completo" : "entreno";
      billing = r() < 0.22 ? "anual" : "mes";
      const lag = r() < 0.7 ? 0 : 1 + Math.floor(r() * 3);
      const first = addDays(signup, Math.min(lag, ago));
      const base = { id: subs.length + 1, user_id: demoUuid(i + 1), plan, billing, provider: "onvo", created_at: `${first}T${String(7 + Math.floor(r() * 14)).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}:00-06:00`, provider_customer_id: `cus_${hex(20)}`, provider_subscription_id: `sub_${hex(20)}` };
      if (ago <= 6 && r() < 0.45) {
        // Prueba de 7 días: sin cobro todavía.
        sub = { ...base, status: "trialing", current_period_start: null, current_period_end: `${addDays(first, 7)}T23:59:00-06:00`, cancel_at_period_end: false, canceled_at: null };
      } else {
        // Recorre los ciclos: cada renovación puede cobrarse, fallar o cancelarse.
        let last = first;
        let status = "active", canceledAt: string | null = null, cancelAtEnd = false;
        for (;;) {
          const end = nextRenewal(last, billing);
          if (end > today) {
            // Algunos piden cancelar a mitad de periodo: conservan acceso hasta el fin del periodo pagado.
            if (r() < 0.05) { status = "canceled"; cancelAtEnd = true; canceledAt = addDays(last, Math.floor(r() * (dayDiffSafe(last, today) + 1))); }
            break;
          }
          const x = r();
          if (x < (billing === "anual" ? 0.15 : 0.08)) { status = "canceled"; cancelAtEnd = true; canceledAt = addDays(end, -1 - Math.floor(r() * 10)); break; }
          if (end >= addDays(today, -3) && x < 0.6) {
            status = "past_due";
            failedPayments.push({ id: `pay_${hex(12)}`, user_id: base.user_id, amount: PRICE[plan][billing], status: "failed", created_at: `${end}T06:05:00-06:00`, failure_reason: pick(FAIL_REASONS) });
            break;
          }
          last = end;
        }
        sub = { ...base, status, current_period_start: `${last}T06:00:00-06:00`, current_period_end: `${nextRenewal(last, billing)}T06:00:00-06:00`, cancel_at_period_end: cancelAtEnd, canceled_at: canceledAt ? `${canceledAt}T15:30:00-06:00` : null, updated_at: canceledAt ? `${canceledAt}T15:30:00-06:00` : undefined };
      }
      subs.push(sub);
    }

    // ── Cortesía (equipo y algunos invitados) ──
    let comp: DemoComp | null = null;
    if (staff) comp = { plan: "completo", reason: "Cuenta del equipo", starts_at: `${signup}T09:00:00-06:00`, expires_at: `${addDays(today, 200)}T23:59:59-06:00` };
    else if (!sub && onboarded && ago >= 10 && r() < 0.06) {
      const start = addDays(today, -Math.min(ago - 1, 5 + Math.floor(r() * 25)));
      comp = { plan: "completo", reason: pick(["Influencer piloto", "Compensación por falla", "Sorteo en Instagram"]), starts_at: `${start}T10:00:00-06:00`, expires_at: `${addDays(start, 60)}T23:59:59-06:00` };
    }

    // Plan del perfil: el mismo que calcula el webhook a partir de la suscripción (o la cortesía vigente).
    const subPlan = sub ? profilePlanFor({ plan: sub.plan ?? null, status: sub.status ?? "", current_period_end: sub.current_period_end ?? null, cancel_at_period_end: sub.cancel_at_period_end }, now) : "free";
    const compLive = comp && Date.parse(comp.expires_at) > now.getTime() ? comp.plan : null;
    const plan = subPlan !== "free" ? subPlan : compLive ?? "free";
    const role: Role = staff?.role ?? (plan === "free" ? "free" : "pro");

    // ── Actividad: vida útil con decaimiento; ventanas de retención anidadas (D30 ⇒ D7 ⇒ D1) ──
    const everPaid = !!sub || !!comp;
    const lifeMean = staff ? 400 : everPaid ? 75 : 8;
    let life = Math.floor(-Math.log(1 - r() * 0.999) * lifeMean);
    if (sub?.status === "canceled" && sub.canceled_at) life = Math.min(life, Math.max(1, dayDiffSafe(signup, crDay(sub.canceled_at)) + 5));
    const q = staff ? 0.8 : everPaid ? 0.4 : 0.2;          // probabilidad diaria de actividad mientras sigue enganchado
    const qDay1 = staff ? 1 : everPaid ? 0.85 : 0.6;        // volver al día siguiente
    const days = new Set<string>();
    const workouts = new Set<string>();
    if (onboarded) {
      for (let d = 0; d <= Math.min(ago, life); d++) {
        const day = addDays(signup, d);
        if (d === 0 || r() < (d === 1 ? qDay1 : q)) days.add(day);
      }
      const inWin = (a: number, b: number) => { for (let d = a; d <= b; d++) if (days.has(addDays(signup, d))) return true; return false; };
      const [, b7] = RETENTION_WINDOWS.d7, [a30, b30] = RETENTION_WINDOWS.d30, [a7] = RETENTION_WINDOWS.d7;
      if (inWin(a30, b30) && !inWin(a7, b7)) days.add(addDays(signup, a7 + Math.floor(r() * (b7 - a7 + 1))));
      if (inWin(a7, b7) && !days.has(addDays(signup, 1))) days.add(addDays(signup, 1));
      if (inWin(a30, b30) && !days.has(addDays(signup, 1))) days.add(addDays(signup, 1));
      for (const d of days) if (d <= today && r() < (everPaid ? 0.72 : 0.5)) workouts.add(d);
      for (const d of [...days]) if (d > today) days.delete(d);
    }
    const start = 64 + Math.round(r() * 46);
    let kg = start;
    const weights: { day: string; kg: number }[] = [];
    for (const d of [...days].sort()) if (r() < 0.3) { kg = Math.round((kg - 0.05 - r() * 0.12 + (r() - 0.5) * 0.35) * 10) / 10; weights.push({ day: d, kg }); }

    users.push({
      id: demoUuid(i + 1), full_name, email, role, plan, onboarded,
      created_at: `${signup}T${String(6 + Math.floor(r() * 16)).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}:00-06:00`,
      country: r() > 0.14 ? "CR" : pick(["PA", "NI", "GT", "MX", "CO"]),
      goal_type: pick(["grasa", "grasa", "grasa", "recomp", "fuerza"]), equipment: pick(["gym", "gym", "casa", "mixto"]), train_days: 3 + Math.floor(r() * 3),
      days, workouts, weights, billing, sub, comp,
      goal: onboarded ? { start_weight: start, goal_weight: start - 5 - Math.round(r() * 9), goal_date: addDays(signup, 84 + Math.floor(r() * 60)), mode: r() > 0.3 ? "acelerada" : "recomp" } : null,
    });
    // La suscripción no puede ser anterior al alta.
    if (sub && sub.created_at && crDay(sub.created_at) < signup) sub.created_at = users[users.length - 1].created_at;
  }

  cache = { key: today, users, subs, failedPayments };
  return cache;
}

function dayDiffSafe(a: string, b: string) {
  return Math.max(0, Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5));
}

/** Cortesía vigente de un usuario demo (o null). */
export function demoCompLive(u: DemoUser, now = new Date(`${crToday().iso}T12:00:00-06:00`)): DemoComp | null {
  return u.comp && Date.parse(u.comp.expires_at) > now.getTime() ? u.comp : null;
}

/** Bitácora de staff coherente con el mundo demo (cortesías y cambios de rol reales de la lista). */
export function demoAudit() {
  const w = demoWorld();
  const today = w.key;
  const comped = w.users.find((u) => u.comp && u.role !== "superadmin" && !["admin", "coach", "support"].includes(u.role));
  const reset = w.users.find((u, i) => i > 10 && u.onboarded && u.plan === "free");
  const rows: { action: string; target: string; meta: Record<string, unknown>; at: string }[] = [
    { action: "user.role_change", target: demoUuid(3), meta: { de: "free", a: "coach", motivo: "Coach certificado del equipo" }, at: `${addDays(today, -40)}T09:20:00-06:00` },
    { action: "food.update", target: "food:casado", meta: { verificado: true }, at: `${addDays(today, -1)}T10:20:00-06:00` },
    { action: "challenge.create", target: "challenge:reto-21", meta: { titulo: "Reto 21 días sin excusas" }, at: `${addDays(today, -2)}T11:20:00-06:00` },
    { action: "announcement.create", target: "announcement:a1", meta: { titulo: "Nuevo: entrena en casa" }, at: `${addDays(today, -3)}T12:20:00-06:00` },
    { action: "report.hide", target: "report:1", meta: { tipo: "post", id: "p_118" }, at: `${addDays(today, -4)}T12:00:00-06:00` },
    { action: "exercise.update", target: "exercise:dips", meta: { habilitado: true, nombre: "Fondos en paralelas" }, at: `${addDays(today, -8)}T14:20:00-06:00` },
  ];
  if (comped?.comp) rows.push({ action: "user.comp_grant", target: comped.id, meta: { plan: comped.comp.plan, vence: comped.comp.expires_at.slice(0, 10), motivo: comped.comp.reason }, at: comped.comp.starts_at });
  if (reset) rows.push({ action: "user.onboarding_reset", target: reset.id, meta: { motivo: "Pidió rehacer su plan" }, at: `${addDays(today, -6)}T15:20:00-06:00` });
  return rows
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((x, i) => ({ id: 100 - i, actor: i % 3 === 0 ? demoUuid(1) : demoUuid(2), actor_name: i % 3 === 0 ? "Andrés Guevara" : "Mónica Salas", action: x.action, target: x.target, meta: x.meta, created_at: x.at }));
}

export const DEMO_REPORTS = (() => {
  const today = crToday().iso;
  return [
    { id: 3, target_type: "post", target_id: "p_204", reporter: demoUuid(21), reason: "desinformacion_salud", details: "Recomienda comer 600 kcal al día.", excerpt: "Yo bajé 8 kg en 2 semanas comiendo solo 600 kcal, háganlo ", status: "abierto", created_at: `${today}T08:12:00-06:00`, resolved_at: null, resolution_note: null },
    { id: 2, target_type: "comment", target_id: "c_871", reporter: demoUuid(30), reason: "acoso", details: "Comentarios sobre el cuerpo de otra usuaria.", excerpt: "Con ese cuerpo mejor ni subas fotos…", status: "abierto", created_at: `${addDays(today, -1)}T19:40:00-06:00`, resolved_at: null, resolution_note: null },
    { id: 1, target_type: "post", target_id: "p_118", reporter: demoUuid(12), reason: "spam", details: null, excerpt: "Compren mis pastillas quemagrasa en este link", status: "oculto", created_at: `${addDays(today, -4)}T11:05:00-06:00`, resolved_at: `${addDays(today, -4)}T12:00:00-06:00`, resolution_note: "Spam comercial" },
  ];
})();

export const DEMO_CHALLENGES = [
  { id: "c1", slug: "reto-21", title: "Reto 21 días sin excusas", description: "Entrena o camina 30 min cada día durante 21 días. Si fallas un día, la racha sigue con un comodín.", days: 21, rules: { minSesiones: 18, comodines: 1, xpBonus: 500 }, active: true, sort: 1 },
  { id: "c2", slug: "pasos-10k", title: "10 000 pasos x 14", description: "Llega a 10 000 pasos diarios dos semanas seguidas.", days: 14, rules: { pasosMin: 10000 }, active: true, sort: 2 },
  { id: "c3", slug: "proteina-30", title: "Proteína completa 30 días", description: "Cumple tu meta de proteína 25 de 30 días.", days: 30, rules: { diasMeta: 25 }, active: false, sort: 3 },
];

export const DEMO_ANNOUNCEMENTS = (() => {
  const today = crToday().iso;
  return [
    { id: "a1", title: "Nuevo: entrena en casa", body: "Cambia a modo casa en tu perfil y tu rutina se adapta a mancuernas y peso corporal.", audience: "todos", tone: "banana", cta_label: "Probar", cta_href: "/app/perfil", starts_at: `${addDays(today, -3)}T00:00:00-06:00`, ends_at: `${addDays(today, 10)}T23:59:00-06:00`, active: true },
    { id: "a2", title: "Plan anual con descuento", body: "Solo esta semana: Entreno + Nutrición anual a $89.99.", audience: "free", tone: "ember", cta_label: "Ver planes", cta_href: "/precios", starts_at: `${addDays(today, 2)}T00:00:00-06:00`, ends_at: `${addDays(today, 9)}T23:59:00-06:00`, active: true },
  ];
})();

export const DEMO_OVERRIDES: Record<string, { name: string | null; cues: string[]; enabled: boolean; updated_at: string }> = {
  dips: { name: "Fondos en paralelas", cues: ["Hombros lejos de las orejas", "Baja hasta 90° de codo", "Torso levemente inclinado"], enabled: true, updated_at: "2026-10-12T10:00:00Z" },
  dipsw: { name: null, cues: [], enabled: false, updated_at: "2026-10-12T10:00:00Z" },
};
