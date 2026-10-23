"use client";
// Visual de cada paso de la guía: capturas reales de la app, la animación de técnica en vivo y piezas hechas con los
// mismos estilos de la app (chips, tarjetas, portada del programa). Nada decorativo se lee dos veces: aria-hidden
// en lo que repite el texto y alt corto en las capturas.
import Image from "next/image";
import { BrandIcon, CheckCircle, CookingPot, Drop, Footprints, Lightning, Lock, Moon, Play, ShieldCheck, Timer, TrendUp } from "@/components/icons";
import { ExerciseMotion } from "@/components/exercise-motion";
import { ChallengeCover } from "@/components/retos/cover";
import type { CoverStyle } from "@/lib/challenges";
import { guideVariant, type GuideInput, type GuideStep } from "@/lib/guide";
import { PLANS } from "@/lib/plans";

const nf = (n: number) => n.toLocaleString("es-419", { maximumFractionDigits: 1 });

/** Captura en un teléfono que sale por abajo del recuadro (se ve la parte de arriba de la pantalla). */
function Shot({ src, alt, badge }: { src: string; alt: string; badge?: React.ReactNode }) {
  return (
    <div className="relative h-full overflow-hidden rounded-[1.75rem] bg-banana-soft">
      <div aria-hidden className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgb(27 21 5 / .07) 1.5px, transparent 1.6px)", backgroundSize: "14px 14px" }} />
      <div className="absolute left-1/2 top-5 w-[min(58%,240px)] -translate-x-1/2 rounded-[2rem] bg-ink p-1.5 shadow-lift sm:top-8">
        <div className="relative aspect-[390/844] overflow-hidden rounded-[1.6rem] bg-cream">
          <Image src={src} alt={alt} fill sizes="240px" className="object-cover object-top" />
        </div>
      </div>
      {badge}
    </div>
  );
}

function Mascot({ className = "" }: { className?: string }) {
  return <Image src="/brand/mascota-sola.webp" alt="" width={360} height={360} className={`pointer-events-none select-none object-contain ${className}`} />;
}

