import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { Logo } from "@/components/brand";
import { acceptInvite } from "./actions";

export const metadata = { title: "Invitación de referidor", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ERR: Record<string, string> = {
  invalida: "Este enlace no es válido o fue anulado. Pide uno nuevo.",
  vencida: "Este enlace venció. Pide uno nuevo.",
  usada: "Este enlace ya se usó con otra cuenta.",
  otro_correo: "Entraste con un correo distinto al de la invitación. Sal y entra con el correo al que te llegó.",
  sin_config: "No pudimos revisar la invitación ahora. Intenta en unos minutos.",
};

export default async function Invitacion({ searchParams }: { searchParams: Promise<{ t?: string; e?: string }> }) {
  const { t = "", e } = await searchParams;
  const v = await getViewer();
  if (!v) redirect(`/entrar?next=${encodeURIComponent(`/referidor/invitacion?t=${t}`)}`);
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4 py-10">
      <div className="card w-full max-w-md space-y-4 p-6">
        <Logo />
        <h1 className="text-2xl font-extrabold text-ink text-balance">Te invitaron al programa de referidos de Banana Burn</h1>
        <p className="text-sm text-body">Recibes un enlace propio. Cuando alguien crea su cuenta con él y paga, ganas del 10 % al 40 % de lo que paga, según cuántos referidos tengas pagando. En el nivel máximo, la app te sale gratis.</p>
        <p className="text-sm text-muted">Vas a aceptar con <b className="text-ink">{v.email}</b>.</p>
        {e && <p role="alert" className="rounded-2xl bg-ember/15 p-3 text-sm font-semibold text-ember-ink">{ERR[e] ?? ERR.invalida}</p>}
        <form action={acceptInvite}>
          <input type="hidden" name="t" value={t} />
          <button type="submit" className="btn-primary h-12 w-full">Aceptar y ver mi enlace</button>
        </form>
        <p className="text-xs text-muted">Al aceptar, aceptas las reglas de referidos de los <Link href="/terminos#afiliados" className="underline">Términos</Link>.</p>
      </div>
    </main>
  );
}
