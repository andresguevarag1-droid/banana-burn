"use client";
// Flujo de verificación: consentimiento, documento (sin el número completo), fotos al bucket privado y envío.
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle, IdentificationCard, Lock, Trash, UploadSimple, User, WarningCircle } from "@/components/icons";
import { submitVerification, withdrawVerification } from "@/app/actions/perfil-poder";
import { safeAction } from "@/lib/action-client";
import { cleanIdName, cleanLast3, CONSENT_POINTS, CONSENT_VERSION, DOC_TYPES, ID_PHOTO_MAX, ID_PHOTO_TYPES, idPhotoName, type DocType } from "@/lib/identity";
import { COUNTRIES } from "@/lib/countries";

type Shot = { file: File; url: string } | null;

function PhotoPick({ id, title, hint, icon: I, capture, shot, onPick, onClear }: { id: string; title: string; hint: string; icon: typeof Camera; capture: "environment" | "user"; shot: Shot; onPick: (f: File) => void; onClear: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      {shot ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shot.url} alt={`Vista previa: ${title}`} className="size-20 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-bold text-ink"><CheckCircle weight="fill" className="size-4 shrink-0 text-peel" />{title}</p>
            <p className="text-xs text-muted">Lista. Revisa que se lea bien y sin reflejos.</p>
          </div>
          <button type="button" onClick={onClear} className="tap pressable grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-cream hover:text-ink" aria-label={`Quitar ${title.toLowerCase()}`}><Trash weight="duotone" className="size-5" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="pressable flex w-full min-h-20 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-banana/60" aria-describedby={`${id}-h`}>
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-banana-soft text-banana-ink"><I weight="duotone" className="size-7" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-ink">{title}</span>
            <span id={`${id}-h`} className="block text-xs text-muted">{hint}</span>
          </span>
          <span className="chip h-9 shrink-0 bg-ink px-3 text-white"><UploadSimple weight="bold" className="size-4" />Subir</span>
        </button>
      )}
      <input ref={input} id={id} type="file" accept={ID_PHOTO_TYPES.join(",")} capture={capture} className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }} />
    </div>
  );
}

