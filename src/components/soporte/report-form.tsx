"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, ImageSquare, Trash, WarningCircle } from "@/components/icons";
import { createTicket, discardShot } from "@/app/actions/support";
import { safeAction } from "@/lib/action-client";
import { BODY_MAX, SHOT_TYPES, SUPPORT_CATEGORIES, TITLE_MAX, shotError, shotName, ticketError } from "@/lib/support";

/**
 * Formulario de "Reportar un problema": categoría, título, descripción y captura opcional (bucket privado, solo tu
 * carpeta). El contexto técnico (pantalla, versión, dispositivo y plan) lo agrega el servidor; aquí solo se explica.
 */
export function ReportForm({ userId, demo, page, origin, defaultCategory = "app" }: { userId: string; demo: boolean; page: string | null; origin: string; defaultCategory?: string }) {
  const [category, setCategory] = useState(defaultCategory);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "subiendo" | "enviando">("idle");
  const [done, setDone] = useState<{ id: number; number: string; demo?: boolean } | null>(null);
  const [, start] = useTransition();
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);
  useEffect(() => { if (done) head.current?.focus(); }, [done]);

  function pick(f: File | undefined) {
    if (!f) return;
    const e = shotError(f);
    if (e) { setErr(e); if (fileRef.current) fileRef.current.value = ""; return; }
    setErr(null);
    if (shot) URL.revokeObjectURL(shot.url);
    setShot({ file: f, url: URL.createObjectURL(f) });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (stage !== "idle") return;
    const v = ticketError({ category, title, body });
    if (v) { setErr(v); return; }
    setErr(null);
    let path: string | null = null;
    if (shot && !demo) {
      setStage("subiendo");
      try {
        const { createClient } = await import("@/lib/supabase/client");
        path = `${userId}/${shotName(shot.file.type, Math.random().toString(36).slice(2, 12))}`;
        const up = await createClient().storage.from("soporte").upload(path, shot.file, { contentType: shot.file.type, upsert: false });
        if (up.error) throw up.error;
      } catch {
        setStage("idle");
        setErr(typeof navigator !== "undefined" && !navigator.onLine ? "Sin conexión. Envíalo cuando tengas señal." : "No pudimos subir la captura. Intenta de nuevo o envía el reporte sin ella.");
        return;
      }
    }
    setStage("enviando");
    start(async () => {
      const r = await safeAction(createTicket({ category, title, body, page, origin, attachment: path ?? (demo && shot ? `${userId}/captura-demo.png` : null) }));
      setStage("idle");
      if (!r.ok || !r.id) {
        if (path) discardShot(path).catch(() => null);
        setErr(r.error ?? "No se pudo enviar. Intenta de nuevo.");
        return;
      }
      setDone({ id: r.id, number: r.number ?? "", demo: r.demo });
    });
  }

  if (done) {
    return (
      <section className="card p-6 text-center" role="status" aria-live="polite">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-banana-soft text-banana-ink bb-check-pop"><CheckCircle weight="fill" className="size-9" aria-hidden /></span>
        <h2 ref={head} tabIndex={-1} className="mt-3 text-xl font-extrabold text-ink outline-none">Recibimos tu reporte {done.number}</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted text-pretty">{done.demo ? "Modo demo: no se guardó nada. En tu cuenta real te avisamos en la campanita, por correo y con una notificación." : "Te avisamos en la campanita, por correo y con una notificación cuando lo estemos trabajando y cuando quede resuelto."}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href={`/app/soporte/${done.id}`} className="btn-primary h-12 px-5">Ver mi reporte <ArrowRight weight="bold" className="size-4" /></Link>
          <Link href="/app/soporte" className="btn-ghost h-12 px-5">Mis reportes</Link>
        </div>
      </section>
    );
  }

  const busy = stage !== "idle";
  const field = "w-full rounded-2xl border border-line bg-white px-4 text-[16px] text-ink placeholder:text-faint outline-none transition-[border-color,box-shadow] duration-150 focus:border-ink focus:ring-4 focus:ring-banana/40";
  return (
    <form onSubmit={submit} className="card space-y-5 p-5 sm:p-6" noValidate aria-busy={busy}>
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-ink">¿Sobre qué es?</legend>
        <div className="flex flex-wrap gap-2">
          {SUPPORT_CATEGORIES.map(([k, l]) => (
            <label key={k} className={`pressable tap inline-flex h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-bold transition-colors duration-150 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-banana/50 ${category === k ? "border-ink bg-ink text-banana" : "border-line bg-white text-ink hover:border-ink/25"}`}>
              <input type="radio" name="category" value={k} checked={category === k} onChange={() => setCategory(k)} className="sr-only" />{l}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={`${uid}-t`} className="mb-1.5 block text-sm font-bold text-ink">Título</label>
        <input id={`${uid}-t`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} required autoComplete="off" placeholder="p. ej. No se guarda mi peso" className={`${field} h-12`} />
      </div>
      <div>
        <label htmlFor={`${uid}-b`} className="mb-1.5 block text-sm font-bold text-ink">¿Qué pasó?</label>
        <textarea id={`${uid}-b`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_MAX} required rows={5} aria-describedby={`${uid}-bh`}
          placeholder="Qué hiciste, qué esperabas y qué pasó. Si se repite, cuéntanos cada cuánto." className={`${field} py-3`} />
        <p id={`${uid}-bh`} className="mt-1 flex justify-between gap-3 text-xs text-muted"><span>No incluyas contraseñas ni números de tarjeta.</span><span className="tabular-nums" aria-live="polite">{body.length.toLocaleString("es-419")} / {BODY_MAX.toLocaleString("es-419")}</span></p>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-bold text-ink">Captura de pantalla <span className="font-semibold text-muted">(opcional)</span></p>
        {shot ? (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-cream p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot.url} alt="Vista previa de la captura" className="size-16 shrink-0 rounded-xl object-cover" />
            <p className="min-w-0 flex-1 truncate text-sm text-ink">{shot.file.name}</p>
            <button type="button" onClick={() => { URL.revokeObjectURL(shot.url); setShot(null); if (fileRef.current) fileRef.current.value = ""; }} className="tap pressable grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-white hover:text-bad" aria-label="Quitar la captura"><Trash className="size-5" aria-hidden /></button>
          </div>
        ) : (
          <label className="pressable flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-ink/25 bg-white px-4 py-3 text-sm font-semibold text-ink hover:border-ink/50 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-banana/50">
            <ImageSquare weight="duotone" className="size-6 shrink-0 text-banana-ink" aria-hidden />
            <span>Adjuntar una imagen <span className="block text-xs font-normal text-muted">JPG, PNG o WebP, hasta 5 MB. Solo la ve el equipo.</span></span>
            <input ref={fileRef} type="file" accept={SHOT_TYPES.join(",")} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        )}
      </div>
      <p className="rounded-2xl bg-paper px-4 py-3 text-xs text-muted text-pretty">Para ayudarte más rápido agregamos la pantalla desde donde llegaste, la versión de la app, tu tipo de dispositivo y navegador, y tu plan. Nada de tus datos de salud.</p>
      {err && <p role="alert" className="flex items-start gap-1.5 text-sm font-semibold text-bad"><WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" aria-hidden />{err}</p>}
      <button type="submit" disabled={busy} aria-disabled={busy} className="btn-primary h-12 w-full">{stage === "subiendo" ? "Subiendo la captura…" : stage === "enviando" ? "Enviando…" : "Enviar reporte"}</button>
    </form>
  );
}
