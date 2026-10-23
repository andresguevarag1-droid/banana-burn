"use client";
// Recorrido por dentro de la app: pestañas con capturas reales y la animación de técnica en vivo del mono.
import { useRef, useState } from "react";
import { Phone } from "@/components/phone";
import { ExerciseMotion } from "@/components/exercise-motion";
import { Check } from "@/components/icons";

type Tab = { id: string; label: string; title: string; body: string; points: string[]; src?: string; motion?: true; plan?: string };

const TABS: Tab[] = [
  { id: "hoy", label: "Tu día", src: "/landing/hoy2.png", title: "Abres la app y sabes qué hacer hoy.",
    body: "Tus números del día y tu entreno, en una sola pantalla. Sin pensar, sin buscar videos.",
    points: ["Calorías y proteína que te quedan", "El entreno que te toca y por qué importa", "Cómo va tu semana de un vistazo"] },
  { id: "entreno", label: "Tu entreno", src: "/landing/entreno.png", title: "El peso exacto de cada serie.",
    body: "Como si tu entrenador estuviera al lado: te dice cuántas repeticiones, con cuánto peso y cuándo descansar.",
    points: ["Si completas tus repeticiones, la próxima vez sube", "Descanso cronometrado entre series", "Entrenos exprés de 10, 20 o 30 minutos"] },
  { id: "tecnica", label: "Técnica", motion: true, title: "Coach Banana te enseña cada movimiento.",
    body: "Ejercicios novedosos con animación paso a paso: dónde bajar lento, dónde empujar y qué músculo trabaja.",
    points: ["Animación en cada ejercicio clave", "Ritmo marcado: baja en 3 segundos, sube fuerte", "Alternativas si no tienes la máquina"] },
  { id: "comida", label: "Tu comida", src: "/landing/nutricion.png", title: "Comes lo que ya comes.",
    body: "Arroz con pollo, tacos, arepas o un combo de comida rápida: lo registras y ves cuánto te queda.",
    points: ["Más de 1.200 alimentos y platos latinos", "Proteína suficiente para reconstruir músculo", "Recetas y menú del día"], plan: "En Entreno + Nutrición" },
  { id: "progreso", label: "Progreso", src: "/landing/progreso.png", title: "Ves cómo cambia tu cuerpo, no solo tu peso.",
    body: "La tendencia real de tu peso, tus medidas, tus fotos y la fuerza que vas ganando en cada ejercicio.",
    points: ["Tendencia de peso, no el número del día", "Medidas y fotos privadas", "Fuerza por ejercicio, semana a semana"] },
  { id: "retos", label: "Retos y niveles", src: "/landing/retos.png", title: "Engancha como un juego.",
    body: "Subes de nivel con cada entreno, cuidas tu racha y te unes a retos con hitos y medalla al final.",
    points: ["Niveles con premios reales", "Retos de 7 a 42 días", "Comunidad que entrena contigo"] },
];

export function AppTour() {
  const [i, setI] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const t = TABS[i];
  const go = (n: number) => { const k = (n + TABS.length) % TABS.length; setI(k); refs.current[k]?.focus(); };

  return (
    <div className="mt-10">
      <div role="tablist" aria-label="Pantallas de la app" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {TABS.map((x, n) => (
          <button key={x.id} ref={(el) => { refs.current[n] = el; }} role="tab" id={`tab-${x.id}`} aria-selected={n === i} aria-controls="tour-panel" tabIndex={n === i ? 0 : -1}
            onClick={() => setI(n)} onKeyDown={(e) => { if (e.key === "ArrowRight") go(i + 1); if (e.key === "ArrowLeft") go(i - 1); }}
            className={`pressable h-11 shrink-0 rounded-full px-4 text-[15px] font-bold transition-colors duration-150 ${n === i ? "bg-ink text-banana" : "bg-white text-ink border border-line hover:border-ink"}`}>
            {x.label}
          </button>
        ))}
      </div>

      <div id="tour-panel" role="tabpanel" aria-labelledby={`tab-${t.id}`} className="mt-6 grid items-center gap-10 rounded-[2rem] bg-banana p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:gap-16">
        <div key={t.id} className="animate-rise">
          {t.plan && <p className="mb-3 w-fit rounded-full bg-ink px-3 py-1 text-xs font-bold text-banana">{t.plan}</p>}
          <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">{t.title}</h3>
          <p className="mt-3 max-w-[48ch] text-lg leading-relaxed text-ink/80 text-pretty">{t.body}</p>
          <ul className="mt-6 space-y-3">
            {t.points.map((p) => (
              <li key={p} className="flex items-start gap-3 font-semibold text-ink"><span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-ink"><Check weight="bold" className="size-3.5 text-banana" /></span>{p}</li>
            ))}
          </ul>
        </div>
        <div className="justify-self-center">
          {t.motion ? (
            <div className="w-[280px] rounded-[2.6rem] bg-ink p-2 shadow-lift sm:w-[300px]">
              <div className="rounded-[2.1rem] bg-cream p-4">
                <p className="text-xs font-bold text-muted">Ejercicio 1 de 4</p>
                <p className="text-lg font-extrabold text-ink">Sentadilla con barra</p>
                <ExerciseMotion anim="squat" mus="Cuádriceps, glúteos" cues={["Pecho arriba y mirada al frente", "Rodillas hacia afuera", "Baja en 3 segundos"]} className="mt-3 h-[340px]" />
              </div>
            </div>
          ) : (
            <Phone key={t.src} src={t.src!} alt={`Pantalla de Banana Burn: ${t.label}`} sizes="300px" className="w-[260px] sm:w-[290px]" />
          )}
        </div>
      </div>
    </div>
  );
}
