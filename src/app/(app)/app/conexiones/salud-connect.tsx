"use client";
// Conectar Salud en la app nativa (src/lib/native/salud.ts): Apple Salud en iPhone, Health Connect en Android. Solo
// lectura de pasos, energía activa y peso; el permiso del sistema se pide al tocar "Conectar", nunca al abrir la app.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowsClockwise, Fire, Footprints, Heart, Heartbeat, Info, Scales, Warning } from "@/components/icons";
import { fmtDate } from "@/lib/today";
import { nfmt } from "@/lib/num";
import type { SaludState } from "@/lib/native/salud";

type Saved = { steps: number | null; activeKcal: number | null; weight: { day: string; kg: number } | null };
type Props = { owner: string; platform: "ios" | "android"; shellOk: boolean; saved: Saved };

const salud = () => import("@/lib/native/salud");

export function SaludConnect({ owner, platform, shellOk, saved }: Props) {
  const router = useRouter();
  const [state, setState] = useState<SaludState | "checking" | "working">("checking");
  const [shown, setShown] = useState<Saved>(saved);
  const [msg, setMsg] = useState<string | null>(null);
  const ios = platform === "ios";
  const app = ios ? "la app Salud" : "Health Connect";

  useEffect(() => { setShown(saved); }, [saved]);
  useEffect(() => {
    if (!shellOk) { setState("unavailable"); return; }
    void salud().then((m) => m.saludState(owner)).then(setState).catch(() => setState("unavailable"));
  }, [owner, shellOk]);

  const sync = useCallback(async () => {
    setState("working");
    setMsg(null);
    const snap = await salud().then((m) => m.syncSalud({ force: true })).catch(() => null);
    if (snap && !snap.result.ok) setMsg(snap.result.error ?? "No pudimos actualizar. Intenta de nuevo en un momento.");
    if (snap?.result.ok) {
      // Lo que se ve es lo guardado (lo anotado a mano puede ser mayor); el servidor vuelve a pintar la página.
      setShown((s) => ({ steps: Math.max(s.steps ?? 0, snap.steps ?? 0) || s.steps, activeKcal: snap.activeKcal ?? s.activeKcal, weight: s.weight ?? snap.lastWeight }));
      router.refresh();
    }
    setState(await salud().then((m) => m.saludState(owner)).catch(() => "on" as const));
  }, [owner, router]);

  const connect = async () => {
    setState("working");
    const next = await salud().then((m) => m.connectSalud(owner)).catch(() => "unavailable" as const);
    if (next === "on") return sync();
    setState(next);
  };
  const disconnect = () => { void salud().then((m) => m.disconnectSalud()); setState("off"); };
  const settings = () => { void salud().then((m) => m.openHealthSettings()); };

  if (state === "checking") return <div className="card h-48 animate-pulse" aria-hidden />;

  if (state === "unavailable") {
    return (
      <Notice>
        {!shellOk ? "Actualiza Banana Burn desde la tienda para conectar tus pasos y tu peso."
          : ios ? "Este teléfono no tiene la app Salud." : "Tu teléfono no es compatible con Health Connect, la app de Google para datos de actividad."}
      </Notice>
    );
  }

  if (state === "install") {
    return (
      <section className="card p-5">
        <Title icon={Heartbeat}>Instala Health Connect</Title>
        <p className="mt-2 text-sm text-body">Es la app gratuita de Google que guarda tus pasos y tu peso en Android. Instálala o actualízala y vuelve aquí.</p>
        <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata" target="_blank" rel="noreferrer" className="btn-primary mt-4 h-12 w-full">Abrir en Google Play</a>
      </section>
    );
  }

  if (state === "denied") {
    return (
      <section className="card p-5">
        <Title icon={Warning}>Falta tu permiso</Title>
        <p className="mt-2 text-sm text-body">Health Connect no nos dejó leer tus datos. Abre sus permisos y activa Pasos, Peso y Calorías activas quemadas para Banana Burn.</p>
        <div className="mt-4 flex gap-2">
          <button onClick={settings} className="btn-primary h-12 flex-1 px-5">Abrir Health Connect</button>
          <button onClick={() => void connect()} className="btn-ghost h-12 px-5">Reintentar</button>
        </div>
      </section>
    );
  }

  if (state === "off") {
    return (
      <section className="rounded-3xl border-2 border-banana bg-banana-soft/40 p-5">
        <Title icon={ios ? Heart : Heartbeat}>Conecta {app}</Title>
        <p className="mt-2 text-sm text-body">Tus pasos, tu energía activa y tu peso entran solos a tu día. Cuentan para tus retos y tu racha igual que si los anotaras.</p>
        <ul className="mt-3 space-y-1.5 text-sm text-body">
          <li className="flex items-center gap-2"><Footprints weight="duotone" className="size-4 shrink-0 text-banana-ink" />Pasos de los últimos 7 días</li>
          <li className="flex items-center gap-2"><Fire weight="duotone" className="size-4 shrink-0 text-banana-ink" />Energía activa del día</li>
          <li className="flex items-center gap-2"><Scales weight="duotone" className="size-4 shrink-0 text-banana-ink" />Pesajes de tu báscula de los últimos 30 días</li>
        </ul>
        <p className="mt-3 text-xs text-muted">Solo leemos. No escribimos nada en {app} ni compartimos estos datos con nadie.</p>
        <button onClick={() => void connect()} className="btn-primary mt-4 h-12 w-full">Conectar</button>
      </section>
    );
  }

  // Conectada (o actualizando).
  const kcal = shown.activeKcal;
  return (
    <section className="card p-5">
      <Title icon={ios ? Heart : Heartbeat}>{ios ? "Salud conectada" : "Health Connect conectado"}</Title>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat icon={Footprints} label="Pasos hoy" value={shown.steps != null ? nfmt(shown.steps, 0) : "Sin datos"} />
        <Stat icon={Fire} label="Energía activa" value={kcal != null ? `${nfmt(kcal, 0)} kcal` : "Sin datos"} />
        <Stat icon={Scales} label={shown.weight ? `Peso, ${fmtDate(shown.weight.day)}` : "Peso"} value={shown.weight ? `${nfmt(shown.weight.kg)} kg` : "Sin datos"} />
      </dl>
      {msg && <p className="mt-3 text-sm font-bold text-ink" role="status">{msg}</p>}
      <p className="mt-3 text-xs text-muted">Se actualiza solo cuando abres la app. Si anotas más pasos a mano, se respeta lo tuyo; lo mismo con el peso del día.</p>
      {ios && <p className="mt-2 flex gap-1.5 text-xs text-muted"><Info weight="duotone" className="size-4 shrink-0" />¿Ves todo en 0? Revisa el permiso en Ajustes, Salud, Acceso a datos y dispositivos, Banana Burn.</p>}
      <div className="mt-4 flex items-center gap-2">
        <button onClick={() => void sync()} disabled={state === "working"} className="btn-primary h-12 flex-1 px-5">
          <ArrowsClockwise weight="bold" className={`size-4 ${state === "working" ? "animate-spin" : ""}`} aria-hidden />{state === "working" ? "Actualizando" : "Actualizar"}
        </button>
        <button onClick={disconnect} className="tap px-2 text-xs font-bold text-muted underline hover:text-ink">Dejar de sincronizar</button>
      </div>
    </section>
  );
}

function Title({ icon: I, children }: { icon: typeof Heart; children: React.ReactNode }) {
  return <h2 className="flex items-center gap-3 font-extrabold text-ink"><span className="grid place-items-center size-11 shrink-0 rounded-2xl bg-banana text-ink"><I weight="duotone" className="size-6" /></span>{children}</h2>;
}

function Stat({ icon: I, label, value }: { icon: typeof Heart; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-cream p-3">
      <I weight="duotone" className="size-5 text-banana-ink" aria-hidden />
      <dt className="order-last text-[11px] font-bold text-muted">{label}</dt>
      <dd className="mt-1 text-base font-extrabold text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-cream p-4">
      <Info weight="duotone" className="size-5 shrink-0 text-muted" />
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}
