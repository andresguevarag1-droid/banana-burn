// Reproductor dentro de la app nativa: vibración con el motor del teléfono (Haptics), pantalla encendida durante el
// entreno (KeepAwake), aviso de fin de descanso con la app en segundo plano o la pantalla bloqueada (notificación
// local) y barra de estado clara sobre las pantallas ink. Solo se carga dentro de la app (components/workout/device.ts
// lo importa con import()); cada plugin se pregunta antes de usarlo porque una app vieja puede no traerlo.
import { SystemBars, SystemBarsStyle } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { LocalNotifications } from "@capacitor/local-notifications";
import { hasNativePlugin, nativePlatform } from "@/lib/platform";

/** Patrón de vibración de la web → golpe del sistema. Toques cortos, confirmaciones y celebraciones. */
export function hapticKind(p: number | number[]): "selection" | "light" | "medium" | "success" {
  if (Array.isArray(p)) return "success";
  if (p <= 15) return "selection";
  if (p <= 30) return "light";
  return "medium";
}

export async function haptic(p: number | number[]): Promise<boolean> {
  if (!hasNativePlugin("Haptics")) return false;
  const kind = hapticKind(p);
  if (kind === "selection") await Haptics.selectionChanged();
  else if (kind === "success") await Haptics.notification({ type: NotificationType.Success });
  else await Haptics.impact({ style: kind === "light" ? ImpactStyle.Light : ImpactStyle.Medium });
  return true;
}

export async function keepAwake(on: boolean): Promise<boolean> {
  if (!hasNativePlugin("KeepAwake")) return false;
  await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep());
  return true;
}

/* ---------- Aviso de fin de descanso ---------- */

const ALARM_ID = 4201;
const CHANNEL = "descanso";
let channelReady: Promise<void> | null = null;

/** Android 8+: canal propio con prioridad alta y vibración, para que el aviso se vea sobre la pantalla bloqueada. */
function channel() {
  if (nativePlatform() !== "android") return Promise.resolve();
  channelReady ??= LocalNotifications.createChannel({
    id: CHANNEL, name: "Fin del descanso", description: "Te avisa cuando termina el descanso o el intervalo del entreno.",
    importance: 4, vibration: true, visibility: 1,
  }).catch(() => {});
  return channelReady;
}

export type NotifyPermission = "granted" | "denied" | "prompt" | "unavailable";

export async function notifyPermission(): Promise<NotifyPermission> {
  if (!hasNativePlugin("LocalNotifications")) return "unavailable";
  const { display } = await LocalNotifications.checkPermissions();
  return display === "granted" ? "granted" : display === "denied" ? "denied" : "prompt";
}

/** Pide el permiso de avisos (en iPhone y Android 13+ es el mismo para los avisos locales y los push). */
export async function requestNotify(): Promise<NotifyPermission> {
  if (!hasNativePlugin("LocalNotifications")) return "unavailable";
  const { display } = await LocalNotifications.requestPermissions();
  return display === "granted" ? "granted" : display === "denied" ? "denied" : "prompt";
}

/**
 * Programa el aviso para `at`. Solo con el permiso ya dado: desde la versión 8.3, schedule() lo pediría por su cuenta,
 * sin contexto. Un solo aviso a la vez (mismo id): programar de nuevo reemplaza al anterior.
 */
export async function scheduleAlarm(at: number, title: string, body: string): Promise<boolean> {
  if (at <= Date.now() + 1000 || (await notifyPermission()) !== "granted") return false;
  await channel();
  await LocalNotifications.cancel({ notifications: [{ id: ALARM_ID }] }).catch(() => {});
  await LocalNotifications.schedule({
    notifications: [{
      id: ALARM_ID, title, body, schedule: { at: new Date(at), allowWhileIdle: true },
      channelId: CHANNEL, sound: nativePlatform() === "ios" ? "default" : undefined, autoCancel: true,
    }],
  });
  return true;
}

export async function cancelAlarm(): Promise<void> {
  if (!hasNativePlugin("LocalNotifications")) return;
  await LocalNotifications.cancel({ notifications: [{ id: ALARM_ID }] }).catch(() => {});
  await LocalNotifications.removeDeliveredNotifications({ notifications: [{ id: ALARM_ID, title: "", body: "" }] }).catch(() => {});
}

/* ---------- Barra de estado ---------- */

/** `dark`: pantalla de fondo ink (descanso, intervalos): hora y batería en claro. */
export async function darkStatusBar(dark: boolean): Promise<void> {
  if (!hasNativePlugin("SystemBars")) return;
  await SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
}
