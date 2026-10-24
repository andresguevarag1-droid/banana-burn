"use client";
// Va en el layout de la app. Cuenta las aperturas (una por día) para elegir el momento de pedir los avisos y, si la app
// está abierta ya instalada, lo anota una vez por dispositivo (métrica del admin y evento app_installed).
import { useEffect } from "react";
import { markAppInstalled } from "@/app/actions/install";
import { track } from "@/components/analytics";
import { isStandaloneNow } from "./use-install";

export const OPENS_KEY = "bb.opens";
const DAY_KEY = "bb.opensDay";
const REPORTED_KEY = "bb.installReported";

/** Veces que abrió la app (días distintos). */
export function readOpens() {
  try { return Number(localStorage.getItem(OPENS_KEY) || 0); } catch { return 0; }
}

export function InstallBeacon() {
  useEffect(() => {
    try {
      const day = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem(DAY_KEY) !== day) {
        localStorage.setItem(DAY_KEY, day);
        localStorage.setItem(OPENS_KEY, String(readOpens() + 1));
      }
      if (isStandaloneNow() && !localStorage.getItem(REPORTED_KEY)) {
        localStorage.setItem(REPORTED_KEY, String(Date.now()));
        track("app_installed", { where: "standalone" });
        void markAppInstalled().catch(() => {});
      }
    } catch { /* sin almacenamiento local: no pasa nada */ }
  }, []);
  return null;
}
