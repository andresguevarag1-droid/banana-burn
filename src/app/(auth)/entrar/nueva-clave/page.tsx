import Link from "next/link";
import { Logo } from "@/components/brand";
import { Lock } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { NewPasswordForm } from "./new-password-form";

export const metadata = { title: "Nueva contraseña", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Llega aquí desde el enlace de recuperación (/auth/callback?type=recovery), que ya abrió una sesión temporal. */
export default async function NuevaClave() {
  const v = await getViewer();
  return (
    <div className="min-h-dvh flex flex-col px-5 sm:px-10 py-6">
      <header><Logo /></header>
      <main className="flex-1 grid place-items-center py-10">
        <div className="w-full max-w-[400px] animate-rise">
          {v && !v.demo ? (
            <>
              <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink text-balance"><Lock weight="duotone" className="size-8 shrink-0 text-banana-ink" />Crea tu nueva contraseña</h1>
              <p className="mt-2 text-muted text-pretty">Para la cuenta <b className="text-ink break-all">{v.email}</b>.</p>
              <NewPasswordForm />
            </>
          ) : (
            <>
              <h1 className="text-3xl font-extrabold tracking-tight text-ink text-balance">Este enlace ya no sirve</h1>
              <p className="mt-2 text-muted text-pretty">{v?.demo ? "En la demo no hay cuentas ni contraseñas." : "El enlace para cambiar tu contraseña venció o ya se usó. Pide uno nuevo; llega en un minuto."}</p>
              <Link href={v?.demo ? "/app" : "/entrar?recuperar=1"} className="btn-primary w-full h-13 mt-8">{v?.demo ? "Explorar la app" : "Pedir un enlace nuevo"}</Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
