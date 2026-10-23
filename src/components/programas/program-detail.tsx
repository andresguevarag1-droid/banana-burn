// Página de un programa en la tienda (servidor): vende la transformación con datos reales del programa.
// Para quién es, el resultado, duración, días, minutos, equipo y nivel; la semana 1 completa; la técnica animada de un
// ejercicio; qué cambia en tu app al empezarlo; fases; precio y botón. Sin testimonios ni cifras inventadas.
import Image from "next/image";
import Link from "next/link";
import type { Viewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { getAthlete } from "@/lib/athlete";
import { getOwned, levelPerks } from "@/lib/challenges-server";
import { exAnim, exInfo, getProgramSessions, getProgramStates, sessionViews, type ProgramChallenge } from "@/lib/programs-server";
import { LEVEL_LABEL, MODE_LABEL, daysLabel, daysOf, durationLabel, phaseAt, sessionsOfPhase, weeksOf } from "@/lib/programs";
import { coachArt, coachOf } from "@/lib/coaches";
import { priceMinor, usd } from "@/lib/challenges";
import { NUTRITION_PLAN_NAME } from "@/lib/plan-access";
import { TECH } from "@/lib/engine/technique";
import { ChallengeCover, coverInk } from "@/components/retos/cover";
import { BuyButton } from "@/components/retos/buy-button";
import { ExerciseMotion } from "@/components/exercise-motion";
import { ProgramWeek } from "./program-week";
import { StartProgramButton } from "./program-actions";
import { ArrowLeft, ArrowRight, BananaMedal, Barbell, CalendarCheck, CheckCircle, Clock, Eye, ForkKnife, Info, Lightning, Shield, Sparkle, Target, TreePalm, WarningCircle } from "@/components/icons";

export async function ProgramDetail({ v, c, preview = false }: { v: Viewer; c: ProgramChallenge; preview?: boolean }) {
  const [owned0, perks, states, ent, a] = await Promise.all([getOwned(v), levelPerks(v), getProgramStates(v), getEntitlements(v), getAthlete(v)]);
  // Vista previa del panel: se ve como alguien que todavía no lo compró.
  const owned = !preview && (owned0.has(c.id) || c.priceUsd === 0);
  const st = preview ? undefined : states.find((s) => s.slug === c.id);
  const sessions = await getProgramSessions(v, c.id);
  const meta = c.program;
  const weeks = weeksOf(meta);
  const totalDays = daysOf(meta), dur = durationLabel(meta);
  const coach = coachOf(meta.experience);
  const days = daysLabel(meta, sessions);
  const week1 = sessionsOfPhase(sessions, 1);
  const ink = coverInk(c.cover);
  const listMinor = priceMinor(c.priceUsd, 0), finalMinor = priceMinor(c.priceUsd, perks.discountPct);
  const other = states.find((s) => s.status === "activo" && s.slug !== c.id);

  // Técnica animada: el ejercicio elegido por el programa (o el primero de la semana 1 que tenga animación).
  const ids = week1.flatMap((s) => s.exercises.map((e) => e.id));
  const animId = [meta.previewExercise, ...ids].find((id) => id && exAnim(id)) ?? null;
  const anim = animId ? exAnim(animId) : null;
  const allIds = [...new Set(sessions.flatMap((s) => s.exercises.map((e) => e.id)))];
  const animated = allIds.filter((id) => exAnim(id)).length;

  let cta: React.ReactNode;
  if (preview) cta = <p className="flex items-center justify-center gap-1.5 rounded-2xl bg-sky/10 p-3 text-center text-sm font-bold text-sky"><Eye weight="duotone" className="size-4" />Vista previa: así lo ve alguien que no lo compró.</p>;
  else if (!owned) cta = (
    <>
      <BuyButton slug={c.id} label={`Comprar por ${usd(finalMinor)}`} />
      <p className="mt-2 text-center text-xs text-muted">{finalMinor < listMinor ? `Precio normal ${usd(listMinor)}. Tu nivel ${perks.level.n} te da ${perks.discountPct}% de descuento. ` : ""}Pago único con tarjeta en USD, procesado por ONVO Pay. Es tuyo para siempre.</p>
    </>
  );
  else if (!ent.app) cta = (
    <>
      <p className="rounded-2xl bg-cream p-3 text-center text-sm text-body">El programa es tuyo y queda guardado. Para entrenarlo necesitas un plan activo.</p>
      <Link href="/app/suscripcion" className="btn-banana mt-2 h-12 w-full">Ver planes</Link>
    </>
  );
  else if (st?.status === "activo") cta = (
    <div className="space-y-2">
      <p className="flex items-center justify-center gap-1.5 rounded-2xl bg-peel/10 p-3 text-sm font-extrabold text-peel"><CheckCircle weight="fill" className="size-5" />Programa activo</p>
      <Link href="/app" className="btn-primary h-12 w-full">Ir a la sesión de hoy<ArrowRight weight="bold" className="size-5" /></Link>
      <Link href={`/app/retos/${c.id}/progreso`} className="btn-ghost h-12 w-full">Avance y opciones</Link>
    </div>
  );
  else cta = (
    <>
      <StartProgramButton slug={c.id} title={c.title} label={st?.status === "pausado" ? "Reanudar programa" : st ? "Empezar de nuevo" : "Empezar programa"} />
      <p className="mt-2 text-center text-xs text-muted">{st?.status === "pausado" ? "Sigues donde lo dejaste." : other ? "Tu otro programa activo queda en pausa, con su avance guardado." : "Empieza hoy: la semana 1 arranca con tu primera sesión."}</p>
    </>
  );

  const n = meta.nutrition;
  const x = meta.experience;
  const changes: { icon: typeof Barbell; t: string }[] = [
    { icon: Barbell, t: `Hoy y Entrenar te muestran la sesión del programa: ${days.toLowerCase()}, de unos ${meta.sessionMinutes} minutos.` },
    meta.adapt ? { icon: Lightning, t: "Cada serie trae su carga exacta: sale de tu historial y sube cuando llegas al tope del rango." }
      : { icon: Lightning, t: "Cada ejercicio trae sus repeticiones o segundos exactos, y suben semana a semana." },
    ...(meta.adapt ? [{ icon: Target, t: "Si entrenas en casa, los ejercicios de máquina cambian por su versión con tu equipo." }] : []),
    ...(n ? [{ icon: Info, t: ent.nutrition ? `Tus calorías y tu proteína siguen el programa: ${MODE_LABEL[n.mode ?? a.mode].toLowerCase()}${n.proteinPerKg ? `, con ${n.proteinPerKg.toLocaleString("es-CO")} g de proteína por kg` : ""}.` : `El programa ajusta calorías y proteína en ${NUTRITION_PLAN_NAME}. Con tu plan actual, el entreno cambia y tu nutrición no.` }] : []),
    { icon: CalendarCheck, t: "Hoy muestra tu semana del programa, tu avance y el próximo hito, con los colores del programa." },
    ...(x ? [
      { icon: Sparkle, t: `Toda la app entra en ${x.mode}: la cinta del programa te acompaña en cada sección y ${coach.name} responde con su enfoque.` },
      ...(x.habits.length ? [{ icon: CheckCircle, t: `Tus hábitos de cada día: ${x.habits.map((h) => h.label.toLowerCase()).join(", ")}.` }] : []),
      ...(x.tips.length ? [{ icon: Lightning, t: `Un consejo de ${coach.name} para cada una de las ${Math.min(x.tips.length, weeks)} semanas.` }] : []),
      ...(x.food.length ? [{ icon: ForkKnife, t: `Cómo comer en este programa: ${x.food[0].charAt(0).toLowerCase()}${x.food[0].slice(1)}` }] : []),
    ] : []),
    { icon: TreePalm, t: "Puedes pausarlo o dejarlo cuando quieras y volver a tu rutina normal. Tu avance queda guardado." },
  ];
  let start = 1;
  const phases = meta.phases.map((p) => { const from = start; start += p.weeks; return { ...p, from, to: start - 1 }; });

  const priceCard = (
    <section className="card p-5" aria-label="Precio">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-muted">Pago único</p>
        {owned ? <p className="inline-flex items-center gap-1 text-lg font-extrabold text-peel"><CheckCircle weight="fill" className="size-5" />Ya es tuyo</p> : <p className="tabular-nums">{finalMinor < listMinor && <s className="mr-1.5 text-sm text-faint">{usd(listMinor)}</s>}<span className="text-2xl font-extrabold text-ink">{usd(finalMinor)}</span> <span className="text-xs font-semibold text-muted">USD</span></p>}
      </div>
      <div className="mt-4">{cta}</div>
    </section>
  );

  return (
    <div className="space-y-6 animate-enter">
      <Link href="/app/retos" className="tap inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Programas y retos</Link>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <div className="space-y-6">
          <header className="overflow-hidden rounded-[1.75rem] shadow-soft">
            <ChallengeCover c={c} className="h-48 sm:h-56">
              <div className={`absolute inset-x-0 bottom-0 p-5 ${ink}`}>
                <p className="text-xs font-extrabold uppercase tracking-[.14em] opacity-85">Programa Premium de {dur}</p>
                <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight text-balance">{c.title}</h1>
              </div>
            </ChallengeCover>
          </header>

          <ul className="flex flex-wrap gap-2 text-xs font-bold text-ink/85">
            <li className="chip h-8 border border-line bg-white"><CalendarCheck weight="duotone" className="size-4" />{dur}</li>
            <li className="chip h-8 border border-line bg-white"><Barbell weight="duotone" className="size-4" />{days}</li>
            <li className="chip h-8 border border-line bg-white"><Clock weight="duotone" className="size-4" />{meta.sessionMinutes} min por sesión</li>
            <li className="chip h-8 border border-line bg-white"><Target weight="duotone" className="size-4" />{LEVEL_LABEL[meta.level]}</li>
            <li className="chip h-8 border border-line bg-white">{meta.equipment}</li>
          </ul>

          <section aria-labelledby="para-quien" className="space-y-4">
            <div>
              <h2 id="para-quien" className="text-lg font-extrabold text-ink">Para quién es</h2>
              <p className="mt-1 text-[17px] leading-relaxed text-body">{meta.who}</p>
            </div>
            <div className="rounded-2xl border border-banana/60 bg-banana-soft/50 p-4">
              <h2 className="text-sm font-extrabold uppercase tracking-[.1em] text-banana-ink">El objetivo</h2>
              <p className="mt-1 font-semibold text-ink">{meta.result}</p>
            </div>
          </section>

          {coach.id !== "banana" && (
            <section aria-labelledby="tu-coach" className="flex items-center gap-4 overflow-hidden rounded-[1.5rem] bg-[linear-gradient(135deg,#F3E8FF,#FFD6E7)] p-4 sm:p-5">
              <Image src={coach.hello} alt={`${coach.name} saludando`} width={128} height={128} sizes="128px" className="size-28 shrink-0 object-contain sm:size-32" />
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[.12em] text-ink/70">Tu coach en este programa</p>
                <h2 id="tu-coach" className="text-xl font-extrabold text-ink">{coach.name}</h2>
                <p className="mt-1 text-sm text-body text-pretty">Mientras dura el programa, ella te acompaña en lugar de Coach Banana: te da la bienvenida, un consejo cada semana, responde tus preguntas en el chat y aparece haciendo cada ejercicio contigo.</p>
              </div>
            </section>
          )}

          <div className="lg:hidden">{priceCard}</div>

          {c.safetyNote && <p className="flex gap-2.5 rounded-2xl border border-sky/25 bg-sky/5 p-4 text-sm text-body"><WarningCircle weight="duotone" className="mt-0.5 size-5 shrink-0 text-sky" /><span><b className="text-ink">Antes de empezar.</b> {c.safetyNote}</span></p>}

          <section aria-labelledby="cambia" className="card p-5">
            <h2 id="cambia" className="text-lg font-extrabold text-ink">Qué cambia en tu app al empezarlo</h2>
            <ul className="mt-3 space-y-3">
              {changes.map((x) => <li key={x.t} className="flex gap-3 text-sm text-body"><span className="grid size-8 shrink-0 place-items-center rounded-xl bg-banana-soft text-banana-ink"><x.icon weight="duotone" className="size-4.5" /></span><span className="pt-1">{x.t}</span></li>)}
            </ul>
          </section>

          <section aria-labelledby="semana1" className="space-y-3">
            <div>
              <h2 id="semana1" className="text-xl font-extrabold text-ink">Tu semana 1, completa</h2>
              <p className="text-sm text-muted">Fase 1: {phaseAt(meta, 1).phase.name}. {owned ? "" : "El resto de las semanas se abre al comprarlo."}</p>
            </div>
            {week1.length ? <ProgramWeek cta={false} current={1} label="Sesiones de la semana 1"
              sessions={sessionViews({ slug: c.id, title: c.title, meta }, c.icon, week1, 1, a.equipment, () => false, () => null)} /> : <p className="text-sm text-muted">Las sesiones de este programa se están preparando.</p>}
          </section>

          {coach.id !== "banana" && allIds.some((id) => coachArt(coach, id)) ? (
            <section aria-labelledby="tecnica" className="card overflow-hidden p-5">
              <h2 id="tecnica" className="text-lg font-extrabold text-ink">{coach.name} te enseña cada movimiento</h2>
              <p className="mt-1 text-sm text-muted">{allIds.filter((id) => coachArt(coach, id)).length} de los {allIds.length} ejercicios traen su ilustración, para que veas la postura antes de hacerla.</p>
              <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {allIds.filter((id) => coachArt(coach, id)).slice(0, 6).map((id) => (
                  <li key={id} className="overflow-hidden rounded-2xl bg-[#F3E8FF]">
                    <Image src={coachArt(coach, id)!} alt="" width={240} height={240} sizes="(min-width: 640px) 200px, 45vw" className="aspect-square w-full object-contain" />
                    <p className="px-2.5 pb-2.5 pt-1 text-sm font-bold leading-tight text-ink">{exInfo(id)?.name ?? id}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : anim && animId && (
            <section aria-labelledby="tecnica" className="card overflow-hidden p-5">
              <h2 id="tecnica" className="text-lg font-extrabold text-ink">Técnica guiada: {exInfo(animId)?.name}</h2>
              <p className="mt-1 text-sm text-muted">En el reproductor, {animated} de los {allIds.length} ejercicios de este programa traen su técnica animada, con la bajada al tempo de cada fase.</p>
              <ExerciseMotion anim={anim} mus={TECH[animId]?.mus ?? exInfo(animId)?.muscle} cues={TECH[animId]?.cues?.slice(0, 3)} className="mt-3 h-[300px] sm:h-[340px]" />
            </section>
          )}

          <section aria-labelledby="fases" className="space-y-3">
            <h2 id="fases" className="text-xl font-extrabold text-ink">Cómo avanza</h2>
            <ol className="relative space-y-3 border-l-2 border-line pl-5">
              {phases.map((p, i) => (
                <li key={i} className="relative">
                  <span aria-hidden className={`absolute -left-[27px] top-1 grid size-3.5 place-items-center rounded-full ring-4 ring-paper ${p.deload ? "bg-sky" : "bg-ember"}`} />
                  <p className="text-xs font-bold uppercase tracking-[.1em] text-muted">{totalDays !== weeks * 7 && i === phases.length - 1 ? `Días ${(p.from - 1) * 7 + 1} ${totalDays - (p.from - 1) * 7 === 2 ? "y" : "a"} ${totalDays}` : p.from === p.to ? `Semana ${p.from}` : `Semanas ${p.from} a ${p.to}`}{p.deload ? ", descarga" : ""}</p>
                  <p className="font-extrabold text-ink">{p.name}</p>
                  {p.focus && <p className="text-sm text-body">{p.focus}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="hidden lg:block">{priceCard}</div>
          {meta.outcomes.length > 0 && (
            <section className="card p-5" aria-labelledby="incluye-t">
              <h2 id="incluye-t" className="font-extrabold text-ink">Qué incluye</h2>
              <ul className="mt-3 space-y-2.5 text-sm">{meta.outcomes.map((o) => <li key={o} className="flex gap-2"><CheckCircle weight="fill" className="mt-0.5 size-4 shrink-0 text-peel" /><span>{o}</span></li>)}</ul>
            </section>
          )}
          <section className="card p-5" aria-labelledby="premio-t">
            <h2 id="premio-t" className="flex items-center gap-2 font-extrabold text-ink"><BananaMedal className="size-6 text-banana-ink" />Al terminar</h2>
            <p className="mt-2 text-sm text-body">Medalla <b>{c.badge}</b> y certificado en tu perfil{c.rewardTitle ? <>, más el título <b>{c.rewardTitle}</b></> : ""}. Comparas tu fuerza, tu peso y tus medidas con el día 1.</p>
          </section>
          <section className="card p-5" aria-labelledby="reglas-t">
            <h2 id="reglas-t" className="flex items-center gap-2 font-extrabold text-ink"><Shield weight="duotone" className="size-5 text-sky" />Reglas</h2>
            <ul className="mt-3 space-y-2 text-sm text-body">
              <li>Un programa activo a la vez. Si empiezas otro, el actual queda en pausa con su avance.</li>
              <li>La semana no avanza mientras está en pausa.</li>
              <li>Necesita un plan activo para entrenarlo; si tu plan vence, el programa queda guardado.</li>
              <li>Los retos de hábitos (agua, pasos, proteína) siguen funcionando junto con el programa.</li>
            </ul>
            {!owned && !preview && <p className="mt-3 flex gap-2 text-xs text-muted"><Info weight="duotone" className="size-4 shrink-0" />El programa se activa en tu cuenta cuando ONVO confirma el pago, normalmente en segundos.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
