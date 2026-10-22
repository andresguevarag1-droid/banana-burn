"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { syncTimezone } from "@/app/actions/timezone";

/**
 * Lleva la zona horaria del navegador al servidor (cookie bb_tz) para que "hoy", las rachas y los
 * recordatorios usen el día local de cada usuario en cualquier país. Si cambió, refresca una vez.
 */
export function TzSync({ current }: { current: string }) {
  const router = useRouter();
  useEffect(() => {
    let tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return; }
    if (!tz || tz === current) return;
    document.cookie = `bb_tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    syncTimezone(tz).finally(() => router.refresh());
  }, [current, router]);
  return null;
}
