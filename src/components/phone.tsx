import { planDay, targets } from "@/lib/engine";

/** Mockup de la pantalla "Hoy" — usa el motor real. */
export function PhoneMock() {
  const day = planDay(1, 0);
  const t = targets({ kg: 94, heightCm: 182, age: 27 });
  return (
    <div className="relative mx-auto w-[300px] sm:w-[320px] rounded-[2.8rem] bg-ink p-2.5 shadow-lift animate-floaty">
      <div className="rounded-[2.3rem] bg-paper overflow-hidden">
        <div className="h-7 flex justify-center items-end"><div className="h-5 w-24 rounded-full bg-ink" /></div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted">Hoy · lunes</p>
            <p className="text-2xl font-extrabold tracking-tight text-ink">¡Pura vida, Andrés! 🍌</p>
          </div>
          <div className="rounded-3xl bg-banana p-4 text-ink">
            <div className="flex items-center justify-between">
              <span className="chip bg-ink/10 h-6">{day.tag}</span>
              <span className="text-xs font-semibold">~55 min</span>
            </div>
            <p className="mt-2 text-xl font-extrabold">{day.emoji} {day.name}</p>
            <ul className="mt-2 space-y-1 text-[13px] font-medium">
              {day.exercises.map((e) => (
                <li key={e.id} className="flex justify-between"><span>{e.name}</span><span className="opacity-60">{e.cfg.sets}×{e.cfg.lo}–{e.cfg.hi}</span></li>
              ))}
            </ul>
            <div className="mt-3 h-10 rounded-full bg-ink text-white grid place-items-center text-sm font-bold">Empezar entreno →</div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["🔥", t.kcal, "kcal"], ["🥩", `${t.protein} g`, "proteína"], ["👟", "10k", "pasos"]].map(([i, v, l]) => (
              <div key={String(l)} className="rounded-2xl bg-white border border-line py-2.5">
                <p className="text-base">{i}</p><p className="text-sm font-extrabold text-ink">{v}</p><p className="text-[10px] text-muted">{l}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-white border border-line p-3">
            <div className="flex justify-between text-xs font-semibold"><span className="text-muted">Meta 85 kg · 31 dic</span><span className="text-peel">−0,8 kg/sem ✓</span></div>
            <div className="mt-2 h-2 rounded-full bg-line overflow-hidden"><div className="h-full w-[38%] rounded-full bg-gradient-to-r from-banana to-ember" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
