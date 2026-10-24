import Link from "next/link";
import { createClient, getViewer } from "@/lib/supabase/server";
import { CommunitySettings } from "./community-settings";
import { Glp1Settings } from "./glp1-settings";
import { NotificationSettings } from "@/components/notifications/settings";
import { getNotificationPrefs } from "@/app/actions/notifications";
import { AccountSettings } from "./account";
import { getEntitlements } from "@/lib/entitlements";
import { getAthlete } from "@/lib/athlete";
import { coachOf } from "@/lib/coaches";
import { getDaily, prefetchDaily } from "@/lib/daily";
import { PLANS } from "@/lib/plans";
import { TrainingSettings, DataControls } from "./settings";
import { ArrowRight, BananaFlame, Barbell, ChatCircleText, Compass, LevelIcon, Lifebuoy, Lock, ShieldCheck, Sparkle, Target, User, Users, type PhosphorIcon } from "@/components/icons";
import { perksAt } from "@/lib/gamify";
import { FRAME_RING } from "@/components/levels/level-badge";
import { getMyPower, getMyVerification } from "@/lib/profile-power-server";
import { TIER_CARD, TierBanner, TierGuide, TierPill, TierProgress, PowerStats, Showcase } from "@/components/perfil/power";
import { InsigniasPicker } from "@/components/perfil/insignias-picker";
import { VerifyCard } from "@/components/perfil/verify-card";
import { FeaturedBadge, VerifiedMark } from "@/components/community/flair";
import { insigniaMeta } from "@/lib/profile-power";
import { money } from "@/lib/copy";
import { TesterBadge } from "@/components/testers/tester-badge";
import { getMyTester } from "@/lib/testers-server";
import { OpenGuideButton } from "@/components/guide/open-guide";
import { VoiceSettings } from "./voice-settings";
import { getVoice } from "@/lib/voice-server";
import { nfmt } from "@/lib/num";

function H({ icon: I, children, className = "" }: { icon: PhosphorIcon; children: React.ReactNode; className?: string }) {
  return <h2 className={`flex items-center gap-2 font-extrabold text-ink ${className}`}><span className="grid place-items-center size-8 shrink-0 rounded-lg bg-banana-soft text-banana-ink"><I weight="duotone" className="size-5" /></span>{children}</h2>;
}

export const metadata = { title: "Mi perfil" };

const fmtDay = (iso?: string, tz?: string) => { if (!iso) return null; try { return new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: tz }); } catch { return null; } };

