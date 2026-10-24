// Novedades de Banana Burn: lo que cambió en la app, escrito para la persona que la usa. Lógica pura (sin servidor).
//
// CÓMO AGREGAR UNA NOVEDAD (ver docs/novedades.md):
//   1. Por cada versión con cambios que la persona nota, agrega una entrada ARRIBA de NOVEDADES (la más nueva primero).
//   2. id = "AAAA-MM-DD-tema" (fecha del deploy + tema corto en minúsculas). Nunca cambies ni reutilices un id publicado:
//      es lo que guarda profiles.news_seen (0036) para saber qué ya vio cada persona.
//   3. Cada item dice qué cambió (title) y cómo mejora SU experiencia (benefit): concreto, en tú, sin promesas que la app
//      no cumpla. href = la pantalla donde se prueba. audience = quién lo ve (por defecto, todos).
//   4. Español neutro, sin emojis, sin rayas largas, sin "IA". novedades.test.ts lo revisa.
// Al entrar a Hoy, quien no vio una versión recibe "Lo nuevo en Banana Burn" con todo lo que cambió desde su última
// visita (las versiones juntas, la más nueva arriba). El historial completo vive en /app/novedades.
import type { IconName } from "@/components/icons/named";

/**
 * Quién ve un item:
 *   todos: cualquier persona.
 *   entreno: plan Entreno (sin nutrición). Sirve para contar lo que trae Entreno + Nutrición sin mostrarlo como propio.
 *   completo: con nutrición (Entreno + Nutrición, la prueba o una cortesía que la incluya).
 *   con-programa: con un programa Premium activo.
 *   staff: equipo de Banana Burn que usa el panel (NEWS_STAFF_ROLES: soporte, admin y superadmin).
 */
export type Audience = "todos" | "entreno" | "completo" | "con-programa" | "staff";
export const AUDIENCES: Audience[] = ["todos", "entreno", "completo", "con-programa", "staff"];

/** Imagen del item: portada de un reto o programa (slug), Coach Banana en un nivel (1 a 8) o un archivo de /public. */
export type NewsArt = { reto: string } | { nivel: number } | { src: string };

export type NewsItem = {
  title: string;
  /** Cómo mejora la experiencia de quien lo lee. Una o dos frases concretas. */
  benefit: string;
  /** Nombre de BrandIcon (icons/named.tsx). */
  icon: IconName;
  /** Pantalla donde se prueba ("Probar"). Siempre una ruta de la app. */
  href: string;
  /** Texto del enlace. Por defecto "Probar". */
  cta?: string;
  /** Acción en vez de navegar (la guía se abre como diálogo). El href queda de respaldo. */
  opens?: "guia";
  audience?: Audience;
  image?: NewsArt;
};

export type Release = {
  /** "AAAA-MM-DD-tema". Único y para siempre. */
  id: string;
  /** Fecha del deploy (AAAA-MM-DD, hora de Costa Rica). */
  date: string;
  title: string;
  /** Una o dos frases: qué trae esta versión para ti. */
  intro: string;
  items: NewsItem[];
};

