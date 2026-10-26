"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, CircleNotch, Envelope, Eye, EyeSlash, Lock, MonkeyBanana } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/security/redirect";
import { INTENT_COOKIE, INTENT_MAX_AGE, encodeIntent, parseIntent } from "@/lib/checkout-intent";
import { PLANS } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/copy";
import { confirmAndCheck, signUpConfirmed } from "./actions";
import { signupError } from "./validate";

type Step = "email" | "code" | "reset";
/** Cuenta bloqueada desde el panel (0056): Supabase responde "User is banned". */
const BLOCKED_MSG = "Tu cuenta está pausada. Escríbenos a hola@bananaburn.app y te ayudamos.";
type Method = "password" | "code";

const authError = (m: string) =>
  /banned/i.test(m) ? BLOCKED_MSG :
  /invalid login credentials/i.test(m) ? "Correo o contraseña incorrectos." :
  /email not confirmed/i.test(m) ? "Tu correo aún no está confirmado. Busca el correo de confirmación (revisa Correo no deseado) o pide ayuda a soporte." :
  /already registered|already been registered|user already exists/i.test(m) ? "Ya existe una cuenta con ese correo. Entra con tu contraseña." :
  /password.*(at least|characters|weak|pwned|leaked)/i.test(m) ? "Esa contraseña es muy débil. Usa al menos 8 caracteres, con letras y números." :
  /rate limit|security purposes/i.test(m) ? "Demasiados intentos. Espera un minuto e intenta de nuevo." :
  "No pudimos completar el acceso. Intenta de nuevo.";

const linkError = (e: string | null) =>
  e === "recuperacion" ? "Ese enlace para cambiar tu contraseña ya se usó o venció. Pide uno nuevo." :
  e ? "Ese enlace ya se usó o venció. Pide un código nuevo." : null;

const setCookie = (k: string, v: string, maxAge: number) => { try { document.cookie = `${k}=${v}; path=/; max-age=${maxAge}; samesite=lax`; } catch { /* sin cookies */ } };

