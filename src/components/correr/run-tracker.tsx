"use client";
// Registrar una carrera con el GPS del teléfono. Explica antes de pedir permiso, mantiene la pantalla encendida
// (Wake Lock, se vuelve a pedir al regresar a la app), guarda cada punto en el teléfono (IndexedDB) por si se cierra
// la pestaña, y al terminar manda los puntos al servidor, que recalcula todo. Los cortes de señal quedan como pausa.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleNotch, MapPin, Pause, Play, ShieldCheck, Stop } from "@/components/icons";
import { SafeImage } from "@/components/safe-image";
import { RunMap } from "./run-map";
import { GAP_MS, acceptPoint, haversine, currentPace, fmtDuration, fmtKm, fmtPace, runStats, type GeoPoint, type Track } from "@/lib/runs";

type Saved = { clientId: string; segments: Track; startedAt: number; activeMs: number };
type Phase = "intro" | "denied" | "unsupported" | "waiting" | "running" | "paused" | "saving" | "error";

// ───────────── IndexedDB (búfer local) ─────────────
const DB = "bb-correr", STORE = "carreras";
function idb(): Promise<IDBDatabase | null> {
  return new Promise((ok) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "clientId" });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
    } catch { ok(null); }
  });
}
async function idbDo<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await idb();
  if (!db) return null;
  return new Promise((ok) => {
    try { const q = fn(db.transaction(STORE, mode).objectStore(STORE)); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); } catch { ok(null); }
  });
}
const putRun = (r: Saved) => idbDo("readwrite", (s) => s.put(r));
const delRun = (id: string) => idbDo("readwrite", (s) => s.delete(id));
const allRuns = () => idbDo<Saved[]>("readonly", (s) => s.getAll() as IDBRequest<Saved[]>);

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)));

