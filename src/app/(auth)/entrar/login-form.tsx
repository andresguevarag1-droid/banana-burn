"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "code";

export function LoginForm({ configured }: { configured: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const isSignup = params.get("modo") === "registro";
  const next = params.get("next") || "/app";
  if (typeof document !== "undefined" && params.get("programa") === "glp1") document.cookie = "bb_programa=glp1; path=/; max-age=86400; samesite=lax";
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(params.get("error") ? "No pudimos iniciar sesión. Intenta de nuevo." : null);

  if (!configured) {
    return (
      <div className="space-y-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Modo demo 🧪</h1>
        <p className="text-muted">Las cuentas se activan cuando conectes Supabase (ver README). Mientras tanto puedes explorar la app con datos de ejemplo.</p>
        <Link href="/app" className="btn-primary w-full">Explorar la app</Link>
      </div>
    );
  }

  const sb = createClient();

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    setBusy(false);
    if (error) return setErr(error.status === 429 ? "Demasiados intentos. Espera un minuto." : "No pudimos enviar el código. Revisa tu correo.");
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) return setErr("Código incorrecto o vencido.");
    router.replace(next);
    router.refresh();
  }

  async function google() {
    setBusy(true);
    await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
  }

  return (
    <div className="animate-rise">
      {step === "email" ? (
        <>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">{isSignup ? "Crea tu plan 🍌" : "¡Qué bueno verte! 👋"}</h1>
          <p className="mt-2 text-muted">{isSignup ? "En 2 minutos tienes tu rutina de hoy." : "Entra para ver qué te toca hoy."}</p>
          <button onClick={google} disabled={busy} className="btn-ghost w-full mt-8 h-13">
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"/></svg>
            Continuar con Google
          </button>
          <div className="my-6 flex items-center gap-3 text-xs font-semibold text-faint"><span className="h-px flex-1 bg-line" />o con tu correo<span className="h-px flex-1 bg-line" /></div>
          <form onSubmit={sendCode} className="space-y-3">
            <label className="block text-sm font-semibold text-ink" htmlFor="email">Correo electrónico</label>
            <input id="email" type="email" required autoComplete="email" inputMode="email" placeholder="tucorreo@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input h-13" />
            <button disabled={busy || !email} className="btn-primary w-full h-13">{busy ? <Loader2 className="size-5 animate-spin" /> : <Mail className="size-5" />}Enviarme un código</button>
          </form>
          <p className="mt-6 text-sm text-muted text-center">
            {isSignup ? <>¿Ya tienes cuenta? <Link href="/entrar" className="font-semibold text-ink underline">Entrar</Link></> : <>¿Nuevo aquí? <Link href="/entrar?modo=registro" className="font-semibold text-ink underline">Crea tu cuenta</Link></>}
          </p>
        </>
      ) : (
        <>
          <button onClick={() => { setStep("email"); setCode(""); }} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" />Cambiar correo</button>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">Revisa tu correo 📬</h1>
          <p className="mt-2 text-muted">Te enviamos un código de 6 dígitos a <b className="text-ink">{email}</b>.</p>
          <form onSubmit={verify} className="mt-8 space-y-3">
            <input autoFocus required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" maxLength={8} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="input h-16 text-center text-3xl font-extrabold tracking-[.5em]" aria-label="Código" />
            <button disabled={busy || code.length < 6} className="btn-primary w-full h-13">{busy && <Loader2 className="size-5 animate-spin" />}Entrar</button>
          </form>
          <button onClick={sendCode} disabled={busy} className="mt-4 w-full text-sm font-semibold text-muted hover:text-ink">Reenviar código</button>
        </>
      )}
      {err && <p role="alert" className="mt-4 rounded-2xl bg-bad/10 text-bad text-sm font-semibold p-3">{err}</p>}
    </div>
  );
}