// ───────────── Historial (la más nueva primero) ─────────────
export const NOVEDADES: Release[] = [
  {
    id: "2026-10-24-tarjeta-lista",
    date: "2026-10-24",
    title: "Tu primer mes a mitad de precio",
    intro: "La prueba gratis ya no pide tarjeta, y dejarla lista tiene premio.",
    items: [
      { title: "Deja tu tarjeta lista y paga 50 % menos tu primer mes", benefit: "Si guardas tu tarjeta antes de tu primer cobro, tu primer mes del plan mensual cuesta la mitad. Hoy no se cobra nada, te avisamos 2 días antes y cancelas cuando quieras desde Mi plan.", icon: "shield", href: "/app/suscripcion#tarjeta", cta: "Ver la oferta" },
    ],
  },
  {
    id: "2026-10-23-pilates-platanita",
    date: "2026-10-23",
    title: "Pilates en casa con Coach Platanita",
    intro: "Llega un programa nuevo para entrenar en tu sala y una coach nueva que te acompaña en él.",
    items: [
      { title: "Pilates en casa 30 días", benefit: "Sesiones de 20 a 30 minutos con solo un tapete, una mini banda y una toalla: abdomen, glúteo, postura y cintura, sin gimnasio.", icon: "sparkle", href: "/app/retos/pilates-casa-30", cta: "Ver el programa", image: { reto: "pilates-casa-30" } },
      { title: "Conoce a Coach Platanita", benefit: "En Pilates en casa y en Banana Girl, ella te da la bienvenida, un consejo cada semana, responde en el chat y aparece haciendo cada ejercicio para que veas la postura.", icon: "monkey", href: "/app/retos/pilates-casa-30", cta: "Conocerla" },
      { title: "Tu comida de hoy, más clara", benefit: "En Hoy ves qué comiste en cada tiempo de comida y qué te recomienda tu coach para el siguiente.", icon: "fork", href: "/app", audience: "completo" },
    ],
  },
  {
    id: "2026-10-23-retos-y-guia",
    date: "2026-10-23",
    title: "Retos más cortos, soporte y una guía para tu plan",
    intro: "Retos gratis que sí se terminan, una guía que te muestra la app según tu plan y claridad total sobre la prueba con tarjeta.",
    items: [
      {
        title: "4 retos gratis de 15 días o menos",
        benefit: "Hidratado 14 días, Detox de azúcar 7 días, Flexible como mono 14 días y Caminata de la selva 15 días. Son cortos para que llegues al final, con una tarea concreta cada día. Hidratado y Caminata se marcan solos cuando registras tu agua o tus pasos en Hoy.",
        icon: "medal", href: "/app/retos", cta: "Ver los retos", image: { reto: "agua-21" },
      },
      {
        title: "Tu entreno de hoy, más claro y con ganas",
        benefit: "Los entrenos tienen nombres que dicen qué trabajas (como Piernas de acero y pecho firme) y la tarjeta de Hoy muestra cada ejercicio con Coach Banana, cuántas series haces y lo que levantaste la vez pasada.",
        icon: "monkey", href: "/app", cta: "Ver mi entreno",
      },
      {
        title: "Coach Banana te habla como prefieras",
        benefit: "Elige en Perfil si quieres explicaciones básicas, intermedias o técnicas. Los números son los mismos; cambia cómo te lo explicamos.",
        icon: "sparkle", href: "/app/perfil", cta: "Elegir cómo te hablo",
      },
      {
        title: "Reporta un problema y sigue tu caso",
        benefit: "Si algo falla, cuéntanoslo desde Ayuda y reportes. Recibes un número de caso y te avisamos cuando lo recibimos, cuando lo estamos trabajando y cuando queda resuelto.",
        icon: "flag", href: "/app/soporte", cta: "Reportar un problema",
      },
      {
        title: "Entrenos exprés más a la mano",
        benefit: "¿Día ocupado? Los entrenos de 10, 20 y 30 minutos sin equipo ahora están arriba en Entrenar y en Hoy. Cuentan para tu racha.",
        icon: "bolt", href: "/app/entrenar", cta: "Ver los exprés",
      },
      {
        title: "Sabes cuántas preguntas te quedan con Coach Banana",
        benefit: "Coach Banana te muestra cuántas preguntas te quedan hoy según tu plan, para que sepas cuándo aprovecharlas.",
        icon: "monkey", href: "/app/coach", cta: "Preguntarle algo",
      },
      {
        title: "Guía de la app según tu plan",
        benefit: "Un recorrido corto por lo que tu plan incluye: cómo entrenar, retos, Coach Banana y tu progreso. Ábrela cuando quieras desde Perfil o desde Más.",
        icon: "flag", href: "/app/perfil", cta: "Abrir la guía", opens: "guia",
      },
      {
        title: "Tarjeta guardada y cobro con aviso",
        benefit: "Puedes guardar tu tarjeta en Mi plan: ese día no se cobra nada, te avisamos 2 días antes del cobro y cancelas cuando quieras. Si estás en la beta, tu acceso gratis llega hasta el 31 de octubre.",
        icon: "shield", href: "/app/suscripcion", cta: "Ver mi plan",
      },
      {
        title: "Testers desde el panel",
        benefit: "Asigna un mes de tester desde la ficha de cada persona y revisa sus reportes en un solo lugar.",
        icon: "flask", href: "/admin/usuarios/testers", cta: "Ver testers", audience: "staff",
      },
    ],
  },
  {
    id: "2026-10-23-perfil-y-niveles",
    date: "2026-10-23",
    title: "Tu perfil sube de nivel",
    intro: "Coach Banana crece contigo y tu perfil muestra todo lo que has logrado.",
    items: [
      {
        title: "Coach Banana en cada etapa de su vida",
        benefit: "Cada nivel tiene a Coach Banana en una etapa distinta, de bebé a King Kong. Ves de un vistazo cuánto has avanzado y qué te falta para el siguiente.",
        icon: "monkeyCrown", href: "/app/niveles", cta: "Ver mis niveles", image: { nivel: 6 },
      },
      {
        title: "Perfil por niveles: de Semilla a Banana de oro",
        benefit: "Tu perfil pasa por Semilla, Racimo, Cosecha, Platanal y Banana de oro con lo que haces de verdad: programas, retos, nivel, racha y verificación. Cada etapa desbloquea una portada y un marco nuevos.",
        icon: "trophy", href: "/app/perfil#poder", cta: "Ver mi perfil",
      },
      {
        title: "Insignias junto a tu nombre",
        benefit: "Elige la insignia que más te representa y se muestra junto a tu nombre en la comunidad, con tu nivel de perfil.",
        icon: "medal", href: "/app/perfil#poder", cta: "Elegir insignia",
      },
      {
        title: "Verifica tu identidad",
        benefit: "Con la marca de verificado, la tropa sabe que tu perfil es real y tu perfil suma puntos. Borramos las fotos de tu documento al terminar la revisión.",
        icon: "shield", href: "/app/perfil/verificar", cta: "Verificar mi perfil",
      },
      {
        title: "Testers de la beta",
        benefit: "Si el equipo te invita como tester, tienes un mes de Entreno + Nutrición sin cobros y un botón Reportar algo en Hoy para contarnos qué mejorar. Si ya tenías un cobro programado, espera al final de ese mes.",
        icon: "flask", href: "/app",
      },
    ],
  },
  {
    id: "2026-10-23-programas",
    date: "2026-10-23",
    title: "Programas que transforman tu app",
    intro: "Cuando empiezas un programa Premium, toda la app se adapta a tu objetivo: entreno, hábitos, consejos y comida.",
    items: [
      {
        title: "Tu programa toma el control de la app",
        benefit: "Al empezar un programa, la app se pone en su modo: una franja con su color arriba, la cinta del programa en cada pantalla y tu sesión del día lista en Entrenar. Sabes qué toca hoy sin buscarlo.",
        icon: "bolt", href: "/app/retos", cta: "Ver los programas", image: { reto: "gluteos-30" },
      },
      {
        title: "7 programas Premium con nombre propio",
        benefit: "Glúteos de acero, Operación Abdomen, Brazos de Gorila, Banana Girl, Reconstrucción Total, Mi Primera Dominada y Quema Banana 6 semanas. Cada uno con ejercicios enfocados en su objetivo y su portada con Coach Banana.",
        icon: "trophy", href: "/app/retos", cta: "Elegir mi programa", image: { reto: "banana-girl" },
      },
      {
        title: "Hábitos diarios y un consejo por semana",
        benefit: "Tu programa trae 4 hábitos diarios en Hoy. Los que ya registras, como agua o pasos, se marcan solos. Cada semana, Coach Banana te deja un consejo para la etapa en la que vas.",
        icon: "target", href: "/app", cta: "Ver mis hábitos", audience: "con-programa",
      },
      {
        title: "La comida de tu programa",
        benefit: "Cada día, Hoy te da un consejo de comida del programa. Con Entreno + Nutrición, además ajusta tus calorías y tu proteína en Nutrición según su objetivo: bajar grasa, recomposición o ganar músculo.",
        icon: "bowl", href: "/app/nutricion", cta: "Ver mi comida", audience: "completo",
      },
      {
        title: "Banana Shield y Reconstrucción Total",
        benefit: "Si usas GLP-1, Banana Shield te ayuda a que lo que bajes sea grasa y no músculo. Reconstrucción Total está pensado para recuperar fuerza y firmeza después de bajar rápido. Banana Shield viene en Entreno + Nutrición.",
        icon: "shield", href: "/app/glp1", cta: "Abrir Banana Shield", audience: "completo", image: { reto: "reconstruccion-8-semanas" },
      },
      {
        title: "Más del programa con Entreno + Nutrición",
        benefit: "Con Entreno tienes todo el entreno del programa y su consejo de comida del día en Hoy. Si quieres que el programa ajuste tus calorías y tu proteína, y Banana Shield si usas GLP-1, vienen en Entreno + Nutrición.",
        icon: "bowl", href: "/app/suscripcion", cta: "Ver planes", audience: "entreno",
      },
    ],
  },
];

