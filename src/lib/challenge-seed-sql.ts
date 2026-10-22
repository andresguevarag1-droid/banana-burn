// SQL de la siembra de retos (lo usa scripts/gen-retos-seed.ts y lo comprueba challenge-seed.test.ts).
import type { SeedChallenge } from "./challenge-seed";

const q = (s: string | null) => (s === null ? "null" : `'${s.replace(/'/g, "''")}'`);

export function seedSql(seed: SeedChallenge[]) {
  const cols = "slug, title, description, days, rules, status, price_usd, difficulty, minutes, cover, icon, verify, grace, xp, steps_goal, badge, reward_title, start_mode, start_date, featured, coming_soon, safety_note, sort";
  const rows = seed.map((s) => `  (${[
    q(s.slug), q(s.title), q(s.description), s.days, "'{}'::jsonb", "'publicado'", s.priceUsd.toFixed(2), q(s.difficulty), s.minutes, q(s.cover), q(s.icon), q(s.verify),
    s.grace, s.xp, s.stepsGoal ?? "null", q(s.badge), q(s.rewardTitle), q(s.startMode), s.startDate ? `'${s.startDate}'` : "null", s.featured, s.comingSoon, q(s.safetyNote), s.sort,
  ].join(", ")})`);
  const plans = seed.map((s) => `  (${q(s.slug)}, $plan$${JSON.stringify(s.plan)}$plan$::jsonb)`);
  return [
    "-- ───────────── 7. Siembra (generada con scripts/gen-retos-seed.ts; no pisa lo editado en el panel) ─────────────",
    `insert into public.challenges_catalog (${cols}) values`,
    rows.join(",\n"),
    "on conflict (slug) do nothing;",
    "",
    "insert into public.challenge_plans (slug, days) values",
    plans.join(",\n"),
    "on conflict (slug) do nothing;",
    "",
  ].join("\n");
}
