"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, WarningCircle } from "@/components/icons";
import { VoicePicker } from "@/components/voice-picker";
import { safeAction } from "@/lib/action-client";
import type { Voice } from "@/lib/voice";
import { updateVoice } from "./actions";

/** Perfil: "Cómo te hablo". Se guarda al tocar (sin botón extra): cambia las explicaciones, nunca los números. */
export function VoiceSettings({ voice: v0 }: { voice: Voice }) {
  const [voice, setVoice] = useState<Voice>(v0);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const pick = (v: Voice) => {
    if (v === voice || pending) return;
    const prev = voice;
    setVoice(v); setMsg(null);
    start(async () => {
      const r = await safeAction(updateVoice(v));
      if (!r.ok) { setVoice(prev); setMsg({ ok: false, t: r.error ?? "No pudimos guardar. Intenta de nuevo." }); return; }
      setMsg({ ok: true, t: r.demo ? "Demo: lo verás en esta sesión." : "Listo, así te hablo desde ahora" });
      router.refresh();
    });
  };
  return (
    <div className="space-y-3">
      <VoicePicker value={voice} onChange={pick} />
      <p role={msg && !msg.ok ? "alert" : "status"} className={`flex min-h-5 items-center gap-1.5 text-sm font-semibold ${msg?.ok ? "text-peel" : "text-bad"}`}>
        {msg && (msg.ok ? <CheckCircle weight="fill" className="size-4 shrink-0" /> : <WarningCircle weight="fill" className="size-4 shrink-0" />)}{pending ? <span className="text-muted">Guardando…</span> : msg?.t}
      </p>
    </div>
  );
}
