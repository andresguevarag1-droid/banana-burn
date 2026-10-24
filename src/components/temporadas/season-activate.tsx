"use client";
// Activa la temporada (con otro programa activo, pide confirmar que se pausa con su avance).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleNotch } from "@/components/icons";
import { activateSeason } from "@/app/actions/temporadas";

export function SeasonActivate({ slug, label = "Empezar mi temporada" }: { slug: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [conflict, setConflict] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const go = (pause: boolean) => start(async () => {
    setError(null);
    const r = await activateSeason(slug, pause);
    if (r.conflict) { setConflict(r.conflict.title); return; }
    if (!r.ok && !r.demo) { setError(r.error ?? "No pudimos activar tu temporada."); return; }
    router.push("/app");
    router.refresh();
  });
  return (
    <div className="space-y-2">
      {!conflict ? (
        <button type="button" disabled={pending} onClick={() => go(false)} className="btn-banana w-full h-14 text-base">{pending ? <CircleNotch weight="bold" className="size-5 animate-spin" /> : <>{label} <ArrowRight className="size-5" /></>}</button>
      ) : (
        <div className="card p-4 space-y-3">
          <p className="text-sm text-body">Tienes activo <b>{conflict}</b>. Lo pausamos con su avance y activamos tu temporada.</p>
          <button type="button" disabled={pending} onClick={() => go(true)} className="btn-primary w-full h-12">Pausar y activar mi temporada</button>
        </div>
      )}
      {error && <p role="alert" className="rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad">{error}</p>}
    </div>
  );
}