export default async function Perfil({ searchParams }: { searchParams: Promise<{ clave?: string; tester?: string }> }) {
  const v = (await getViewer())!;
  prefetchDaily(v); // el registro del día se lee en paralelo con el atleta (getDaily lo reutiliza)
  const sp = await searchParams;
  // En paralelo: el perfil público, el plan, los avisos y las medallas no dependen del atleta.
  const profileRow = v.demo ? Promise.resolve(null) : createClient().then((sb) => sb.from("profiles").select("username,bio,visibility,share_workouts").eq("id", v.id).maybeSingle()).then((r) => r.data);
  const [a, data, ent, prefs, power, verif, tester, voice] = await Promise.all([getAthlete(v), profileRow, getEntitlements(v), getNotificationPrefs().catch(() => null), getMyPower(v), getMyVerification(v).catch(() => null), getMyTester(v, v.demo ? sp.tester : null).catch(() => null), getVoice(v)]);
  const isTester = tester?.phase === "activo" || tester?.phase === "pronto";
  const g = await getDaily(v, a.startWeight, a.currentWeight);
  let cp = { username: "andres", bio: "Bajando de 94 a 85 kg con Banana Burn", visibility: "seguidores" as "publico" | "seguidores" | "privado", share: true };
  if (!v.demo) cp = { username: (data?.username as string) ?? "", bio: (data?.bio as string) ?? "", visibility: (data?.visibility as typeof cp.visibility) ?? "seguidores", share: data?.share_workouts !== false };
  const frame = perksAt(g.level.idx).frame;
  const featuredIns = power.insignias.find((i) => i.id === power.featured) ?? null;
  const featured = featuredIns ? insigniaMeta(featuredIns.id, { label: featuredIns.label, icon: featuredIns.icon, cover: featuredIns.cover, xp: power.stats.totalXp }) : null;
  const plan = PLANS.find((p) => p.id === ent.plan) ?? null;
  const planTitle = plan ? plan.name : ent.trial ? "Prueba gratis" : "Sin plan";
  const planText = isTester && (ent.access === "comp" || ent.access === "demo") ? `Mes de tester de la beta hasta el ${fmtDay(tester!.until ?? undefined, v.tz)}: Entreno + Nutrición, sin cobros.${ent.charge?.testerHold ? ` Tu cobro programado pasa al ${fmtDay(ent.charge.chargeAt, v.tz)}.` : ""}`
    : ent.access === "demo" ? "Modo demo: acceso completo, sin cobros." : ent.access === "comp" ? `Plan de cortesía${ent.compEndsAt ? ` hasta el ${fmtDay(ent.compEndsAt, v.tz)}` : ""}, sin cobros.`
    : ent.access === "staff" ? "Acceso completo por ser parte del equipo."
    : ent.access === "manual" ? "Plan asignado por el equipo de Banana Burn, sin cobros automáticos."
    : plan ? "Pagas con tarjeta de crédito o débito. Cancela cuando quieras."
    : ent.trial ? `Tienes todo incluido hasta el ${fmtDay(ent.trial.endsAt, v.tz)} (${ent.trial.daysLeft === 1 ? "último día" : `${ent.trial.daysLeft} días`}). ${
      ent.charge?.phase === "programado" ? `El ${fmtDay(ent.charge.chargeAt, v.tz)} se cobra tu plan de ${money(ent.charge.amount)}, salvo que canceles antes.`
      : ent.charge?.phase === "cancelado" ? "Cancelaste tu plan: no se te cobrará."
      : ent.trial.beta ? "Todavía no guardaste una tarjeta, así que no hay cobros. Agrégala en Mi plan antes de esa fecha para seguir sin cortes."
      : "Después eliges tu plan."}`
    : ent.charge?.phase === "reintento" || ent.charge?.phase === "fallido" ? "No pudimos cobrar tu plan. Cambia tu tarjeta en Mi plan para seguir; tus datos siguen guardados."
    : ent.cardStep === "trial" ? "Elige tu plan y guarda tu tarjeta en Mi plan para empezar tus 7 días gratis."
    : "Tu prueba gratis terminó. Elige un plan para seguir; tus datos siguen guardados.";
  return (
    <div className="space-y-5 animate-enter max-w-2xl">
      <section id="poder" className={`card overflow-hidden scroll-mt-6 ${TIER_CARD[power.tier] ?? ""}`} aria-labelledby="perfil-nombre">
        <TierBanner tier={power.tier} className="h-28 sm:h-36">
          <TierPill tier={power.tier} className="absolute left-4 top-4" />
        </TierBanner>
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between gap-3">
            <span className={`relative z-10 -mt-10 grid size-20 shrink-0 place-items-center rounded-3xl bg-banana text-3xl font-extrabold text-ink shadow-lift ${frame ? FRAME_RING[frame] : "ring-4 ring-white"}`} title={frame ? "Marco desbloqueado por tu nivel" : undefined}>{a.name[0]?.toUpperCase()}</span>
            {cp.username && <Link href={`/app/comunidad/u/${cp.username}`} className="btn-ghost mt-3 h-11 px-4 text-sm">Ver mi perfil público</Link>}
          </div>
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h1 id="perfil-nombre" className="min-w-0 truncate text-2xl font-extrabold tracking-tight text-ink">{a.name}</h1>
            {power.stats.verified && <VerifiedMark className="size-6" />}
            {featured && <FeaturedBadge f={featured} />}
          </div>
          <p className="text-sm text-muted truncate">{v.email}</p>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <Link href="/app/niveles" className="tap inline-flex h-7 items-center gap-1 rounded-full bg-banana-soft px-2.5 text-banana-ink hover:bg-banana"><LevelIcon idx={g.level.idx} className="size-3.5" />{g.level.n}, nivel {g.level.idx}</Link>
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-ember/10 px-2.5 text-ember-ink"><BananaFlame className="size-3.5" />{g.streak.days} {g.streak.days === 1 ? "día" : "días"} de racha</span>
            {isTester && <TesterBadge />}
          </p>
          <div className="mt-4 space-y-3">
            <TierProgress points={power.points} />
            <PowerStats p={power} />
          </div>
        </div>
      </section>

      {!power.stats.verified && <VerifyCard s={verif} />}

      <Showcase items={power.showcase} mine />

      {power.insignias.length > 0 && <InsigniasPicker items={power.insignias} featured={power.featured} />}

      <TierGuide p={power} mine />

      {power.stats.verified && <VerifyCard s={verif} />}

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-semibold text-muted">Suscripción</p><p className="text-lg font-extrabold text-ink">{planTitle}</p></div>
          <Link href="/app/suscripcion" className="btn-ghost h-11 text-sm px-4">{ent.fromSubscription ? "Gestionar" : "Ver planes"}</Link>
        </div>
        <p className="mt-2 text-sm text-muted">{planText}</p>
      </section>

      <section className="card p-5">
        <H icon={Compass}>Guía de Banana Burn</H>
        <p className="mt-1 text-sm text-muted">Cómo entrenar, retos, {ent.nutrition ? "nutrición, " : ""}tu coach y tu progreso, según tu plan.</p>
        <OpenGuideButton className="btn-ghost mt-3 h-11 text-sm px-4" />
      </section>

      <section className="card p-5">
        <H icon={Sparkle}>Novedades</H>
        <p className="mt-1 text-sm text-muted">Todo lo que mejoramos en Banana Burn y cómo te ayuda.</p>
        <Link href="/app/novedades" className="btn-ghost mt-3 h-11 text-sm px-4">Ver las novedades<ArrowRight weight="bold" className="size-4" aria-hidden /></Link>
      </section>

      <section className="card p-5">
        <H icon={Barbell} className="mb-4">Mi plan de entreno</H>
        <TrainingSettings days={a.trainDays} equipment={a.equipment} mode={a.mode} level={a.level} minutes={a.minutes} />
      </section>

      <section id="lenguaje" className="card p-5 scroll-mt-6">
        <H icon={ChatCircleText}>Cómo te hablo</H>
        <p className="mt-1 mb-4 text-sm text-muted">{coachOf(a.program?.meta.experience).name} te explica el entreno con estas palabras. Las series, las repeticiones y los pesos son los mismos en las tres.</p>
        <VoiceSettings voice={voice} />
      </section>

      <section id="glp1" className="card p-5 scroll-mt-6">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-4">
          <H icon={ShieldCheck} className="min-w-0"><span className="min-w-0">Banana Shield <span className="block sm:inline text-sm sm:text-base font-semibold text-muted">para GLP-1</span></span></H>
          {ent.nutrition && <Link href="/app/glp1" className="tap inline-flex items-center gap-1 text-sm font-bold text-banana-ink hover:text-ink">Ver guía <ArrowRight weight="bold" className="size-3.5" /></Link>}
        </div>
        {ent.nutrition ? <Glp1Settings on={a.glp1.on} med={a.glp1.med} dow={a.glp1.injectionDow} /> : (
          <div className="rounded-2xl bg-cream p-4 text-sm">
            <p className="text-body">Si estás en tratamiento con GLP-1, Banana Shield cuida que lo que bajes sea grasa y no músculo. Está incluido en Entreno + Nutrición.</p>
            <Link href="/app/suscripcion" className="tap mt-2 inline-flex items-center gap-1 font-bold text-banana-ink hover:text-ink">Ver planes <ArrowRight weight="bold" className="size-3.5" /></Link>
          </div>
        )}
      </section>

      <section className="card p-5"><NotificationSettings initial={prefs} /></section>

      <section id="ayuda" className="card p-5 scroll-mt-6" aria-labelledby="ayuda-t">
        <h2 id="ayuda-t" className="flex items-center gap-2 font-extrabold text-ink"><span className="grid place-items-center size-8 shrink-0 rounded-lg bg-banana-soft text-banana-ink"><Lifebuoy weight="duotone" className="size-5" /></span>Ayuda y soporte</h2>
        <p className="mt-2 text-sm text-muted text-pretty">¿Algo falla o tienes un problema con tu cuenta o un cobro? Repórtalo y sigue tu caso: te avisamos cuando lo recibimos, cuando lo trabajamos y cuando queda resuelto.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/app/soporte/nuevo?origen=perfil&desde=/app/perfil" className="btn-primary h-11 px-4 text-sm">Reportar un problema</Link>
          <Link href="/app/soporte" className="btn-ghost h-11 px-4 text-sm">Mis reportes</Link>
        </div>
      </section>

      <section id="comunidad" className="card p-5 scroll-mt-6">
        <H icon={Users} className="mb-4">Perfil en la comunidad</H>
        <CommunitySettings username={cp.username} bio={cp.bio} visibility={cp.visibility} share={cp.share} />
      </section>

      <section className="card p-5">
        <H icon={Target}>Meta</H>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-muted">{nfmt(a.startWeight)} kg <ArrowRight weight="bold" className="size-4 text-faint" /><span className="sr-only">a</span> <b className="text-ink">{nfmt(a.goalWeight)} kg</b> el {new Date(a.goalDate + "T12:00:00").toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric" })}</p>
        <Link href="/app/progreso#meta" className="tap mt-3 inline-flex items-center gap-1 text-sm font-bold text-banana-ink hover:text-ink">Editar meta y datos <ArrowRight weight="bold" className="size-3.5" /></Link>
      </section>

      <section id="cuenta" className="card p-5 scroll-mt-6">
        <H icon={User} className="mb-4">Cuenta</H>
        <AccountSettings name={a.name} email={v.email} newPassword={sp.clave === "nueva" && !v.demo} />
      </section>

      <section className="card p-5">
        <H icon={Lock}>Mis datos</H>
        <p className="mt-1 mb-4 text-sm text-muted">Tus datos de salud son tuyos (Ley 8968). Descárgalos o bórralos cuando quieras.</p>
        <DataControls />
      </section>
      <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted"><Link href="/privacidad" className="underline">Privacidad</Link><Link href="/terminos" className="underline">Términos</Link><a href="mailto:hola@bananaburn.app" className="underline">hola@bananaburn.app</a></p>
    </div>
  );
}
