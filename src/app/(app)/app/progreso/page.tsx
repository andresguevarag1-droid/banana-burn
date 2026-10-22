import { getViewer } from "@/lib/supabase/server";
import { getAthlete } from "@/lib/athlete";
import { ProfileForm, WeightForm } from "./forms";

export const metadata = { title: "Progreso" };

export default async function Progreso() {
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  return (
    <div className="space-y-6 animate-rise">
      <header>
        <p className="eyebrow">Progreso</p>
        <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">{(a.startWeight - a.currentWeight).toFixed(1)} kg perdidos</h1>
        <p className="mt-2 text-muted">Pésate 4+ mañanas por semana: el motor calcula tu tendencia real y ajusta tus calorías.</p>
      </header>
      <section className="card p-5 sm:p-6 max-w-lg">
        <h2 className="font-bold text-ink mb-3">⚖️ Peso de hoy</h2>
        <WeightForm last={a.currentWeight} />
      </section>
      <section className="card p-5 sm:p-6">
        <h2 className="font-bold text-ink mb-4">🎯 Mi perfil y meta</h2>
        <ProfileForm a={a} />
      </section>
    </div>
  );
}
