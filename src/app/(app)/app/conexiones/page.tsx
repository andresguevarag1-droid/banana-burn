import Link from "next/link";
import { Footprints, Heart, Heartbeat, Info, Moon, PersonSimpleRun, Watch, type PhosphorIcon } from "@/components/icons";

export const metadata = { title: "Relojes y wearables" };

const DEVICES: { I: PhosphorIcon; n: string; how: string; eta: string }[] = [
  { I: Heart, n: "Apple Salud (Apple Watch)", how: "Requiere nuestra app nativa de iPhone (HealthKit no está disponible en la web).", eta: "Con la app iOS" },
  { I: Heartbeat, n: "Health Connect (Android, Samsung, Pixel Watch)", how: "Requiere la app nativa de Android; lee pasos, ritmo cardíaco y calorías.", eta: "Con la app Android" },
  { I: Watch, n: "Garmin", how: "Garmin Connect Developer Program (requiere aprobación de Garmin para empresas).", eta: "En evaluación" },
  { I: Footprints, n: "Fitbit / Google", how: "Fitbit Web API con OAuth: pasos, ritmo cardíaco y sueño.", eta: "Próximamente" },
  { I: PersonSimpleRun, n: "Strava", how: "API de Strava con OAuth: importa caminatas, carreras y bici como actividad.", eta: "Próximamente" },
  { I: Moon, n: "Whoop / Oura", how: "APIs de recuperación y sueño para ajustar tu entreno del día.", eta: "Más adelante" },
];

export default function Conexiones() {
  return (
    <div className="space-y-5 animate-rise max-w-3xl">
      <header>
        <p className="eyebrow">Relojes y wearables</p>
        <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Conecta tu reloj</h1>
        <p className="mt-1 text-muted">Pasos, ritmo cardíaco, calorías quemadas y sueño entrarán solos a tu día, y el coach ajustará tu entreno según tu recuperación.</p>
      </header>
      <section className="rounded-[1.5rem] bg-banana p-5">
        <p className="flex items-center gap-2 font-extrabold text-ink"><Info weight="duotone" className="size-5" />Mientras tanto</p>
        <p className="text-sm text-ink/80">Copia tus pasos y horas de sueño del reloj a <Link href="/app" className="font-bold underline">Hoy</Link> con un toque: cuentan para tus retos y tu racha.</p>
      </section>
      <ul className="space-y-3">
        {DEVICES.map((d) => (
          <li key={d.n} className="card p-4 flex items-center gap-4">
            <span className="grid place-items-center size-12 shrink-0 rounded-2xl bg-banana-soft text-banana-ink"><d.I weight="duotone" className="size-6" /></span>
            <div className="flex-1 min-w-0"><p className="font-extrabold text-ink">{d.n}</p><p className="text-sm text-muted">{d.how}</p></div>
            <span className="chip shrink-0 bg-cream text-muted">{d.eta}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-faint">¿Cuál reloj usas? Escríbenos a hola@bananaburn.app y lo priorizamos.</p>
    </div>
  );
}
