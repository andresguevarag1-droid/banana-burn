import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleCheck, Clock } from "lucide-react";
import { createClient, getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { PLANS } from "@/lib/plans";
import { AutoRefresh } from "./auto-refresh";

export const metadata = { title: "¡Pago recibido!" };

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric" }) : null);

export default async function Exito({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const v = await getViewer();
  if (!v) redirect(`/entrar?next=${encodeURIComponent(`/pago/exito${s ? `?s=${s}` : ""}`)}`);

  let confirmed = false;
  let planName: string | null = null;
  let renews: string | null = null;
  if (!v.demo) {
    const ent = await getEntitlements(v);
    let target = ent.plan;
    if (s) {
      const { data: row } = await (await createClient()).from("subscriptions").select("status, plan").eq("provider_subscription_id", s).eq("user_id", v.id).maybeSingle();
      confirmed = row?.status === "active";
      target = (row?.plan as typeof target) ?? target;
    } else confirmed = ent.fromSubscription && ent.plan !== "free";
    planName = PLANS.find((p) => p.id === target)?.name ?? null;
    renews = fmt(ent.renewsAt);
  }

  if (v.demo) {
    return (
      <Card icon={<Clock className="size-8" aria-hidden />} title="Modo demo 🧪" body="En la demo no se procesan pagos.">
        <Link href="/app" className="btn-primary">Ir a la app</Link>
      </Card>
    );
  }

  if (!confirmed) {
    return (
      <Card icon={<Clock className="size-8" aria-hidden />} title="Estamos confirmando tu pago…" body="Suele tardar unos segundos. Con SINPE Móvil puede tardar unos minutos. No cierres esta página; se actualiza sola.">
        <AutoRefresh />
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link href="/app" className="btn-primary">Ir a la app mientras tanto</Link>
          <Link href="/app/suscripcion" className="btn-ghost">Ver mi suscripción</Link>
        </div>
        <p className="text-xs text-muted">Si en 15 minutos no ves tu plan activo, escríbenos a <a className="underline" href="mailto:hola@bananaburn.app">hola@bananaburn.app</a> con el correo de tu cuenta. No vuelvas a pagar.</p>
      </Card>
    );
  }

  const nutrition = PLANS.find((p) => p.name === planName)?.nutrition;
  return (
    <Card icon={<CircleCheck className="size-8" aria-hidden />} tone="ok" title={`¡Listo! ${planName ?? "Tu plan"} está activo 🎉`} body={renews ? `Tu próxima renovación es el ${renews}. Tus pagos quedan en Mi suscripción.` : "Tus pagos quedan en Mi suscripción."}>
      <ol className="text-left space-y-3 text-[15px]">
        <Step n={1}>Abre <b>Hoy</b> y haz tu rutina del día.</Step>
        {nutrition ? <Step n={2}>Ve a <b>Nutrición</b>: ya tienes tus calorías y macros.</Step> : <Step n={2}>Pregúntale al <b>Coach IA</b> cualquier duda de técnica.</Step>}
        <Step n={3}>Pésate mañana en ayunas para que el plan se ajuste a ti.</Step>
      </ol>
      <Link href="/app" className="btn-banana w-full h-13">Empezar ahora</Link>
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
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
      <p className="text-muted">{body}</p>
      {children}
    </div>
  );
}
