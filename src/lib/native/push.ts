// Avisos push dentro de la app nativa: permiso, token (FCM en Android, APNs en iPhone) guardado en el servidor
// (/api/push/native, tabla 0057) y el toque en un aviso abre su pantalla. Solo se carga dentro de la app (import()).
//
// NEXT_PUBLIC_NATIVE_PUSH=1 (Vercel) cuando ya existen las llaves del servidor (FCM y APNs) y el APK trae Firebase:
// sin eso, la app no ofrece avisos (en Android, registrarse sin Firebase cierra la app).
import { App } from "@capacitor/app";
import { PushNotifications } from "@capacitor/push-notifications";
import { hasNativePlugin, nativePlatform } from "@/lib/platform";
import { linkAction } from "./links";
import { nativePushAvailable } from "./push-flag";

export { NATIVE_PUSH_ON, nativePushAvailable } from "./push-flag";

const TOKEN_KEY = "bb.push.native.token";
/** La persona apagó los avisos en Perfil: no se vuelve a registrar sola al abrir la app. */
const OFF_KEY = "bb.push.native.off";
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* */ } },
};

export type PushState = "unavailable" | "prompt" | "granted" | "off" | "denied";

export async function pushState(): Promise<PushState> {
  if (!nativePushAvailable()) return "unavailable";
  const { receive } = await PushNotifications.checkPermissions();
  if (receive === "denied") return "denied";
  if (receive !== "granted") return "prompt";
  return ls.get(OFF_KEY) ? "off" : "granted";
}

async function save(token: string) {
  ls.set(TOKEN_KEY, token);
  const appVersion = await App.getInfo().then((i) => `${i.version} (${i.build})`).catch(() => null);
  await fetch("/api/push/native", {
    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
    body: JSON.stringify({ token, platform: nativePlatform(), appVersion }),
  }).catch(() => {});
}

let attached = false;
function attach(navigate: (path: string) => void) {
  if (attached) return;
  attached = true;
  void PushNotifications.addListener("registration", ({ value }) => { void save(value); });
  void PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const url = (notification.data as { url?: unknown } | undefined)?.url;
    if (typeof url === "string" && linkAction(url, window.location.origin) === "app") navigate(url);
  });
  // Android: canal de los recordatorios con prioridad alta (el servidor manda channel_id "avisos").
  if (nativePlatform() === "android") {
    void PushNotifications.createChannel({ id: "avisos", name: "Recordatorios y avisos", description: "Qué te toca entrenar, tu racha, novedades y respuestas de soporte.", importance: 4, visibility: 1, vibration: true }).catch(() => {});
  }
}

/** Al abrir la app: si ya hay permiso, se registra de nuevo (el token puede cambiar) y escucha los toques. */
export async function bootPush(navigate: (path: string) => void) {
  if (!nativePushAvailable()) return;
  attach(navigate);
  if ((await pushState()) === "granted") await PushNotifications.register();
}

/** Botón "Activar avisos": permiso del sistema (si hace falta) y registro. */
export async function enableNativePush(navigate: (path: string) => void): Promise<PushState> {
  if (!nativePushAvailable()) return "unavailable";
  attach(navigate);
  let { receive } = await PushNotifications.checkPermissions();
  if (receive !== "granted" && receive !== "denied") ({ receive } = await PushNotifications.requestPermissions());
  if (receive !== "granted") return receive === "denied" ? "denied" : "prompt";
  ls.del(OFF_KEY);
  await PushNotifications.register();
  return "granted";
}

/** "Desactivar" en Perfil o al cerrar sesión: el servidor deja de mandar avisos de esta cuenta a este teléfono. */
export async function forgetNativePush(opts: { off: boolean }) {
  if (opts.off) ls.set(OFF_KEY, "1");
  const token = ls.get(TOKEN_KEY);
  if (!token) return;
  ls.del(TOKEN_KEY);
  await fetch("/api/push/native", {
    method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ token }),
  }).catch(() => {});
  if (opts.off && hasNativePlugin("PushNotifications")) await PushNotifications.unregister().catch(() => {});
}
