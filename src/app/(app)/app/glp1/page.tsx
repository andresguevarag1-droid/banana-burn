import Link from "next/link";
import { BananaFlame, Banana, Barbell, BrandIcon, CheckCircle, Egg, Leaf, ShieldCheck, Syringe, Warning, WarningCircle } from "@/components/icons";
import { createClient, getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { PLANS, usd } from "@/lib/plans";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getMeasures } from "@/lib/measures";
import { getProgress, MAIN_LIFTS } from "@/lib/progress";
import { navyBodyFat } from "@/lib/body";
import { MEDS, RED_FLAGS, glp1Targets, muscleShield, weightNear } from "@/lib/glp1";
import { ageOn } from "@/lib/engine";

export const metadata = { title: "Banana Shield para GLP-1" };

const nf = (n: number, d = 0) => n.toLocaleString("es-419", { maximumFractionDigits: d });

/** Pesajes alrededor de una fecha (±10 días), para emparejar cada medición con su peso aunque sea antigua. */
async function weightsAround(userId: string, iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  const from = new Date(d.getTime() - 10 * 864e5).toISOString().slice(0, 10), to = new Date(d.getTime() + 10 * 864e5).toISOString().slice(0, 10);
  const { data } = await (await createClient()).from("weights").select("day,kg").eq("user_id", userId).gte("day", from).lte("day", to);
  return (data ?? []).map((r) => ({ d: r.day as string, v: Number(r.kg) }));
}