export function GuideVisual({ step, input }: { step: GuideStep; input: GuideInput }) {
  const v = step.visual;
  switch (v.kind) {
    case "captura":
      return <Shot src={v.src} alt={v.alt} />;
    case "bienvenida": {
      const variant = guideVariant(input);
      const label = variant === "prueba" ? "Prueba con todo incluido" : PLANS.find((p) => p.id === variant)!.name;
      return (
        <div className="relative grid h-full place-items-center overflow-hidden rounded-[1.75rem] bg-banana">
          <div aria-hidden className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgb(27 21 5 / .09) 1.5px, transparent 1.6px)", backgroundSize: "14px 14px" }} />
          <Mascot className="relative h-[78%] w-auto" />
          <span className="absolute left-4 top-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-extrabold text-banana"><CheckCircle weight="fill" className="size-4" aria-hidden />{label}</span>
        </div>
      );
    }
    case "progresion": {
      const rows = [
        { w: "Semana 1", kg: 40, reps: [10, 10, 9], tag: null },
        { w: "Semana 2", kg: 40, reps: [12, 12, 12], tag: "Al tope" },
        { w: "Semana 3", kg: 42.5, reps: [8, 8, 8], tag: "Sube" },
      ];
      return (
        <div aria-hidden className="flex h-full flex-col justify-center gap-2.5 rounded-[1.75rem] bg-ink p-4 text-white sm:gap-3 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0"><span className="block text-[11px] font-extrabold uppercase tracking-[.12em] text-banana">Sentadilla</span><span className="block text-base font-extrabold sm:text-lg">3 series de 8-12 reps</span></div>
            <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 text-xs font-bold tabular-nums"><Timer weight="bold" className="size-4 text-banana" />1:30</span>
          </div>
          <ul className="grid gap-1.5 sm:gap-2">
            {rows.map((r) => (
              <li key={r.w} className={`grid grid-cols-[4.25rem_auto_1fr_auto] items-center gap-2 rounded-2xl px-3 py-2 sm:py-2.5 ${r.tag === "Sube" ? "bg-banana text-ink" : "bg-white/[.07]"}`}>
                <span className="text-xs font-bold opacity-75">{r.w}</span>
                <span className="text-[15px] font-extrabold tabular-nums whitespace-nowrap">{nf(r.kg)} kg</span>
                <span className="text-sm font-semibold tabular-nums opacity-80 whitespace-nowrap">{r.reps.join(", ")}</span>
                {r.tag ? <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${r.tag === "Sube" ? "bg-ink text-banana" : "bg-white/15 text-white"}`}>{r.tag === "Sube" && <TrendUp weight="bold" className="size-3.5" />}{r.tag}</span> : <span />}
              </li>
            ))}
          </ul>
          <span className="block text-xs font-semibold text-white/70">Llegaste a 12 en todas: la próxima vez subes el peso y vuelves a 8.</span>
        </div>
      );
    }
    case "hoy":
      return (
        <div aria-hidden className="flex h-full flex-col justify-center gap-2.5 rounded-[1.75rem] bg-banana-soft p-4 sm:gap-3 sm:p-6">
          <div className="relative overflow-hidden rounded-[1.5rem] bg-banana p-4">
            <BrandIcon name="barbell" className="absolute -right-6 -top-6 size-32 rotate-12 text-ink opacity-[.09]" />
            <span className="relative block text-xs font-semibold text-ink/75">Hoy lunes, día de fuerza</span>
            <span className="relative mt-0.5 block text-2xl font-extrabold leading-tight text-ink">Pierna y empuje A</span>
            <span className="relative mt-2.5 flex flex-wrap gap-1.5">
              {["Sentadilla 3×8-12", "Press inclinado 3×8-12", "Remo 3×10-12"].map((x) => <span key={x} className="chip h-7 bg-white/70 text-[12px] text-ink">{x}</span>)}
            </span>
            <span className="relative mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-bold text-white"><Play weight="fill" className="size-4 text-banana" />Empezar</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[[Drop, "Agua", "6 de 8"], [Footprints, "Pasos", "7,400"], [Moon, "Sueño", "7 h"]].map(([I, t, v]) => {
              const Icon = I as typeof Drop;
              return <span key={t as string} className="card flex flex-col items-center gap-0.5 px-2 py-2.5 text-center"><Icon weight="duotone" className="size-5 text-banana-ink" /><span className="text-sm font-extrabold tabular-nums text-ink">{v as string}</span><span className="text-[11px] font-semibold text-muted">{t as string}</span></span>;
            })}
          </div>
        </div>
      );
    case "semana": {
      const days = [["Lunes", "Pierna y empuje A", "hecho"], ["Martes", "Tirón A", "hecho"], ["Jueves", "Pierna y empuje B", "hoy"], ["Viernes", "Tirón B", ""]];
      return (
        <div aria-hidden className="flex h-full flex-col justify-center gap-2.5 rounded-[1.75rem] bg-banana-soft p-4 sm:gap-3 sm:p-6">
          <div>
            <span className="hidden text-xs font-semibold text-muted sm:block">4 días por semana, en el gimnasio o en casa</span>
            <span className="block text-xl font-extrabold text-ink">Semana 3 de 6</span>
            <span className="mt-2 flex gap-1">{[1, 2, 3, 4, 5, 6].map((w) => <span key={w} className={`h-2 flex-1 rounded-full ${w < 3 ? "bg-ink" : w === 3 ? "bg-ember" : w === 6 ? "bg-sky/30" : "bg-line"}`} />)}</span>
          </div>
          <ul className="grid gap-1.5">
            {days.map(([d, n, st]) => (
              <li key={d} className={`${d === "Lunes" ? "hidden sm:flex" : "flex"} items-center gap-3 rounded-2xl px-3 py-2 ${st === "hoy" ? "bg-ink text-white" : "bg-white text-ink"}`}>
                <span className={`w-14 shrink-0 text-xs font-bold ${st === "hoy" ? "text-banana" : "text-muted"}`}>{st === "hoy" ? "Hoy" : d}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{n}</span>
                {st === "hecho" && <CheckCircle weight="fill" className="size-5 shrink-0 text-peel" />}
                {st === "hoy" && <Play weight="fill" className="size-4 shrink-0 text-banana" />}
              </li>
            ))}
          </ul>
          <span className="hidden text-xs font-semibold text-muted sm:block">La semana 6 es de descarga: menos volumen para recuperarte.</span>
        </div>
      );
    }
    case "tecnica":
      return (
        <div className="relative h-full overflow-hidden rounded-[1.75rem] bg-banana-soft p-3 sm:p-4">
          <ExerciseMotion anim="squat" mus="Cuádriceps, glúteos" cues={["Pecho arriba", "Rodillas hacia afuera", "Baja en 3 segundos"]} className="h-full" />
          <span aria-hidden className="absolute right-3 top-3 inline-flex h-7 items-center gap-1 rounded-full bg-ink px-2.5 text-[11px] font-extrabold text-banana"><Lightning weight="fill" className="size-3.5" />Exprés 10, 20 o 30 min</span>
        </div>
      );
    case "programa": {
      const p = input.program;
      if (!p) return null;
      return (
        <div aria-hidden className="h-full overflow-hidden rounded-[1.75rem] shadow-soft">
          <ChallengeCover c={{ cover: p.cover as CoverStyle, icon: p.icon }} chip={false} className="flex h-full flex-col justify-between p-5 sm:p-6">
            <div className="relative">
              <p className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink px-2.5 text-[11px] font-extrabold uppercase tracking-[.1em] text-banana"><BrandIcon name={p.icon} className="size-3.5" />{p.mode ?? "Programa activo"}</p>
              <p className="mt-3 text-xl font-extrabold leading-tight tracking-tight sm:text-3xl">{p.title}</p>
              <p className="mt-1 text-sm font-bold opacity-85">Semana {p.week} de {p.weeks}</p>
              <div className="mt-3 flex gap-1">{Array.from({ length: p.weeks }, (_, n) => n + 1).map((w) => <span key={w} className={`h-2 flex-1 rounded-full ${w < p.week ? "bg-ink" : w === p.week ? "bg-ember" : "bg-white/40"}`} />)}</div>
            </div>
            {p.habits.length > 0 && (
              <ul className="relative mt-4 flex flex-wrap gap-1.5">
                {p.habits.slice(0, 4).map((h, n) => <li key={h} className={`chip h-7 bg-white/85 text-[12px] text-ink ${n > 1 ? "hidden sm:inline-flex" : ""}`}><CheckCircle weight="fill" className="size-3.5 text-peel" />{h}</li>)}
              </ul>
            )}
          </ChallengeCover>
        </div>
      );
    }
    case "mejora":
      return <Shot src="/landing/nutricion.png" alt="Vista de la nutrición de Entreno + Nutrición" badge={<span className="absolute bottom-4 left-1/2 inline-flex h-9 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-3.5 text-xs font-extrabold text-banana shadow-lift"><Lock weight="bold" className="size-4" aria-hidden />Incluido en Entreno + Nutrición</span>} />;
    case "recetas":
      return (
        <div aria-hidden className="flex h-full flex-col justify-center gap-3 rounded-[1.75rem] bg-banana-soft p-4 sm:p-6">
          <div className="card p-4">
            <p className="flex items-center gap-2 text-sm font-extrabold text-ink"><Lightning weight="fill" className="size-4 text-ember" />Menú flash: te faltan 620 kcal y 48 g de proteína</p>
            <ul className="mt-3 grid gap-2">
              {[["Cena", "Tilapia con yuca y vegetales", "550 kcal, 56 g"], ["Merienda", "Yogur griego con banana", "210 kcal, 20 g"]].map(([t, m, k], n) => (
                <li key={t} className={`${n ? "hidden sm:flex" : "flex"} items-center gap-3 rounded-2xl bg-cream px-3 py-2`}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-banana text-ink"><CookingPot weight="duotone" className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-bold text-muted">{t}</span><span className="block truncate text-sm font-bold text-ink">{m}</span></span><span className="shrink-0 text-xs font-semibold text-muted tabular-nums">{k}</span></li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-3 rounded-[1.25rem] bg-ink p-4 text-white">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-banana text-ink"><ShieldCheck weight="duotone" className="size-6" /></span>
            <span className="min-w-0"><span className="block font-extrabold">Banana Shield</span><span className="block text-sm text-white/75">Proteína, fibra y agua para tu día de GLP&#8209;1</span></span>
          </div>
        </div>
      );
    case "coach": {
      const nutri = input.nutrition;
      return (
        <div aria-hidden className="relative flex h-full flex-col justify-end overflow-hidden rounded-[1.75rem] bg-ink p-4 sm:p-6">
          <Mascot className="absolute -right-4 -top-2 h-[58%] w-auto opacity-95" />
          <div className="relative grid gap-2">
            <p className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-banana px-3.5 py-2 text-sm font-semibold text-ink">{nutri ? "Voy a comer fuera hoy. ¿Qué pido?" : "Me molesta la rodilla en la sentadilla. ¿Qué hago?"}</p>
            <p className="max-w-[88%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-sm text-ink">{nutri ? "Pide una proteína a la plancha, medio plato de vegetales y una porción de arroz o papa. Así llegas a tu proteína sin pasarte." : "Baja hasta donde no moleste y lleva las rodillas en línea con la punta del pie. Si sigue, cámbiala por prensa o sentadilla a caja."}</p>
          </div>
        </div>
      );
    }
    case "final": {
      const variant = guideVariant(input);
      const label = variant === "prueba" ? "Todo incluido en tu prueba" : PLANS.find((p) => p.id === variant)!.name;
      return (
        <div className="relative grid h-full place-items-center overflow-hidden rounded-[1.75rem] bg-banana">
          <div aria-hidden className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgb(27 21 5 / .09) 1.5px, transparent 1.6px)", backgroundSize: "14px 14px" }} />
          <Mascot className="relative h-[78%] w-auto" />
          <span aria-hidden className="absolute left-4 top-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-extrabold text-banana"><CheckCircle weight="fill" className="size-4" />{label}</span>
        </div>
      );
    }
  }
}
