"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Envelope, Lock, WarningCircle } from "@/components/icons";
import { requestEmailChange, sendPasswordLink, setNewPassword, updateName } from "./actions";

type Msg = { ok: boolean; t: string } | null;
const Status = ({ m }: { m: Msg }) => m ? <p role={m.ok ? "status" : "alert"} className={`flex items-center gap-1.5 text-sm font-semibold ${m.ok ? "text-peel" : "text-bad"}`}>{m.ok ? <CheckCircle weight="fill" className="size-4 shrink-0" /> : <WarningCircle weight="fill" className="size-4 shrink-0" />}{m.t}</p> : null;
const fail = { ok: false, error: "Sin conexión. Intenta de nuevo.", demo: false };

/** Cuenta: nombre, correo (con confirmación por enlace) y contraseña (enlace al correo y nueva contraseña al volver). */
export function AccountSettings({ name: n0, email, newPassword }: { name: string; email: string; newPassword: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(n0);
  const [mail, setMail] = useState("");
  const [pw, setPw] = useState("");
  const [nameMsg, setNameMsg] = useState<Msg>(null);
  const [mailMsg, setMailMsg] = useState<Msg>(null);
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [savingName, startName] = useTransition();
  const [savingMail, startMail] = useTransition();
  const [savingPw, startPw] = useTransition();
  const nameDirty = name.trim() !== n0.trim();

  return (
    <div className="space-y-5">
      {newPassword && (
        <form className="rounded-2xl border-2 border-banana bg-banana-soft/40 p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); startPw(async () => { const r = await setNewPassword(pw).catch(() => fail); setPwMsg(r.ok ? { ok: true, t: r.demo ? "Demo: no se guardó." : "Listo, tu contraseña cambió." } : { ok: false, t: r.error ?? "No pudimos cambiarla." }); if (r.ok) { setPw(""); router.replace("/app/perfil#cuenta"); } }); }}>
          <label htmlFor="nueva-clave" className="block text-sm font-bold text-ink">Escribe tu nueva contraseña</label>
          <input id="nueva-clave" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} maxLength={72} className="input h-12 text-[16px]" aria-describedby="nueva-clave-ayuda" />
          <p id="nueva-clave-ayuda" className="text-xs text-muted">Al menos 8 caracteres, con letras y números.</p>
          <div className="flex flex-wrap items-center gap-3"><button disabled={savingPw || pw.length < 8} className="btn-primary h-11 px-6">{savingPw ? "Guardando…" : "Guardar contraseña"}</button><Status m={pwMsg} /></div>
        </form>
      )}

      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); startName(async () => { const r = await updateName(name).catch(() => fail); setNameMsg(r.ok ? { ok: true, t: r.demo ? "Demo: no se guardó." : "Nombre actualizado" } : { ok: false, t: r.error ?? "No pudimos guardar." }); if (r.ok) router.refresh(); }); }}>
        <label htmlFor="cuenta-nombre" className="block text-sm font-bold text-ink">Nombre</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="cuenta-nombre" value={name} onChange={(e) => { setName(e.target.value); setNameMsg(null); }} maxLength={80} autoComplete="name" className="input h-12 text-[16px] flex-1" />
          <button disabled={!nameDirty || savingName || name.trim().length < 2} className="btn-primary h-12 px-6 shrink-0">{savingName ? "Guardando…" : "Guardar nombre"}</button>
        </div>
        <Status m={nameMsg} />
      </form>

      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); startMail(async () => { const r = await requestEmailChange(mail).catch(() => fail); setMailMsg(r.ok ? { ok: true, t: r.demo ? "Demo: no se envió nada." : `Te enviamos un enlace a ${mail.trim()}. El cambio se aplica cuando lo abras.` } : { ok: false, t: r.error ?? "No pudimos iniciar el cambio." }); if (r.ok) setMail(""); }); }}>
        <label htmlFor="cuenta-correo" className="block text-sm font-bold text-ink">Correo</label>
        <p className="text-sm text-muted">Ahora: <b className="text-ink break-all">{email}</b></p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="cuenta-correo" type="email" value={mail} onChange={(e) => { setMail(e.target.value); setMailMsg(null); }} placeholder="nuevo@correo.com" autoComplete="email" inputMode="email" className="input h-12 text-[16px] flex-1" />
          <button disabled={!mail.trim() || savingMail} className="btn-ghost h-12 px-5 shrink-0"><Envelope weight="bold" className="size-4" />{savingMail ? "Enviando…" : "Cambiar correo"}</button>
        </div>
        <Status m={mailMsg} />
      </form>

      <div className="space-y-2">
        <p className="text-sm font-bold text-ink">Contraseña</p>
        <p className="text-sm text-muted">Te mandamos un enlace a tu correo. Al abrirlo vuelves aquí para escribir la nueva.</p>
        <button type="button" disabled={savingPw} onClick={() => startPw(async () => { const r = await sendPasswordLink().catch(() => fail); setPwMsg(r.ok ? { ok: true, t: r.demo ? "Demo: no se envió nada." : `Revisa ${email}: te enviamos el enlace.` } : { ok: false, t: r.error ?? "No pudimos enviar el enlace." }); })} className="btn-ghost h-11 px-5"><Lock weight="bold" className="size-4" />{savingPw ? "Enviando…" : "Enviarme un enlace para cambiarla"}</button>
        {!newPassword && <Status m={pwMsg} />}
      </div>
    </div>
  );
}
