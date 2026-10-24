"use client";
// Claves de primeros pasos, lecciones y recorridos en el cliente. Une lo del servidor (0046) con este dispositivo
// (localStorage, siempre con try/catch) y avisa a las tarjetas abiertas con el evento `bb:aprende`.
import { useCallback, useEffect, useState } from "react";
import { markLearn } from "@/app/actions/learn";
import { addKey, isLearnKey } from "@/lib/primeros-pasos";

const LS = "bb.aprende";
export const LEARN_EVENT = "bb:aprende";

export function readLocalKeys(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS) ?? "[]");
    return Array.isArray(raw) ? raw.filter(isLearnKey) : [];
  } catch { return []; }
}

/** Marca una clave aquí y en el servidor. Sin sesión o en demo, solo queda en este dispositivo. */
export function learn(key: string) {
  if (!isLearnKey(key)) return;
  const cur = readLocalKeys();
  // Ya marcada en este dispositivo: nada que hacer (evita una llamada al servidor en cada visita).
  if (cur.includes(key)) return;
  try { localStorage.setItem(LS, JSON.stringify(addKey(cur, key))); } catch { /* modo privado */ }
  markLearn(key).catch(() => {});
  try { window.dispatchEvent(new CustomEvent(LEARN_EVENT, { detail: key })); } catch { /* */ }
}

/** Claves vigentes: las del servidor más las de este dispositivo, actualizadas al marcar desde cualquier pantalla. */
export function useLearnKeys(server: readonly string[]): { keys: string[]; ready: boolean; mark: (k: string) => void } {
  const [local, setLocal] = useState<string[] | null>(null);
  useEffect(() => {
    setLocal(readLocalKeys());
    const h = () => setLocal(readLocalKeys());
    window.addEventListener(LEARN_EVENT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(LEARN_EVENT, h); window.removeEventListener("storage", h); };
  }, []);
  const mark = useCallback((k: string) => learn(k), []);
  const keys = local ? [...new Set([...server, ...local])] : [...server];
  return { keys, ready: local !== null, mark };
}
