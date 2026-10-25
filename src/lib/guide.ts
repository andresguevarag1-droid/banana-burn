// Guía de la app: el recorrido que se ve una vez al entrar a la app después de la bienvenida y que se puede volver a
// abrir desde Perfil o el menú. Es distinta de /bienvenida (que pide datos): aquí se explica cómo se usa la app.
// Todo lo de este archivo es puro (sin datos ni React) para poder probar qué capítulos ve cada plan.
// Reglas de los textos: español neutro de tú, sin emojis, sin rayas largas, sin cadenas con "·", sin urgencia falsa y
// sin hablar de inteligencia artificial (Coach Banana es "tu entrenador 24/7"). Cada frase debe ser verdad para el plan.
import { PLANS, TRIAL_DAYS, type PlanId } from "@/lib/plans";
import { money } from "@/lib/copy";
import { REMINDER_DAYS_BEFORE, type CardStep, type ChargeKind, type ChargePhase } from "@/lib/trial";

/** Sube este número cuando la guía cambie lo suficiente como para volver a mostrarla a todos (profiles.guide_version). */
export const GUIDE_VERSION = 2;

/**
 * Consejos cortos de la primera vez (profiles.guide_tips). Formato de la base: ^[a-z0-9-]{1,24}$.
 * El reproductor ya tiene su propio recorrido de la primera vez (components/workout/tour.tsx): no se repite aquí.
 */
export const TIP_KEYS = ["entrenar", "nutricion"] as const;
export type TipKey = (typeof TIP_KEYS)[number];
export const isTipKey = (k: unknown): k is TipKey => typeof k === "string" && (TIP_KEYS as readonly string[]).includes(k);

/** Variante de la guía: (a) Entreno, (b) Entreno + Nutrición, (c) prueba o beta con todo incluido. El programa Premium suma un capítulo a cualquiera. */
export type GuideVariant = "entreno" | "completo" | "prueba";

export type GuideProgram = {
  slug: string;
  title: string;
  /** Nombre del modo que toma la app ("Modo glúteo"). Null si el programa no trae experiencia (0027). */
  mode: string | null;
  welcome: string | null;
  habits: string[];
  hasTips: boolean;
  week: number;
  weeks: number;
  /** Programa en días (Pilates 30 días): en qué día va y cuántos dura. */
  day?: number | null;
  days?: number | null;
  /** Coach propia del programa (Coach Platanita). Null: Coach Banana. */
  coach?: string | null;
  cover: string;
  icon: string;
};

/** Lo que la guía necesita saber de la persona. Datos planos: viajan del layout al cliente. */
export type GuideInput = {
  /** Primer nombre para el saludo (puede venir vacío). */
  name: string;
  plan: PlanId | "free";
  nutrition: boolean;
  /** Prueba vigente: la beta (todos gratis) o la prueba de 7 días con tarjeta. */
  trial: { beta: boolean; endsAt: string; daysLeft: number } | null;
  /** Primer cobro con la tarjeta guardada (trial.ts). */
  charge: { kind: ChargeKind; phase: ChargePhase; plan: PlanId; amount: number; chargeAt: string } | null;
  cardStep: CardStep;
  program: GuideProgram | null;
};

/** Fechas ya escritas para la persona (las arma quien llama, con su zona horaria). */
export type GuideDates = {
  /** Último día gratis de la beta y primer día con cobro (betaDates() de beta-notice). */
  lastFree: string;
  firstPaid: string;
  /** Formatea una fecha ISO como "7 de noviembre". */
  day: (iso: string) => string;
};

export type GuideVisual =
  | { kind: "bienvenida" }
  | { kind: "captura"; src: string; alt: string }
  | { kind: "progresion" }
  | { kind: "hoy" }
  | { kind: "semana" }
  | { kind: "tecnica" }
  | { kind: "programa" }
  | { kind: "mejora" }
  | { kind: "recetas" }
  | { kind: "programas" }
  | { kind: "shield"; included: boolean }
  | { kind: "coach" }
  | { kind: "final" };

export type GuideStepId = "inicio" | "hoy" | "plan" | "reproductor" | "progresion" | "tecnica" | "programa" | "programas" | "retos" | "nutricion" | "recetas" | "shield" | "coach" | "comunidad" | "progreso" | "final";