/** Logo oficial de Google, con sus cuatro colores. */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** `signupChecks`: las dos marcas bajo el registro según la fecha (offer.ts, las calcula el servidor para no depender del reloj del teléfono). */
export function LoginForm({ configured, googleEnabled = false, signupChecks = ["7 días gratis", "Todo incluido"] }: { configured: boolean; googleEnabled?: boolean; signupChecks?: [string, string] }) {
  const params = useSearchParams();
  const router = useRouter();
  const isSignup = params.get("modo") === "registro";
  const next = safeNext(params.get("next"), "/app");
  const programa = params.get("programa");
  const objetivo = params.get("objetivo");
  const intent = parseIntent(params.get("plan"), params.get("pago"));
  const chosen = intent ? PLANS.find((p) => p.id === intent.plan) : null;
  const [step, setStep] = useState<Step>(params.get("recuperar") ? "reset" : "email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<Method>("password");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(linkError(params.get("error")));
  const [wait, setWait] = useState(0);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);

  // Lo que el visitante eligió en la landing (objetivo, programa GLP-1, plan) sobrevive al registro en cookies de 1 día.
  // Se escriben después de montar, nunca durante el render.
  useEffect(() => {
    if (programa === "glp1") setCookie("bb_programa", "glp1", 86400);
    if (objetivo && ["grasa", "recomp", "fuerza"].includes(objetivo)) setCookie("bb_objetivo", objetivo, 86400);
    if (intent) setCookie(INTENT_COOKIE, encodeIntent(intent), INTENT_MAX_AGE);
  }, [programa, objetivo, intent?.plan, intent?.billing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si la persona vuelve desde Google con "Atrás", la página sale del bfcache con el botón trabado: lo liberamos.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setBusy(false); };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  if (!configured) {
    return (
      <div className="space-y-5">
        <span className="grid place-items-center size-16 rounded-2xl bg-banana-soft text-banana-ink"><MonkeyBanana className="size-10" /></span>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Modo demo</h1>
        <p className="text-muted">Estamos abriendo cuentas por invitación muy pronto. Mientras tanto, explora Banana Burn completa con datos de ejemplo.</p>
        <Link href="/app" className="btn-primary w-full">Explorar Banana Burn</Link>
      </div>
    );
  }

  const sb = () => createClient();
  const callback = (n: string) => `${location.origin}/auth/callback?next=${encodeURIComponent(n)}`;
  /** Navega tras entrar. Si el router no sale de /entrar (sesión recién creada, caché), forzamos la carga completa. */
  const go = () => {
    router.replace(next);
    router.refresh();
    setTimeout(() => { if (location.pathname.startsWith("/entrar")) location.assign(next); }, 1500);
  };

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (wait > 0) return;
    setBusy(true); setErr(null);
    const { error } = await sb().auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true, emailRedirectTo: callback(next) } });
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
    const { error } = await sb().auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) return setErr("Código incorrecto o vencido.");
    go();
  }

  async function withPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setInfo(null);
    const mail = email.trim().toLowerCase();
    try {
      if (isSignup) {
        const invalid = signupError(mail, password);
        if (invalid) { setBusy(false); return setErr(invalid); }
        // Primero en el servidor: cuenta ya confirmada, sin esperar un correo que puede no llegar.
        const r = await signUpConfirmed(mail, password);
        if (r.ok) {
          const { error } = await sb().auth.signInWithPassword({ email: mail, password });
          if (error) { setBusy(false); return setErr(authError(error.message)); }
        } else if (r.fallback) {
          const { data, error } = await sb().auth.signUp({ email: mail, password, options: { emailRedirectTo: callback(next) } });
          if (error) { setBusy(false); return setErr(authError(error.message)); }
          if (!data.session) { setBusy(false); return setInfo("Cuenta creada. Te enviamos un correo para confirmarla; ábrelo y luego entra con tu contraseña."); }
        } else { setBusy(false); return setErr(r.error); }
      } else {
        let { error } = await sb().auth.signInWithPassword({ email: mail, password });
        if (error && /email not confirmed/i.test(error.message)) {
          // La cuenta existe pero nunca se confirmó (correo que no llegó): la confirmamos y reintentamos una vez.
          const r = await confirmAndCheck(mail, password);
          if (r.ok) ({ error } = await sb().auth.signInWithPassword({ email: mail, password }));
          else if (!r.fallback) { setBusy(false); return setErr(r.error); }
        }
        if (error) { setBusy(false); return setErr(authError(error.message)); }
      }
    } catch {
      setBusy(false);
      return setErr("No pudimos conectar. Revisa tu internet e intenta de nuevo.");
    }
    go();
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    if (wait > 0) return;
    setBusy(true); setErr(null); setInfo(null);
    const { error } = await sb().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${location.origin}/auth/callback?type=recovery` });
    setBusy(false);
    if (error && (error.status === 429 || /rate limit|security purposes/i.test(error.message))) return setErr("Ya te enviamos un enlace hace poco. Espera un minuto y revisa también Correo no deseado.");
    if (error) return setErr("No pudimos enviar el correo. Revisa que la dirección esté bien e intenta de nuevo.");
    setWait(60);
    // Mismo mensaje exista o no la cuenta: no revelamos qué correos están registrados.
    setInfo(`Si hay una cuenta con ${email.trim()}, te llegará un enlace para crear una contraseña nueva. Revisa también Correo no deseado.`);
  }

  async function google() {
    setBusy(true); setErr(null);
    try {
      const { error } = await sb().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback(next) } });
      if (error) throw error;
    } catch {
      setBusy(false);
      setErr("El acceso con Google no está disponible todavía. Usa tu correo.");
    }
  }

  const backToEmail = () => { setStep("email"); setCode(""); setErr(null); setInfo(null); };

  return (
    <div className="animate-rise">
      {step === "email" && (
        <>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">{isSignup ? "Crea tu cuenta gratis" : "Qué bueno verte"}</h1>
          <p className="mt-2 text-muted text-pretty">{isSignup ? `Solo necesitas tu correo. Después respondes 7 preguntas rápidas y tienes ${TRIAL_DAYS} días gratis con todo incluido.` : "Entra para ver qué te toca hoy."}</p>
          {isSignup && chosen && intent && (
            <p className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl bg-cream px-4 py-3 text-sm text-body">
              <span>Elegiste <b className="text-ink">{chosen.name}</b>, {intent.billing === "anual" ? "pago anual" : "pago mensual"}. Lo activas cuando termine tu prueba.</span>
              <Link href="/precios" className="tap font-semibold text-ink underline underline-offset-2">Cambiar</Link>
            </p>
          )}
          {googleEnabled ? (<>
            <button type="button" onClick={google} disabled={busy} data-cta={isSignup ? "registro-google" : "entrar-google"} className="btn-ghost w-full mt-8 h-13"><GoogleG />Continuar con Google</button>
            <div className="my-6 flex items-center gap-3 text-xs font-semibold text-faint"><span className="h-px flex-1 bg-line" />o con tu correo<span className="h-px flex-1 bg-line" /></div>
          </>) : <div className="mt-8" />}
          <form onSubmit={method === "password" ? withPassword : sendCode} className="space-y-3">
            <label className="block text-sm font-semibold text-ink" htmlFor="email">Correo electrónico</label>
            <input id="email" type="email" required autoComplete="email" inputMode="email" placeholder="tucorreo@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input h-13" />
            {method === "password" && (<>
              <div className="flex items-end justify-between pt-1">
                <label className="block text-sm font-semibold text-ink" htmlFor="password">Contraseña</label>
                {!isSignup && <button type="button" onClick={() => { setStep("reset"); setErr(null); setInfo(null); }} className="tap text-sm font-semibold text-muted underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline">¿Olvidaste tu contraseña?</button>}
              </div>
              <div className="relative">
                <input id="password" type={show ? "text" : "password"} required minLength={isSignup ? 8 : 1} autoComplete={isSignup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="input h-13 pr-14" aria-describedby={isSignup ? "pw-hint" : undefined} />
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center size-11 rounded-full text-muted hover:text-ink" aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}>{show ? <EyeSlash weight="bold" className="size-5" /> : <Eye weight="bold" className="size-5" />}</button>
              </div>
              {isSignup && <p id="pw-hint" className="text-xs text-muted">Mínimo 8 caracteres.</p>}
            </>)}
            <button disabled={busy || !email || (method === "password" && !password)} data-cta={isSignup ? `registro-${method}` : `entrar-${method}`} className="btn-primary w-full h-13">{busy ? <CircleNotch weight="bold" className="size-5 animate-spin" /> : method === "password" ? <Lock weight="duotone" className="size-5" /> : <Envelope weight="duotone" className="size-5" />}{method === "password" ? (isSignup ? "Empezar mi prueba gratis" : "Entrar") : "Enviarme un código"}</button>
            {isSignup && (
              <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 text-xs font-semibold text-muted">
                {signupChecks.map((t) => <li key={t} className="inline-flex items-center gap-1"><Check weight="bold" aria-hidden className="size-3.5 text-peel" />{t}</li>)}
                <li className="inline-flex items-center gap-1"><Check weight="bold" aria-hidden className="size-3.5 text-peel" />Tu plan en 2 minutos</li>
              </ul>
            )}
          </form>
          <button type="button" onClick={() => { setMethod(method === "password" ? "code" : "password"); setErr(null); setInfo(null); }} className="tap mt-3 w-full text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">{method === "password" ? "Prefiero recibir un código por correo" : "Prefiero usar contraseña"}</button>
          {info && <p role="status" className="mt-4 rounded-2xl bg-peel/10 p-3 text-sm font-semibold text-peel">{info}</p>}
          <p className="mt-6 text-sm text-muted text-center">
            {isSignup ? <>¿Ya tienes cuenta? <Link href="/entrar" className="tap font-semibold text-ink underline">Entrar</Link></> : <>¿Nuevo aquí? <Link href="/entrar?modo=registro" className="tap font-semibold text-ink underline">Prueba gratis {TRIAL_DAYS} días</Link></>}
          </p>
        </>
      )}

      {step === "code" && (
        <>
          <button type="button" onClick={backToEmail} className="tap inline-flex items-center gap-1 text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Cambiar correo</button>
          <h1 className="mt-4 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink"><Envelope weight="duotone" className="size-8 text-banana-ink" />Revisa tu correo</h1>
          <p className="mt-2 text-muted">Te enviamos un código a <b className="text-ink">{email}</b>. Escríbelo aquí o toca el enlace del correo.</p>
          <p className="mt-3 rounded-2xl bg-cream p-3 text-sm text-body">¿No llega en un minuto? Busca en <b>Correo no deseado</b> o <b>Promociones</b>; Hotmail y Outlook a veces lo mandan ahí. El remitente es Banana Burn.</p>
          <form onSubmit={verify} className="mt-8 space-y-3">
            <input autoFocus required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="input h-16 text-center text-3xl font-extrabold tracking-[.5em]" aria-label="Código" />
            <button disabled={busy || code.length < 6} className="btn-primary w-full h-13">{busy && <CircleNotch weight="bold" className="size-5 animate-spin" />}Entrar</button>
          </form>
          <button type="button" onClick={sendCode} disabled={busy || wait > 0} className="tap mt-4 w-full text-sm font-semibold text-muted tabular-nums transition-colors duration-150 hover:text-ink disabled:opacity-60">{wait > 0 ? `Reenviar código en ${wait} s` : "Reenviar código"}</button>
        </>
      )}

      {step === "reset" && (
        <>
          <button type="button" onClick={backToEmail} className="tap inline-flex items-center gap-1 text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Volver</button>
          <h1 className="mt-4 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink text-balance"><Lock weight="duotone" className="size-8 shrink-0 text-banana-ink" />Recupera tu cuenta</h1>
          <p className="mt-2 text-muted text-pretty">Escribe tu correo y te mandamos un enlace para crear una contraseña nueva.</p>
          <form onSubmit={sendReset} className="mt-8 space-y-3">
            <label className="block text-sm font-semibold text-ink" htmlFor="reset-email">Correo electrónico</label>
            <input id="reset-email" type="email" required autoComplete="email" inputMode="email" placeholder="tucorreo@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input h-13" />
            <button disabled={busy || !email || wait > 0} className="btn-primary w-full h-13 tabular-nums">{busy ? <CircleNotch weight="bold" className="size-5 animate-spin" /> : <Envelope weight="duotone" className="size-5" />}{wait > 0 ? `Reenviar en ${wait} s` : "Enviarme el enlace"}</button>
          </form>
          {info && <p role="status" className="mt-4 rounded-2xl bg-peel/10 p-3 text-sm font-semibold text-peel">{info}</p>}
        </>
      )}
      {err && <p role="alert" className="mt-4 rounded-2xl bg-bad/10 text-bad text-sm font-semibold p-3">{err}</p>}
    </div>
  );
}
