import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { Banana, Monkey } from "@/components/icons";
import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default function Entrar() {
  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      <div className="flex flex-col px-5 sm:px-10 py-6">
        <header><Logo /></header>
        <main className="flex-1 grid place-items-center py-10">
          <div className="w-full max-w-[400px]">
            <Suspense><LoginForm configured={isSupabaseConfigured} /></Suspense>
          </div>
        </main>
        <footer className="text-xs text-faint text-center">Al continuar aceptas los <Link href="/terminos" className="underline">Términos</Link> y la <Link href="/privacidad" className="underline">Política de privacidad</Link>.</footer>
      </div>
      <aside className="hidden lg:flex relative overflow-hidden bg-banana p-14 flex-col justify-end">
        <Banana weight="fill" className="absolute -top-20 -right-20 size-[420px] text-ink opacity-10 rotate-12 select-none" />
        <blockquote className="relative max-w-md">
          <p className="text-4xl font-extrabold tracking-tight text-ink leading-tight">“Hoy te toca Empuje A. Ayer fue descanso, mañana Tracción. Sube 2,5 kg en banca.”</p>
          <p className="mt-6 flex items-center gap-2 font-semibold text-ink/70"><Monkey className="size-6" />Tu coach Banana Burn, cada mañana</p>
        </blockquote>
      </aside>
    </div>
  );
}