export type GuideStep = {
  id: GuideStepId;
  /** Capítulo (va arriba del título). */
  chapter: string;
  title: string;
  body: string;
  bullets: string[];
  /** "Probar ahora": lleva a la pantalla y cierra la guía. */
  cta: { href: string; label: string } | null;
  visual: GuideVisual;
  /** Nota pequeña al pie (precios, condiciones). */
  note?: string;
};

export function guideVariant(i: Pick<GuideInput, "plan" | "trial" | "nutrition">): GuideVariant {
  if (i.plan === "free" && i.trial) return "prueba";
  return i.nutrition ? "completo" : "entreno";
}

const ENTRENO = PLANS.find((p) => p.id === "entreno")!;
const COMPLETO = PLANS.find((p) => p.id === "completo")!;
const planName = (p: PlanId) => PLANS.find((x) => x.id === p)!.name;

/** Lo que pasa cuando termina la prueba, con las reglas de la tarjeta (0026). Honesto y con la fecha exacta. */
export function afterTrialLines(i: Pick<GuideInput, "trial" | "charge" | "cardStep">, d: GuideDates): { body: string; bullets: string[] } {
  const c = i.charge;
  const prices = `${ENTRENO.name} cuesta ${money(ENTRENO.price.mes)} al mes y ${COMPLETO.name}, ${money(COMPLETO.price.mes)} al mes.`;
  const keep = "Tu progreso, tus entrenos y tus datos quedan guardados pase lo que pase.";
  const choose = `Si eliges ${ENTRENO.name}, la nutrición y Banana Shield quedan fuera al terminar la prueba.`;
  if (i.trial?.beta) {
    const body = `Eres de los primeros en Banana Burn: tienes todo incluido y gratis hasta el ${d.lastFree}. Desde el ${d.firstPaid} se cobran los planes.`;
    if (c && c.kind === "beta" && c.phase === "programado") return { body, bullets: [`Ya guardaste tu tarjeta: el ${d.day(c.chargeAt)} se cobra ${planName(c.plan)} por ${money(c.amount)}, salvo que canceles antes en Mi plan.`, `Te avisamos ${REMINDER_DAYS_BEFORE} días antes del cobro.`, choose, keep] };
    if (c && c.phase === "cancelado") return { body, bullets: ["Cancelaste tu plan: no se te cobrará.", `Desde el ${d.firstPaid} verás la pantalla de planes hasta que elijas uno.`, keep] };
    return { body, bullets: [`Si dejas tu tarjeta lista antes del ${d.firstPaid}, hoy no se cobra nada y ese día se cobra tu primer mes con 50 % de descuento (plan mensual), salvo que canceles antes.`, `Si no la agregas, desde el ${d.firstPaid} verás la pantalla de planes hasta que pagues. No hay días gratis extra.`, prices, keep] };
  }
  const end = i.trial ? d.day(i.trial.endsAt) : null;
  const body = end ? `Tu prueba gratis de ${TRIAL_DAYS} días tiene todo incluido y termina el ${end}.` : `Tu prueba gratis de ${TRIAL_DAYS} días tiene todo incluido.`;
  if (c && c.phase === "cancelado") return { body, bullets: ["Cancelaste tu plan: no se te cobrará.", "Al terminar la prueba verás la pantalla de planes hasta que elijas uno.", keep] };
  if (c && c.phase === "programado") return { body, bullets: [`El ${d.day(c.chargeAt)} se cobra ${planName(c.plan)} por ${money(c.amount)}, salvo que canceles antes en Mi plan, sin costo.`, `Te avisamos ${REMINDER_DAYS_BEFORE} días antes del cobro.`, choose, keep] };
  return { body, bullets: ["Tu prueba no pide tarjeta. Si la dejas lista en Mi plan antes de que termine, tu primer mes cuesta 50 % menos (plan mensual).", "Si no la dejas, al terminar verás la pantalla de planes hasta que elijas uno.", prices, keep] };
}

/**
 * Pasos de la guía para esta persona, en orden. Cambian con el plan:
 *   - Entreno: sin capítulos de comida; un solo paso honesto con lo que suma Entreno + Nutrición y su precio.
 *   - Entreno + Nutrición y prueba: nutrición completa (calorías, registro, recetas, Menú flash y Banana Shield).
 *   - Prueba o beta: al final, qué pasa cuando termina (reglas de la tarjeta).
 *   - Programa Premium activo: un capítulo con su modo, hábitos y consejos.
 */
