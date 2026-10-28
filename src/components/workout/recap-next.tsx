"use client";
// Cierre del entreno: cuándo es el próximo y, en el momento de más ganas, que no se le pase. Avisos si el navegador los
// permite ya; si no (iPhone sin instalar, navegador de Instagram o Facebook), instalar la LinkApp, que es lo que los habilita.
import Link from "next/link";
import { CalendarCheck, CaretRight, DeviceMobile } from "@/components/icons";
import { PushWhenReady } from "@/components/install/push-when-ready";
import { useInstall } from "@/components/install/use-install";
import { pushNeedsInstall } from "@/lib/install-env";

export function RecapNext({ upcoming }: { upcoming: { when: string; name: string } | null }) {
  const { env } = useInstall();
  const install = !!env && env !== "standalone" && env !== "desktop" && (pushNeedsInstall(env) || env === "android-inapp");
  return (
    <div className="mt-3 space-y-3 text-left">
      {upcoming && (
        <div className="card flex items-center gap-3 p-4">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-banana-soft text-banana-ink"><CalendarCheck weight="duotone" className="size-6" /></span>
          <p className="min-w-0"><span className="block text-sm font-bold text-muted first-letter:uppercase">Tu próximo entreno es {upcoming.when}</span><span className="block font-extrabold text-ink">{upcoming.name}</span></p>
        </div>
      )}
      {install ? (
        <Link href="/app/instalar" className="card flex items-center gap-3 p-4">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink text-banana"><DeviceMobile weight="duotone" className="size-6" /></span>
          <span className="min-w-0 flex-1"><span className="block font-extrabold text-ink">Que no se te pase el próximo</span><span className="block text-sm text-muted">Pon Banana Burn en tu pantalla de inicio y te avisamos el día que toca.</span></span>
          <CaretRight weight="bold" className="size-5 shrink-0 text-faint" />
        </Link>
      ) : <PushWhenReady trained />}
    </div>
  );
}
