// Datos de ejemplo del panel (modo demo, sin Supabase). Deterministas: misma semilla → mismos datos en cada render.
import { crToday } from "@/lib/today";
import { addDays } from "@/lib/admin-kpis";
import type { Role } from "@/lib/supabase/server";
import type { SubRow } from "@/lib/admin-kpis";

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["María", "José", "Valeria", "Daniel", "Sofía", "Andrés", "Camila", "Luis", "Fernanda", "Diego", "Mariana", "Carlos", "Gabriela", "Pablo", "Natalia", "Jorge", "Paula", "Esteban", "Laura", "Kevin", "Melissa", "Ricardo", "Daniela", "Alonso"];
const LAST = ["Rodríguez", "Jiménez", "Mora", "Vargas", "Solano", "Rojas", "Alfaro", "Chaves", "Quesada", "Castro", "Arias", "Herrera", "Calderón", "Salazar", "Brenes", "Monge"];

export type DemoUser = {
  id: string; full_name: string; email: string; role: Role; plan: string; onboarded: boolean; created_at: string;
  country: string; goal_type: string; equipment: string; train_days: number; days: Set<string>; weights: { day: string; kg: number }[];
  goal: { start_weight: number; goal_weight: number; goal_date: string; mode: string } | null;
};

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

let cache: { key: string; users: DemoUser[]; subs: SubRow[] } | null = null;

