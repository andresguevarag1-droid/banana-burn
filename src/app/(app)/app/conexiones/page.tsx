import Link from "next/link";
import { Footprints, Heart, Heartbeat, Info, Moon, PersonSimpleRun, Watch, type PhosphorIcon } from "@/components/icons";
import { createClient, getViewer } from "@/lib/supabase/server";
import { DEVICES, type DeviceId } from "./devices";
import { InterestButton } from "./interest";

export const metadata = { title: "Conecta tu reloj" };

const ICON: Record<DeviceId, PhosphorIcon> = { apple: Heart, android: Heartbeat, garmin: Watch, fitbit: Footprints, strava: PersonSimpleRun, whoop_oura: Moon };

export default async function Conexiones() {
  const v = (await getViewer())!;
  let mine = new Set<string>();
  if (!v.demo) {
    const { data } = await (await createClient()).from("device_interest").select("device").eq("user_id", v.id);
    mine = new Set((data ?? []).map((r) => r.device as string));
  }
  return (
    <div className="space-y-5 animate-enter max-w-3xl">
      <header>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Próximamente: conecta tu reloj</h1>
        <p className="mt-1 max-w-[60ch] text-muted">Queremos que tus pasos, tu ritmo cardíaco y tu sueño entren solos a tu día. Todavía no está listo: dinos cuál usas y empezamos por el que más pidan.</p>
      </header>
      <ul className="card divide-y divide-line">
        {DEVICES.map((d) => {
          const I = ICON[d.id];
          return (
            <li key={d.id} className="p-4 flex items-center gap-4">
              <span className="grid place-items-center size-11 shrink-0 rounded-2xl bg-banana-soft text-banana-ink"><I weight="duotone" className="size-6" /></span>
              <div className="flex-1 min-w-0"><p className="font-extrabold text-ink">{d.n}</p><p className="text-sm text-muted">{d.what}</p></div>
              <InterestButton id={d.id} name={d.n} initial={mine.has(d.id)} />
            </li>
          );
        })}
      </ul>
      <section className="rounded-[1.5rem] bg-banana p-5">
        <p className="flex items-center gap-2 font-extrabold text-ink"><Info weight="duotone" className="size-5" />Mientras tanto</p>
        <p className="text-sm text-ink/80">Anota tus pasos y horas de sueño en <Link href="/app" className="font-bold underline">Hoy</Link>: cuentan para tus retos y tu racha.</p>
      </section>
      <p className="text-xs text-muted">¿Usas otro? Escríbenos a <a className="underline" href="mailto:hola@bananaburn.app?subject=Quiero%20conectar%20mi%20reloj">hola@bananaburn.app</a>.</p>
    </div>
  );
}
