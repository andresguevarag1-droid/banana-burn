import Link from "next/link";
import { ArrowRight, Sparkle } from "@/components/icons";
import { BETA_GRACE_UNTIL } from "@/lib/plans";

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

/**
 * Aviso de acceso anticipado dentro de la app (compacto: una línea y el detalle al tocar). Tono de agradecimiento, no de
 * "versión de prueba" (decisión del dueño, oct 2026): la app mejora a diario y las fechas de cobro quedan dichas con claridad.
 */
export function BetaBanner() {
  const { lastFree, firstPaid } = betaDates();
  return (
    <aside aria-label="Acceso anticipado" className="mb-5 rounded-2xl border border-banana bg-banana-soft text-sm">
      <details className="group">
        <summary className="tap flex min-h-11 list-none items-center gap-2.5 px-3.5 py-2 [&::-webkit-details-marker]:hidden">
          <Sparkle weight="duotone" className="size-5 shrink-0 text-banana-ink" aria-hidden />
          <span className="min-w-0 flex-1 text-pretty text-ink"><b>Eres de los primeros en Banana Burn.</b> Todo incluido y gratis hasta el {lastFree}.</span>
          <span className="shrink-0 text-xs font-bold text-banana-ink underline underline-offset-4 group-open:hidden">Más info</span>
        </summary>
        <div className="px-3.5 pb-3 pl-11 text-body text-pretty">
          <p>Gracias por tu confianza. La app mejora todos los días, así que vas a ver cambios y novedades seguido. Si algo falla o se te ocurre una mejora, cuéntanos desde Soporte: lo leemos todo.</p><p className="mt-1.5">Desde el {firstPaid} se cobran los planes. Te avisamos antes.</p>
          <Link href="/app/suscripcion" className="tap mt-1 inline-flex h-11 items-center gap-1 font-bold text-ink underline-offset-4 hover:underline">Ver planes y precios<ArrowRight weight="bold" className="size-4" /></Link>
        </div>
      </details>
    </aside>
  );
}