export function demoWorld() {
  const today = crToday().iso;
  if (cache?.key === today) return cache;
  const r = rng(47);
  const users: DemoUser[] = [];
  const N = 72;
  for (let i = 0; i < N; i++) {
    // Más altas recientes (crecimiento): distribución sesgada hacia hoy.
    const ago = i === 0 ? 70 : Math.floor(Math.pow(r(), 1.6) * 68);
    const signup = addDays(today, -ago);
    const fn = FIRST[Math.floor(r() * FIRST.length)], ln = LAST[Math.floor(r() * LAST.length)];
    const plans = ["free", "free", "free", "entreno", "completo", "completo"];
    const plan = i === 0 ? "completo" : plans[Math.floor(r() * plans.length)];
    const role: Role = i === 0 ? "superadmin" : i === 1 ? "admin" : i === 2 ? "coach" : i === 3 ? "support" : plan === "free" ? "free" : "pro";
    const onboarded = i < 4 || r() > 0.18;
    const engagement = plan === "free" ? 0.25 + r() * 0.3 : 0.5 + r() * 0.4;
    const days = new Set<string>();
    const weights: { day: string; kg: number }[] = [];
    const start = 70 + Math.round(r() * 40);
    let kg = start;
    if (onboarded) {
      for (let d = 0; d <= ago; d++) {
        const decay = Math.exp(-d / (plan === "free" ? 18 : 60));
        const day = addDays(signup, d);
        if (d === 0 || r() < engagement * decay) days.add(day);
        if (days.has(day) && r() < 0.5) { kg = Math.round((kg - 0.08 - r() * 0.12 + (r() - 0.5) * 0.3) * 10) / 10; weights.push({ day, kg }); }
      }
    }
    users.push({
      id: uuid(i + 1), full_name: `${fn} ${ln}`, email: `${fn}.${ln}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + `${i}@ejemplo.cr`,
      role, plan, onboarded, created_at: `${signup}T${String(8 + (i % 12)).padStart(2, "0")}:15:00-06:00`,
      country: r() > 0.2 ? "CR" : ["PA", "GT", "MX", "CO"][Math.floor(r() * 4)],
      goal_type: ["grasa", "grasa", "recomp", "fuerza"][Math.floor(r() * 4)], equipment: ["gym", "gym", "casa", "mixto"][Math.floor(r() * 4)], train_days: 3 + Math.floor(r() * 4),
      days, weights,
      goal: onboarded ? { start_weight: start, goal_weight: start - 6 - Math.round(r() * 8), goal_date: addDays(signup, 90), mode: r() > 0.3 ? "acelerada" : "recomp" } : null,
    });
  }
  users[0].full_name = "Andrés Guevara"; users[0].email = "demo@bananaburn.app";

  const subs: SubRow[] = [];
  let sid = 1;
  for (const u of users) {
    if (u.plan === "free") {
      if (r() < 0.12) { // pagó y canceló
        const created = addDays(u.created_at.slice(0, 10), 1);
        subs.push({ id: sid++, user_id: u.id, status: "canceled", plan: r() > 0.5 ? "entreno" : "completo", billing: "mes", provider: "onvo", created_at: `${created}T10:00:00Z`, canceled_at: `${addDays(created, 20 + Math.floor(r() * 15))}T10:00:00Z`, current_period_end: `${addDays(created, 30)}T10:00:00Z` });
      }
      continue;
    }
    if (u.role === "coach" || u.role === "support" || u.role === "admin") continue;
    const created = u.created_at.slice(0, 10);
    const billing = r() < 0.25 ? "anual" : "mes";
    const x = r();
    const status = x < 0.08 ? "past_due" : x < 0.13 ? "trialing" : "active";
    subs.push({ id: sid++, user_id: u.id, status, plan: u.plan, billing, provider: "onvo", created_at: `${created}T10:00:00Z`, current_period_end: `${addDays(today, 1 + Math.floor(r() * (billing === "anual" ? 300 : 29)))}T10:00:00Z` });
  }
  cache = { key: today, users, subs };
  return cache;
}

export const DEMO_AUDIT = (() => {
  const today = crToday().iso;
  const rows = [
    { action: "user.role_change", target: uuid(3), meta: { from: "free", to: "coach", reason: "Coach certificado del equipo" }, ago: 0 },
    { action: "user.comp_grant", target: uuid(9), meta: { plan: "completo", expires_at: `${addDays(today, 30)}T23:59:59Z`, reason: "Influencer piloto" }, ago: 1 },
    { action: "food.update", target: "food:casado", meta: { verified: true }, ago: 1 },
    { action: "challenge.create", target: "challenge:reto-21", meta: { title: "Reto 21 días sin excusas" }, ago: 2 },
    { action: "announcement.create", target: "announcement:1", meta: { title: "Nuevo: entreno en casa" }, ago: 3 },
    { action: "report.hide", target: "report:2", meta: { target_type: "post", target_id: "p_118" }, ago: 4 },
    { action: "user.onboarding_reset", target: uuid(14), meta: { reason: "Pidió rehacer su plan" }, ago: 6 },
    { action: "exercise.update", target: "exercise:dips", meta: { enabled: true, name: "Fondos en paralelas" }, ago: 8 },
  ];
  return rows.map((x, i) => ({ id: 100 - i, actor: i % 3 === 0 ? uuid(1) : uuid(2), actor_name: i % 3 === 0 ? "Andrés Guevara" : "Admin demo", action: x.action, target: x.target, meta: x.meta, created_at: `${addDays(today, -x.ago)}T${String(9 + i).padStart(2, "0")}:20:00-06:00` }));
})();

export const DEMO_REPORTS = (() => {
  const today = crToday().iso;
  return [
    { id: 3, target_type: "post", target_id: "p_204", reporter: uuid(21), reason: "desinformacion_salud", details: "Recomienda comer 600 kcal al día.", excerpt: "Yo bajé 8 kg en 2 semanas comiendo solo 600 kcal, háganlo 💪", status: "abierto", created_at: `${today}T08:12:00-06:00`, resolved_at: null, resolution_note: null },
    { id: 2, target_type: "comment", target_id: "c_871", reporter: uuid(30), reason: "acoso", details: "Comentarios sobre el cuerpo de otra usuaria.", excerpt: "Con ese cuerpo mejor ni subas fotos…", status: "abierto", created_at: `${addDays(today, -1)}T19:40:00-06:00`, resolved_at: null, resolution_note: null },
    { id: 1, target_type: "post", target_id: "p_118", reporter: uuid(12), reason: "spam", details: null, excerpt: "Compren mis pastillas quemagrasa en este link 👉", status: "oculto", created_at: `${addDays(today, -4)}T11:05:00-06:00`, resolved_at: `${addDays(today, -4)}T12:00:00-06:00`, resolution_note: "Spam comercial" },
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
    { id: "a1", title: "Nuevo: entrena en casa 🏠", body: "Cambia a modo casa en tu perfil y tu rutina se adapta a mancuernas y peso corporal.", audience: "todos", tone: "banana", cta_label: "Probar", cta_href: "/app/perfil", starts_at: `${addDays(today, -3)}T00:00:00-06:00`, ends_at: `${addDays(today, 10)}T23:59:00-06:00`, active: true },
    { id: "a2", title: "50 % en el plan anual", body: "Solo esta semana: Entreno + Nutrición anual a $89.99.", audience: "free", tone: "ember", cta_label: "Ver planes", cta_href: "/precios", starts_at: `${addDays(today, 2)}T00:00:00-06:00`, ends_at: `${addDays(today, 9)}T23:59:00-06:00`, active: true },
  ];
})();

export const DEMO_OVERRIDES: Record<string, { name: string | null; cues: string[]; enabled: boolean; updated_at: string }> = {
  dips: { name: "Fondos en paralelas", cues: ["Hombros lejos de las orejas", "Baja hasta 90° de codo", "Torso levemente inclinado"], enabled: true, updated_at: "2026-10-12T10:00:00Z" },
  dipsw: { name: null, cues: [], enabled: false, updated_at: "2026-10-12T10:00:00Z" },
};
