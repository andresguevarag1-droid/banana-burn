"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFollow } from "@/app/actions/community";

/** Seguir / dejar de seguir. Optimista: si el servidor falla, vuelve al estado anterior y lo dice. */
export function FollowButton({ userId, name, initial = false, refresh = false }: { userId: string; name?: string; initial?: boolean; refresh?: boolean }) {
  const [on, setOn] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  function toggle() {
    const n = !on;
    setOn(n); setErr(null);
    start(async () => {
      const r = await setFollow(userId, n).catch(() => ({ ok: false, error: "Sin conexión. Intenta de nuevo." }));
      if (!r.ok) { setOn(!n); setErr(r.error ?? "No pudimos actualizar. Intenta de nuevo."); }
      else if (refresh) router.refresh();
    });
  }
  return (
    <span className="inline-flex flex-col items-end">
      <button type="button" onClick={toggle} disabled={pending} aria-pressed={on} aria-label={name ? (on ? `Dejar de seguir a ${name}` : `Seguir a ${name}`) : undefined}
        className={`group tap pressable h-11 px-4 rounded-full text-sm font-bold ${on ? "bg-cream text-ink border border-line hover:border-bad/40 hover:text-bad" : "bg-ink text-white"}`}>
        {on ? <><span className="group-hover:hidden">Siguiendo</span><span className="hidden group-hover:inline">Dejar de seguir</span></> : "Seguir"}
      </button>
      {err && <span role="alert" className="mt-1 max-w-48 text-right text-[11px] font-semibold text-bad">{err}</span>}
    </span>
  );
}
