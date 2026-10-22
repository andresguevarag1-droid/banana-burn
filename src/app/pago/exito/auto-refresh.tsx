"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch } from "@/components/icons";

/** Refresca la página mientras el webhook confirma el pago (máx. ~3 min). */
export function AutoRefresh({ everyMs = 4000, max = 45 }: { everyMs?: number; max?: number }) {
  const router = useRouter();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= max) return;
    const t = setTimeout(() => { router.refresh(); setN((x) => x + 1); }, everyMs);
    return () => clearTimeout(t);
  }, [n, max, everyMs, router]);
  return (
    <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted" role="status">
      {n < max ? <><CircleNotch weight="bold" className="size-4 animate-spin" />Verificando…</> : "Sigue pendiente. Revisa en unos minutos desde tu suscripción."}
    </p>
  );
}
