import { Plus } from "@/components/icons";

/** Subrayado de marcador: un fondo con degradado duro que sigue al texto aunque haga salto de línea. */
export function Marker({ children }: { children: React.ReactNode }) {
  return (
    <span className="box-decoration-clone bg-[linear-gradient(transparent_58%,var(--color-banana)_58%,var(--color-banana)_92%,transparent_92%)] px-[.04em]">
      {children}
    </span>
  );
}

/** Preguntas frecuentes: título fijo a la izquierda (acompaña la lista en escritorio) y lista sin tarjetas a la derecha. */
export function Faq({ items, id, aside }: { items: readonly (readonly [string, string])[]; id?: string; aside?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-titulo` : undefined} className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 scroll-mt-20 grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <h2 id={id ? `${id}-titulo` : undefined} className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">Preguntas frecuentes</h2>
        <p className="mt-3 text-muted text-pretty max-w-sm">
          ¿Algo más? Escríbenos a{" "}
          <a href="mailto:hola@bananaburn.app" className="tap font-semibold text-ink underline underline-offset-2">hola@bananaburn.app</a>.
        </p>
        {aside}
      </div>
      <div className="border-t border-line">
        {items.map(([q, a]) => (
          <details key={q} className="group border-b border-line">
            <summary className="cursor-pointer list-none py-5 flex justify-between items-center gap-4 text-[17px] font-bold text-ink [&::-webkit-details-marker]:hidden">
              <span className="text-balance">{q}</span>
              <span aria-hidden className="grid place-items-center size-8 shrink-0 rounded-full bg-white border border-line transition-[background-color,border-color] duration-150 group-open:bg-ink group-open:border-ink group-open:text-white">
                <Plus weight="bold" className="size-4 transition-transform duration-200 ease-[cubic-bezier(.23,1,.32,1)] group-open:rotate-45" />
              </span>
            </summary>
            <p className="pb-6 pr-12 -mt-1 text-muted leading-relaxed text-pretty max-w-[65ch]">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
