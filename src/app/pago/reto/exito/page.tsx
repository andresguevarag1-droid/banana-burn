import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Clock, MagnifyingGlass } from "@/components/icons";
import { BananaTrophy } from "@/components/icons/brand";
import { createClient, getViewer } from "@/lib/supabase/server";
import { AutoRefresh } from "../../exito/auto-refresh";

export const metadata = { title: "Compra de reto" };

/** Después del SDK: el acceso lo otorga el webhook. Aquí solo esperamos a que la compra figure como pagada. */
export default async function RetoExito({ searchParams }: { searchParams: Promise<{ pi?: string }> }) {
  const { pi } = await searchParams;
  const v = await getViewer();
  if (!v) redirect(`/entrar?next=${encodeURIComponent(`/pago/reto/exito?pi=${pi ?? ""}`)}`);
  if (v.demo || !pi) return <Card icon={<MagnifyingGlass weight="duotone" className="size-8" />} title="No encontramos un pago" body="Vuelve a la tienda de retos."><Link href="/app/retos" className="btn-primary">Ir a la tienda</Link></Card>;
  const { data: row } = await (await createClient()).from("challenge_purchases").select("status,challenge_slug").eq("provider_payment_intent_id", pi).eq("user_id", v.id).maybeSingle();
  if (!row) return <Card icon={<MagnifyingGlass weight="duotone" className="size-8" />} title="No encontramos un pago" body="Si acabas de pagar, revisa la tienda de retos en unos minutos."><Link href="/app/retos" className="btn-primary">Ir a la tienda</Link></Card>;
  if (row.status !== "pagado") {
    return (
      <Card icon={<Clock weight="duotone" className="size-8" />} title="Estamos confirmando tu pago…" body="Suele tardar unos segundos. Esta página se actualiza sola.">
        <AutoRefresh />
        <p className="text-xs text-muted">Si en 15 minutos no ves tu reto, escríbenos a <a className="tap underline underline-offset-2" href="mailto:hola@bananaburn.app">hola@bananaburn.app</a>. No vuelvas a pagar.</p>
      </Card>
    );
  }
  return (
    <Card icon={<BananaTrophy className="size-10" />} title="El reto ya es tuyo" body="Empiézalo cuando quieras. Puedes repetirlo las veces que necesites.">
      <Link href={`/app/retos/${row.challenge_slug}`} className="btn-banana w-full h-14 text-base">Ver mi reto<ArrowRight weight="bold" className="size-5" /></Link>
    </Card>
  );
}

function Card({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="card p-6 sm:p-8 text-center space-y-5 animate-rise">
      <span className="mx-auto grid place-items-center size-16 rounded-3xl bg-banana-soft text-banana-ink">{icon}</span>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink text-balance">{title}</h1>
      <p className="text-muted text-pretty">{body}</p>
      {children}
    </div>
  );
}