export function VerifyFlow({ userId, demo, defaultCountry }: { userId: string; demo: boolean; defaultCountry: string }) {
  const [consent, setConsent] = useState(false);
  const [doc, setDoc] = useState<DocType>(defaultCountry === "CR" ? "cedula_cr" : "documento_nacional");
  const [country, setCountry] = useState(defaultCountry);
  const [last3, setLast3] = useState("");
  const [trimmed, setTrimmed] = useState(false);
  const [name, setName] = useState("");
  const [front, setFront] = useState<Shot>(null);
  const [selfie, setSelfie] = useState<Shot>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<null | "ok" | "demo">(null);
  const [stage, setStage] = useState<"idle" | "subiendo" | "enviando">("idle");
  const [, start] = useTransition();
  const router = useRouter();
  const uid = useId();
  const def = DOC_TYPES.find((d) => d.id === doc)!;

  // Las vistas previas usan URLs locales: se liberan al cambiar o al salir.
  useEffect(() => () => { if (front) URL.revokeObjectURL(front.url); }, [front]);
  useEffect(() => () => { if (selfie) URL.revokeObjectURL(selfie.url); }, [selfie]);

  function pickPhoto(set: (s: Shot) => void) {
    return (f: File) => {
      setErr(null);
      if (!ID_PHOTO_TYPES.includes(f.type)) return setErr("Usa una foto en JPG, PNG, WEBP o HEIC.");
      if (f.size > ID_PHOTO_MAX) return setErr("La foto pesa más de 6 MB. Tómala de nuevo con menos zoom.");
      set({ file: f, url: URL.createObjectURL(f) });
    };
  }
  /** Solo los últimos 3: si pegan el número completo, el resto se descarta aquí y nunca sale del teléfono. */
  function onLast3(raw: string) {
    const c = cleanLast3(raw, doc);
    if (c) { setLast3(c.value); setTrimmed(c.trimmed); return; }
    setLast3(raw.toUpperCase().replace(def.digits ? /[^0-9]/g : /[^0-9A-Z]/g, "").slice(0, 3)); setTrimmed(false);
  }

  const nameOk = !!cleanIdName(name);
  const ready = consent && last3.length === 3 && nameOk && !!front && !!selfie && (def.country !== null || !!country);
  const busy = stage !== "idle";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy || !front || !selfie) return;
    setErr(null);
    if (demo) { setDone("demo"); return; }
    setStage("subiendo");
    const rand = () => Math.random().toString(36).slice(2, 10);
    const fp = `${userId}/${idPhotoName("frente", front.file.type, rand())}`;
    const sp = `${userId}/${idPhotoName("selfie", selfie.file.type, rand())}`;
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const bucket = createClient().storage.from("identidad");
      const a = await bucket.upload(fp, front.file, { contentType: front.file.type, upsert: false });
      if (a.error) throw a.error;
      const b = await bucket.upload(sp, selfie.file, { contentType: selfie.file.type, upsert: false });
      if (b.error) { await bucket.remove([fp]).catch(() => null); throw b.error; }
      setStage("enviando");
      start(async () => {
        const r = await safeAction(submitVerification({ docType: doc, country: def.country ?? country, last3, fullName: name, front: fp, selfie: sp, consent, consentVersion: CONSENT_VERSION }));
        setStage("idle");
        if (!r.ok) { await bucket.remove([fp, sp]).catch(() => null); setErr(r.error ?? "No pudimos enviar tu verificación. Intenta de nuevo."); return; }
        setDone("ok");
        router.refresh();
      });
    } catch {
      setStage("idle");
      setErr(typeof navigator !== "undefined" && !navigator.onLine ? "Sin conexión. Envíala cuando tengas señal." : "No pudimos subir las fotos. Intenta de nuevo.");
    }
  }

  if (done) {
    return (
      <section className="card p-6 text-center" role="status">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-banana-soft text-banana-ink bb-check-pop"><CheckCircle weight="fill" className="size-9" /></span>
        <p className="mt-3 text-lg font-extrabold text-ink">{done === "demo" ? "Demo: no se envió nada" : "¡Listo! Tu verificación está en revisión"}</p>
        <p className="mt-1 text-sm text-muted">{done === "demo" ? "En tu cuenta real, las fotos van a un almacenamiento privado y te avisamos en la campanita cuando esté lista." : "Te avisamos en la campanita cuando esté lista. Al decidir, borramos las fotos."}</p>
      </section>
    );
  }

  return (
    <form onSubmit={send} className="space-y-4" aria-describedby={err ? `${uid}-err` : undefined}>
      <section className="card p-5" aria-labelledby={`${uid}-c`}>
        <h2 id={`${uid}-c`} className="flex items-center gap-2 font-extrabold text-ink"><span className="grid size-7 place-items-center rounded-full bg-ink text-xs text-banana">1</span>Antes de empezar</h2>
        <ul className="mt-3 space-y-2 text-sm text-body">
          {CONSENT_POINTS.map((t) => { const [h, ...rest] = t.split(": "); return <li key={h} className="flex gap-2"><Lock weight="duotone" aria-hidden className="mt-0.5 size-4 shrink-0 text-peel" /><span><b className="text-ink">{h}:</b> {rest.join(": ")}</span></li>; })}
        </ul>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-line bg-cream p-3 has-[:checked]:border-ink has-[:checked]:bg-banana-soft has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-banana/60">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[#1B1505]" />
          <span className="text-sm text-ink">Doy mi consentimiento expreso para que Banana Burn trate la foto de mi documento, mi selfie y mi nombre solo para verificar mi identidad, como se explica arriba (Ley N.º 8968).</span>
        </label>
      </section>

      <fieldset disabled={!consent} className="card p-5 disabled:opacity-60" aria-labelledby={`${uid}-d`}>
        <h2 id={`${uid}-d`} className="flex items-center gap-2 font-extrabold text-ink"><span className="grid size-7 place-items-center rounded-full bg-ink text-xs text-banana">2</span>Tu documento</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de documento">
          {DOC_TYPES.map((d) => (
            <label key={d.id} className={`cursor-pointer rounded-2xl border-2 p-3 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-banana/60 ${doc === d.id ? "border-ink bg-banana" : "border-line bg-white"}`}>
              <input type="radio" name="doc" value={d.id} checked={doc === d.id} onChange={() => { setDoc(d.id); setLast3(""); setTrimmed(false); if (d.country) setCountry(d.country); }} className="sr-only" />
              <span className="flex items-center gap-1.5 text-sm font-bold text-ink"><IdentificationCard weight="duotone" className="size-4.5 shrink-0" />{d.label}</span>
              <span className="block text-[11px] text-ink/70">{d.hint}</span>
            </label>
          ))}
        </div>
        {def.country === null && (
          <label className="mt-3 block"><span className="text-sm font-bold text-ink">País que lo emitió</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="input mt-1">
              {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </label>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block min-w-0"><span className="text-sm font-bold text-ink">Nombre completo como aparece en el documento</span>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 120))} autoComplete="name" className="input mt-1" placeholder="Ej: María José Rojas Mora" aria-invalid={name.length > 3 && !nameOk} />
          </label>
          <label className="block"><span className="text-sm font-bold text-ink">Últimos 3 {def.digits ? "dígitos" : "caracteres"}</span>
            <input value={last3} onChange={(e) => onLast3(e.target.value)} inputMode={def.digits ? "numeric" : "text"} autoComplete="off" spellCheck={false} maxLength={30}
              className="input mt-1 w-full sm:w-32 text-center font-mono text-lg tracking-[.3em]" placeholder={def.digits ? "678" : "C4X"} aria-describedby={`${uid}-l3`} />
          </label>
        </div>
        <p id={`${uid}-l3`} className={`mt-1.5 text-xs ${trimmed ? "font-semibold text-peel" : "text-muted"}`}>
          {trimmed ? "Solo guardamos los últimos 3. El resto del número no salió de tu teléfono." : "Nunca te pedimos el número completo: solo los últimos 3, para compararlos con la foto."}
        </p>
      </fieldset>

      <fieldset disabled={!consent} className="card p-5 disabled:opacity-60" aria-labelledby={`${uid}-f`}>
        <h2 id={`${uid}-f`} className="flex items-center gap-2 font-extrabold text-ink"><span className="grid size-7 place-items-center rounded-full bg-ink text-xs text-banana">3</span>Dos fotos</h2>
        <p className="mt-1 text-sm text-muted">Con buena luz, sin reflejos y que se lean tu nombre y tu foto. Se guardan en privado y se borran al decidir.</p>
        <div className="mt-3 space-y-2">
          <PhotoPick id={`${uid}-front`} title="Frente del documento" hint="Todo el documento dentro de la foto." icon={IdentificationCard} capture="environment" shot={front} onPick={pickPhoto(setFront)} onClear={() => setFront(null)} />
          <PhotoPick id={`${uid}-selfie`} title="Selfie sosteniendo el documento" hint="Tu cara y el documento juntos, sin tapar tu foto." icon={User} capture="user" shot={selfie} onPick={pickPhoto(setSelfie)} onClear={() => setSelfie(null)} />
        </div>
      </fieldset>

      {err && <p id={`${uid}-err`} role="alert" className="flex items-center gap-1.5 text-sm font-semibold text-bad"><WarningCircle weight="fill" className="size-4 shrink-0" />{err}</p>}
      <button disabled={!ready || busy} className="btn-primary h-13 w-full text-base disabled:opacity-50">
        {stage === "subiendo" ? "Subiendo fotos…" : stage === "enviando" ? "Enviando…" : "Enviar para revisión"}
      </button>
      {!ready && consent && <p className="-mt-2 text-center text-xs text-muted">Completa tu nombre, los últimos 3 y las dos fotos.</p>}
    </form>
  );
}

/** Retirar la verificación (o cancelar la revisión): borra la fila y las fotos. Con confirmación. */
export function WithdrawButton({ label, confirm }: { label: string; confirm: string }) {
  const [ask, setAsk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [demoMsg, setDemoMsg] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!ask) return (
    <div>
      <button type="button" onClick={() => { setAsk(true); setDemoMsg(false); }} className="btn-ghost h-11 px-4 text-sm text-bad">{label}</button>
      {demoMsg && <p role="status" className="mt-2 text-sm font-semibold text-peel">Demo: no se borró nada.</p>}
    </div>
  );
  return (
    <div className="rounded-2xl border border-bad/25 bg-bad/5 p-3 text-sm animate-fade" role="group" aria-label="Confirmar">
      <p className="font-semibold text-ink">{confirm}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => setAsk(false)} className="btn-ghost h-11 px-4 text-sm">Cancelar</button>
        <button type="button" disabled={pending} onClick={() => start(async () => {
          const r = await safeAction(withdrawVerification());
          if (!r.ok) { setErr(r.error ?? "No pudimos retirarla."); return; }
          if (r.demo) { setDemoMsg(true); setAsk(false); return; }
          router.refresh();
        })} className="btn h-11 bg-bad px-4 text-sm text-white">{pending ? "Borrando…" : "Sí, borrar todo"}</button>
      </div>
      {err && <p role="alert" className="mt-2 font-semibold text-bad">{err}</p>}
    </div>
  );
}