export default async function Glp1Guide() {
  const v = (await getViewer())!;
  if (!(await getEntitlements(v)).nutrition) {
    const p = PLANS.find((x) => x.nutrition)!;
    return (
      <div className="max-w-xl mx-auto text-center py-8 animate-enter">
        <span className="mx-auto grid place-items-center size-20 rounded-3xl bg-ink text-banana"><ShieldCheck weight="duotone" className="size-11" /></span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink text-balance">Banana Shield está incluido en {p.name}</h1>
        <p className="mt-3 text-muted text-pretty">Si estás en tratamiento con GLP-1, Banana Shield cuida que lo que bajes sea grasa y no músculo: proteína, calorías mínimas, fuerza y seguimiento de tus medidas.</p>
        <Link href="/app/suscripcion" className="btn-banana w-full h-14 mt-6 text-base">Mejorar a {p.name} por {usd(p.price.mes)}/mes</Link>
        <p className="mt-2 text-xs text-faint">Cancela cuando quieras.</p>
      </div>
    );
  }
  const a = await getAthlete(v);
  const d = dashboard(a);
  const g = d.glp1 ?? glp1Targets({ kg: a.currentWeight, goalKg: a.goalWeight, heightCm: a.heightCm, age: ageOn(a.dob), sex: a.sex });
  const [ms, prog] = await Promise.all([getMeasures(v), getProgress(v)]);
  const bf = (m?: (typeof ms)[number]) => (m ? navyBodyFat({ sex: a.sex, heightCm: a.heightCm, waist: m.waist, neck: m.neck, hip: m.hip }) : null);
  const changes = MAIN_LIFTS.map((k) => { const p = prog.lifts[k] ?? []; return p.length > 1 ? (p.at(-1)!.v - p[0].v) / p[0].v * 100 : null; }).filter((x): x is number => x != null);
  // Cada medición se compara con el peso registrado más cercano a SU fecha (no con el peso inicial de la meta ni el de hoy).
  const first = ms[0], last = ms.at(-1);
  const near = !v.demo && first && last && ms.length > 1 ? [...prog.weights, ...(await weightsAround(v.id, first.d)), ...(await weightsAround(v.id, last.d))] : prog.weights;
  const startKg = first ? weightNear(near, first.d) : null;
  const nowKg = last ? weightNear(near, last.d) : null;
  const paired = startKg != null && nowKg != null;
  const sh = muscleShield({ startKg: startKg ?? 0, nowKg: nowKg ?? 0, startBf: paired ? bf(first) : null, nowBf: paired ? bf(last) : null, strengthChangePct: changes.length ? changes.reduce((x, y) => x + y, 0) / changes.length : null });
  const med = MEDS.find((m) => m.id === a.glp1.med);
  // La calificación solo es confiable con el programa activo, 2+ mediciones y 4+ semanas entre ellas.
  const spanDays = ms.length > 1 ? (new Date(ms.at(-1)!.d + "T12:00:00").getTime() - new Date(ms[0].d + "T12:00:00").getTime()) / 864e5 : 0;
  const enough = a.glp1.on && ms.length >= 2 && spanDays >= 28;

  return (
    <div className="space-y-6 animate-enter max-w-3xl">
      <header>
        <h1 className="flex items-center gap-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
          <span className="relative grid place-items-center size-12 sm:size-14 shrink-0 rounded-2xl bg-ink text-banana"><ShieldCheck weight="duotone" className="size-7 sm:size-8" /><Banana weight="fill" className="absolute -bottom-1 -right-1 size-5 text-banana drop-shadow" /></span>
          <span>Banana Shield <span className="block text-base sm:text-lg font-bold text-muted">Programa para GLP-1</span></span>
        </h1>
        <p className="mt-2 max-w-[60ch] text-lg text-muted">El medicamento te ayuda a comer menos. Nosotros nos aseguramos de que lo que pierdas sea <b className="text-ink">grasa, no músculo</b>.</p>
        {!a.glp1.on && <Link href="/app/perfil#glp1" className="btn-banana h-11 mt-4">Activar Banana Shield en mi plan</Link>}
        {a.glp1.on && med && <p className="mt-3 chip h-8 gap-1.5 bg-ink text-white"><Syringe weight="duotone" className="size-4 text-banana" />{med.n}, {a.glp1.injectionDow != null ? `inyección los ${["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"][a.glp1.injectionDow]}` : "diario/oral"}</p>}
      </header>

      <section className="rounded-[1.75rem] bg-ink text-white p-6">
        <div className="flex items-center gap-3"><ShieldCheck weight="duotone" className="size-7 text-banana" /><h2 className="text-xl font-extrabold">Tu escudo de músculo</h2></div>
        {enough && sh.grade ? (
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-4xl font-extrabold text-banana">{sh.grade}</p><p className="text-xs text-white/70">calificación</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-3xl font-extrabold tabular-nums">{sh.fatShare != null ? `${nf(sh.fatShare * 100)} %` : <span className="text-white/50">Sin dato</span>}</p><p className="text-xs text-white/70">de lo perdido fue grasa</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="grid place-items-center h-9">{sh.strengthOk == null ? <span className="text-sm font-bold text-white/50">Sin dato</span> : sh.strengthOk ? <CheckCircle weight="fill" className="size-9 text-banana" /> : <Warning weight="fill" className="size-9 text-ember" />}</p><p className="text-xs text-white/70">{sh.strengthOk === false ? "fuerza bajando" : "fuerza se mantiene"}</p></div>
          </div>
        ) : <p className="mt-3 text-white/80">{!a.glp1.on ? "Activa Banana Shield y anota tus medidas (cintura y cuello) cada 2 semanas. En 4 semanas te mostramos cuánto de lo que bajas es grasa." : `Anota tus medidas (cintura y cuello) cada 2 semanas y registra tus entrenos. Tu primera calificación aparece cuando tengamos 4 semanas de datos${ms.length ? ` (llevas ${Math.max(0, Math.round(spanDays / 7))} de 4)` : ""}.`}</p>}
        {enough && !paired && <p className="mt-3 text-sm text-white/80">Para calcular cuánto de lo perdido fue grasa, pésate el mismo día (o la misma semana) en que anotas tus medidas.</p>}
        <p className="mt-4 text-sm text-white/70">Meta: que al menos 3 de cada 4 kg perdidos sean grasa y que tu fuerza no baje. Estudios con GLP-1 muestran que, sin fuerza ni proteína, cerca de 1 de cada 4 kg perdidos puede ser masa magra.</p>
      </section>

      <section>
        <h2 className="text-xl font-extrabold text-ink">{a.glp1.on ? "Tus 4 pilares de hoy" : "Tus metas si activas Banana Shield"}</h2>
        <ul className="mt-3 card divide-y divide-line">
          {[
            [<Barbell key="i" weight="duotone" className="size-6" />, "Fuerza 3+ días por semana", "Es la señal que le dice a tu cuerpo “este músculo se queda”. Básicos, cerca del fallo, sin prisa. En días de náusea, modo suave, pero no la saltes."],
            [<Egg key="i" weight="duotone" className="size-6" />, `${g.protein} g de proteína al día`, `≈ ${g.perMeal} g por comida en ${g.meals} comidas pequeñas. Come la proteína primero: si te llenas rápido, que sea con lo importante.`],
            [<BananaFlame key="i" className="size-6" />, `${nf(g.kcal)} kcal al día`, `Nunca menos de ${nf(g.kcalMin)} kcal. Con poco apetito es fácil comer de menos y perder músculo; si un día no llegas, prioriza batido de proteína o yogur griego.`],
            [<Leaf key="i" weight="duotone" className="size-6" />, `${g.fiber} g de fibra y ${nf(g.waterL, 1)} L de agua`, "Frijoles, avena, frutas y vegetales poco a poco, y agua durante el día: es lo que más ayuda con el estreñimiento."],
          ].map(([icon, t, b]) => <li key={String(t)} className="flex gap-3.5 p-4"><span aria-hidden className="grid place-items-center size-10 shrink-0 rounded-xl bg-banana-soft text-banana-ink">{icon}</span><div className="min-w-0"><p className="font-extrabold text-ink">{t}</p><p className="max-w-[60ch] text-sm text-muted">{b}</p></div></li>)}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="text-xl font-extrabold text-ink">Si aparecen molestias</h2>
        <dl className="mt-3 space-y-3 text-[15px]">
          <div><dt className="flex items-center gap-2 font-bold text-ink"><BrandIcon name="waves" className="size-5 text-banana-ink" />Náuseas</dt><dd className="text-body pl-7">Desayuno pequeño y comidas pequeñas cada 3 a 4 h; evita frituras, picante y comidas grandes; té de jengibre o menta.</dd></div>
          <div><dt className="flex items-center gap-2 font-bold text-ink"><BrandIcon name="leaf" className="size-5 text-banana-ink" />Estreñimiento</dt><dd className="text-body pl-7">Sube fibra poco a poco (ciruelas, avena, frijoles) y el agua. Si no mejora, consulta a tu médico.</dd></div>
          <div><dt className="flex items-center gap-2 font-bold text-ink"><BrandIcon name="drop" className="size-5 text-banana-ink" />Diarrea</dt><dd className="text-body pl-7">Evita comidas grandes o grasosas, lácteos en exceso, cafeína y endulzantes artificiales; hidrátate.</dd></div>
        </dl>
      </section>

      <section className="rounded-[1.5rem] border-2 border-bad/40 bg-bad/5 p-5" aria-labelledby="alarma">
        <h2 id="alarma" className="flex items-center gap-2 text-lg font-extrabold text-bad"><Warning weight="fill" className="size-6 shrink-0" />Busca atención médica si tienes</h2>
        <ul className="mt-2 space-y-1.5 text-[15px] text-body">{RED_FLAGS.map((r) => <li key={r} className="flex items-start gap-2"><WarningCircle weight="bold" className="size-4 shrink-0 mt-1 text-bad" />{r}</li>)}</ul>
      </section>

      <section className="card p-5">
        <h2 className="text-xl font-extrabold text-ink">¿Y cuando dejes el medicamento?</h2>
        <p className="mt-2 text-body">Hasta dos tercios del peso perdido puede regresar en el primer año al suspenderlo. Tu seguro son los hábitos que construyes ahora: fuerza 3 veces por semana, proteína alta y pesarte cada semana. Banana Burn ajusta tus calorías con tu peso real para que la transición sea gradual, siempre de la mano de tu médico.</p>
      </section>

      <p className="text-xs text-faint">Banana Shield es un programa de entrenamiento y hábitos; no reemplaza a tu médico ni da indicaciones sobre dosis o medicamentos. Basado en: Mozaffarian et al., <i>Obesity</i> 2025 (ACLM, ASN, OMA y The Obesity Society) y Noronha et al., <i>Obesity Pillars</i> 2025.</p>
    </div>
  );
}
