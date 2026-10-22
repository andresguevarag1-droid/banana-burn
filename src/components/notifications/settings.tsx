"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Bell, CheckCircle, PaperPlaneTilt, WarningCircle } from "@/components/icons";
import { getNotificationPrefs, saveNotificationPrefs, sendTestNotification } from "@/app/actions/notifications";
import type { Prefs } from "@/lib/notify";
import { EnablePush } from "./enable-push";

// Sin llave VAPID no hay push: no mostramos opciones que no funcionan.
const PUSH_READY = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
const label = (hhmm: string) => {
  const h = Number(hhmm.slice(0, 2));
  const suf = h < 12 ? "a. m." : "p. m.";
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${suf}`;
};

function Toggle({ on, onChange, title, hint }: { on: boolean; onChange: (v: boolean) => void; title: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center gap-3 py-3 text-left">
      <span className="flex-1 min-w-0"><span className="block text-sm font-bold text-ink">{title}</span>{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-(--dur-fast) ${on ? "bg-ink" : "bg-line"}`}>
        <span className={`absolute left-1 top-1 size-5 rounded-full shadow transition-[translate,background-color] duration-(--dur-fast) ease-out ${on ? "translate-x-5 bg-banana" : "bg-white"}`} />
      </span>
    </button>
  );
}

type Initial = Awaited<ReturnType<typeof getNotificationPrefs>>;

/**
 * Sección "Avisos" para /app/perfil. Si no recibe `initial`, carga las preferencias con una server action.
 * Uso: <section className="card p-5"><NotificationSettings /></section>
 */
export function NotificationSettings({ initial }: { initial?: Initial }) {
  const [data, setData] = useState<Initial | null>(initial ?? null);
  useEffect(() => { if (!initial) getNotificationPrefs().then(setData).catch(() => {}); }, [initial]);
  if (!data) return <div id="notificaciones" className="h-40 animate-pulse rounded-2xl bg-cream" aria-busy="true" />;
  return <Form data={data} />;
}

function Form({ data }: { data: Initial }) {
  const [saved, setSaved] = useState<Prefs>(data.prefs);
  const [p, setP] = useState<Prefs>(data.prefs);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const browserTz = useMemo(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ""; } }, []);
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => { setP((x) => ({ ...x, [k]: v })); setMsg(null); };
  const quietOn = Boolean(p.quiet_start && p.quiet_end);
  const reminderHour = `${p.reminder_time.slice(0, 2)}:00`;

  const save = () => start(async () => {
    const r = await saveNotificationPrefs(p);
    if (r.ok) setSaved(p);
    setMsg(r.ok ? { ok: true, t: r.demo ? "Demo: no se guardó." : "Avisos actualizados" } : { ok: false, t: r.error ?? "No pudimos guardar tus avisos. Intenta de nuevo." });
  });
  const test = () => startTest(async () => {
    const r = await sendTestNotification();
    setTestMsg(!r.ok ? r.error ?? "No pudimos enviar el aviso de prueba. Intenta de nuevo." : r.demo ? "Demo: así funcionaría con tu cuenta real." : r.push ? `Enviado a ${r.push} dispositivo${r.push > 1 ? "s" : ""} y a tu campanita.` : r.devices ? "Lo dejamos en tu campanita; el push no llegó (revisa permisos del navegador)." : "Lo dejamos en tu campanita. Activa los avisos push para recibirlo también en el celular.");
  });

  return (
    <div id="notificaciones" className="space-y-5 scroll-mt-24">
      <div>
        <h2 className="flex items-center gap-2 font-extrabold text-ink"><span className="grid place-items-center size-8 shrink-0 rounded-lg bg-banana-soft text-banana-ink"><Bell weight="duotone" className="size-5" /></span>Avisos</h2>
        <p className="mt-1 text-sm text-muted">Te recordamos qué te toca, sin spam: máximo 2 avisos al día.</p>
      </div>

      <EnablePush publicKey={data.vapidPublicKey} />

      <div>
        <p className="text-sm font-bold text-ink mb-2">Hora de tu recordatorio de entreno</p>
        <select value={reminderHour} onChange={(e) => set("reminder_time", e.target.value)} className="input h-11" aria-label="Hora del recordatorio">
          {HOURS.slice(5, 23).map((h) => <option key={h} value={h}>{label(h)}</option>)}
        </select>
        <p className="mt-1.5 text-xs text-muted">Solo los días que te toca entrenar y si todavía no has entrenado.</p>
      </div>

      <div className="divide-y divide-line">
        {PUSH_READY && <Toggle on={p.push_reminders} onChange={(v) => set("push_reminders", v)} title="Recordatorios push" hint="Entreno del día y racha en peligro (8 p. m.)" />}
        <Toggle on={p.email_reminders} onChange={(v) => set("email_reminders", v)} title="Recordatorios por correo" hint="Los mismos avisos, en tu bandeja" />
        <Toggle on={p.weekly_summary} onChange={(v) => set("weekly_summary", v)} title="Resumen semanal" hint="Lunes 7 a. m.: entrenos, peso, récords y tu semana" />
        <Toggle on={p.marketing} onChange={(v) => set("marketing", v)} title="Novedades y promociones" hint="Funciones nuevas y ofertas, pocas veces al mes" />
        {PUSH_READY && <Toggle on={quietOn} onChange={(v) => { set("quiet_start", v ? "22:00" : null); set("quiet_end", v ? "07:00" : null); }} title="Horas de silencio" hint="Sin pushes a estas horas" />}
      </div>

      {PUSH_READY && quietOn && (
        <div role="radiogroup" aria-label="Horario de silencio" className="flex flex-wrap gap-2">
          {([["21:00", "06:00"], ["22:00", "07:00"], ["23:00", "08:00"], ["00:00", "09:00"]] as const).map(([from, to]) => {
            const on = p.quiet_start === from && p.quiet_end === to;
            return <button key={from} type="button" role="radio" aria-checked={on} onClick={() => { set("quiet_start", from); set("quiet_end", to); }} className={`chip h-10 px-4 ${on ? "bg-ink text-white" : "bg-cream text-ink"}`}>{label(from)} a {label(to)}</button>;
          })}
        </div>
      )}

      <p className="text-xs text-muted">
        Zona horaria: <b className="text-ink">{p.timezone.replace(/_/g, " ")}</b>
        {browserTz && browserTz !== p.timezone && <>. <button type="button" onClick={() => set("timezone", browserTz)} className="tap font-bold text-banana-ink underline">Usar {browserTz.replace(/_/g, " ")}</button></>}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={!dirty || pending} onClick={save} className="btn-primary h-11 px-6">{pending ? "Guardando…" : "Guardar avisos"}</button>
        <button onClick={test} disabled={testing} className="btn-ghost h-11 px-5"><PaperPlaneTilt weight="bold" className="size-4" />{testing ? "Enviando…" : "Probar aviso"}</button>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`flex items-center gap-1.5 text-sm font-semibold ${msg.ok ? "text-peel" : "text-bad"}`}>{msg.ok ? <CheckCircle weight="fill" className="size-4 shrink-0" /> : <WarningCircle weight="fill" className="size-4 shrink-0" />}{msg.t}</p>}
      {testMsg && <p className="text-sm text-muted">{testMsg}</p>}
    </div>
  );
}