// ───────────── Reglas ─────────────

/** Medianoche de Costa Rica (UTC-6, sin horario de verano) del día de la versión. */
export const releaseStart = (date: string) => Date.parse(`${date}T06:00:00.000Z`);
export const isReleaseId = (s: unknown): s is string => typeof s === "string" && NOVEDADES.some((r) => r.id === s);
/** Posición en el historial: 0 = la más nueva. -1 si no existe (id borrado o inventado). */
export const releaseIndex = (id: string | null | undefined, list: Release[] = NOVEDADES) => (id ? list.findIndex((r) => r.id === id) : -1);

export type AudienceCtx = { nutrition: boolean; plan: string; program: boolean; staff: boolean };

export function itemVisible(a: Audience | undefined, c: AudienceCtx): boolean {
  switch (a ?? "todos") {
    case "todos": return true;
    case "entreno": return !c.nutrition;
    case "completo": return c.nutrition;
    case "con-programa": return c.program;
    case "staff": return c.staff;
  }
}

/** El historial con solo los items que esta persona ve. Una versión sin items para ella no aparece. */
export function releasesFor(c: AudienceCtx, list: Release[] = NOVEDADES): Release[] {
  return list.map((r) => ({ ...r, items: r.items.filter((i) => itemVisible(i.audience, c)) })).filter((r) => r.items.length > 0);
}