export function guideSteps(i: GuideInput, d: GuideDates, opts: { short?: boolean } = {}): GuideStep[] {
  const variant = guideVariant(i);
  if (opts.short) return shortSteps(i, d);
  const nutri = i.nutrition;
  const first = i.name.trim().split(/\s+/)[0] ?? "";
  const hi = first ? `Hola, ${first}` : "Hola";
  const p = i.program;
  const steps: GuideStep[] = [];

  steps.push({
    id: "inicio", chapter: "Bienvenida", title: `${hi}. Soy Coach Banana, tu entrenador personal en el celular`,
    body: variant === "entreno" ? `Tienes el plan ${ENTRENO.name}: tu rutina, el reproductor con técnica, progreso, comunidad, retos y yo para tus dudas de entreno.`
      : variant === "completo" ? `Tienes ${COMPLETO.name}: tu entreno y tu comida trabajan juntos para que lo que bajes sea grasa y no músculo.`
      : "Durante tu prueba tienes todo incluido: entreno, nutrición, Banana Shield, comunidad y retos. Al final te cuento qué pasa cuando termina.",
    bullets: ["Te muestro lo más importante en un par de minutos.", "Puedes saltar la guía y volver a verla cuando quieras desde Perfil."],
    cta: null, visual: { kind: "bienvenida" },
  });

  steps.push({
    id: "hoy", chapter: "Cómo funciona la app", title: "Todo empieza en Hoy",
    body: "Cada vez que abras la app llegas a Hoy: tu entreno del día, tus números y tus retos en una sola pantalla.",
    bullets: [
      p ? "Con tu programa activo, Hoy te muestra la sesión que te toca." : "Toca Empezar y entrena lo que te toca hoy.",
      nutri ? "Registra calorías, proteína, agua, pasos y sueño con un toque." : "Registra agua, pasos y sueño con un toque.",
      "Pésate al despertar y tu curva de peso se arma sola.",
      "Tu racha sube cada día que entrenas o registras algo.",
    ],
    // La captura de Hoy muestra calorías: solo para quien tiene nutrición. En Entreno, la pieza armada sin comida.
    cta: { href: "/app", label: "Ir a Hoy" }, visual: nutri ? { kind: "captura", src: "/landing/hoy2.png", alt: "Pantalla Hoy con tus números del día" } : { kind: "hoy" },
  });

  steps.push({
    id: "plan", chapter: "Tu entrenamiento", title: "Una rutina hecha a tu medida",
    body: "Tu plan sale de tu nivel, tus días y tu equipo. Va en bloques de 6 semanas y la última es de descarga para que te recuperes.",
    bullets: [
      p ? `Mientras dure ${p.title}, tus sesiones salen del programa.` : "Haz el día que te toca. Si se te pasa uno, hazlo mañana y sigue el orden.",
      "¿Entrenas en casa? Cambia tu equipo en Perfil y los ejercicios se adaptan.",
      "Si una máquina está ocupada, cambia el ejercicio por una alternativa.",
    ],
    cta: { href: "/app/entrenar", label: "Ver mi semana" }, visual: { kind: "semana" },
  });

  steps.push({
    id: "reproductor", chapter: "Cómo entrenar", title: "Series, reps y peso, sin adivinar",
    body: "El reproductor te dice cuántas series, cuántas repeticiones y con cuánto peso. Al terminar cada serie anotas lo que hiciste y corre el descanso.",
    bullets: [
      "El rango, por ejemplo 8-12, es tu meta de repeticiones.",
      "El temporizador de descanso te avisa cuándo seguir.",
      "¿Máquina ocupada o algo te molesta? Toca Cambiar ejercicio.",
    ],
    cta: { href: "/app/entreno", label: "Abrir el entreno de hoy" }, visual: { kind: "captura", src: "/landing/entreno.png", alt: "Reproductor con la serie, el peso y las repeticiones" },
  });

  steps.push({
    id: "progresion", chapter: "Cómo entrenar", title: "Cuando ya puedes más, el peso sube",
    body: "Se llama doble progresión: primero subes repeticiones y, cuando completas el rango, subes el peso. La app lo calcula sola con tu historial.",
    bullets: [
      "Llegas al tope del rango en todas las series: la próxima vez sube el peso y vuelves al mínimo.",
      "Si dos sesiones salen flojas, el peso baja un poco para que retomes con buena técnica.",
      "Anota siempre lo que hiciste de verdad: así el ajuste es justo.",
    ],
    cta: { href: "/app/progreso", label: "Ver mi fuerza" }, visual: { kind: "progresion" },
  });

  steps.push({
    id: "tecnica", chapter: "Cómo entrenar", title: "Mira cómo se hace cada ejercicio",
    body: "Cada ejercicio trae una animación del movimiento con el músculo que trabaja y las claves de técnica. Baja lento: unos 3 segundos.",
    bullets: [
      `Más de ${(1300).toLocaleString("es-419")} ejercicios en la biblioteca, con pasos en español.`,
      "¿Te estás quedando sin tiempo? Entrenos exprés de 10, 20 o 30 minutos sin equipo, en un espacio de 2 × 2 m.",
    ],
    cta: { href: "/app/entreno?expres=10", label: "Probar un exprés de 10 min" }, visual: { kind: "tecnica" },
  });

  if (p) {
    steps.push({
      id: "programa", chapter: "Tu programa", title: `Tu app cambia con ${p.title}`,
      body: p.welcome ?? "Mientras dura tu programa, tu entreno, tus metas y tus consejos salen de él.",
      bullets: [
        `${p.day && p.days ? `Vas en el día ${p.day} de ${p.days}` : `Vas en la semana ${p.week} de ${p.weeks}`}. Las sesiones del programa reemplazan tu rutina en Hoy y Entrenar.`,
        ...(p.coach ? [`${p.coach} te acompaña mientras dura: te da la bienvenida, te enseña cada ejercicio y responde tus preguntas en el chat.`] : []),
        ...(p.habits.length ? [`Tus hábitos de cada día: ${listEs(p.habits.map((h) => h.toLowerCase()))}.`] : []),
        ...(p.hasTips ? [p.coach ? `Cada semana ${p.coach} te deja un consejo nuevo del programa.` : "Cada semana te dejo un consejo nuevo del programa."] : []),
        "La app toma los colores y la portada del programa mientras dura.",
      ],
      cta: { href: `/app/retos/${p.slug}/progreso`, label: "Ver mi programa" }, visual: { kind: "programa" },
    });
  }

  // Programas Premium: lo que de verdad cambia en la app mientras dura uno (layout: franja del programa; Hoy: ProgramHero
  // y ProgramHabits; Nutrición: "Cómo comer en..."; coach: consejo por semana; al cerrar: certificado y poder del perfil).
  steps.push({
    id: "programas", chapter: "Programas Premium", title: "Un programa Premium transforma toda tu app",
    body: "Cada programa tiene un objetivo claro, como glúteo, abdomen o tu primera dominada. Se compra aparte con un pago único, en cualquier plan, y mientras dura la app entera trabaja para ese objetivo.",
    bullets: [
      "Toma su color: una franja del programa arriba en cada pantalla y un nombre de modo, como Modo glúteo.",
      "Hoy te muestra la sesión del programa, con entrenos enfocados en su objetivo, por fases y con semana de descarga.",
      "Hasta 4 hábitos diarios propios y un consejo nuevo de tu coach cada semana.",
      nutri ? "Tu comida también se ajusta al programa: proteína y calorías para su objetivo." : `Con ${COMPLETO.name}, tu comida también se ajusta al programa.`,
      "Al terminar recibes su certificado y tu perfil gana poder.",
    ],
    cta: { href: "/app/retos", label: "Ver los programas" }, visual: { kind: "programas" },
  });

  steps.push({
    id: "retos", chapter: "Retos gratis", title: "Retos gratis, XP y racha",
    body: "Los retos gratis son un hábito diario de 7 a 15 días: agua, pasos, movilidad y menos azúcar. Se suman a tu rutina sin cambiarla y puedes hacerlos junto con un programa.",
    bullets: [
      "Cada entreno y cada registro suman XP. Subir de nivel te da descuento en los programas Premium.",
      "La racha cuenta los días seguidos en que entrenas o registras algo.",
      "Cada reto completado te deja su medalla.",
    ],
    cta: { href: "/app/retos", label: "Ver retos gratis" }, visual: { kind: "captura", src: "/landing/retos.png", alt: "Tienda de retos y programas" },
  });

  if (nutri) {
    steps.push({
      id: "nutricion", chapter: "Nutrición", title: "Tu comida, con números claros",
      body: "Calculamos tus calorías y macros para tu meta, y se ajustan cada semana según tu peso real.",
      bullets: [
        "Registra con comida de toda Latinoamérica: gallo pinto, arepas, tortillas, tamales y más.",
        "Arma tu plato o guarda Mis recetas para registrar en un toque.",
        "Proteína en cada comida: es lo que protege tu músculo mientras bajas.",
      ],
      cta: { href: "/app/nutricion", label: "Registrar mi comida" }, visual: { kind: "captura", src: "/landing/nutricion.png", alt: "Pantalla de nutrición con calorías y macros" },
      ...(variant === "prueba" ? { note: `Incluido en tu prueba. Después, solo en ${COMPLETO.name}.` } : {}),
    });
    steps.push({
      id: "recetas", chapter: "Nutrición", title: "Recetas latinas y Menú flash",
      body: "¿No sabes qué comer? Menú flash arma tu comida con lo que te falta hoy, con recetas latinas fáciles.",
      bullets: [
        "Recetas con calorías y proteína por porción.",
        "Guarda tus propias recetas en Mis recetas y regístralas en un toque.",
      ],
      cta: { href: "/app/nutricion/recetas", label: "Ver recetas" }, visual: { kind: "recetas" },
      ...(variant === "prueba" ? { note: `Incluido en tu prueba. Después, solo en ${COMPLETO.name}.` } : {}),
    });
  } else {
    const extra = Math.round((COMPLETO.price.mes - ENTRENO.price.mes) * 100) / 100;
    steps.push({
      id: "nutricion", chapter: "Nutrición", title: `Lo que suma ${COMPLETO.name}`,
      body: `Tu plan ${ENTRENO.name} no incluye nutrición. Tu entreno funciona igual; si algún día quieres sumar la comida, esto es lo que agrega:`,
      bullets: [
        "Calorías y macros calculados para ti, con ajuste cada semana según tu peso real.",
        "Registro de comidas latinas, Mis recetas y Armar plato.",
        "Recetas y Menú flash con lo que te falta hoy.",
        "Banana Shield para personas en GLP-1.",
      ],
      note: `Cuesta ${money(COMPLETO.price.mes)} al mes (${money(extra)} más que ${ENTRENO.name}) o ${money(COMPLETO.price.anual)} al año. Puedes cambiar de plan cuando quieras.`,
      cta: { href: "/app/suscripcion", label: "Ver planes" }, visual: { kind: "mejora" },
    });
  }

  // Banana Shield: uno de los diferenciadores. Completo y prueba: el capítulo entero. Entreno: qué es y que viene con
  // Entreno + Nutrición, sin dar a entender que ya lo tiene. Siempre con lenguaje médico prudente (sin dosis).
  if (nutri) {
    steps.push({
      id: "shield", chapter: "Banana Shield", title: "Banana Shield: si usas GLP-1, protege tu músculo",
      body: "El medicamento te ayuda a comer menos. Banana Shield se asegura de que lo que bajes sea grasa y no músculo, con un plan pensado para el tratamiento.",
      bullets: [
        "Proteína primero: una meta diaria de proteína y un piso de calorías para no comer de menos.",
        "Sabe qué día te inyectas: ese día y el siguiente te sugiere un entreno más suave.",
        "Consejos de comida para las molestias comunes: náuseas, estreñimiento y diarrea.",
        "Te muestra cuánto de lo que bajas es grasa y si tu fuerza se mantiene.",
        "Actívalo en Perfil, en la sección Banana Shield, con tu medicamento y tu día de inyección.",
      ],
      note: variant === "prueba"
        ? `Incluido en tu prueba. Después, solo en ${COMPLETO.name}. No da indicaciones de dosis ni reemplaza a tu médico: consulta con tu médico cualquier cambio.`
        : "No da indicaciones de dosis ni reemplaza a tu médico: consulta con tu médico cualquier cambio en tu tratamiento.",
      cta: { href: "/app/glp1", label: "Abrir Banana Shield" }, visual: { kind: "shield", included: true },
    });
  } else {
    steps.push({
      id: "shield", chapter: "Banana Shield", title: "¿Usas GLP-1? Conoce Banana Shield",
      body: `Si usas un medicamento GLP-1, como semaglutida o tirzepatida, Banana Shield cuida que lo que bajes sea grasa y no músculo. Tu plan ${ENTRENO.name} no lo incluye: viene con ${COMPLETO.name}.`,
      bullets: [
        "Metas de proteína primero y un piso de calorías para no comer de menos.",
        "Un plan que sabe qué día te inyectas y te sugiere un entreno más suave ese día y el siguiente.",
        "Consejos de comida para las náuseas, el estreñimiento y la diarrea.",
        "Seguimiento de cuánto de lo que bajas es grasa y de tu fuerza.",
      ],
      note: `${COMPLETO.name} cuesta ${money(COMPLETO.price.mes)} al mes o ${money(COMPLETO.price.anual)} al año. Banana Shield no da indicaciones de dosis ni reemplaza a tu médico.`,
      cta: { href: "/app/suscripcion", label: "Ver planes" }, visual: { kind: "shield", included: false },
    });
  }

  steps.push({
    id: "coach", chapter: "Coach Banana", title: "Tu entrenador 24/7",
    body: nutri ? "Pregúntame lo que quieras de tu entreno y de tu comida: cómo hacer un ejercicio, qué pedir si comes fuera o cómo llegar a tu proteína."
      : "Pregúntame lo que quieras de tu entreno: cómo hacer un ejercicio, qué cambiar si algo te molesta o cómo seguir si faltaste.",
    bullets: [
      "Conozco tu plan, tus cargas y tu progreso, así que respondo para ti.",
      p ? `Mientras dure ${p.title}, mis respuestas se enfocan en tu programa.` : "Me encuentras en el menú, siempre a un toque.",
    ],
    cta: { href: "/app/coach", label: "Hablar con Coach Banana" }, visual: { kind: "coach" },
  });

  steps.push({
    id: "comunidad", chapter: "Comunidad", title: "No entrenas sin compañía",
    body: "Comparte tus entrenos, sigue a otras personas y suma apoyo. Tú decides quién ve tu perfil.",
    bullets: ["Ranking de la semana para motivarte.", "Cambia tu privacidad cuando quieras en Perfil."],
    cta: { href: "/app/comunidad", label: "Ver la comunidad" }, visual: { kind: "captura", src: "/landing/comunidad.png", alt: "Pantalla de la comunidad" },
  });

  steps.push({
    id: "progreso", chapter: "Progreso", title: "Mira cómo cambia tu cuerpo",
    body: "La báscula no lo cuenta todo. Con medidas, fotos y tu fuerza ves si estás bajando grasa y cuidando tu músculo.",
    bullets: ["Pésate al despertar, después del baño y antes de comer.", "Toma medidas y fotos cada 2 semanas, con la misma luz.", "Tu fuerza estimada se calcula sola con tus entrenos."],
    cta: { href: "/app/progreso", label: "Ver mi progreso" }, visual: { kind: "captura", src: "/landing/progreso.png", alt: "Pantalla de progreso con la curva de peso" },
  });

  if (variant === "prueba") {
    const after = afterTrialLines(i, d);
    steps.push({ id: "final", chapter: "Tu prueba", title: "Qué pasa cuando termina tu prueba", body: after.body, bullets: after.bullets, cta: { href: "/app/suscripcion", label: "Ver mi plan" }, visual: { kind: "final" } });
  } else {
    steps.push({
      id: "final", chapter: "Listo", title: "Ya sabes lo esencial. A entrenar",
      body: `Tu plan es ${planName(variant === "completo" ? "completo" : "entreno")}. Puedes volver a ver esta guía cuando quieras desde Perfil o desde el menú.`,
      bullets: ["Empieza hoy con lo que te toca, aunque sea un exprés de 10 minutos.", "La constancia le gana a la perfección."],
      cta: { href: "/app/entreno", label: "Empezar mi entreno" }, visual: { kind: "final" },
    });
  }
  return steps;
}

