import Link from "next/link";
import { ArrowRight, CalendarCheck, Gift } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { getSex } from "@/lib/athlete";
import { getSeasonsView } from "@/lib/seasons-server";
import { COACHES, seasonCoachId } from "@/lib/coaches";
import { SPORTS, canEnroll, daysToStart, longDate, seasonStatus, seasonWeek } from "@/lib/seasons";
import { usd } from "@/lib/challenges";
import { SafeImage } from "@/components/safe-image";
import { redirect } from "next/navigation";

export const metadata = { title: "Temporadas" };

export default async function Temporadas({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/app/temporadas");
  const [view, sex, sp] = await Promise.all([getSeasonsView(v), getSex(v), searchParams]);
  const first = view.seasons[0];
  return (
    <div className="space-y-6 animate-rise">
      <header className="space-y-2">
        <p className="chip h-7 w-fit bg-ink text-banana">Temporadas deportivas</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">Entrena para tu deporte</h1>
        <p className="text-muted text-pretty max-w-2xl">8 semanas con fechas oficiales: todos viven la misma temporada. Tu fuerza se acomoda a tus días de carrera, partido o box, y la app entera se transforma mientras dura. Cada temporada se vive una sola vez: la siguiente llega mejorada con lo que más les gustó.</p>
        {first && <p className="flex items-center gap-2 text-sm font-semibold text-ink"><CalendarCheck weight="duotone" className="size-5 text-banana-ink" />Temporada {first.number}: del {longDate(first.startsOn)} al {longDate(first.endsOn)}</p>}
      </header>
      {sp.pago === "vencido" && <p role="alert" className="rounded-2xl bg-ember/10 p-3 text-sm font-semibold text-ember-ink">Ese enlace de pago venció. Vuelve a intentarlo desde la temporada.</p>}
      {view.annual && <p className="flex items-center gap-2 rounded-2xl bg-peel/10 p-3 text-sm font-semibold text-peel"><Gift weight="duotone" className="size-5 shrink-0" />Tu plan anual incluye 1 temporada gratis. Elige tu deporte.</p>}
      <ul className="grid gap-4 md:grid-cols-3">
        {view.seasons.map((s) => {
          const info = SPORTS[s.sport];
          const coach = COACHES[seasonCoachId(s.sport, sex)];
          const owned = view.owned.has(s.slug);
          const st = seasonStatus(s, view.today);
          const label = owned ? "Tu temporada" : !canEnroll(s, view.today) ? "Inscripciones cerradas" : view.annual ? "Incluida en tu plan anual" : usd(s.priceMinor);
          const when = st === "preventa" ? `Empieza en ${daysToStart(s, view.today)} días` : st === "activa" ? `Semana ${seasonWeek(s, view.today)} de 8` : "Terminó";
          return (
            <li key={s.slug} style={{ ["--sport" as string]: info.accent, ["--sport-soft" as string]: info.accentSoft }}>
              <Link href={`/app/temporadas/${s.slug}`} className="card group flex h-full flex-col overflow-hidden transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(.23,1,.32,1)] hover:-translate-y-0.5 active:scale-[.99]">
                <div className="relative aspect-[4/3] bg-[var(--sport-soft)]">
                  <SafeImage src={coach.hello} alt={`${coach.name} con ropa de ${info.name.toLowerCase()}`} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-contain object-bottom p-3" />
                  <span className="absolute left-3 top-3 chip h-7 bg-[var(--sport)] text-white">{info.name}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <h2 className="text-xl font-extrabold tracking-tight text-ink">{s.title}</h2>
                  <p className="text-sm text-muted text-pretty">{info.tagline}</p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                    <span className="text-sm font-semibold text-muted">{when}</span>
                    <span className="inline-flex items-center gap-1 font-extrabold text-ink">{label}<ArrowRight weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" /></span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">Los planes anuales incluyen 1 temporada gratis por cada año pagado. Necesitas un plan activo o tu prueba gratis para sumar una temporada.</p>
    </div>
  );
}