export function RunTracker({ coachSrc, coachName }: { coachSrc: string; coachName: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [segments, setSegments] = useState<Track>([]);
  const [here, setHere] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [activeMs, setActiveMs] = useState(0);
  const [autoPause, setAutoPause] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false);
  const [hold, setHold] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Saved | null>(null);
  const [lockOk, setLockOk] = useState(true);

  const run = useRef<Saved | null>(null);
  const watch = useRef<number | null>(null);
  const lock = useRef<WakeLockSentinel | null>(null);
  const tickFrom = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("intro");
  const slowSince = useRef<number | null>(null);
  const holdTimer = useRef<number | null>(null);
  const lastSave = useRef(0);
  const autoPauseRef = useRef(false);
  const autoPausedRef = useRef(false);
  autoPauseRef.current = autoPause;
  phaseRef.current = phase;

  // Carreras sin guardar de una sesión anterior (se cerró la pestaña o no había internet).
  useEffect(() => { allRuns().then((xs) => { if (xs?.length) setPending(xs.sort((a, b) => b.startedAt - a.startedAt)[0]); }); }, []);

  const wakeLock = useCallback(async () => {
    try {
      if (!("wakeLock" in navigator)) { setLockOk(false); return; }
      lock.current = await navigator.wakeLock.request("screen");
      setLockOk(true);
    } catch { setLockOk(false); }
  }, []);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible" && ["running", "paused", "waiting"].includes(phaseRef.current)) void wakeLock(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [wakeLock]);

  // Reloj del tiempo en movimiento.
  useEffect(() => {
    if (phase !== "running" || autoPaused) return;
    tickFrom.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const delta = now - (tickFrom.current ?? now);
      tickFrom.current = now;
      setActiveMs((x) => x + delta);
    }, 1000);
    return () => { window.clearInterval(id); tickFrom.current = null; };
  }, [phase, autoPaused]);
  useEffect(() => { if (run.current) run.current.activeMs = activeMs; }, [activeMs]);

  const persist = useCallback((force = false) => {
    const r = run.current;
    if (!r) return;
    const now = Date.now();
    if (force || now - lastSave.current > 8000) { lastSave.current = now; void putRun({ ...r, segments: r.segments.map((s) => [...s]) }); }
  }, []);

  const onPoint = useCallback((pos: GeolocationPosition) => {
    const p: GeoPoint = { t: pos.timestamp || Date.now(), lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
    setHere({ lat: p.lat, lng: p.lng, acc: p.acc });
    if (phaseRef.current === "waiting" && p.acc <= 30) { setPhase("running"); phaseRef.current = "running"; }
    const r = run.current;
    if (!r || phaseRef.current !== "running") return;
    const segs = r.segments;
    let cur = segs[segs.length - 1];
    const prev = cur?.[cur.length - 1] ?? null;
    // Pausa automática (opcional): casi quieto por 12 s; vuelve sola al moverse. En pausa no suma puntos.
    if (autoPauseRef.current) {
      const speed = pos.coords.speed ?? (prev ? haversine(prev, p) / Math.max(1, (p.t - prev.t) / 1000) : null);
      if (speed != null && speed < 0.6) { slowSince.current ??= p.t; if (p.t - slowSince.current > 12_000 && !autoPausedRef.current) { autoPausedRef.current = true; setAutoPaused(true); } }
      else if (speed != null && speed > 1.2 && autoPausedRef.current) { slowSince.current = null; autoPausedRef.current = false; setAutoPaused(false); segs.push([]); cur = segs[segs.length - 1]; }
      else if (speed != null && speed >= 0.6) slowSince.current = null;
      if (autoPausedRef.current) return;
    }
    const last = cur?.[cur.length - 1] ?? null;
    if (!acceptPoint(last && p.t - last.t <= GAP_MS ? last : null, p)) return;
    // Sin señal más de 30 s: el tramo se corta (en el mapa queda como pausa, sin recta).
    if (!cur || (last && p.t - last.t > GAP_MS)) { cur = []; segs.push(cur); }
    cur.push(p);
    setSegments(segs.map((s) => s));
    persist();
  }, [persist]);

  const startWatch = useCallback(() => {
    if (watch.current != null) return;
    watch.current = navigator.geolocation.watchPosition(onPoint, (e) => {
      if (e.code === e.PERMISSION_DENIED) { setPhase("denied"); stopWatch(); }
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
  }, [onPoint]);
  const stopWatch = () => { if (watch.current != null) navigator.geolocation.clearWatch(watch.current); watch.current = null; };
  useEffect(() => () => { stopWatch(); void lock.current?.release().catch(() => {}); }, []);

  const begin = (resume?: Saved) => {
    if (!("geolocation" in navigator)) { setPhase("unsupported"); return; }
    run.current = resume ? { ...resume, segments: [...resume.segments, []] } : { clientId: uuid(), segments: [], startedAt: Date.now(), activeMs: 0 };
    setSegments(run.current.segments);
    setActiveMs(run.current.activeMs);
    setPending(null);
    setPhase(resume ? "running" : "waiting");
    void wakeLock();
    startWatch();
  };
  const pause = () => { setPhase("paused"); persist(true); };
  const resume = () => { run.current?.segments.push([]); autoPausedRef.current = false; setAutoPaused(false); setPhase("running"); };

  const finish = async (r: Saved | null = run.current) => {
    if (!r) return;
    setConfirmEnd(false);
    setPhase("saving");
    stopWatch();
    await putRun({ ...r, segments: r.segments.filter((s) => s.length) });
    try {
      const res = await fetch("/api/carreras", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: r.clientId, segments: r.segments.filter((s) => s.length > 1) }) });
      const j = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (res.status === 422) { await delRun(r.clientId); setError(j.error ?? "Carrera demasiado corta."); setPhase("error"); run.current = null; return; }
      if (!res.ok || !j.id) throw new Error(j.error ?? "No pudimos guardar tu carrera.");
      await delRun(r.clientId);
      void lock.current?.release().catch(() => {});
      router.push(j.id.startsWith("demo") ? "/app/correr/demo-0" : `/app/correr/${j.id}`);
    } catch (e) {
      run.current = r;
      setError(`${e instanceof Error ? e.message : "No pudimos guardar tu carrera."} Quedó guardada en tu teléfono.`);
      setPhase("error");
    }
  };
  const discard = async (id: string) => { await delRun(id); setPending(null); };

  // Mantener presionado para terminar (evita terminar por un toque accidental en el bolsillo).
  const holdStart = () => {
    const t0 = Date.now();
    holdTimer.current = window.setInterval(() => {
      const f = Math.min(1, (Date.now() - t0) / 1200);
      setHold(f);
      if (f >= 1) { holdEnd(); void finish(); }
    }, 40);
  };
  const holdEnd = () => { if (holdTimer.current) window.clearInterval(holdTimer.current); holdTimer.current = null; setHold(0); };

  const stats = runStats(segments);
  const cur = segments[segments.length - 1] ?? [];
  const moving = Math.round(activeMs / 1000);
  const avg = stats.distanceM >= 50 ? Math.round(moving / (stats.distanceM / 1000)) : null;

  if (phase === "intro" || phase === "denied" || phase === "unsupported") {
    return (
      <div className="space-y-4">
        {pending && (
          <section className="card p-5 space-y-3" aria-labelledby="pend">
            <h2 id="pend" className="font-extrabold text-ink">Tienes una carrera sin guardar</h2>
            <p className="text-sm text-body">{fmtKm(runStats(pending.segments).distanceM)} km del {new Date(pending.startedAt).toLocaleDateString("es-419", { day: "numeric", month: "long" })}.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void finish(pending)} className="btn-primary h-12">Guardarla</button>
              <button type="button" onClick={() => begin(pending)} className="btn-ghost h-12">Seguir corriendo</button>
              <button type="button" onClick={() => void discard(pending.clientId)} className="btn-ghost h-12">Descartar</button>
            </div>
          </section>
        )}
        <section className="card overflow-hidden md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="relative aspect-[4/3] md:aspect-auto md:min-h-72 bg-[#FFEDD5]"><SafeImage src={coachSrc} alt={`${coachName} con ropa de correr`} fill priority sizes="(min-width: 768px) 40vw, 100vw" className="object-contain object-bottom p-3" /></div>
          <div className="space-y-4 p-5 sm:p-7">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink text-balance">Registra tu carrera</h1>
            <p className="text-body text-pretty">Usamos el GPS de tu teléfono para medir distancia, tiempo y ritmo por kilómetro. Tu recorrido es privado: solo tú lo ves, y el mapa guardado no muestra los primeros ni los últimos 200 m.</p>
            <ul className="space-y-2 text-sm text-body">
              <li className="flex gap-2"><MapPin weight="duotone" className="mt-0.5 size-5 shrink-0 text-[#C2410C]" />Te vamos a pedir tu ubicación. Elige permitirla mientras usas la app.</li>
              <li className="flex gap-2"><ShieldCheck weight="duotone" className="mt-0.5 size-5 shrink-0 text-[#C2410C]" />Deja la app abierta con la pantalla encendida: el navegador no puede medir con el teléfono bloqueado.</li>
            </ul>
            {phase === "denied" && (
              <div role="alert" className="space-y-2 rounded-2xl bg-ember/10 p-4 text-sm text-ember-ink">
                <p className="font-bold">El permiso de ubicación está bloqueado.</p>
                <p><b>iPhone:</b> abre Ajustes, Privacidad y seguridad, Localización. Activa la localización, entra a Safari (o a tu navegador) y elige “Al usar la app” con “Ubicación exacta” encendida. Luego recarga esta página.</p>
                <p><b>Android:</b> en Chrome toca el candado junto a la dirección, Permisos, Ubicación, y elige Permitir. Revisa también que la ubicación del teléfono esté encendida.</p>
              </div>
            )}
            {phase === "unsupported" && <p role="alert" className="rounded-2xl bg-ember/10 p-4 text-sm font-semibold text-ember-ink">Este navegador no tiene GPS. Abre Banana Burn en el navegador de tu teléfono.</p>}
            <button type="button" onClick={() => begin()} className="btn-banana w-full h-14 text-base">{phase === "denied" ? "Intentar de nuevo" : "Permitir ubicación y empezar"}<ArrowRight className="size-5" /></button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RunMap track={segments} here={here} label="Mapa de tu carrera en vivo" />
      {phase === "waiting" && <p role="status" className="flex items-center gap-2 rounded-2xl bg-cream p-3 text-sm font-semibold text-ink"><CircleNotch weight="bold" className="size-5 animate-spin" />Buscando señal de GPS{here ? ` (precisión ${Math.round(here.acc)} m)` : ""}. Sal a un lugar abierto.</p>}
      {!lockOk && <p className="rounded-2xl bg-cream p-3 text-sm text-body">Tu navegador no deja mantener la pantalla encendida: no bloquees el teléfono mientras corres.</p>}
      {autoPaused && phase === "running" && <p role="status" className="rounded-2xl bg-cream p-3 text-sm font-semibold text-ink">Pausa automática: sigue cuando vuelvas a moverte.</p>}
      <section className="card grid grid-cols-2 gap-4 p-5" aria-label="Datos de tu carrera" aria-live="off">
        <div className="col-span-2"><p className="text-xs font-bold uppercase tracking-[.12em] text-muted">Distancia</p><p className="text-6xl font-extrabold tabular-nums tracking-tight text-ink">{fmtKm(stats.distanceM)}<span className="ml-1 text-xl text-muted">km</span></p></div>
        <div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted">Tiempo</p><p className="text-3xl font-extrabold tabular-nums text-ink">{fmtDuration(moving)}</p></div>
        <div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted">Ritmo actual</p><p className="text-3xl font-extrabold tabular-nums text-ink">{fmtPace(phase === "running" && !autoPaused ? currentPace(cur) : null)}<span className="ml-1 text-sm text-muted">/km</span></p></div>
        <div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted">Ritmo promedio</p><p className="text-3xl font-extrabold tabular-nums text-ink">{fmtPace(avg)}<span className="ml-1 text-sm text-muted">/km</span></p></div>
        <div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted">Parciales</p><p className="text-3xl font-extrabold tabular-nums text-ink">{stats.splits.filter((s) => Number.isInteger(s.km)).length}</p></div>
      </section>
      {stats.splits.some((s) => Number.isInteger(s.km)) && (
        <ol className="card divide-y divide-line p-0" aria-label="Parciales por kilómetro">
          {stats.splits.filter((s) => Number.isInteger(s.km)).slice(-5).map((s) => <li key={s.km} className="flex justify-between px-5 py-2.5 text-sm"><span className="font-bold text-ink">Km {s.km}</span><span className="tabular-nums text-body">{fmtPace(s.seconds)}</span></li>)}
        </ol>
      )}
      <label className="flex items-center gap-3 text-sm font-semibold text-ink"><input type="checkbox" checked={autoPause} onChange={(e) => { setAutoPause(e.target.checked); if (!e.target.checked) { autoPausedRef.current = false; setAutoPaused(false); } }} className="size-5 accent-ink" />Pausa automática cuando me detengo</label>
      {phase === "saving" ? (
        <p role="status" className="flex items-center justify-center gap-2 p-4 font-bold text-ink"><CircleNotch weight="bold" className="size-5 animate-spin" />Guardando tu carrera</p>
      ) : phase === "error" ? (
        <div className="space-y-2">
          <p role="alert" className="rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad">{error}</p>
          {run.current && <button type="button" onClick={() => void finish()} className="btn-primary w-full h-12">Intentar guardar de nuevo</button>}
          <button type="button" onClick={() => { setPhase("intro"); setSegments([]); setActiveMs(0); }} className="btn-ghost w-full h-12">Volver</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {phase === "paused"
            ? <button type="button" onClick={resume} className="btn-banana h-16 text-base"><Play weight="fill" className="size-5" />Seguir</button>
            : <button type="button" onClick={pause} disabled={phase === "waiting"} className="btn-ghost h-16 text-base"><Pause weight="fill" className="size-5" />Pausar</button>}
          <button type="button" onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd} onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => { if (e.detail === 0) setConfirmEnd(true); }} aria-describedby="hold-hint"
            className="relative h-16 overflow-hidden rounded-2xl bg-ink text-base font-extrabold text-white select-none touch-none">
            <span aria-hidden className="absolute inset-y-0 left-0 bg-[#C2410C]" style={{ width: `${hold * 100}%` }} />
            <span className="relative inline-flex items-center gap-2"><Stop weight="fill" className="size-5" />Terminar</span>
          </button>
          <p id="hold-hint" className="col-span-2 text-center text-xs text-muted">Mantén presionado Terminar para guardar tu carrera.</p>
          {confirmEnd && (
            <div className="col-span-2 card p-4 space-y-2">
              <p className="text-sm text-body">¿Terminar y guardar tu carrera?</p>
              <div className="flex gap-2"><button type="button" onClick={() => void finish()} className="btn-primary h-12 flex-1">Sí, terminar</button><button type="button" onClick={() => setConfirmEnd(false)} className="btn-ghost h-12 flex-1">Seguir</button></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
