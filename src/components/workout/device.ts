"use client";
// Todo lo que toca el teléfono: vibración, pitidos, voz y pantalla encendida.
// Cada función falla en silencio: si el navegador no lo soporta, el entreno sigue igual.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export const store = {
  get<T>(k: string): T | null { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* */ } },
};

export const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* */ } };

/* ---------- Preferencias del reproductor ---------- */
export type Prefs = { sound: boolean; voice: boolean; view: "focus" | "list" };
const PREFS_KEY = "bb.player.prefs";
const DEFAULT: Prefs = { sound: true, voice: false, view: "focus" };
let cached: Prefs | null = null;
const subs = new Set<() => void>();
const readPrefs = (): Prefs => (cached ??= { ...DEFAULT, ...(store.get<Partial<Prefs>>(PREFS_KEY) ?? {}) });
export function usePrefs() {
  const prefs = useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, readPrefs, () => DEFAULT);
  const set = useCallback((p: Partial<Prefs>) => { cached = { ...readPrefs(), ...p }; store.set(PREFS_KEY, cached); subs.forEach((f) => f()); }, []);
  return [prefs, set] as const;
}

/* ---------- Sonido: un solo AudioContext, desbloqueado con el primer toque ---------- */
let ctx: AudioContext | null = null;
function audio() {
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}
/** Llamar dentro de un gesto (tap) para que iOS deje sonar los pitidos después. */
export const unlockAudio = () => { audio(); };
function tone(freq: number, at: number, dur: number, vol = 0.2) {
  const c = audio();
  if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = "sine"; o.frequency.value = freq;
  const t = c.currentTime + at;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
export const sfx = {
  /** Cuenta regresiva 3, 2, 1 */
  tick() { tone(660, 0, 0.12, 0.16); },
  /** Fin del descanso o del intervalo */
  go() { tone(880, 0, 0.22); tone(1320, 0.16, 0.32); },
  /** Serie marcada */
  done() { tone(523, 0, 0.09, 0.12); tone(784, 0.07, 0.14, 0.12); },
  /** Récord */
  pr() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 0.14)); },
};

/* ---------- Voz del coach (Web Speech) ---------- */
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
let voice: SpeechSynthesisVoice | null | undefined;
function pickVoice() {
  if (voice !== undefined) return voice;
  try {
    const all = window.speechSynthesis.getVoices();
    if (!all.length) return null; // aún cargando: se reintenta en la próxima frase
    const pref = ["es-419", "es-MX", "es-US"];
    const norm = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase();
    // Español neutro latinoamericano primero; cualquier otra voz latina después; España solo si no hay otra
    voice = pref.map((l) => all.find((v) => norm(v) === l.toLowerCase())).find(Boolean)
      ?? all.find((v) => norm(v).startsWith("es-") && norm(v) !== "es-es") ?? all.find((v) => norm(v).startsWith("es")) ?? null;
    return voice;
  } catch { return null; }
}
export function say(text: string, o: { interrupt?: boolean; rate?: number } = {}) {
  if (!canSpeak()) return;
  try {
    const s = window.speechSynthesis;
    if (o.interrupt) s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? "es-MX";
    u.rate = o.rate ?? 1.05;
    s.speak(u);
  } catch { /* */ }
}
export const hush = () => { try { if (canSpeak()) window.speechSynthesis.cancel(); } catch { /* */ } };

/* ---------- Pantalla encendida durante el entreno ---------- */
type Sentinel = { release: () => Promise<void>; released?: boolean };
export function useWakeLock(active: boolean) {
  const lock = useRef<Sentinel | null>(null);
  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } };
    if (!nav.wakeLock) return;
    let alive = true;
    const get = async () => {
      if (document.visibilityState !== "visible" || (lock.current && !lock.current.released)) return;
      try { const l = await nav.wakeLock!.request("screen"); if (alive) lock.current = l; else void l.release(); } catch { /* batería baja o sin permiso */ }
    };
    void get();
    // El sistema suelta el bloqueo al cambiar de app: lo pedimos de nuevo al volver
    const onVis = () => { if (document.visibilityState === "visible") { lock.current = null; void get(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; document.removeEventListener("visibilitychange", onVis); void lock.current?.release().catch(() => {}); lock.current = null; };
  }, [active]);
}

/**
 * Reloj del reproductor. Todo se calcula con marcas de tiempo (no se cuentan ticks),
 * así que si la pestaña se duerme en el bolsillo, al volver el descanso marca lo correcto.
 */
export function useNow(ms = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    const onVis = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [ms]);
  return now;
}

/* ---------- Aviso con la pestaña oculta ---------- */
const NOTICE_TAG = "bb-workout";
async function swReg() {
  try {
    if (!("serviceWorker" in navigator) || !("Notification" in window) || Notification.permission !== "granted") return null;
    return (await navigator.serviceWorker.getRegistration("/")) ?? null;
  } catch { return null; }
}
/**
 * Programa un aviso local para `at` (fin del descanso, del intervalo o de la serie por tiempo).
 * Solo suena si la pestaña está oculta y el usuario ya dio permiso de notificaciones (service worker de avisos).
 * Al volver a la app se cierra: el reloj en pantalla ya muestra el estado correcto porque todo va con marcas de tiempo.
 */
export function useHiddenAlarm(at: number | null, title: string, body: string) {
  const text = useRef({ title, body });
  useEffect(() => { text.current = { title, body }; }, [title, body]);
  useEffect(() => {
    if (at == null) return;
    const ms = at - Date.now();
    if (ms <= 0) return;
    const t = setTimeout(() => {
      if (document.visibilityState !== "hidden") return;
      void swReg().then((reg) => reg?.showNotification(text.current.title, {
        body: text.current.body, tag: NOTICE_TAG, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", lang: "es",
        data: { url: location.pathname + location.search },
      }).catch(() => {}));
    }, ms);
    return () => clearTimeout(t);
  }, [at]);
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      void swReg().then((reg) => reg?.getNotifications({ tag: NOTICE_TAG }).then((ns) => ns.forEach((n) => n.close())).catch(() => {}));
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
}

/** Prefiere-movimiento-reducido, leído en vivo. */
export function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia("(prefers-reduced-motion: reduce)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
