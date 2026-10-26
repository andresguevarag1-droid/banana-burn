// Salud en la app nativa: Apple Salud (HealthKit) en iPhone y Health Connect en Android, con @capgo/capacitor-health.
// Solo lectura de pasos, peso y energía activa: ni un permiso de más (Info.plist, App.entitlements y el manifiesto de
// Android quitan el resto). Solo se carga dentro de la app (import()); la web nunca lo descarga.
//
// Conectar es un gesto de la persona en Conexiones ("Conectar"): ahí se pide el permiso del sistema. Después, al abrir
// la app o volver a ella (como mucho cada 30 min), se mandan los últimos 7 días de pasos y energía activa y los pesajes
// de 30 días. Qué se guarda lo decide el servidor (src/app/actions/salud.ts, reglas en src/lib/salud-sync.ts).
import { Health, type HealthDataType } from "@capgo/capacitor-health";
import { syncHealth, type HealthSyncResult } from "@/app/actions/salud";
import { hasNativePlugin, nativePlatform } from "@/lib/platform";
import { STEP_DAYS, WEIGHT_DAYS, dailyTotals, latestWeights, localDayOf, type HealthPayload, type HealthWeight } from "@/lib/salud-sync";

const READ: HealthDataType[] = ["steps", "weight", "calories"]; // "calories" = energía activa (activeEnergyBurned / ActiveCaloriesBurned)
/** Cuenta que conectó Salud en este teléfono: si entra otra, no se sincroniza nada hasta que ella lo conecte. */
const OWNER_KEY = "bb.salud.owner";
const LAST_KEY = "bb.salud.last";
const EVERY_MS = 30 * 60 * 1000;

export const HEALTH_CONNECT_STORE = "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* */ } },
};

/**
 * unavailable: este teléfono no tiene Salud (o la app instalada es vieja). install: Android sin Health Connect o con
 * una versión vieja. off: sin conectar. denied: Android con todos los permisos negados. on: conectada.
 */
export type SaludState = "unavailable" | "install" | "off" | "denied" | "on";

async function availability(): Promise<"ok" | "install" | "unavailable"> {
  if (!hasNativePlugin("Health")) return "unavailable";
  const a = await Health.isAvailable().catch(() => null);
  if (a?.available) return "ok";
  // Android 9 a 13: Health Connect es una app de Play Store (SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED).
  return nativePlatform() === "android" && /update/i.test(a?.reason ?? "") ? "install" : "unavailable";
}

export async function saludState(owner: string): Promise<SaludState> {
  const a = await availability();
  if (a !== "ok") return a;
  if (ls.get(OWNER_KEY) !== owner) return "off";
  // HealthKit no dice si la persona negó la lectura (por privacidad, se ve igual que "sin datos"); Health Connect sí.
  if (nativePlatform() === "android") {
    const s = await Health.checkAuthorization({ read: READ }).catch(() => null);
    if (s && !s.readAuthorized.length) return "denied";
  }
  return "on";
}

/** Botón "Conectar": permiso del sistema (solo lectura de los 3 datos) y primera sincronización. */
export async function connectSalud(owner: string): Promise<SaludState> {
  const a = await availability();
  if (a !== "ok") return a;
  try {
    const s = await Health.requestAuthorization({ read: READ });
    if (nativePlatform() === "android" && !s.readAuthorized.length) return "denied";
  } catch {
    return nativePlatform() === "android" ? "denied" : "off";
  }
  ls.set(OWNER_KEY, owner);
  ls.del(LAST_KEY);
  return "on";
}

/** "Dejar de sincronizar": la app ya no lee Salud. El permiso del sistema se quita en Salud o en Health Connect. */
export function disconnectSalud() {
  ls.del(OWNER_KEY);
  ls.del(LAST_KEY);
}

/** Abre los permisos de Health Connect (Android). En iPhone no hay atajo: se indica la ruta en Ajustes. */
export async function openHealthSettings() {
  if (nativePlatform() === "android") await Health.openHealthConnectSettings().catch(() => {});
}

const midnightDaysAgo = (n: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};

async function readPayload(): Promise<HealthPayload> {
  const now = new Date().toISOString();
  // Tramos de un día desde la medianoche local (HealthKit ancla en el día de startDate; Health Connect corta cada 24 h).
  const sum = (dataType: HealthDataType) =>
    Health.queryAggregated({ dataType, startDate: midnightDaysAgo(STEP_DAYS - 1).toISOString(), endDate: now, bucket: "day", aggregation: "sum" })
      .then((r) => dailyTotals(r.samples))
      .catch(() => new Map<string, number>());
  const [steps, kcal, weights] = await Promise.all([
    sum("steps"),
    sum("calories"),
    Health.readSamples({ dataType: "weight", startDate: midnightDaysAgo(WEIGHT_DAYS - 1).toISOString(), endDate: now, limit: 200, ascending: false })
      .then((r) => latestWeights(r.samples))
      .catch(() => [] as HealthWeight[]),
  ]);
  const days = [...new Set([...steps.keys(), ...kcal.keys()])].map((day) => ({ day, steps: steps.get(day), activeKcal: kcal.get(day) }));
  return { days, weights };
}

export type SaludSnapshot = { steps: number | null; activeKcal: number | null; lastWeight: HealthWeight | null; result: HealthSyncResult };

let running: Promise<SaludSnapshot | null> | null = null;

/**
 * Lee Salud y la manda al servidor. Sin `force`, como mucho cada 30 min (lo llama boot.ts al abrir y al volver a la
 * app). Devuelve lo leído para mostrarlo en Conexiones, o null si no tocaba o Salud no está conectada.
 */
export function syncSalud(opts: { force?: boolean } = {}): Promise<SaludSnapshot | null> {
  const owner = ls.get(OWNER_KEY);
  if (!owner || !hasNativePlugin("Health")) return Promise.resolve(null);
  if (!opts.force && Date.now() - Number(ls.get(LAST_KEY) ?? 0) < EVERY_MS) return Promise.resolve(null);
  if (running) return running;
  ls.set(LAST_KEY, String(Date.now()));
  running = (async () => {
    const p = await readPayload();
    const result = await syncHealth(p, owner).catch((): HealthSyncResult => ({ ok: false, reason: "error" }));
    if (!result.ok && result.reason === "sesion") ls.del(LAST_KEY); // sin sesión: se intenta al volver a entrar
    if (!result.ok && result.reason === "otra-cuenta") disconnectSalud();
    const today = p.days.find((d) => d.day === localDayOf(new Date().toISOString()));
    return { steps: today?.steps ?? null, activeKcal: today?.activeKcal ?? null, lastWeight: p.weights.at(-1) ?? null, result };
  })().finally(() => { running = null; });
  return running;
}
