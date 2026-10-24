import Link from "next/link";
import { ArrowRight, Flask } from "@/components/icons";
import { BETA_GRACE_UNTIL, betaLive } from "@/lib/plans";

const TZ = "America/Costa_Rica";
const day = (ms: number) => new Date(ms).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: TZ });

/**
 * Cuentas de la beta: "7 de noviembre" (último día gratis) y "8 de noviembre" (primer día con cobro), según
 * BETA_GRACE_UNTIL (7 días después del lanzamiento del 1 de noviembre, 0045).
 */
export function betaDates() {
  const end = Date.parse(BETA_GRACE_UNTIL);
  return { lastFree: day(end - 1), firstPaid: day(end) };
}

/** Aviso del período de prueba dentro de la app (compacto: una línea y el detalle al tocar). */
export function BetaBanner() {
  const { lastFree, firstPaid } = betaDates();
  return (
    <aside aria-label="Versión de prueba" className="mb-5 rounded-2xl border border-banana bg-banana-soft text-sm">
      <details className="group">
        <summary className="tap flex min-h-11 list-none items-center gap-2.5 px-3.5 py-2 [&::-webkit-details-marker]:hidden">
          <Flask weight="duotone" className="size-5 shrink-0 text-banana-ink" aria-hidden />
          <span className="min-w-0 flex-1 text-pretty text-ink"><b>Versión de prueba:</b> gratis hasta el {lastFree}. Desde el {firstPaid} se cobran los planes.</span>
          <span className="shrink-0 text-xs font-bold text-banana-ink underline underline-offset-4 group-open:hidden">Más info</span>
        </summary>
        <div className="px-3.5 pb-3 pl-11 text-body text-pretty">
          <p>Mientras tanto tienes todo incluido. Desde esa fecha empezaremos a cobrar los planes a todas las cuentas. Si algo falla o se puede mejorar, cuéntanos.</p>
          <Link href="/app/suscripcion" className="tap mt-1 inline-flex h-11 items-center gap-1 font-bold text-ink underline-offset-4 hover:underline">Ver planes y precios<ArrowRight weight="bold" className="size-4" /></Link>
        </div>
      </details>
    </aside>
  );
}

/** Franja superior del sitio público durante la beta. */
export function BetaStrip() {
  if (!betaLive()) return null;
  const { lastFree, firstPaid } = betaDates();
  return (
    <aside aria-label="Versión de prueba" className="bg-ink px-4 py-1.5 text-center text-xs font-semibold text-white/90 text-pretty">
      <Flask weight="fill" className="mr-1.5 inline size-3.5 -translate-y-px text-banana" aria-hidden />
      Versión de prueba: gratis para todos hasta el {lastFree}. Desde el {firstPaid} se cobran los planes.
    </aside>
  );
}
