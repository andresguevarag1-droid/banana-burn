// GPS de carreras en la app nativa (@capacitor-community/background-geolocation): sigue midiendo con la pantalla apagada
// o en otra app. iPhone: actualizaciones en segundo plano con el indicador azul de ubicación (permiso "Al usar la app",
// nunca "Siempre"). Android: servicio en primer plano con el aviso fijo "Midiendo tu carrera" (y useLegacyBridge en
// capacitor.config.ts para que la web siga recibiendo puntos después de 5 minutos).
// Solo mientras hay una carrera en curso (también en pausa): run-tracker.tsx lo apaga al terminar o al salir de Correr.
// Solo se carga dentro de la app (import()).
import { registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin, Location } from "@capacitor-community/background-geolocation";
import { nativePlatform } from "@/lib/platform";

const Gps = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

/** Lo mismo que usa run-tracker de un GeolocationPosition del navegador. */
export type Fix = { timestamp: number; coords: { latitude: number; longitude: number; accuracy: number; speed: number | null } };

const toFix = (l: Location): Fix => ({
  timestamp: l.time ?? Date.now(),
  coords: { latitude: l.latitude, longitude: l.longitude, accuracy: l.accuracy, speed: l.speed },
});

/**
 * iPhone: el plugin pide "Siempre" cuando hay modo de fondo, y la carrera no lo necesita (empieza con la app abierta).
 * Se pide "Al usar la app" con un vigía de primer plano que se quita al primer resultado. true = hay permiso.
 */
function askWhenInUse(): Promise<boolean> {
  return new Promise((resolve) => {
    let id: string | null = null;
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      if (id) void Gps.removeWatcher({ id }).catch(() => {});
      resolve(ok);
    };
    Gps.addWatcher({ requestPermissions: true, stale: true }, (loc, err) => {
      if (err) finish(err.code !== "NOT_AUTHORIZED");
      else if (loc) finish(true);
    }).then((x) => { id = x; if (done) void Gps.removeWatcher({ id: x }).catch(() => {}); }, () => finish(false));
  });
}

/** Empieza a medir. Devuelve cómo parar. `onDenied`: sin permiso de ubicación. */
export async function watchRun(onFix: (f: Fix) => void, onDenied: () => void): Promise<() => void> {
  const ios = nativePlatform() === "ios";
  if (ios && !(await askWhenInUse())) {
    onDenied();
    return () => {};
  }
  const id = await Gps.addWatcher(
    {
      backgroundTitle: "Banana Burn",
      backgroundMessage: "Midiendo tu carrera. Toca para volver.",
      requestPermissions: !ios, // Android: solo ubicación precisa mientras se usa la app (sin ubicación en segundo plano)
      stale: false,
      distanceFilter: 0,
    },
    (loc, err) => {
      if (err) { if (err.code === "NOT_AUTHORIZED") onDenied(); return; }
      if (loc) onFix(toFix(loc));
    },
  );
  return () => { void Gps.removeWatcher({ id }).catch(() => {}); };
}

/** Ajustes de la app (permiso de ubicación). */
export const openLocationSettings = () => Gps.openSettings().catch(() => {});
