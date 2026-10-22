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

export const metadata = { title: "Mi perfil" };

export default async function Perfil() {
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const g = await getDaily(v, a.startWeight, a.currentWeight);
  let cp = { username: "andres", bio: "Bajando de 94 a 85 kg 🍌", visibility: "seguidores" as "publico" | "seguidores" | "privado", share: true };
  if (!v.demo) {
    const { data } = await (await createClient()).from("profiles").select("username,bio,visibility,share_workouts").eq("id", v.id).maybeSingle();
    cp = { username: (data?.username as string) ?? "", bio: (data?.bio as string) ?? "", visibility: (data?.visibility as typeof cp.visibility) ?? "seguidores", share: data?.share_workouts !== false };
  }
  const ent = await getEntitlements(v);
  const plan = PLANS.find((p) => p.id === ent.plan) ?? null;
  return (
    <div className="space-y-5 animate-rise max-w-2xl">
      <header className="flex items-center gap-4">
        <span className="grid place-items-center size-16 rounded-3xl bg-banana text-2xl font-extrabold text-ink">{a.name[0]?.toUpperCase()}</span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink truncate">{a.name}</h1>
          <p className="text-sm text-muted truncate">{v.email}</p>
          <p className="mt-1 text-xs font-bold text-banana-ink">{g.level.e} Nivel {g.level.idx} · {g.level.n} · 🔥 {g.streak.days} días</p>
        </div>
      </header>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <div><p className="text-xs font-bold uppercase tracking-wider text-muted">Suscripción</p><p className="text-lg font-extrabold text-ink">{plan ? plan.name : "Beta sin costo"}</p></div>
          <Link href="/app/suscripcion" className="btn-ghost h-10 text-sm px-4">{plan ? "Gestionar" : "Ver planes"}</Link>
        </div>
        <p className="mt-2 text-sm text-muted">{plan ? "Pagas con tarjeta, SINPE Móvil o Apple Pay. Cancela cuando quieras." : "Durante la beta tienes acceso completo. Te avisaremos antes de cualquier cobro."}</p>
      </section>

      <section className="card p-5">
        <h2 className="font-extrabold text-ink mb-4">🏋️ Mi plan de entreno</h2>
        <TrainingSettings days={a.trainDays} equipment={a.equipment} mode={a.mode} level={a.level} minutes={a.minutes} />
      </section>

      <section id="glp1" className="card p-5 scroll-mt-6">
        <div className="flex items-baseline justify-between mb-4"><h2 className="font-extrabold text-ink">🛡️ Banana Shield · GLP-1</h2><Link href="/app/glp1" className="text-sm font-bold text-banana-ink">Ver guía →</Link></div>
        <Glp1Settings on={a.glp1.on} med={a.glp1.med} dow={a.glp1.injectionDow} />
      </section>

      <section className="card p-5"><NotificationSettings /></section>

      <section id="comunidad" className="card p-5 scroll-mt-6">
        <h2 className="font-extrabold text-ink mb-4">👥 Perfil en la comunidad</h2>
        <CommunitySettings username={cp.username} bio={cp.bio} visibility={cp.visibility} share={cp.share} />
      </section>

      <section className="card p-5">
        <h2 className="font-extrabold text-ink">🎯 Meta</h2>
        <p className="mt-1 text-muted">{a.startWeight} kg → <b className="text-ink">{a.goalWeight} kg</b> el {new Date(a.goalDate + "T12:00:00").toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric" })}</p>
        <Link href="/app/progreso#meta" className="mt-3 inline-flex text-sm font-bold text-banana-ink">Editar meta y datos →</Link>
      </section>

      <section className="card p-5">
        <h2 className="font-extrabold text-ink">🔒 Mis datos</h2>
        <p className="mt-1 mb-4 text-sm text-muted">Tus datos de salud son tuyos (Ley 8968). Descárgalos o bórralos cuando quieras.</p>
        <DataControls />
      </section>
      <p className="text-center text-xs text-faint"><Link href="/privacidad" className="underline">Privacidad</Link> · <Link href="/terminos" className="underline">Términos</Link> · hola@bananaburn.app</p>
    </div>
  );
}