/**
 * Versión corta que se abre sola la primera vez (v2): 4 pantallas y a hacer. Antes eran 16 diapositivas seguidas y la
 * gente llegaba a Hoy sin saber qué tocar. Lo demás se aprende haciendo: "Tus primeros pasos" en Hoy, el recorrido
 * guiado de cada pantalla y el minicurso "Aprende a entrenar". La guía completa se sigue abriendo desde el menú y Perfil.
 */
export function shortSteps(i: GuideInput, d: GuideDates): GuideStep[] {
  const first = i.name.trim().split(/\s+/)[0] ?? "";
  const hi = first ? `Hola, ${first}` : "Hola";
  const steps: GuideStep[] = [
    {
      id: "inicio", chapter: "Bienvenida", title: `${hi}. Soy Coach Banana, tu entrenador`,
      body: "Voy a decirte qué ejercicios hacer, cuántas veces y con cuánto peso. Tú solo sigues los pasos y anotas lo que hiciste.",
      bullets: ["Esto toma un minuto.", "Después te enseño la app mientras la usas."],
      cta: null, visual: { kind: "bienvenida" },
    },
    {
      id: "hoy", chapter: "Así funciona", title: "Así funciona, en 4 pasos",
      body: "Cada semana repites lo mismo. Es simple:",
      bullets: [
        "1. Abre Hoy y mira qué entrenamiento te toca.",
        "2. Toca Empezar. La app te guía ejercicio por ejercicio.",
        "3. Al terminar cada serie, anota lo que hiciste.",
        "4. Cuando ya puedes más, la app te sube el peso sola.",
      ],
      cta: null, visual: { kind: "semana" },
    },
    {
      id: "coach", chapter: "Te enseño haciendo", title: "Aprende mientras la usas",
      body: "En Hoy vas a ver Tus primeros pasos: una lista corta que te enseña a usar la app, un toque a la vez.",
      bullets: [
        "Cada pantalla tiene un botón ¿Cómo se usa? que te la explica.",
        "¿Nunca has entrenado? El minicurso Aprende a entrenar te explica todo desde cero, en lecciones de 30 segundos.",
        `${i.nutrition ? "¿Dudas de tu entreno o tu comida?" : "¿Dudas de tu entreno?"} Pregúntame en el chat cuando quieras.`,
      ],
      cta: { href: "/app/aprende", label: "Ver el minicurso" }, visual: { kind: "coach" },
    },
  ];
  if (guideVariant(i) === "prueba") {
    const after = afterTrialLines(i, d);
    steps.push({ id: "final", chapter: "Tu prueba", title: "Qué pasa cuando termina tu prueba", body: after.body, bullets: after.bullets, cta: null, visual: { kind: "final" } });
  } else {
    steps.push({ id: "final", chapter: "Listo", title: "Empieza por tus primeros pasos", body: "Están arriba en Hoy. El primero toma menos de un minuto.", bullets: ["La constancia le gana a la perfección."], cta: null, visual: { kind: "final" } });
  }
  return steps;
}

