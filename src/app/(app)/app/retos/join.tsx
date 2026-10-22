"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinChallenge } from "@/app/actions/challenges";

export function JoinButton({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div>
      <button disabled={pending} onClick={() => start(async () => { const r = await joinChallenge(id); if (r.ok) { setMsg(r.demo ? "Demo: no se guardó" : "Adentro. Tu reto empieza hoy."); router.refresh(); } else setMsg(r.error ?? "No pudimos unirte. Intenta de nuevo."); })} className="btn-primary h-10 px-5 text-sm" aria-label={`Unirme a ${title}`}>{pending ? "…" : "Unirme"}</button>
      {msg && <p className="mt-1 text-xs font-semibold text-muted" role="status">{msg}</p>}
    </div>
  );
}
