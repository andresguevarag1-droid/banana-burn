"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle, Lock, Ruler, Trash, TrendDown, TrendUp, WarningCircle } from "@/components/icons";
import { saveMeasures, addPhoto, deletePhoto } from "@/app/actions/progress";
import type { Measure, Photo } from "@/lib/measures";
import { safeAction } from "@/lib/action-client";

const FIELDS = [["waist", "Cintura", "a la altura del ombligo"], ["neck", "Cuello", "bajo la manzana de Adán"], ["chest", "Pecho", "a la altura de los pezones"], ["arm", "Brazo", "parte más ancha, relajado"], ["thigh", "Muslo", "parte más ancha"], ["hip", "Cadera", "parte más ancha de glúteos"]] as const;
const nf = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 1 });

export function Measures({ history, bodyFat, demo }: { history: Measure[]; bodyFat: number | null; demo: boolean }) {
  const last = history.at(-1), first = history[0];
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const waistDelta = last?.waist && first?.waist && history.length > 1 ? last.waist - first.waist : null;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-cream p-3"><p className="text-xs font-bold text-muted">Cintura</p><p className="text-xl font-extrabold text-ink tabular-nums whitespace-nowrap">{last?.waist ? <>{nf(last.waist)}<span className="text-sm font-bold text-muted"> cm</span></> : <span className="text-faint">Sin dato</span>}</p>{waistDelta != null && <p className={`inline-flex items-center gap-1 text-xs font-bold ${waistDelta <= 0 ? "text-peel" : "text-ember-ink"}`}>{waistDelta <= 0 ? <TrendDown weight="bold" className="size-3.5" /> : <TrendUp weight="bold" className="size-3.5" />}<span className="sr-only">{waistDelta <= 0 ? "Bajó" : "Subió"}</span>{nf(Math.abs(waistDelta))} cm</p>}</div>
        <div className="rounded-2xl bg-cream p-3"><p className="text-xs font-bold text-muted">% grasa (aprox.)</p><p className="text-xl font-extrabold text-ink tabular-nums whitespace-nowrap">{bodyFat != null ? <>{nf(bodyFat)}<span className="text-sm font-bold text-muted"> %</span></> : <span className="text-faint">Sin dato</span>}</p><p className="text-[11px] text-muted">fórmula Marina EE. UU.</p></div>
        <div className="rounded-2xl bg-cream p-3"><p className="text-xs font-bold text-muted">Última</p><p className="text-sm font-extrabold text-ink">{last ? new Date(last.d + "T12:00:00").toLocaleDateString("es-419", { day: "numeric", month: "short" }) : "Nunca"}</p><p className="text-[11px] text-muted">mide cada 1 o 2 semanas</p></div>
      </div>
      {history.length > 1 && <MeasureTable history={history} />}
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn-ghost h-11 mt-4 w-full"><Ruler weight="duotone" className="size-5" />Anotar medidas de hoy</button>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const input = Object.fromEntries(FIELDS.map(([k]) => [k, Number(String(fd.get(k) || "").replace(",", ".")) || null]));
          start(async () => { const r = await safeAction(saveMeasures(input)); setMsg(r.ok ? { ok: true, t: r.demo ? "Demo: no se guardó." : "Medidas guardadas, +15 XP" } : { ok: false, t: r.error ?? "No pudimos guardar tus medidas. Intenta de nuevo." }); if (r.ok) { setOpen(false); router.refresh(); } });
        }}>
          <p className="text-xs text-muted">Con cinta métrica, en la mañana, sin apretar. Solo llena las que quieras.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {FIELDS.map(([k, l, hint]) => (
              <label key={k} className="block"><span className="text-xs font-bold text-ink">{l} <span className="font-normal text-faint">cm</span></span>
                <input name={k} inputMode="decimal" defaultValue={last?.[k] ?? ""} className="input h-11 mt-1" aria-describedby={`h-${k}`} /><span id={`h-${k}`} className="text-[10px] text-faint">{hint}</span></label>
            ))}
          </div>
          <div className="flex gap-2"><button type="button" onClick={() => setOpen(false)} className="btn-ghost h-11 flex-1">Cancelar</button><button disabled={pending} className="btn-primary h-11 flex-1">{pending ? "Guardando…" : "Guardar"}</button></div>
        </form>
      )}
      {msg && <p className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${msg.ok ? "text-peel" : "text-bad"}`} role={msg.ok ? "status" : "alert"}>{msg.ok ? <CheckCircle weight="fill" className="size-4 shrink-0" /> : <WarningCircle weight="fill" className="size-4 shrink-0" />}{msg.t}</p>}
      {demo && <p className="mt-2 text-[11px] text-faint">Datos de ejemplo.</p>}
    </div>
  );
}

/** Historial en tabla: en móvil se desliza de lado, con la fecha fija y un degradado que avisa que hay más columnas. */
function MeasureTable({ history }: { history: Measure[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", check); ro.disconnect(); };
  }, []);
  return (
    <div className="mt-3 relative">
      <div ref={ref} className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]" tabIndex={more ? 0 : undefined} role={more ? "region" : undefined} aria-label={more ? "Historial de medidas, desliza para ver más" : undefined}>
        <table className="w-full min-w-[26rem] text-sm tabular-nums whitespace-nowrap">
          <caption className="sr-only">Historial de medidas en centímetros</caption>
          <thead><tr className="text-xs text-muted"><th scope="col" className="sticky left-0 z-[1] bg-card py-1.5 pr-3 text-left font-semibold">Fecha</th>{FIELDS.map(([k, l]) => <th key={k} scope="col" className="py-1.5 pl-3 text-right font-semibold">{l}</th>)}</tr></thead>
          <tbody>{[...history].reverse().slice(0, 5).map((m) => (
            <tr key={m.d} className="border-t border-line"><th scope="row" className="sticky left-0 z-[1] bg-card py-1.5 pr-3 text-left font-normal text-muted">{new Date(m.d + "T12:00:00").toLocaleDateString("es-419", { day: "numeric", month: "short" })}</th>{FIELDS.map(([k]) => <td key={k} className="py-1.5 pl-3 text-right text-ink">{m[k] != null ? nf(m[k]!) : <><span aria-hidden className="inline-block h-px w-2.5 bg-faint align-middle" /><span className="sr-only">sin dato</span></>}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
      <div aria-hidden className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent transition-opacity duration-200 ease-out ${more ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}

export function Photos({ photos, userId, demo }: { photos: Photo[]; userId: string; demo: boolean }) {
  const [pose, setPose] = useState<"frente" | "lado" | "espalda">("frente");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [local, setLocal] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  async function remove(id: string) {
    if (deleting) return;
    setDeleting(id); setErr(null);
    const r = await safeAction(deletePhoto(id));
    setDeleting(null);
    if (r.ok) router.refresh(); else setErr("No pudimos borrar la foto. Intenta de nuevo.");
  }
  const [cmp, setCmp] = useState(50);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const byPose = photos.filter((p) => p.pose === pose && p.url);
  const before = byPose.at(-1), after = byPose[0];

  async function onFile(f: File) {
    setErr(null);
    if (f.size > 8 * 1024 * 1024) return setErr("La foto pesa más de 8 MB.");
    if (demo) { setLocal(URL.createObjectURL(f)); return; }
    setBusy(true);
    try {
      const ext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `${userId}/${new Date().toISOString().slice(0, 10)}-${pose}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      // El cliente de Supabase se carga solo al subir una foto: no pesa en la carga de Progreso.
      const { createClient } = await import("@/lib/supabase/client");
      const bucket = createClient().storage.from("progreso");
      const { error } = await bucket.upload(path, f, { contentType: f.type, upsert: false });
      if (error) throw error;
      const r = await safeAction(addPhoto(path, pose));
      // Sin registro la foto no se vería nunca: se borra del almacenamiento para no dejarla huérfana.
      if (!r.ok) { await bucket.remove([path]).catch(() => null); throw new Error(); }
      router.refresh();
    } catch { setErr(typeof navigator !== "undefined" && !navigator.onLine ? "Sin conexión. Sube la foto cuando tengas señal." : "No se pudo subir la foto. Intenta de nuevo."); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="flex gap-1.5" role="tablist" aria-label="Pose">
        {(["frente", "lado", "espalda"] as const).map((p) => <button key={p} role="tab" aria-selected={pose === p} onClick={() => setPose(p)} className={`tap chip h-9 px-4 capitalize ${pose === p ? "bg-ink text-white" : "bg-cream text-ink"}`}>{p}</button>)}
      </div>

      {before && after && before.id !== after.id ? (
        <div className="mt-4">
          <div className="relative aspect-[3/4] max-w-sm mx-auto overflow-hidden rounded-3xl bg-cream select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={after.url!} alt={`Después, ${after.d}`} className="absolute inset-0 size-full object-cover" />
            {/* Comparador con clip-path: sin redimensionar nada, todo en GPU */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={before.url!} alt={`Antes, ${before.d}`} className="absolute inset-0 size-full object-cover" style={{ clipPath: `inset(0 ${100 - cmp}% 0 0)` }} />
            <div aria-hidden className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow" style={{ left: `${cmp}%` }} />
            <span className="absolute top-3 left-3 chip bg-ink/70 text-white">Antes: {new Date(before.d + "T12:00:00").toLocaleDateString("es-419", { day: "numeric", month: "short" })}</span>
            <span className="absolute top-3 right-3 chip bg-banana text-ink">Ahora</span>
          </div>
          <input type="range" min={5} max={95} value={cmp} onChange={(e) => setCmp(Number(e.target.value))} className="mt-3 w-full max-w-sm mx-auto block accent-ink" aria-label="Comparar antes y después" />
        </div>
      ) : (
        <div className="mt-4 rounded-3xl border-2 border-dashed border-line p-6 text-center">
          {local ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={local} alt="Vista previa" className="mx-auto max-h-72 rounded-2xl" />
          ) : (
            <><span className="mx-auto grid place-items-center size-14 rounded-2xl bg-banana-soft text-banana-ink"><Camera weight="duotone" className="size-7" /></span><p className="mt-2 font-bold text-ink">Tu primera foto de {pose}</p><p className="text-sm text-muted">La báscula miente; el espejo no. En 4 semanas vas a ver el cambio aquí lado a lado.</p></>
          )}
        </div>
      )}

      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} aria-label="Subir foto de progreso" />
      <button onClick={() => input.current?.click()} disabled={busy} className="btn-primary h-12 w-full mt-4"><Camera weight="duotone" className="size-5" />{busy ? "Subiendo…" : `Tomar foto de ${pose}`}</button>
      {err && <p role="alert" className="mt-2 text-sm font-semibold text-bad">{err}</p>}
      <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted"><Lock weight="duotone" className="size-3.5" />Privadas: solo tú las ves. {demo && "Demo: la foto no se guarda."}</p>

      {photos.length > 0 && (
        <ul className="mt-4 grid grid-cols-4 gap-2">
          {photos.slice(0, 12).map((p) => (
            <li key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-cream">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.url && <img src={p.url} alt={`${p.pose}, ${p.d}`} loading="lazy" decoding="async" className={`size-full object-cover ${deleting === p.id ? "opacity-40" : ""}`} />}
              <button onClick={() => remove(p.id)} disabled={!!deleting} aria-busy={deleting === p.id} className="tap pressable absolute top-1 right-1 grid place-items-center size-7 rounded-full bg-ink/60 text-white hover:bg-ink/80 disabled:opacity-60" aria-label={`Borrar foto del ${p.d}`}><Trash weight="bold" className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
