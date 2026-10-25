// Modo demo (solo sin Supabase): qué persona y qué programa de ejemplo se ven, para revisar cada estado de la app.
// Las cookies las pone el middleware desde la URL (?programa=, ?dia=, ?estado=, ?persona=) y duran una hora.
//   ?programa=no                 sin programa activo (la rutina del motor)
//   ?programa=si                 el demo de siempre: Andrés en Reconstrucción 8 semanas, semana 2 (por defecto)
//   ?programa=pilates-casa-30    Sofía en Pilates en casa 30 días (con Coach Platanita)
//   ?programa=banana-girl        Sofía en Banana Girl (6 semanas, con Coach Platanita)
//   ?dia=N                       día del programa de chicas (1 = bienvenida; 29 = prueba final; 31 = terminado)
//   ?estado=activo|pausado|completado   estado del programa de chicas
//   ?persona=chica|chico         fuerza la persona (sin programa, por ejemplo) y se borra con ?persona=auto
import "server-only";
import { cookies } from "next/headers";

export const DEMO_GIRL_PROGRAMS = ["pilates-casa-30", "banana-girl"] as const;
export type DemoGirlProgram = (typeof DEMO_GIRL_PROGRAMS)[number];
export const isDemoGirlProgram = (s: string | undefined | null): s is DemoGirlProgram => !!s && (DEMO_GIRL_PROGRAMS as readonly string[]).includes(s);

export type DemoState = {
  /** "no", "si" (insignia) o un programa de chicas. */
  program: "no" | "si" | DemoGirlProgram;
  /** Día del programa de chicas (1-based). */
  day: number;
  status: "activo" | "pausado" | "completado";
  /** Persona del demo: Sofía (chica) o Andrés. */
  girl: boolean;
  /** Temporada activa del demo (?temporada=running|raquetas|cross): empezó hace 9 días, en la semana 2. */
  season: "running" | "raquetas" | "cross" | null;
};

/** Valores que el middleware acepta para cada cookie (lo mismo se valida al leer). */
export const DEMO_COOKIE = { program: "bb_demo_programa", day: "bb_demo_dia", status: "bb_demo_estado", persona: "bb_demo_persona", season: "bb_demo_temporada" } as const;

export function parseDemoState(get: (k: string) => string | undefined): DemoState {
  const p = get(DEMO_COOKIE.program);
  const program: DemoState["program"] = p === "no" ? "no" : isDemoGirlProgram(p) ? p : "si";
  const d = Number(get(DEMO_COOKIE.day));
  const day = Number.isInteger(d) && d >= 1 && d <= 60 ? d : program === "banana-girl" ? 9 : 12;
  const s = get(DEMO_COOKIE.status);
  const status = s === "pausado" || s === "completado" ? s : "activo";
  const per = get(DEMO_COOKIE.persona);
  const girl = per === "chica" ? true : per === "chico" ? false : isDemoGirlProgram(program);
  const se = get(DEMO_COOKIE.season);
  const season = se === "running" || se === "raquetas" || se === "cross" ? se : null;
  return { program, day, status, girl, season };
}

/** Estado del demo para esta petición (siempre el de Andrés fuera del modo demo: nadie más lo llama). */
export async function demoState(): Promise<DemoState> {
  const jar = await cookies();
  return parseDemoState((k) => jar.get(k)?.value);
}

/** La chica del demo (mismos pesajes de demo-story que Andrés, para que las gráficas cuadren). */
export const DEMO_GIRL = { name: "Sofía", heightCm: 165, goalWeight: 85 } as const;
