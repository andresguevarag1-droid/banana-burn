"use client";
// Opinión rápida después de una sesión de temporada: por ejercicio, me gustó o no y, si quiere, muy difícil o muy fácil.
// Todo opcional. Con esto se arma la próxima temporada (lo que gusta se queda; lo que no, se cambia).
import { useState, useTransition } from "react";
import { CheckCircle, CircleNotch, X } from "@/components/icons";
import { saveSeasonFeedback, type FeedbackItem } from "@/app/actions/temporadas";

type Ex = { id: string; name: string };

export function SeasonFeedback({ slug, week, day, title, exercises }: { slug: string; week: number; day: number; title: string; exercises: Ex[] }) {
  const [items, setItems] = useState<Record<string, FeedbackItem>>({});
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (hidden) return null;
  const set = (id: string, p: Partial<FeedbackItem>) => setItems((x) => ({ ...x, [id]: { ...(x[id] ?? { exercise_id: id, liked: null, difficulty: null, skipped: false }), ...p } }));
  const send = () => start(async () => {
    setError(null);
    const r = await saveSeasonFeedback(slug, week, day, Object.values(items));
    if (!r.ok) { setError(r.error ?? "No pudimos guardar."); return; }
    setDone(true);
  });
  if (done) return <p className="card flex items-center gap-2 p-4 text-sm font-semibold text-peel"><CheckCircle weight="duotone" className="size-5 shrink-0" />Gracias. Con esto armamos la próxima temporada.</p>;
  const btn = (on: boolean) => `pressable h-10 min-w-11 px-3 rounded-xl border-2 text-sm font-bold ${on ? "border-ink bg-banana text-ink" : "border-line bg-white text-muted"}`;
  return (
    <section className="card p-5 space-y-3" aria-labelledby="fb-title">
      <div className="flex items-start justify-between gap-3">
        <div><h2 id="fb-title" className="font-extrabold text-ink">¿Qué tal tu sesión?</h2><p className="text-sm text-muted">{title}. Opcional: marca lo que te gustó y lo que no.</p></div>
        <button type="button" onClick={() => setHidden(true)} aria-label="Cerrar" className="pressable grid place-items-center size-11 shrink-0 rounded-full text-muted"><X weight="bold" className="size-5" /></button>
      </div>
      <ul className="divide-y divide-line">
        {exercises.map((e) => {
          const it = items[e.id];
          return (
            <li key={e.id} className="py-2.5 space-y-2">
              <p className="text-sm font-bold text-ink">{e.name}</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" aria-pressed={it?.liked === true} onClick={() => set(e.id, { liked: it?.liked === true ? null : true })} className={btn(it?.liked === true)}>Me gustó</button>
                <button type="button" aria-pressed={it?.liked === false} onClick={() => set(e.id, { liked: it?.liked === false ? null : false })} className={btn(it?.liked === false)}>No me gustó</button>
                <button type="button" aria-pressed={it?.difficulty === "dificil"} onClick={() => set(e.id, { difficulty: it?.difficulty === "dificil" ? null : "dificil" })} className={btn(it?.difficulty === "dificil")}>Muy difícil</button>
                <button type="button" aria-pressed={it?.difficulty === "facil"} onClick={() => set(e.id, { difficulty: it?.difficulty === "facil" ? null : "facil" })} className={btn(it?.difficulty === "facil")}>Muy fácil</button>
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad">{error}</p>}
      <button type="button" disabled={pending || !Object.keys(items).length} onClick={send} className="btn-primary w-full h-12">{pending ? <CircleNotch weight="bold" className="size-5 animate-spin" /> : "Enviar mi opinión"}</button>
    </section>
  );
}
