import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getMeasures } from "@/lib/measures";
import { getProgress, MAIN_LIFTS } from "@/lib/progress";
import { navyBodyFat } from "@/lib/body";
import { MEDS, RED_FLAGS, glp1Targets, muscleShield } from "@/lib/glp1";
import { ageOn } from "@/lib/engine";

export const metadata = { title: "Banana Shield · GLP-1" };

const nf = (n: number, d = 0) => n.toLocaleString("es-CR", { maximumFractionDigits: d });

export default async function Glp1Guide() {
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const d = dashboard(a);
  const g = d.glp1 ?? glp1Targets({ kg: a.currentWeight, goalKg: a.goalWeight, heightCm: a.heightCm, age: ageOn(a.dob), sex: a.sex });
  const [ms, prog] = await Promise.all([getMeasures(v), getProgress(v)]);
  const bf = (m?: (typeof ms)[number]) => (m ? navyBodyFat({ sex: a.sex, heightCm: a.heightCm, waist: m.waist, neck: m.neck, hip: m.hip }) : null);
  const changes = MAIN_LIFTS.map((k) => { const p = prog.lifts[k] ?? []; return p.length > 1 ? (p.at(-1)!.v - p[0].v) / p[0].v * 100 : null; }).filter((x): x is number => x != null);
  const sh = muscleShield({ startKg: ms[0] ? a.startWeight : a.startWeight, nowKg: a.currentWeight, startBf: bf(ms[0]), nowBf: bf(ms.at(-1)), strengthChangePct: changes.length ? changes.reduce((x, y) => x + y, 0) / changes.length : null });
  const med = MEDS.find((m) => m.id === a.glp1.med);
  // La calificación solo es confiable con el programa activo, 2+ mediciones y 4+ semanas entre ellas.
  const spanDays = ms.length > 1 ? (new Date(ms.at(-1)!.d + "T12:00:00").getTime() - new Date(ms[0].d + "T12:00:00").getTime()) / 864e5 : 0;
  const enough = a.glp1.on && ms.length >= 2 && spanDays >= 28;

  return (
    <div className="space-y-6 animate-rise max-w-3xl">
      <header>
        <p className="eyebrow">Programa para GLP-1</p>
        <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Banana Shield 🛡️🍌</h1>
        <p className="mt-2 text-lg text-muted">El medicamento te ayuda a comer menos. Nosotros nos aseguramos de que lo que pierdas sea <b className="text-ink">grasa, no músculo</b>.</p>
        {!a.glp1.on && <Link href="/app/perfil#glp1" className="btn-banana h-11 mt-4">Activar Banana Shield en mi plan</Link>}
        {a.glp1.on && med && <p className="mt-3 chip h-8 bg-ink text-white">💉 {med.n} · {a.glp1.injectionDow != null ? `inyección los ${["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"][a.glp1.injectionDow]}` : "diario/oral"}</p>}
      </header>

      <section className="rounded-[1.75rem] bg-ink text-white p-6">
        <div className="flex items-center gap-3"><ShieldCheck className="size-7 text-banana" /><h2 className="text-xl font-extrabold">Tu escudo de músculo</h2></div>
        {enough && sh.grade ? (
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-4xl font-extrabold text-banana">{sh.grade}</p><p className="text-xs text-white/70">calificación</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-3xl font-extrabold tabular-nums">{sh.fatShare != null ? `${nf(sh.fatShare * 100)} %` : "—"}</p><p className="text-xs text-white/70">de lo perdido fue grasa</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-3xl font-extrabold">{sh.strengthOk == null ? "—" : sh.strengthOk ? "💪" : "⚠️"}</p><p className="text-xs text-white/70">{sh.strengthOk === false ? "fuerza bajando" : "fuerza se mantiene"}</p></div>
          </div>
        ) : <p className="mt-3 text-white/80">{!a.glp1.on ? "Activa Banana Shield y anota tus medidas (cintura y cuello) cada 2 semanas. En 4 semanas te mostramos cuánto de lo que bajas es grasa." : `Anota tus medidas (cintura y cuello) cada 2 semanas y registra tus entrenos. Tu primera calificación aparece cuando tengamos 4 semanas de datos${ms.length ? ` (llevas ${Math.max(0, Math.round(spanDays / 7))} de 4)` : ""}.`}</p>}
        <p className="mt-4 text-sm text-white/70">Meta: que al menos 3 de cada 4 kg perdidos sean grasa y que tu fuerza no baje. Estudios con GLP-1 muestran que, sin fuerza ni proteína, cerca de 1 de cada 4 kg perdidos puede ser masa magra.</p>
      </section>

      <section>
        <h2 className="text-xl font-extrabold text-ink">{a.glp1.on ? "Tus 4 pilares de hoy" : "Tus metas si activas Banana Shield"}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            ["🏋️", "Fuerza 3+ días por semana", "Es la señal que le dice a tu cuerpo “este músculo se queda”. Básicos, cerca del fallo, sin prisa. En días de náusea, modo suave — pero no la saltes."],
            ["🥩", `${g.protein} g de proteína al día`, `≈ ${g.perMeal} g por comida en ${g.meals} comidas pequeñas. Come la proteína primero: si te llenas rápido, que sea con lo importante.`],
            ["🔥", `${nf(g.kcal)} kcal al día`, `Nunca menos de ${nf(g.kcalMin)} kcal. Con poco apetito es fácil comer de menos y perder músculo; si un día no llegas, prioriza batido de proteína o yogur griego.`],
            ["🥦", `${g.fiber} g de fibra · ${nf(g.waterL, 1)} L de agua`, "Frijoles, avena, frutas y vegetales poco a poco, y agua durante el día: es lo que más ayuda con el estreñimiento."],
          ].map(([e, t, b]) => <div key={t} className="card p-4"><p className="text-2xl">{e}</p><p className="mt-1 font-extrabold text-ink">{t}</p><p className="text-sm text-muted">{b}</p></div>)}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-xl font-extrabold text-ink">Si aparecen molestias</h2>
        <dl className="mt-3 space-y-3 text-[15px]">
          <div><dt className="font-bold text-ink">🤢 Náuseas</dt><dd className="text-body">Desayuno pequeño y comidas pequeñas cada 3–4 h; evita frituras, picante y comidas grandes; té de jengibre o menta.</dd></div>
          <div><dt className="font-bold text-ink">🚽 Estreñimiento</dt><dd className="text-body">Sube fibra poco a poco (ciruelas, avena, frijoles) y el agua. Si no mejora, consulta a tu médico.</dd></div>
          <div><dt className="font-bold text-ink">💩 Diarrea</dt><dd className="text-body">Evita comidas grandes o grasosas, lácteos en exceso, cafeína y endulzantes artificiales; hidrátate.</dd></div>
        </dl>
      </section>

      <section className="rounded-[1.5rem] border-2 border-bad/40 bg-bad/5 p-5" aria-labelledby="alarma">
        <h2 id="alarma" className="text-lg font-extrabold text-bad">🚨 Busca atención médica si tienes</h2>
        <ul className="mt-2 space-y-1 text-[15px] text-body">{RED_FLAGS.map((r) => <li key={r}>• {r}</li>)}</ul>
      </section>

      <section className="card p-5">
        <h2 className="text-xl font-extrabold text-ink">¿Y cuando dejes el medicamento?</h2>
        <p className="mt-2 text-body">Hasta dos tercios del peso perdido puede regresar en el primer año al suspenderlo. Tu seguro son los hábitos que construyes ahora: fuerza 3 veces por semana, proteína alta y pesarte cada semana. Banana Burn ajusta tus calorías con tu peso real para que la transición sea gradual — siempre de la mano de tu médico.</p>
      </section>

      <p className="text-xs text-faint">Banana Shield es un programa de entrenamiento y hábitos; no reemplaza a tu médico ni da indicaciones sobre dosis o medicamentos. Basado en: Mozaffarian et al., <i>Obesity</i> 2025 (ACLM, ASN, OMA y The Obesity Society) y Noronha et al., <i>Obesity Pillars</i> 2025.</p>
    </div>
  );
}
