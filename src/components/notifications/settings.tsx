"use client";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Bell, CheckCircle, PaperPlaneTilt, WarningCircle } from "@/components/icons";
import { getNotificationPrefs, saveNotificationPrefs, sendTestNotification, type NotificationPrefsData } from "@/app/actions/notifications";
import { tzLabel, type Prefs } from "@/lib/notify";
import { EnablePush } from "./enable-push";
import { Toggle } from "./toggle";

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
const label = (hhmm: string) => {
  const h = Number(hhmm.slice(0, 2));
  const suf = h < 12 ? "a. m." : "p. m.";
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${suf}`;
};

/**
 * Sección "Avisos" para /app/perfil. Recibe `initial` desde el servidor; si no viene (o falla), la carga con
 * una server action y muestra un estado de error con "Reintentar" en vez de un esqueleto eterno.
 */
export function NotificationSettings({ initial }: { initial?: NotificationPrefsData | null }) {
  const [data, setData] = useState<NotificationPrefsData | null>(initial ?? null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(!initial);
  const load = useCallback(() => {
    setLoading(true); setFailed(false);
    getNotificationPrefs().then((d) => setData(d)).catch(() => setFailed(true)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (!initial) load(); }, [initial, load]);
  if (data) return <Form data={data} />;
  if (failed && !loading) {
    return (
      <div id="notificaciones" className="scroll-mt-24" role="alert">
        <Heading />
        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-bad"><WarningCircle weight="fill" className="size-4 shrink-0" />No pudimos cargar tus avisos.</p>
        <button type="button" onClick={load} className="btn-ghost h-11 px-5 mt-3">Reintentar</button>
      </div>
    );
  }
  return <div id="notificaciones" className="h-40 animate-pulse rounded-2xl bg-cream motion-reduce:animate-none" aria-busy="true" aria-label="Cargando avisos" />;
}

function Heading({ sub }: { sub?: string }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 font-extrabold text-ink"><span className="grid place-items-center size-8 shrink-0 rounded-lg bg-banana-soft text-banana-ink"><Bell weight="duotone" className="size-5" /></span>Avisos</h2>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

function Form({ data }: { data: NotificationPrefsData }) {
  const [saved, setSaved] = useState<Prefs>(data.prefs);
  const [p, setP] = useState<Prefs>(data.prefs);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const browserTz = useMemo(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ""; } }, []);
  const hourly = data.cronMode === "hourly";
  const pushReady = data.pushConfigured && Boolean(data.vapidPublicKey);
  const email = data.emailConfigured;
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => { setP((x) => ({ ...x, [k]: v })); setMsg(null); };
  const quietOn = Boolean(p.quiet_start && p.quiet_end);
  const reminderHour = `${p.reminder_time.slice(0, 2)}:00`;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const save = () => start(async () => {
    const r = await saveNotificationPrefs(p).catch(() => ({ ok: false, error: "Sin conexión. Intenta de nuevo.", demo: false }));
    if (r.ok) setSaved(p);
    setMsg(r.ok ? { ok: true, t: r.demo ? "Demo: no se guardó." : "Avisos actualizados" } : { ok: false, t: r.error ?? "No pudimos guardar tus avisos. Intenta de nuevo." });
  });
  const test = () => startTest(async () => {
    const r = await sendTestNotification().catch(() => ({ ok: false, error: "Sin conexión. Intenta de nuevo.", push: 0, devices: 0, demo: false, retryIn: 0 }));
    if (r.retryIn) setCooldown(r.retryIn);
    setTestMsg(!r.ok ? { ok: false, t: r.error ?? "No pudimos enviar el aviso de prueba. Intenta de nuevo." } : { ok: true, t: r.demo ? "Demo: así funcionaría con tu cuenta real." : r.push ? `Enviado a ${r.push} dispositivo${r.push > 1 ? "s" : ""} y a tu campanita.` : r.devices ? "Lo dejamos en tu campanita; el push no llegó (revisa los permisos del navegador)." : "Lo dejamos en tu campanita." });
  });

  const channels = [pushReady && "en tu celular", "en tu campanita", email && "por correo"].filter(Boolean).join(", ").replace(/, ([^,]*)$/, " y $1");

  return (
    <div id="notificaciones" className="space-y-5 scroll-mt-24">
      <Heading sub={`Te recordamos qué te toca ${channels}, sin spam: máximo 2 avisos al día.`} />

      {pushReady && <EnablePush publicKey={data.vapidPublicKey} hourly={hourly} />}

      {hourly ? (
        <div>
          <label htmlFor="hora-recordatorio" className="block text-sm font-bold text-ink mb-2">Hora de tu recordatorio de entreno</label>
          <select id="hora-recordatorio" value={reminderHour} onChange={(e) => set("reminder_time", e.target.value)} className="input h-11">
            {HOURS.slice(5, 23).map((h) => <option key={h} value={h}>{label(h)}</option>)}
          </select>
          <p className="mt-1.5 text-xs text-muted">Solo los días que te toca entrenar y si todavía no has entrenado.</p>
        </div>
      ) : (
        <p className="rounded-2xl bg-cream p-3 text-sm text-muted">El recordatorio de entreno sale una vez al día, en la mañana, solo los días que te toca entrenar.</p>
      )}

      <div className="divide-y divide-line">
        {pushReady && <Toggle on={p.push_reminders} onChange={(v) => set("push_reminders", v)} title="Recordatorios push" hint={hourly ? "Entreno del día y racha en peligro (8 p. m.)" : "Entreno del día"} />}
        {email && <Toggle on={p.email_reminders} onChange={(v) => set("email_reminders", v)} title="Recordatorios por correo" hint="Los mismos avisos, en tu bandeja" />}
        <Toggle on={p.weekly_summary} onChange={(v) => set("weekly_summary", v)} title="Resumen semanal" hint={`Los lunes${hourly ? " a las 7 a. m." : " en la mañana"}: entrenos, peso, récords y tu semana${email ? ", también por correo" : ""}`} />
        {email && <Toggle on={p.marketing} onChange={(v) => set("marketing", v)} title="Novedades y promociones" hint="Funciones nuevas y ofertas, pocas veces al mes" />}
        {pushReady && hourly && <Toggle on={quietOn} onChange={(v) => { set("quiet_start", v ? "22:00" : null); set("quiet_end", v ? "07:00" : null); }} title="Horas de silencio" hint="Sin pushes a estas horas" />}
      </div>

      {pushReady && hourly && quietOn && (
        <div role="radiogroup" aria-label="Horario de silencio" className="flex flex-wrap gap-2">
          {([["21:00", "06:00"], ["22:00", "07:00"], ["23:00", "08:00"], ["00:00", "09:00"]] as const).map(([from, to]) => {
            const on = p.quiet_start === from && p.quiet_end === to;
            return <button key={from} type="button" role="radio" aria-checked={on} onClick={() => { set("quiet_start", from); set("quiet_end", to); }} className={`chip pressable h-11 px-4 outline-none focus-visible:ring-4 focus-visible:ring-banana/60 ${on ? "bg-ink text-white" : "bg-cream text-ink"}`}>{label(from)} a {label(to)}</button>;
          })}
        </div>
      )}

      <p className="text-xs text-muted">
        Zona horaria: <b className="text-ink">{tzLabel(p.timezone)}</b>
        {browserTz && browserTz !== p.timezone && <>. <button type="button" onClick={() => set("timezone", browserTz)} className="tap font-bold text-banana-ink underline">Usar {tzLabel(browserTz)}</button></>}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={!dirty || pending} onClick={save} className="btn-primary h-11 px-6">{pending ? "Guardando…" : "Guardar avisos"}</button>
        <button onClick={test} disabled={testing || cooldown > 0} className="btn-ghost h-11 px-5"><PaperPlaneTilt weight="bold" className="size-4" />{testing ? "Enviando…" : cooldown > 0 ? `Probar de nuevo en ${cooldown} s` : "Probar aviso"}</button>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`flex items-center gap-1.5 text-sm font-semibold ${msg.ok ? "text-peel" : "text-bad"}`}>{msg.ok ? <CheckCircle weight="fill" className="size-4 shrink-0" /> : <WarningCircle weight="fill" className="size-4 shrink-0" />}{msg.t}</p>}
      {testMsg && <p role={testMsg.ok ? "status" : "alert"} className={`text-sm ${testMsg.ok ? "text-muted" : "font-semibold text-bad"}`}>{testMsg.t}</p>}
    </div>
  );
}