/** "a, b y c". */
export function listEs(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}

/** ¿Se abre sola? Solo si nunca vio esta versión (en el servidor o en este dispositivo) y no hay otra pantalla encima. */
export function shouldAutoOpen(x: { seenVersion: number | null; localVersion: number | null; locked: boolean; busy: boolean; path: string }): boolean {
  if (x.locked || x.busy || x.path !== "/app") return false;
  const seen = Math.max(x.seenVersion ?? 0, x.localVersion ?? 0);
  return seen < GUIDE_VERSION;
}

/** Variante de prueba solo para el modo demo: /app?guia=entreno|completo|prueba|programa. */
export const DEMO_GUIDE_VARIANTS = ["entreno", "completo", "prueba", "programa"] as const;
export type DemoGuideVariant = (typeof DEMO_GUIDE_VARIANTS)[number];

export function demoGuideInput(base: GuideInput, v: string | null): GuideInput | null {
  if (!(DEMO_GUIDE_VARIANTS as readonly string[]).includes(v ?? "")) return null;
  const now = Date.now();
  switch (v as DemoGuideVariant) {
    case "entreno": return { ...base, plan: "entreno", nutrition: false, trial: null, charge: null, cardStep: "none", program: null };
    case "completo": return { ...base, plan: "completo", nutrition: true, trial: null, charge: null, cardStep: "none", program: null };
    case "prueba": return { ...base, plan: "free", nutrition: true, trial: base.trial ?? { beta: false, endsAt: new Date(now + 5 * 864e5).toISOString(), daysLeft: 5 }, program: null };
    case "programa": return { ...base, plan: "completo", nutrition: true, trial: null, charge: null, cardStep: "none" };
  }
}
