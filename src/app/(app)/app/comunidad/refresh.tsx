"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowsClockwise } from "@/components/community/icons";

/** Actualizar el feed sin recargar la página (como "jalar para actualizar"). */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" onClick={() => start(() => router.refresh())} disabled={pending} aria-label={pending ? "Actualizando" : "Actualizar"}
      className="tap pressable grid place-items-center size-11 shrink-0 rounded-full bg-white border border-line text-ink hover:border-ink/30">
      <ArrowsClockwise weight="bold" className={`size-5 ${pending ? "bb-spin" : ""}`} />
      <span className="sr-only" role="status">{pending ? "Actualizando…" : ""}</span>
    </button>
  );
}
