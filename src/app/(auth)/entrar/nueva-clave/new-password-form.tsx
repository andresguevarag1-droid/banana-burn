"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, Eye, EyeSlash, Lock } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

const updateError = (m: string) =>
  /different from the old|same.*password/i.test(m) ? "Usa una contraseña distinta a la anterior." :
  /password.*(at least|characters|weak|pwned|leaked)/i.test(m) ? "Esa contraseña es muy débil. Usa al menos 8 caracteres, con letras y números." :
  /session|jwt|expired/i.test(m) ? "Tu enlace venció. Pide uno nuevo desde Entrar." :
  "No pudimos guardar tu contraseña. Intenta de nuevo.";

export function NewPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mismatch = repeat.length > 0 && repeat !== password;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setErr("Usa al menos 8 caracteres.");
    if (password !== repeat) return setErr("Las contraseñas no coinciden.");
    setBusy(true); setErr(null);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) { setBusy(false); return setErr(updateError(error.message)); }
    router.replace("/app");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="mt-8 space-y-3">
      <label className="block text-sm font-semibold text-ink" htmlFor="new-password">Contraseña nueva</label>
      <div className="relative">
        <input id="new-password" type={show ? "text" : "password"} required minLength={8} autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className="input h-13 pr-14" aria-describedby="new-pw-hint" />
        <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center size-11 rounded-full text-muted hover:text-ink" aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}>{show ? <EyeSlash weight="bold" className="size-5" /> : <Eye weight="bold" className="size-5" />}</button>
      </div>
      <p id="new-pw-hint" className="text-xs text-muted">Mínimo 8 caracteres.</p>
      <label className="block pt-1 text-sm font-semibold text-ink" htmlFor="repeat-password">Repítela</label>
      <input id="repeat-password" type={show ? "text" : "password"} required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className="input h-13" aria-invalid={mismatch} aria-describedby={mismatch ? "repeat-hint" : undefined} />
      {mismatch && <p id="repeat-hint" className="text-xs font-semibold text-bad">No coincide con la de arriba.</p>}
      <button disabled={busy || password.length < 8 || password !== repeat} className="btn-primary w-full h-13">{busy ? <CircleNotch weight="bold" className="size-5 animate-spin" /> : <Lock weight="duotone" className="size-5" />}Guardar y entrar</button>
      {err && <p role="alert" className="rounded-2xl bg-bad/10 text-bad text-sm font-semibold p-3">{err}</p>}
    </form>
  );
}
