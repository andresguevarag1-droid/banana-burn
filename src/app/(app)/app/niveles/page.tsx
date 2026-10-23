import Link from "next/link";
import { getViewer } from "@/lib/supabase/server";
import { getXpSummary } from "@/lib/xp-server";
import { getEntitlements } from "@/lib/entitlements";
import { CHECKIN_XP, CHALLENGE_DAY_XP, FULL_BONUS, LEVELS, LEVEL_PERKS, MEAL_XP, MEAL_XP_DAILY_MAX, MILESTONE_XP, PR_XP, SET_XP, STREAK_BONUS_MAX, STREAK_TIERS, WEIGH_XP } from "@/lib/gamify";
import { LevelBadge } from "@/components/levels/level-badge";
import { ProgressBar } from "@/components/progress-bar";
import { BananaFlame, BananaMedal, Barbell, BowlFood, Check, CheckCircle, CalendarCheck, Lock, Scales, Target } from "@/components/icons";

export const metadata = { title: "Niveles" };

const n = (x: number) => x.toLocaleString("es-CO");
const mult = (m: number) => `x${m.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
const DOW = ["D", "L", "M", "M", "J", "V", "S"];

export default async function Niveles() {
  const v = (await getViewer())!;
  const [s, ent] = await Promise.all([getXpSummary(v), getEntitlements(v)]);
  const maxDay = Math.max(1, ...s.history.map((d) => d.xp));
  const sum7 = s.history.reduce((a, d) => a + d.xp, 0);
  const bonus7 = s.history.reduce((a, d) => a + d.bonus, 0);

  const ways = [
    { icon: Barbell, title: "Entrenar", xp: `+${SET_XP} por serie, +${FULL_BONUS} si completas todo, +${PR_XP} por récord`, done: s.sources.workout, href: "/app/entreno", status: s.sources.workout ? "Hecho hoy" : null },
    // Registrar comidas es de Entreno + Nutrición: en Entreno se muestra con candado y lleva a Mi plan.
    ent.nutrition
      ? { icon: BowlFood, title: "Registrar comidas", xp: `+${MEAL_XP} cada una, hasta ${MEAL_XP_DAILY_MAX} al día`, done: s.sources.meals >= MEAL_XP_DAILY_MAX, href: "/app/nutricion", status: `${s.sources.meals} de ${MEAL_XP_DAILY_MAX}` }
      : { icon: Lock, title: "Registrar comidas", xp: `+${MEAL_XP} cada una, incluido en Entreno + Nutrición`, done: false, href: "/app/suscripcion", status: null },
    { icon: CalendarCheck, title: "Registro del día", xp: `+${CHECKIN_XP} con el primer dato de hoy (agua, pasos o sueño)`, done: s.sources.checkin, href: "/app", status: s.sources.checkin ? "Hecho hoy" : null },
    { icon: Scales, title: "Pesarte", xp: `+${WEIGH_XP} una vez al día`, done: s.sources.weigh, href: "/app/progreso", status: s.sources.weigh ? "Hecho hoy" : null },
    { icon: Target, title: "Reto del día", xp: `+${CHALLENGE_DAY_XP} al marcar un reto manual, +${MILESTONE_XP} en los hitos de los días 7 y 14`, done: s.sources.challengeDays > 0, href: "/app/retos", status: s.sources.challengeDays ? `${s.sources.challengeDays} hoy` : null },
  ];

  return (
    <div className="space-y-6 animate-enter">
      <header className="relative overflow-hidden rounded-[1.75rem] bg-ink p-5 text-white sm:p-7">
        <div aria-hidden className="absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(rgb(255 214 10 / .14) 1.5px, transparent 1.6px)", backgroundSize: "16px 16px" }} />
        <div className="relative flex items-center gap-4">
          <LevelBadge idx={s.level.idx} size="xl" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-banana">Nivel {s.level.idx} de {LEVELS.length}</p>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{s.level.n}</h1>
            <p className="mt-0.5 text-sm font-semibold text-white/75 tabular-nums">{n(s.total)} XP en total</p>
          </div>
        </div>
        <ProgressBar value={s.level.progress} min={0.03} className="relative mt-5 h-3" track="bg-white/15" fill="bg-banana" label={`Progreso al siguiente nivel`} />
        <p className="relative mt-2 text-sm font-semibold">
          {s.next ? <>Te faltan <b className="text-banana tabular-nums">{n(s.next.xpLeft)} XP</b> para {s.next.name}. Desbloqueas: {s.next.perk.text.charAt(0).toLowerCase() + s.next.perk.text.slice(1)}.</> : "Llegaste al nivel máximo. Sigue sumando para tu racha y la meta semanal."}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <section className="card p-5" aria-labelledby="ganar-t">
          <h2 id="ganar-t" className="font-extrabold text-ink">Cómo ganar XP hoy</h2>
          <p className="text-sm text-muted">Hoy llevas <b className="text-ink tabular-nums">+{n(s.today.xp)} XP</b>{s.today.bonus ? <>, de ellos {n(s.today.bonus)} de bono de racha</> : ""}.</p>
          <ul className="mt-3 divide-y divide-line">
            {ways.map((w) => (
              <li key={w.title}>
                <Link href={w.href} className="flex min-h-14 items-center gap-3 py-2.5 hover:bg-cream/60">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${w.done ? "bg-peel/10 text-peel" : "bg-banana-soft text-banana-ink"}`}>{w.done ? <CheckCircle weight="fill" className="size-5" /> : <w.icon weight="duotone" className="size-5" />}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-ink">{w.title}</span><span className="block text-xs text-muted">{w.xp}</span></span>
                  {w.status && <span className={`shrink-0 text-xs font-bold tabular-nums ${w.done ? "text-peel" : "text-muted"}`}>{w.status}</span>}
                </Link>
              </li>
            ))}
            <li className="flex min-h-14 items-center gap-3 py-2.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ember/10 text-ember-ink"><BananaFlame className="size-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-ink">Bono de racha</span><span className="block text-xs text-muted">{s.multiplier > 1 ? `${mult(s.multiplier)} sobre lo que ganes hoy` : "Desde 3 días seguidos, un extra sobre lo que ganes cada día"}</span></span>
              <span className="shrink-0 text-xs font-bold tabular-nums text-ember-ink">{s.bonusDue > 0 ? `+${n(s.bonusDue)} XP` : mult(s.multiplier)}</span>
            </li>
          </ul>
        </section>

        <div className="space-y-6">
          <section className="card p-5" aria-labelledby="semana-t">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="semana-t" className="font-extrabold text-ink">Meta de la semana</h2>
              <span className="text-sm font-bold tabular-nums text-ink">{n(s.week.xp)} / {n(s.week.goal)} XP</span>
            </div>
            <ProgressBar value={s.week.xp / s.week.goal} min={0.03} className="mt-3 h-3" fill={s.week.xp >= s.week.goal ? "bg-peel" : "bg-ink"} label="Meta semanal de XP" />
            <p className="mt-2 text-sm text-muted">{s.week.xp >= s.week.goal ? "Meta cumplida esta semana." : `Te faltan ${n(s.week.goal - s.week.xp)} XP de aquí al domingo. La meta crece con tu nivel.`}</p>
          </section>

          <section className="card p-5" aria-labelledby="racha-t">
            <div className="flex items-center justify-between gap-3">
              <h2 id="racha-t" className="flex items-center gap-2 font-extrabold text-ink"><BananaFlame weight={s.streak.todayDone ? "fill" : "duotone"} className="size-6 text-ember-ink" />Racha de {s.streak.days} {s.streak.days === 1 ? "día" : "días"}</h2>
              <span className="rounded-full bg-ink px-3 py-1 text-sm font-extrabold text-banana tabular-nums">{mult(s.multiplier)}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{s.nextTier ? `${s.nextTier.left === 1 ? "1 día más" : `${s.nextTier.left} días más`} y tu XP diario sube a ${mult(s.nextTier.mult)}.` : "Estás en el multiplicador máximo."} El bono se suma aparte en tu historial, con un tope de {STREAK_BONUS_MAX} XP al día. Cuenta cualquier día con entreno, registro o pesaje.</p>
            <ol className="mt-3 grid grid-cols-4 gap-2 text-center">
              {[...STREAK_TIERS].reverse().map((tr) => {
                const on = s.streak.days >= tr.days;
                return <li key={tr.days} className={`rounded-xl px-1 py-2 ${on ? "bg-ember/10 text-ember-ink" : "bg-cream text-muted"}`}><p className="text-sm font-extrabold tabular-nums">{mult(tr.mult)}</p><p className="text-[11px] font-semibold">{tr.days} días</p></li>;
              })}
            </ol>
          </section>
        </div>
      </div>

      <section className="card p-5" aria-labelledby="hist-t">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="hist-t" className="font-extrabold text-ink">Últimos 7 días</h2>
          <p className="text-sm text-muted tabular-nums"><b className="text-ink">{n(sum7)} XP</b>{bonus7 ? `, ${n(bonus7)} de bono de racha` : ""}</p>
        </div>
        <ol className="mt-4 grid h-40 grid-cols-7 items-end gap-2" aria-label="XP por día">
          {s.history.map((d) => {
            const dow = new Date(d.day + "T12:00:00").getDay();
            const h = d.xp ? Math.max(6, Math.round((d.xp / maxDay) * 100)) : 0;
            const bonusH = d.xp ? Math.round((d.bonus / d.xp) * 100) : 0;
            const isToday = d.day === s.history[s.history.length - 1].day;
            return (
              <li key={d.day} className="flex h-full flex-col items-center justify-end gap-1">
                <span className="text-[11px] font-bold tabular-nums text-ink">{d.xp ? n(d.xp) : ""}</span>
                <span className="relative flex w-full max-w-10 flex-col justify-end overflow-hidden rounded-lg bg-cream" style={{ height: `${h}%`, minHeight: d.xp ? 6 : 4 }}>
                  <span className={`w-full ${isToday ? "bg-ember" : "bg-ink"}`} style={{ height: `${100 - bonusH}%` }} />
                  {bonusH > 0 && <span className="absolute inset-x-0 top-0 bg-banana" style={{ height: `${bonusH}%` }} />}
                </span>
                <span className={`text-[11px] font-bold ${isToday ? "text-ink" : "text-faint"}`}>{DOW[dow]}</span>
                <span className="sr-only">{d.day}: {d.xp} XP{d.bonus ? `, ${d.bonus} de bono` : ""}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-ink" />XP ganado</span><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-banana" />Bono de racha</span><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-ember" />Hoy</span></p>
      </section>

      <section className="space-y-3" aria-labelledby="escalera-t">
        <h2 id="escalera-t" className="text-xl font-extrabold text-ink">La escalera</h2>
        <ol className="space-y-2">
          {LEVELS.map((lv, i) => {
            const idx = i + 1, cur = idx === s.level.idx, got = idx < s.level.idx;
            return (
              <li key={lv.n} className={`flex items-center gap-3 rounded-2xl border p-3 ${cur ? "border-ember bg-ember/5 ring-2 ring-ember/20" : got ? "border-line bg-white" : "border-line bg-white/60"}`} aria-current={cur ? "step" : undefined}>
                <LevelBadge idx={idx} locked={!got && !cur} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm font-extrabold text-ink">{lv.n}<span className="text-xs font-semibold text-muted tabular-nums">{n(lv.xp)} XP</span>{cur && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-extrabold text-banana">Estás aquí</span>}</p>
                  <p className="text-xs text-muted">{LEVEL_PERKS[i].text}</p>
                </div>
                <span className="shrink-0" role="img" aria-label={got || cur ? "Desbloqueado" : "Bloqueado"}>{got || cur ? <Check weight="bold" className="size-5 text-peel" /> : <Lock weight="duotone" className="size-5 text-faint" />}</span>
              </li>
            );
          })}
        </ol>
        <p className="flex items-start gap-2 text-xs text-muted"><BananaMedal className="size-4 shrink-0 text-banana-ink" />Los comodines extra se aplican a los retos que empieces después de subir; el descuento se aplica al comprar retos Premium.</p>
      </section>
    </div>
  );
}
