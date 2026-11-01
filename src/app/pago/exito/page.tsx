import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Barbell, Clock, MagnifyingGlass, MonkeyBanana } from "@/components/icons";
import { createClient, getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { ANNUAL_SEASON_NOTE, annualSaving, PLANS } from "@/lib/plans";
import { AutoRefresh } from "./auto-refresh";
import { FunnelTracker } from "@/components/analytics";

import { usd2 } from "@/lib/num";
import { canEnroll, longDate, SEASONS_T1 } from "@/lib/seasons";
import { todayFor } from "@/lib/today";
import { REF_GROUP_SIZE, REF_BASE_MONTHS, REF_ANNUAL_MONTHS, REF_WINDOW_DAYS, REF_MAX_REWARDS_YEAR } from "@/lib/referrals";

export const metadata = { title: "Pago recibido" };

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric" }) : null);

export default async function Exito({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const v = await getViewer();
  if (!v) redirect(`/entrar?next=${encodeURIComponent(`/pago/exito${s ? `?s=${s}` : ""}`)}`);

  let confirmed = false;
  // ¿Hay un pago que esperar? Solo si el enlace trae una suscripción de esta cuenta.
  let pending = false;
  let planName: string | null = null;
  let billing: string | null = null;
  let renews: string | null = null;
  if (!v.demo) {
    const ent = await getEntitlements(v);
    billing = ent.billing ?? null;
    let target = ent.plan;
    if (s) {
      const { data: row } = await (await createClient()).from("subscriptions").select("status, plan, billing").eq("provider_subscription_id", s).eq("user_id", v.id).maybeSingle();
      confirmed = row?.status === "active";
      pending = row?.status === "incomplete"; // el webhook de ONVO aún no la activa
      target = (row?.plan as typeof target) ?? target;
      billing = (row?.billing as string | undefined) ?? null;
    } else confirmed = ent.fromSubscription && ent.plan !== "free";
    planName = PLANS.find((p) => p.id === target)?.name ?? null;
    renews = fmt(ent.renewsAt);
  }

  if (v.demo) {
    return (
      <Card icon={<MonkeyBanana className="size-10" />} title="Modo demo" body="En la demo no se procesan pagos.">
        <Link href="/app" className="btn-primary">Ir a Banana Burn</Link>
      </Card>
    );
  }

  if (!confirmed && !pending) {
    return (
      <Card icon={<MagnifyingGlass weight="duotone" className="size-8" />} title="No encontramos un pago" body="No vemos un pago reciente en tu cuenta. Si acabas de pagar, revisa Mi plan en unos minutos; si no, elige tu plan cuando quieras.">
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link href="/app/suscripcion" className="btn-primary">Ver mi suscripción</Link>
          <Link href="/precios" className="btn-ghost">Ver planes</Link>
        </div>
        <Link href="/app" className="tap inline-block text-sm font-semibold text-muted underline underline-offset-2 transition-colors duration-150 hover:text-ink">Ir a Banana Burn</Link>
      </Card>
    );
  }

  if (!confirmed) {
    return (
      <Card icon={<Clock weight="duotone" className="size-8" />} title="Estamos confirmando tu pago…" body="Suele tardar unos segundos. No cierres esta página; se actualiza sola.">
        <AutoRefresh />
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link href="/app/entreno" data-cta="exito-pendiente-entreno" className="btn-primary"><Barbell weight="duotone" className="size-5" />Entrenar mientras tanto</Link>
          <Link href="/app/suscripcion" className="btn-ghost">Ver mi suscripción</Link>
        </div>
        <p className="text-xs text-muted text-pretty">Si en 15 minutos no ves tu plan activo, escríbenos a <a className="tap underline underline-offset-2" href="mailto:hola@bananaburn.app">hola@bananaburn.app</a> con el correo de tu cuenta. No vuelvas a pagar.</p>
      </Card>
    );
  }

  const plan = PLANS.find((p) => p.name === planName);
  const nutrition = plan?.nutrition;
  const season = SEASONS_T1[0];
  const seasonOpen = canEnroll(season, todayFor(v).iso);
  return (
    <Card icon={<MonkeyBanana className="size-10" />} tone="ok" title={`${planName ?? "Tu plan"} ya está activo`} body="Todo lo que llevas sigue ahí. El siguiente paso es tu entreno de hoy.">
      <FunnelTracker view="purchase_success" props={{ plan: planName ?? "", ...(billing ? { billing } : {}) }} />
      <Link href="/app/entreno" data-cta="exito-entreno" className="btn-banana w-full h-14 text-base">Ir a mi entreno de hoy<ArrowRight weight="bold" className="size-5" /></Link>
      <ol className="text-left space-y-3 text-[15px] border-t border-line pt-5">
        <Step n={1}>Haz tu rutina de hoy: cada serie trae su peso.</Step>
        {nutrition ? <Step n={2}>Registra tu próxima comida en <b>Comida</b>: ya tienes tus calorías y macros.</Step> : <Step n={2}>Pregúntale a <b>Coach Banana</b> cualquier duda de técnica.</Step>}
        {nutrition ? <Step n={3}>Pésate mañana en ayunas para que tus calorías se ajusten a ti cada semana.</Step> : <Step n={3}>Pésate mañana en ayunas para ver tu progreso real.</Step>}
      </ol>
      {nutrition === false && <p className="text-sm text-muted text-pretty">Tu plan incluye entreno, coach, progreso, agua, pasos y sueño, comunidad y retos gratis. <span className="line-through">Nutrición</span> no incluida; tus comidas guardadas no se borran.</p>}
      <div className="space-y-4 border-t border-line pt-5 text-left">
        {billing === "mes" && plan && <section aria-labelledby="exito-anual" className="rounded-3xl bg-banana-soft p-4 space-y-2">
          <h2 id="exito-anual" className="font-extrabold text-ink">Ahorra <span className="tabular-nums">{usd2(annualSaving(plan))}</span> con el anual</h2>
          <p className="text-sm text-body">{usd2(plan.price.anual)} al año frente a {usd2(plan.price.mes * 12)} por 12 mensualidades a precio regular. Precios en USD con IVA incluido. {ANNUAL_SEASON_NOTE} por cada año pagado.</p>
          <p className="text-xs text-body">El anual empieza al confirmar el pago y reemplaza tu plan actual, sin prorrateo.</p>
          <Link href={`/app/suscripcion?plan=${plan.id}&pago=anual`} data-cta="exito-anual" className="tap inline-flex min-h-11 items-center font-bold text-sm text-ink underline underline-offset-4">Ver cambio a anual</Link>
        </section>}
        {seasonOpen && <section aria-labelledby="exito-temporada" className="rounded-3xl border border-line p-4 space-y-2">
          <h2 id="exito-temporada" className="font-extrabold text-ink">Temporada 1: elige tu deporte</h2>
          <p className="text-sm text-body">Running, Raquetas o Cross Training. Del {longDate(season.startsOn)} al {longDate(season.endsOn)}. Inscripciones hasta el {longDate(season.enrollUntil)}.</p>
          <p className="text-sm text-muted">{billing === "anual" ? "Tu anual incluye 1 temporada por año pagado. Revisa si tienes el canje disponible." : "Se compra aparte o puedes usar la temporada incluida al cambiar a anual."}</p>
          <Link href="/app/temporadas" data-cta="exito-temporadas" className="tap inline-flex min-h-11 items-center font-bold text-sm text-ink underline underline-offset-4">Ver Temporada 1</Link>
        </section>}
        <section aria-labelledby="exito-referidos" className="rounded-3xl border border-line p-4 space-y-2">
          <h2 id="exito-referidos" className="font-extrabold text-ink">Invita y gana meses gratis</h2>
          <p className="text-sm text-body">Cada {REF_GROUP_SIZE} amigos calificados te dan {REF_BASE_MONTHS} mes gratis. Si uno de ese grupo compra el anual y se confirma su pago, el premio pasa a {REF_ANNUAL_MONTHS} meses en total.</p>
          <p className="text-xs text-muted">Deben crear una cuenta nueva con tu enlace, terminar la bienvenida y, en sus primeros {REF_WINDOW_DAYS} días, completar un entreno o registrar agua, pasos o sueño. No cuentan cuentas propias ni repetidas. Las cuentas en revisión requieren validación. Máximo {REF_MAX_REWARDS_YEAR} premios en 365 días.</p>
          <Link href="/app/referidos" data-cta="exito-referidos" className="tap inline-flex min-h-11 items-center font-bold text-sm text-ink underline underline-offset-4">Ver mi enlace de referidos</Link>
        </section>
      </div>
      <p className="text-xs text-muted text-pretty">{renews ? `Se renueva el ${renews}. ` : ""}Cancelas cuando quieras desde <Link href="/app/suscripcion" className="font-semibold text-ink underline underline-offset-2">Mi plan</Link>, donde también quedan tus recibos.</p>
    </Card>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return <li className="flex gap-3"><span className="grid place-items-center size-7 shrink-0 rounded-full bg-banana text-sm font-extrabold text-ink" aria-hidden>{n}</span><span>{children}</span></li>;
}

function Card({ icon, title, body, children, tone }: { icon: React.ReactNode; title: string; body: string; children: React.ReactNode; tone?: "ok" }) {
  return (
    <div className="card p-6 sm:p-8 text-center space-y-5 animate-rise">
      <span className={`mx-auto grid place-items-center size-16 rounded-3xl ${tone === "ok" ? "bg-peel/10 text-peel" : "bg-banana-soft text-banana-ink"}`}>{icon}</span>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink text-balance">{title}</h1>
      <p className="text-muted text-pretty">{body}</p>
      {children}
    </div>
  );
}
