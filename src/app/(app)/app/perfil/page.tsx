import Link from "next/link";
import { createClient, getViewer } from "@/lib/supabase/server";
import { CommunitySettings } from "./community-settings";
import { Glp1Settings } from "./glp1-settings";
import { NotificationSettings } from "@/components/notifications/settings";
import { getEntitlements } from "@/lib/entitlements";
import { getAthlete } from "@/lib/athlete";
import { getDaily } from "@/lib/daily";
import { PLANS } from "@/lib/plans";
import { TrainingSettings, DataControls } from "./settings";
import { ArrowRight, BananaFlame, Barbell, LevelIcon, Lock, ShieldCheck, Target, Users, type PhosphorIcon } from "@/components/icons";

function H({ icon: I, children, className = "" }: { icon: PhosphorIcon; children: React.ReactNode; className?: string }) {
  return <h2 className={`flex items-center gap-2 font-extrabold text-ink ${className}`}><span className="grid place-items-center size-8 shrink-0 rounded-lg bg-banana-soft text-banana-ink"><I weight="duotone" className="size-5" /></span>{children}</h2>;
}

export const metadata = { title: "Mi perfil" };

export default async function Perfil() {
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const g = await getDaily(v, a.startWeight, a.currentWeight);
  let cp = { username: "andres", bio: "Bajando de 94 a 85 kg con Banana Burn", visibility: "seguidores" as "publico" | "seguidores" | "privado", share: true };
  if (!v.demo) {
    const { data } = await (await createClient()).from("profiles").select("username,bio,visibility,share_workouts").eq("id", v.id).maybeSingle();
    cp = { username: (data?.username as string) ?? "", bio: (data?.bio as string) ?? "", visibility: (data?.visibility as typeof cp.visibility) ?? "seguidores", share: data?.share_workouts !== false };
  }
  const ent = await getEntitlements(v);
  const plan = PLANS.find((p) => p.id === ent.plan) ?? null;
  return (
    <div className="space-y-5 animate-enter max-w-2xl">
      <header className="flex items-center gap-4">
        <span className="grid place-items-center size-16 rounded-3xl bg-banana text-2xl font-extrabold text-ink">{a.name[0]?.toUpperCase()}</span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink truncate">{a.name}</h1>
          <p className="text-sm text-muted truncate">{v.email}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <span className="inline-flex items-center gap-1 rounded-full bg-banana-soft px-2 py-0.5 text-banana-ink"><LevelIcon idx={g.level.idx} className="size-3.5" />{g.level.n}, nivel {g.level.idx}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-ember/10 px-2 py-0.5 text-ember-ink"><BananaFlame className="size-3.5" />{g.streak.days} {g.streak.days === 1 ? "día" : "días"} de racha</span>
          </p>
        </div>
      </header>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-semibold text-muted">Suscripción</p><p className="text-lg font-extrabold text-ink">{plan ? plan.name : "Beta sin costo"}</p></div>
          <Link href="/app/suscripcion" className="btn-ghost h-10 text-sm px-4">{plan ? "Gestionar" : "Ver planes"}</Link>
        </div>
        <p className="mt-2 text-sm text-muted">{plan ? "Pagas con tarjeta, SINPE Móvil o Apple Pay. Cancela cuando quieras." : "Durante la beta tienes acceso completo. Te avisaremos antes de cualquier cobro."}</p>
      </section>

      <section className="card p-5">
        <H icon={Barbell} className="mb-4">Mi plan de entreno</H>
        <TrainingSettings days={a.trainDays} equipment={a.equipment} mode={a.mode} level={a.level} minutes={a.minutes} />
      </section>

      <section id="glp1" className="card p-5 scroll-mt-6">
        <div className="flex items-center justify-between gap-3 mb-4"><H icon={ShieldCheck}>Banana Shield <span className="font-semibold text-muted">para GLP-1</span></H><Link href="/app/glp1" className="tap inline-flex items-center gap-1 text-sm font-bold text-banana-ink hover:text-ink">Ver guía <ArrowRight weight="bold" className="size-3.5" /></Link></div>
        <Glp1Settings on={a.glp1.on} med={a.glp1.med} dow={a.glp1.injectionDow} />
      </section>

      <section className="card p-5"><NotificationSettings /></section>

      <section id="comunidad" className="card p-5 scroll-mt-6">
        <H icon={Users} className="mb-4">Perfil en la comunidad</H>
        <CommunitySettings username={cp.username} bio={cp.bio} visibility={cp.visibility} share={cp.share} />
      </section>

      <section className="card p-5">
        <H icon={Target}>Meta</H>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-muted">{a.startWeight} kg <ArrowRight weight="bold" className="size-4 text-faint" /><span className="sr-only">a</span> <b className="text-ink">{a.goalWeight} kg</b> el {new Date(a.goalDate + "T12:00:00").toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric" })}</p>
        <Link href="/app/progreso#meta" className="tap mt-3 inline-flex items-center gap-1 text-sm font-bold text-banana-ink hover:text-ink">Editar meta y datos <ArrowRight weight="bold" className="size-3.5" /></Link>
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
