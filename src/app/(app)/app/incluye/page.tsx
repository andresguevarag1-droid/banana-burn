import Link from "next/link";
import { PoseImage } from "@/components/primeros-pasos/pose-image";
import { ArrowRight, Barbell, BookOpen, BowlFood, ChartLine, Check, Lock, ShieldCheck, Users, type PhosphorIcon } from "@/components/icons";
import { BananaMedal, Monkey } from "@/components/icons/brand";
import { getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { PLANS } from "@/lib/plans";
import { money } from "@/lib/copy";
import { COACH_POSE } from "@/lib/aprende";

export const metadata = { title: "Lo que incluye tu plan" };

const ENTRENO = PLANS.find((p) => p.id === "entreno")!;
const COMPLETO = PLANS.find((p) => p.id === "completo")!;

type Item = { icon: PhosphorIcon | typeof Monkey; title: string; body: string; href: string; nutri?: boolean };
const ITEMS: Item[] = [
  { icon: Barbell, title: "Un plan hecho para ti, que se ajusta solo", body: "Tus entrenos salen de tu nivel, tus días y tu equipo. Cuando ya puedes más, la app te sube el peso o las repeticiones.", href: "/app/entrenar" },
  { icon: BookOpen, title: "La técnica de cada ejercicio", body: "Un dibujo que se mueve y los pasos en español, para que entrenes seguro y bien.", href: "/app/ejercicios" },
  { icon: Monkey, title: "Tu entrenador 24/7", body: "Coach Banana responde tus dudas de entreno a cualquier hora, con tu plan en mente.", href: "/app/coach" },
  { icon: BowlFood, title: "Tu comida con números claros", body: "Calorías y proteína para tu meta, recetas latinas y Menú flash. Se ajusta cada semana con tu peso real.", href: "/app/nutricion", nutri: true },
  { icon: ShieldCheck, title: "Banana Shield para GLP-1", body: "Si usas un medicamento GLP-1, un plan para que lo que bajes sea grasa y no músculo.", href: "/app/glp1", nutri: true },
  { icon: BananaMedal, title: "Retos y niveles", body: "Retos gratis de 7 a 15 días, XP, racha y medallas para que no pierdas el ritmo.", href: "/app/retos" },
  { icon: Users, title: "Comunidad", body: "Comparte tus entrenos y motívate con otras personas. Tú decides quién te ve.", href: "/app/comunidad" },
  { icon: ChartLine, title: "Tu progreso a la vista", body: "Peso, medidas, fotos y fuerza en un solo lugar, para ver que el esfuerzo sí funciona.", href: "/app/progreso" },
];

/**
 * "Lo que incluye tu plan": lo que la persona recibe cada semana, honesto y según su plan. La comparación con un
 * entrenador personal usa un rango publicado:
 *   Cronoshare México, "¿Cuánto cobra un entrenador personal?" (consultado el 24 oct 2026): entre $400 y $1,000 MXN por
 *   sesión (https://www.cronoshare.com.mx/cuanto-cuesta/entrenador-personal). 3 sesiones por semana son unas 12 al mes:
 *   con el mínimo (unos $20 USD por sesión) ya pasa de $200 USD al mes.
 */
export default async function Incluye() {
  const v = (await getViewer())!;
  const ent = await getEntitlements(v);
  const trial = ent.plan === "free" && !!ent.trial;
  const planName = trial ? "tu prueba" : ent.nutrition ? COMPLETO.name : ENTRENO.name;
  return (
    <div className="max-w-2xl space-y-6 animate-enter">
      <header className="relative overflow-hidden rounded-[1.75rem] bg-banana px-5 pt-5 sm:px-7 sm:pt-7">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1 pb-5 sm:pb-7">
            <p className="text-[12px] font-extrabold uppercase tracking-[.14em] text-ink/70">{trial ? "En tu prueba gratis" : `Tu plan ${planName}`}</p>
            <h1 className="mt-1 text-3xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-4xl">Lo que incluye tu plan</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink/80">{trial ? "Durante tu prueba tienes todo incluido. Esto es lo que la app hace por ti cada semana." : "Esto es lo que la app hace por ti cada semana."}</p>
          </div>
          <PoseImage src={COACH_POSE.entrenador} size={150} className="size-28 shrink-0 self-end object-contain object-bottom sm:size-36" />
        </div>
      </header>

      <ul className="space-y-2.5">
        {ITEMS.map((it) => {
          const locked = it.nutri && !ent.nutrition;
          const I = it.icon;
          return (
            <li key={it.title}>
              <Link href={locked ? "/app/suscripcion" : it.href} className="card pressable flex items-start gap-3 p-4">
                <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${locked ? "bg-cream text-muted" : "bg-banana-soft text-banana-ink"}`}><I weight="duotone" className="size-6" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-extrabold leading-tight text-ink">{locked ? <Lock weight="bold" className="size-4 shrink-0 text-muted" aria-hidden /> : <Check weight="bold" className="size-4 shrink-0 text-peel" aria-hidden />}{it.title}</span>
                  <span className="mt-0.5 block text-sm text-muted text-pretty">{it.body}</span>
                  {locked && <span className="mt-1 block text-xs font-bold text-banana-ink">Incluido en {COMPLETO.name}, por {money(COMPLETO.price.mes)} al mes</span>}
                </span>
                <ArrowRight weight="bold" className="mt-1 size-4 shrink-0 text-faint" />
              </Link>
            </li>
          );
        })}
      </ul>

      <section className="rounded-[1.5rem] bg-cream p-5">
        <h2 className="font-extrabold text-ink">¿Cuánto cuesta un entrenador personal?</h2>
        <p className="mt-1 text-[15px] text-body text-pretty">En México, una sesión con entrenador personal suele costar entre 400 y 1,000 pesos mexicanos, unos $20 a $55 dólares. Con 3 sesiones por semana, eso pasa de $200 dólares al mes.</p>
        <p className="mt-2 text-[15px] font-bold text-ink text-pretty">Banana Burn te acompaña todos los días desde {money(ENTRENO.price.mes)} al mes. Un entrenador en persona te corrige en vivo; la app te da el plan, la técnica y el seguimiento a cualquier hora.</p>
        <p className="mt-2 text-xs text-muted">Precio de referencia publicado por Cronoshare México, octubre de 2026.</p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/app/aprende" className="btn-ghost h-12 px-5"><BookOpen weight="bold" className="size-5" />Aprende a entrenar</Link>
        <Link href="/app/entreno" className="btn-primary h-12 px-5">Empezar mi entreno<ArrowRight weight="bold" className="size-5" /></Link>
      </div>
    </div>
  );
}
