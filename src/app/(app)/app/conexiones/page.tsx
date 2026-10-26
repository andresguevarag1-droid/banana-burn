import { redirect } from "next/navigation";
// En la web, conectar relojes y otros dispositivos todavía no se ofrece: la sección queda cerrada (decisión del dueño,
// oct 2026). Para reabrirla, quita este redirect y vuelve a poner el acceso en app-nav.tsx.
// En la app nativa sí: Apple Salud o Health Connect (SaludConnect), que es lo que de verdad funciona. Se entra desde Perfil.
const ABIERTA = false;
import Link from "next/link";
import { Footprints, Heart, Heartbeat, Info, Moon, PersonSimpleRun, Watch, type PhosphorIcon } from "@/components/icons";
import { createClient, getViewer, type Viewer } from "@/lib/supabase/server";
import { requestNativeAgent } from "@/lib/platform-server";
import { todayFor } from "@/lib/today";
import { DEVICES, type DeviceId } from "./devices";
import { InterestButton } from "./interest";
import { SaludConnect } from "./salud-connect";

export const metadata = { title: "Conecta tu reloj" };

const ICON: Record<DeviceId, PhosphorIcon> = { apple: Heart, android: Heartbeat, garmin: Watch, fitbit: Footprints, strava: PersonSimpleRun, whoop_oura: Moon };

/** Primer cascarón con el plugin de Salud (capacitor.config.ts, NATIVE_SHELL). */
const SALUD_SHELL = 2;

/** Lo guardado hoy (pasos y energía activa) y el último peso, para mostrarlo antes de que el teléfono lea Salud. */
async function saved(v: Viewer) {
  const empty = { steps: null, activeKcal: null, weight: null };
  if (v.demo) return empty;
  const sb = await createClient();
  const today = todayFor(v).iso;
  const [log, w] = await Promise.all([
    // Sin la columna active_kcal (0058 sin aplicar), solo pasos.
    sb.from("daily_logs").select("steps,active_kcal").eq("user_id", v.id).eq("day", today).maybeSingle()
      .then((r) => (r.error ? sb.from("daily_logs").select("steps").eq("user_id", v.id).eq("day", today).maybeSingle() : r)),
    sb.from("weights").select("day,kg").eq("user_id", v.id).order("day", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const row = (log.data ?? {}) as { steps?: number | null; active_kcal?: number | null };
  return {
    steps: row.steps ?? null,
    activeKcal: row.active_kcal ?? null,
    weight: w.data ? { day: w.data.day as string, kg: Number(w.data.kg) } : null,
  };
}

async function NativeSalud({ v, platform, shell }: { v: Viewer; platform: "ios" | "android"; shell: number }) {
  const ios = platform === "ios";
  return (
    <div className="space-y-5 animate-enter max-w-3xl">
      <header>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">{ios ? "Salud" : "Health Connect"}</h1>
        <p className="mt-1 max-w-[60ch] text-muted">Tus pasos, tu energía activa y tu peso, directo de {ios ? "la app Salud de tu iPhone" : "Health Connect"} a tu día en Banana Burn.</p>
      </header>
      <SaludConnect owner={v.id} platform={platform} shellOk={shell >= SALUD_SHELL} saved={await saved(v)} />
      <p className="text-xs text-muted">Usamos estos datos solo para tu registro, tus retos y tu progreso. Más detalles en <Link href="/privacidad#salud-conectada" className="underline">Privacidad</Link>.</p>
    </div>
  );
}

export default async function Conexiones() {
  const agent = await requestNativeAgent();
  if (agent) return <NativeSalud v={(await getViewer())!} platform={agent.platform} shell={agent.shell} />;
  if (!ABIERTA) redirect("/app");
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
