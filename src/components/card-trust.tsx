// Piezas de confianza del registro con tarjeta (#323). Reciben los textos de cardTrust() (src/lib/card-trust.ts), que es
// null antes de CARD_REQUIRED_FROM: quien las usa no muestra nada en ese caso.
import { Lock } from "@/components/icons";
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

/** Fila "Pago seguro": quién procesa el pago, quién guarda la tarjeta y qué tarjetas se aceptan. Sin logos. */
export function SecurePay({ trust, className = "" }: { trust: CardTrust; className?: string }) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border border-line bg-white p-4 text-left ${className}`}>
      <Lock weight="duotone" aria-hidden className="mt-0.5 size-5 shrink-0 text-ink" />
      <p className="text-sm text-body text-pretty"><b className="text-ink">{trust.brands}.</b> {trust.secure}</p>
    </div>
  );
}

/** Línea chica debajo de cada botón de registro. */
export function UnderCta({ trust, className = "" }: { trust: CardTrust; className?: string }) {
  return <p className={`text-xs font-semibold text-ink/75 text-pretty ${className}`}>{trust.underCta}</p>;
}
