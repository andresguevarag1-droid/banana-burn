"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CircleNotch, Envelope, MonkeyBanana } from "@/components/icons";
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
  const [err, setErr] = useState<string | null>(params.get("error") ? "Ese enlace ya se usó o venció. Pide un código nuevo." : null);
  const [wait, setWait] = useState(0);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);

  if (!configured) {
    return (
      <div className="space-y-5">
        <span className="grid place-items-center size-16 rounded-2xl bg-banana-soft text-banana-ink"><MonkeyBanana className="size-10" /></span>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Modo demo</h1>
        <p className="text-muted">Estamos abriendo cuentas por invitación muy pronto. Mientras tanto, explora la app completa con datos de ejemplo.</p>
        <Link href="/app" className="btn-primary w-full">Explorar la app</Link>
      </div>
    );
  }

  const sb = createClient();

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (wait > 0) return;
    setBusy(true); setErr(null);
    const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    setBusy(false);
    if (error) {
      const rate = error.status === 429 || /rate limit|security purposes/i.test(error.message);
      const secs = Number(error.message.match(/after (\d+) seconds/)?.[1] ?? 0);
      if (secs) setWait(secs);
      return setErr(rate ? `Ya te enviamos un correo hace poco. ${secs ? `Puedes pedir otro en ${secs} segundos.` : "Espera unos minutos antes de pedir otro."} Revisa también Correo no deseado.` : "No pudimos enviar el correo. Revisa que la dirección esté bien e intenta de nuevo.");
    }
    setWait(60);
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
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
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">{isSignup ? "Crea tu plan" : "Qué bueno verte"}</h1>
          <p className="mt-2 text-muted">{isSignup ? "En 2 minutos tienes tu rutina de hoy." : "Entra para ver qué te toca hoy."}</p>
          <button onClick={google} disabled={busy} className="btn-ghost w-full mt-8 h-13">
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"/></svg>
            Continuar con Google
          </button>
          <div className="my-6 flex items-center gap-3 text-xs font-semibold text-faint"><span className="h-px flex-1 bg-line" />o con tu correo<span className="h-px flex-1 bg-line" /></div>
          <form onSubmit={sendCode} className="space-y-3">
            <label className="block text-sm font-semibold text-ink" htmlFor="email">Correo electrónico</label>
            <input id="email" type="email" required autoComplete="email" inputMode="email" placeholder="tucorreo@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input h-13" />
            <button disabled={busy || !email} className="btn-primary w-full h-13">{busy ? <CircleNotch weight="bold" className="size-5 animate-spin" /> : <Envelope weight="duotone" className="size-5" />}Enviarme un código</button>
          </form>
          <p className="mt-6 text-sm text-muted text-center">
            {isSignup ? <>¿Ya tienes cuenta? <Link href="/entrar" className="font-semibold text-ink underline">Entrar</Link></> : <>¿Nuevo aquí? <Link href="/entrar?modo=registro" className="font-semibold text-ink underline">Crea tu cuenta</Link></>}
          </p>
        </>
      ) : (
        <>
          <button onClick={() => { setStep("email"); setCode(""); }} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Cambiar correo</button>
          <h1 className="mt-4 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink"><Envelope weight="duotone" className="size-8 text-banana-ink" />Revisa tu correo</h1>
          <p className="mt-2 text-muted">Te enviamos un código a <b className="text-ink">{email}</b>. Escríbelo aquí o toca el enlace del correo.</p>
          <p className="mt-3 rounded-2xl bg-cream p-3 text-sm text-body">¿No llega en un minuto? Busca en <b>Correo no deseado</b> o <b>Promociones</b>; Hotmail y Outlook a veces lo mandan ahí. El remitente es Banana Burn.</p>
          <form onSubmit={verify} className="mt-8 space-y-3">
            <input autoFocus required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="input h-16 text-center text-3xl font-extrabold tracking-[.5em]" aria-label="Código" />
            <button disabled={busy || code.length < 6} className="btn-primary w-full h-13">{busy && <CircleNotch weight="bold" className="size-5 animate-spin" />}Entrar</button>
          </form>
          <button onClick={sendCode} disabled={busy || wait > 0} className="tap mt-4 w-full text-sm font-semibold text-muted hover:text-ink disabled:opacity-60">{wait > 0 ? `Reenviar código en ${wait} s` : "Reenviar código"}</button>
        </>
      )}
      {err && <p role="alert" className="mt-4 rounded-2xl bg-bad/10 text-bad text-sm font-semibold p-3">{err}</p>}
    </div>
  );
}