export type SeenState = {
  /** Última versión vista guardada en el servidor (profiles.news_seen). */
  seenId: string | null;
  /** Cuándo la vio (profiles.news_seen_at). */
  seenAt: string | null;
  /** Creación de la cuenta: lo publicado antes no es novedad para quien llegó después. */
  createdAt: string | null;
  /** Respaldo de este dispositivo (demo o sin 0036). */
  localId?: string | null;
};

/**
 * Versiones que esta persona todavía no vio, la más nueva primero.
 *   - Si se conoce la última vista (servidor o dispositivo), todo lo que está arriba de ella en el historial.
 *   - Si no, lo publicado después de la última vez que abrió Novedades o, sin eso, después de crear su cuenta.
 *   - Sin ningún dato (demo recién abierto): todo el historial.
 */
export function unseenReleases(list: Release[], s: SeenState): Release[] {
  const known = [releaseIndex(s.seenId, NOVEDADES), releaseIndex(s.localId, NOVEDADES)].filter((i) => i >= 0);
  if (known.length) {
    const newestSeen = NOVEDADES[Math.min(...known)];
    const cut = releaseIndex(newestSeen.id, NOVEDADES);
    return list.filter((r) => releaseIndex(r.id, NOVEDADES) < cut);
  }
  const base = Date.parse(s.seenAt ?? s.createdAt ?? "");
  if (!Number.isFinite(base)) return list;
  return list.filter((r) => releaseStart(r.date) > base);
}

/** Lo que ve una persona: su historial, cuáles no vio (según el servidor) y la versión más nueva para ella. */
export function newsView(c: AudienceCtx, s: SeenState, list: Release[] = NOVEDADES) {
  const releases = releasesFor(c, list);
  const unseenIds = unseenReleases(releases, s).map((r) => r.id);
  return { releases, unseenIds, latestId: releases[0]?.id ?? null };
}

/** Equipo que ve los items `staff` (los que trabajan en el panel). */
export const NEWS_STAFF_ROLES = ["support", "admin", "superadmin"];

/** ¿Vale la pena guardar `next` como vista? Solo si es más nueva que la guardada (una pestaña vieja no la baja). */
export function isNewer(next: string, current: string | null | undefined): boolean {
  const n = releaseIndex(next);
  if (n < 0) return false;
  const c = releaseIndex(current);
  return c < 0 || n < c;
}

/** Fecha corta: "23 de octubre de 2026". */
export function releaseDay(date: string): string {
  try { return new Date(`${date}T12:00:00.000Z`).toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }); } catch { return date; }
}

/** "1 novedad" / "5 novedades". */
export const countLabel = (n: number) => `${n.toLocaleString("es-419")} ${n === 1 ? "novedad" : "novedades"}`;

// ───────────── Aviso a quien no abre la app ─────────────

/** Días después de una versión en que se avisa por push y campanita a quien no la vio. */
export const NUDGE_AFTER_DAYS = 3;
/** Pasado esto ya no se avisa (nada de avisos viejos). */
export const NUDGE_UNTIL_DAYS = 14;

/** La versión de la que toca avisar hoy (la más nueva con algo para todos), o null. */
export function nudgeRelease(now: Date, list: Release[] = NOVEDADES): Release | null {
  const r = list[0];
  if (!r || !r.items.some((i) => (i.audience ?? "todos") === "todos")) return null;
  const age = (now.getTime() - releaseStart(r.date)) / 864e5;
  return age >= NUDGE_AFTER_DAYS && age < NUDGE_UNTIL_DAYS ? r : null;
}

/** ¿Esta persona todavía no vio la versión `r`? (misma regla que el diálogo, sin el respaldo del dispositivo). */
export function needsNudge(r: Release, p: { news_seen: string | null; news_seen_at: string | null; created_at: string | null }): boolean {
  return unseenReleases([r], { seenId: p.news_seen, seenAt: p.news_seen_at, createdAt: p.created_at }).length > 0;
}

export const NUDGE_COPY = (r: Release) => ({ title: "Hay novedades en Banana Burn", body: `${r.title}. Mira qué cambió y cómo te ayuda.`, url: "/app/novedades" });
