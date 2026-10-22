import Link from "next/link";
import { ArrowLeft, ArrowRight, BrandIcon, Check, Heartbeat, MagnifyingGlass, PersonArmsSpread, User } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { getAthlete } from "@/lib/athlete";
import { BODY, EQUIP, LIB_COUNT, MUSCLE, es, searchLibrary } from "@/lib/library";

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const metadata = { title: "Biblioteca de ejercicios" };

// Ícono por zona del cuerpo: marca (gorila, racimo) donde hay identidad, Phosphor para lo demás.
const BP_NAME: Record<string, string> = { back: "gorilla", chest: "barbell", "lower arms": "bolt", "lower legs": "sneaker", "upper arms": "bunch", "upper legs": "run", waist: "target" };
function BodyIcon({ bp }: { bp: string }) {
  if (bp === "cardio") return <Heartbeat weight="duotone" className="size-6" />;
  if (bp === "shoulders") return <PersonArmsSpread weight="duotone" className="size-6" />;
  if (bp === "neck") return <User weight="duotone" className="size-6" />;
  return <BrandIcon name={BP_NAME[bp] ?? "barbell"} className="size-6" />;
}

export default async function Biblioteca({ searchParams }: { searchParams: Promise<{ q?: string; zona?: string; equipo?: string; mio?: string; p?: string }> }) {
  const sp = await searchParams;
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const mine = sp.mio === "1" && a.equipment !== "gym" && a.equipment !== "mixto" ? a.equipment : undefined;
  const r = searchLibrary({ q: sp.q, bp: sp.zona, eq: sp.equipo, mine, page: Number(sp.p) || 1 });
  const qs = (patch: Record<string, string | undefined>) => { const u = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, x]) => x) as [string, string][]); return `/app/ejercicios?${u}`; };
  return (
    <div className="space-y-5 animate-enter">
      <header>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">{LIB_COUNT.toLocaleString("es-CR")} ejercicios</h1>
        <p className="mt-1 text-muted">Con pasos en español, músculos que trabajan y equipo necesario.</p>
      </header>
      <form className="flex gap-2" role="search">
        <label className="flex-1 flex items-center gap-2 h-12 rounded-2xl bg-white border border-line px-3 focus-within:border-ink focus-within:ring-4 focus-within:ring-banana/40">
          <MagnifyingGlass weight="bold" className="size-5 text-faint" aria-hidden /><span className="sr-only">Buscar ejercicio</span>
          <input name="q" defaultValue={sp.q} placeholder="Sentadilla, glúteos, banda…" className="flex-1 min-w-0 bg-transparent text-[16px] text-ink outline-none" />
        </label>
        {sp.zona && <input type="hidden" name="zona" value={sp.zona} />}
        <button className="btn-primary h-12 px-5">Buscar</button>
      </form>
      <nav aria-label="Filtrar por zona" className="-mx-4 px-4 flex gap-1.5 overflow-x-auto pb-1 relative">
        <Link href={qs({ zona: undefined, p: undefined })} aria-current={!sp.zona ? "true" : undefined} className={`chip h-9 px-4 shrink-0 ${!sp.zona ? "bg-ink text-white" : "bg-white border border-line text-ink"}`}>Todo</Link>
        {Object.entries(BODY).filter(([k]) => k !== "neck").map(([k, l]) => <Link key={k} href={qs({ zona: k, p: undefined })} aria-current={sp.zona === k ? "true" : undefined} className={`chip h-9 px-4 shrink-0 ${sp.zona === k ? "bg-ink text-white" : "bg-white border border-line text-ink"}`}>{l}</Link>)}
      </nav>
      {(a.equipment === "casa" || a.equipment === "ninguno") && (
        <Link href={qs({ mio: sp.mio === "1" ? undefined : "1", p: undefined })} className={`chip h-9 px-4 ${sp.mio === "1" ? "bg-banana text-ink" : "bg-cream text-ink"}`}>{sp.mio === "1" && <Check weight="bold" className="size-4" />}Solo lo que puedo hacer {a.equipment === "ninguno" ? "sin equipo" : "en casa"}</Link>
      )}
      <p className={`text-sm text-muted ${sp.q || sp.zona || sp.mio ? "" : "sr-only"}`} aria-live="polite">{r.total.toLocaleString("es-CR")} {r.total === 1 ? "resultado" : "resultados"}</p>
      {r.items.length > 0 && <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {r.items.map((e) => (
          <li key={e.id}>
            <Link href={`/app/ejercicios/${e.id}`} className="card p-3 flex items-center gap-3">
              <span className="grid place-items-center size-12 shrink-0 rounded-2xl bg-cream text-banana-ink" aria-hidden><BodyIcon bp={e.bp} /></span>
              <span className="min-w-0"><span className="block font-bold text-ink leading-tight line-clamp-2">{e.n}</span><span className="block text-xs text-muted truncate">{cap(es(MUSCLE, e.t))}, {es(EQUIP, e.eq).toLowerCase()}</span></span>
            </Link>
          </li>
        ))}
      </ul>}
      {!r.items.length && (
        <div className="card p-6 text-center">
          <span className="mx-auto grid place-items-center size-12 rounded-2xl bg-banana-soft text-banana-ink" aria-hidden><MagnifyingGlass weight="bold" className="size-6" /></span>
          <p className="mt-3 font-extrabold text-ink">No encontramos {sp.q ? `“${sp.q}”` : "ejercicios con ese filtro"}</p>
          <p className="text-sm text-muted">Prueba con el músculo (glúteos, pecho) o con el equipo (banda, mancuernas).</p>
          <Link href="/app/ejercicios" className="btn-ghost h-10 px-4 mt-4 text-sm">Ver todos</Link>
        </div>
      )}
      {r.pages > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-center gap-2">
          {r.page > 1 && <Link href={qs({ p: String(r.page - 1) })} className="btn-ghost h-10 px-4 text-sm"><ArrowLeft weight="bold" className="size-4" />Anterior</Link>}
          <span className="text-sm text-muted">Página {r.page} de {r.pages}</span>
          {r.page < r.pages && <Link href={qs({ p: String(r.page + 1) })} className="btn-ghost h-10 px-4 text-sm">Siguiente<ArrowRight weight="bold" className="size-4" /></Link>}
        </nav>
      )}
      <p className="text-[11px] text-faint">Datos de ejercicios: exercises-dataset de Hasan Emir Yıldırım (licencia MIT).</p>
    </div>
  );
}
