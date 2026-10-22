import { afterEach, describe, expect, it, vi } from "vitest";
import { addDays, addMonths, crDay } from "./admin-kpis";
import { demoAudit, demoWorld } from "./admin-demo";
import { getDashboard, getUserDetail, listSubscriptions, listUsers } from "./admin";
import { profilePlanFor } from "./onvo";
import type { Viewer } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: () => { throw new Error("sin Supabase en pruebas"); } }));

const viewer: Viewer = { demo: true, id: "demo", email: "demo@bananaburn.app", name: "Andrés", role: "superadmin", plan: "completo", onboarded: true, tz: "America/Costa_Rica", country: "CR" };
const DATES = ["2026-10-22T15:00:00Z", "2026-03-01T15:00:00Z", "2027-01-31T15:00:00Z"];

afterEach(() => vi.useRealTimers());

describe.each(DATES)("mundo demo coherente (%s)", (date) => {
  const setup = () => { vi.useFakeTimers(); vi.setSystemTime(new Date(date)); return demoWorld(); };

  it("es determinista", () => {
    const a = setup();
    const b = demoWorld();
    expect(b).toBe(a);
    expect(a.users.map((u) => u.full_name)).toEqual(a.users.map((u) => u.full_name));
    expect(new Set(a.users.map((u) => u.full_name)).size).toBe(a.users.length);
  });

  it("renovaciones según la periodicidad del último cobro", () => {
    const w = setup();
    const today = w.key;
    for (const s of w.subs) {
      const end = crDay(s.current_period_end!);
      const created = crDay(s.created_at!);
      if (s.status === "trialing") { expect(s.current_period_start).toBeNull(); expect(end).toBe(addDays(created, 7)); continue; }
      const last = crDay(s.current_period_start!);
      expect(end).toBe(addMonths(last, s.billing === "anual" ? 12 : 1));
      expect(last >= created).toBe(true);
      expect(last <= today).toBe(true);
      if (s.status === "active") expect(end > today).toBe(true);
      if (s.status === "past_due") { expect(end <= today).toBe(true); expect(end >= addDays(today, -3)).toBe(true); }
      if (s.canceled_at) { expect(crDay(s.canceled_at) >= created).toBe(true); expect(crDay(s.canceled_at) <= today).toBe(true); }
    }
  });

  it("plan y rol del perfil salen de la suscripción", () => {
    const w = setup();
    const now = new Date(`${w.key}T12:00:00-06:00`);
    for (const u of w.users) {
      const sub = u.sub ? profilePlanFor({ plan: u.sub.plan ?? null, status: u.sub.status ?? "", current_period_end: u.sub.current_period_end ?? null, cancel_at_period_end: u.sub.cancel_at_period_end }, now) : "free";
      const comp = u.comp && Date.parse(u.comp.expires_at) > now.getTime() ? u.comp.plan : "free";
      expect(u.plan).toBe(sub !== "free" ? sub : comp);
      if (["free", "pro"].includes(u.role)) expect(u.role).toBe(u.plan === "free" ? "free" : "pro");
      expect(crDay(u.created_at) <= w.key).toBe(true);
      for (const d of u.days) expect(d >= crDay(u.created_at) && d <= w.key).toBe(true);
      for (const d of u.workouts) expect(u.days.has(d)).toBe(true);
    }
  });

  it("cohortes posibles: n ≤ elegibles ≤ tamaño y D1 ≥ D7 ≥ D30", async () => {
    setup();
    const d = await getDashboard(viewer);
    expect(d.retention.length).toBe(8);
    expect(d.retention.some((r) => r.d30.rate !== null)).toBe(true);
    for (const r of d.retention) {
      for (const c of [r.d1, r.d7, r.d30]) { expect(c.n).toBeLessThanOrEqual(c.eligible); expect(c.eligible).toBeLessThanOrEqual(r.size); }
      if (r.d7.rate !== null) expect(r.d1.rate!).toBeGreaterThanOrEqual(r.d7.rate);
      if (r.d30.rate !== null) expect(r.d7.rate!).toBeGreaterThanOrEqual(r.d30.rate);
      if (r.d1.rate !== null) expect(r.d1.rate).toBeGreaterThan(0);
    }
  });

  it("Resumen, Usuarios, Pagos y ficha cuentan lo mismo", async () => {
    const w = setup();
    const [dash, users, pagos] = await Promise.all([getDashboard(viewer), listUsers(viewer, { page: 1 }), listSubscriptions(viewer, { page: 1 })]);
    expect(users.total).toBe(dash.users_total);
    const paying = w.subs.filter((s) => s.status === "active" || s.status === "past_due").length;
    expect(dash.paying).toBe(paying);
    expect(pagos.summary.active + pagos.summary.past_due).toBe(paying);
    expect(dash.revenue!.mrr).toBe(pagos.summary.mrr);
    expect(pagos.total).toBe(w.subs.length);
    // El estado de suscripción en Usuarios es el mismo que en Pagos, para cada usuario.
    const allUsers = (await listUsers(viewer, { page: 1 })).rows.concat(...await Promise.all(Array.from({ length: Math.ceil(users.total / 25) - 1 }, (_, i) => listUsers(viewer, { page: i + 2 }).then((x) => x.rows))));
    expect(allUsers.length).toBe(users.total);
    const allSubs = (await Promise.all(Array.from({ length: Math.ceil(pagos.total / 25) }, (_, i) => listSubscriptions(viewer, { page: i + 1 })))).flatMap((x) => x.rows);
    const byUser = new Map(allSubs.map((s) => [s.user_id, s]));
    for (const u of allUsers) {
      const s = byUser.get(u.id);
      expect(u.sub_status).toBe(s?.status ?? null);
      if (s) expect(u.billing).toBe(s.billingId);
    }
    // Ficha
    const sample = w.users.find((u) => u.sub)!;
    const det = await getUserDetail(viewer, sample.id);
    expect(det!.account.plan).toBe(sample.plan);
    expect(det!.billing!.subs[0].status).toBe(sample.sub!.status);
    expect(det!.activity!.workouts_total).toBe(sample.workouts.size);
  });

  it("auditoría apunta a usuarios existentes", () => {
    const w = setup();
    const ids = new Set(w.users.map((u) => u.id));
    for (const a of demoAudit()) if (a.target.startsWith("00000000")) expect(ids.has(a.target)).toBe(true);
  });
});
