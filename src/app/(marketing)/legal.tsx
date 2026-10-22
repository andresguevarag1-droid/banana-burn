// Plantilla común para las páginas legales: índice, secciones numeradas y fecha de actualización.
// TODO(legal): textos pendientes de revisión por un abogado antes del lanzamiento público. Es una nota interna:
// no se muestra en pantalla.
export type LegalSection = { id: string; t: string; p: (string | string[])[] };

export function LegalPage({ title, intro, updated, sections }: { title: string; intro: string; updated: string; sections: LegalSection[] }) {
  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 pt-16 pb-24 text-body leading-relaxed">
      <h1 className="text-4xl font-extrabold tracking-tight text-ink text-balance">{title}</h1>
      <p className="mt-3 text-sm text-muted">Última actualización: {updated}.</p>
      <p className="mt-6 max-w-[65ch] text-pretty">{intro}</p>
      <nav aria-label="Contenido" className="mt-8 rounded-2xl bg-cream p-5">
        <ol className="grid sm:grid-cols-2 sm:gap-x-4 text-sm">
          {sections.map((s, i) => <li key={s.id}><a href={`#${s.id}`} className="flex min-h-11 items-center font-semibold text-ink underline-offset-4 hover:underline">{i + 1}. {s.t}</a></li>)}
        </ol>
      </nav>
      <div className="mt-10 space-y-10">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <h2 className="text-xl font-extrabold text-ink text-balance">{i + 1}. {s.t}</h2>
            <div className="mt-3 space-y-3 max-w-[65ch] text-pretty">
              {s.p.map((x, j) => Array.isArray(x)
                ? <ul key={j} className="list-disc space-y-1.5 pl-5 marker:text-banana-ink">{x.map((li) => <li key={li}>{li}</li>)}</ul>
                : <p key={j}>{x}</p>)}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
