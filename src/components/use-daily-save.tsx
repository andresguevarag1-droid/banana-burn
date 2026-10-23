"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { setDaily, type DailyField } from "@/app/actions/daily";
import { Toast } from "@/components/toast";
import { WarningCircle } from "@/components/icons";
import { safeAction } from "@/lib/action-client";

/**
 * Guarda un valor del día (agua, pasos, energía…) después de mostrarlo en pantalla.
 * Si el servidor no lo guardó, ejecuta `undo` (vuelve al valor anterior) y avisa con un mensaje breve.
 */
export function useDailySave() {
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  useEffect(() => { if (!err) return; const t = setTimeout(() => setErr(null), 3500); return () => clearTimeout(t); }, [err]);
  const save = useCallback((field: DailyField, value: number, undo: () => void) => {
    start(async () => {
      const r = await safeAction(setDaily(field, value));
      if (!r.ok) { undo(); setErr(r.error ?? "No se guardó. Intenta de nuevo."); }
    });
  }, []);
  const toast = <Toast side="bottom">{err && <><WarningCircle weight="fill" className="size-5 shrink-0 text-ember" aria-hidden /><span>{err}</span></>}</Toast>;
  return { save, toast };
}
