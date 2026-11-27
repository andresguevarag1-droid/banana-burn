// Piezas de confianza del registro con tarjeta (#323). Reciben los textos de cardTrust() (src/lib/card-trust.ts), que es
// null antes de CARD_REQUIRED_FROM: quien las usa no muestra nada en ese caso.
import { Bell, CalendarCheck, CheckCircle, EyeSlash, Gift, Lock, ShieldCheck } from "@/components/icons";
import type { CardTrust } from "@/lib/card-trust";

/** "Así funciona tu prueba": línea de tiempo de 4 pasos y, debajo, la línea de la cancelación. */
export function TrialTimeline({ trust, id = "tu-prueba", className = "" }: { trust: CardTrust; id?: string; className?: string }) {
  return (
    <section aria-labelledby={id} className={className}>
      <h2 id={id} className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">{trust.title}</h2>
      <ol className="mt-6 grid gap-3 lg:grid-cols-4">
        {trust.steps.map(([when, t, d], i) => (
          <li key={when} className="relative flex gap-4 rounded-[1.5rem] bg-cream p-5 lg:flex-col">
            <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-lg font-extrabold tabular-nums text-banana">{i + 1}</span>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-wide text-banana-ink tabular-nums">{when}</p>
              <h3 className="mt-0.5 text-lg font-extrabold text-ink text-balance">{t}</h3>
              <p className="mt-1 leading-relaxed text-muted text-pretty tabular-nums">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 font-bold text-ink text-pretty">{trust.cancel}</p>
    </section>
  );
}

const POINT_ICONS = [CheckCircle, EyeSlash, Bell] as const;

/**
 * Lo que pasa con su tarjeta, con sus fechas y su monto, junto al formulario: hoy $0, aviso por correo, primer cobro.
 * Va arriba del formulario de la tarjeta en la bienvenida (en vez de una línea de texto).
 */
export function ChargeSteps({ rows, ariaLabel, className = "" }: { rows: [string, string, string][]; ariaLabel: string; className?: string }) {
  const icons = [Gift, Bell, CalendarCheck];
  return (
    <ol aria-label={ariaLabel} className={`relative space-y-0 rounded-[1.5rem] border border-line bg-white p-4 shadow-sm ${className}`}>
      {rows.map(([when, title, detail], i) => {
        const Icon = icons[i % icons.length];
        const last = i === rows.length - 1;
        return (
          <li key={when} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && <span aria-hidden className="absolute left-[17px] top-9 bottom-0 w-0.5 bg-line" />}
            <span aria-hidden className={`relative grid size-9 shrink-0 place-items-center rounded-full ${i === 0 ? "bg-peel text-white" : "bg-banana-soft text-ink"}`}><Icon weight="duotone" className="size-5" /></span>
            <div className="min-w-0 pt-0.5">
              <p className="text-xs font-extrabold uppercase tracking-wide text-banana-ink tabular-nums">{when}</p>
              <p className="text-base font-extrabold text-ink text-balance tabular-nums">{title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-body text-pretty">{detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * "Pago seguro" (#350): las 3 garantías que la gente busca antes de dejar la tarjeta (hoy no se cobra, no vemos tu tarjeta,
 * avisamos antes), las marcas aceptadas con su logo y la empresa detrás.
 */
export function SecurePay({ trust, className = "" }: { trust: CardTrust; className?: string }) {
  return (
    <section aria-label={trust.secureTitle} className={`rounded-[1.5rem] border border-line bg-white p-5 text-left shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-base font-extrabold text-ink">
          <span aria-hidden className="grid size-9 place-items-center rounded-full bg-peel/10"><ShieldCheck weight="fill" className="size-5 text-peel" /></span>
          {trust.secureTitle}
        </p>
        <ul aria-label={trust.brands} className="flex gap-1.5">
          {trust.brandList.map((b) => (
            <li key={b} className="grid h-8 w-12 place-items-center rounded-md border border-line bg-white">
              {/* Marcas de aceptación (simple-icons, CC0) en /public/pagos; el alt dice cuál es. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/pagos/${b.toLowerCase()}.svg`} alt={b} width={32} height={32} className="size-8" />
            </li>
          ))}
        </ul>
      </div>
      <ul className="mt-4 space-y-3.5">
        {trust.securePoints.map(([title, detail], i) => {
          const Icon = POINT_ICONS[i % POINT_ICONS.length];
          return (
            <li key={title} className="flex gap-3">
              <Icon weight="duotone" aria-hidden className="mt-0.5 size-5 shrink-0 text-ink" />
              <div>
                <p className="text-sm font-extrabold text-ink">{title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-body text-pretty tabular-nums">{detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 flex items-center gap-1.5 border-t border-line pt-3 text-xs text-muted text-pretty">
        <Lock weight="bold" aria-hidden className="size-3.5 shrink-0" />{trust.secure}
      </p>
    </section>
  );
}

/** Línea chica debajo de cada botón de registro. */
export function UnderCta({ trust, className = "" }: { trust: CardTrust; className?: string }) {
  return <p className={`text-xs font-semibold text-ink/75 text-pretty ${className}`}>{trust.underCta}</p>;
}
