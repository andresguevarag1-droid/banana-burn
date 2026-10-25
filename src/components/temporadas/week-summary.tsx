// "Así queda tu semana": los 7 días con la sesión de fuerza que toca y los días del deporte. Sin estado: sirve en el
// cliente (cuestionario) y en el servidor (página de la temporada).
import { DOW_SHORT, type SessionKind, type SportId, type WeekPlan } from "@/lib/seasons";

export const SESSION_LABEL: Record<SessionKind, string> = { fuerza: "Fuerza", potencia: "Potencia y agilidad", superior: "Tren superior y core", recuperacion: "Recuperación" };
const SPORT_DAY: Record<SportId, { clave: string; normal: string }> = {
  running: { clave: "Carrera larga", normal: "Corres" },
  raquetas: { clave: "Partido", normal: "Juegas" },
  cross: { clave: "Box", normal: "Box" },
};

export function WeekSummary({ sport, plan }: { sport: SportId; plan: WeekPlan }) {
  return (
    <ol className="grid gap-1.5" aria-label="Tu semana">
      {plan.days.map((d) => (
        <li key={d.dow} className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${d.session ? "border-ink/15 bg-white" : "border-line bg-cream/60"}`}>
          <span className="w-10 shrink-0 text-sm font-extrabold text-ink">{DOW_SHORT[d.dow]}</span>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {d.session && <span className="chip h-7 bg-[var(--sport,#1B1505)] text-white">{SESSION_LABEL[d.session]}</span>}
            {d.sport && <span className={`chip h-7 ${d.sport === "clave" ? "bg-ink text-banana" : "bg-[var(--sport-soft,#FFF1A8)] text-ink"}`}>{SPORT_DAY[sport][d.sport]}</span>}
            {!d.session && !d.sport && <span className="text-sm text-muted">Descanso activo</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
