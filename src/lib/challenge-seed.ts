// Catálogo inicial de la tienda de retos. FUENTE de la siembra de 0018_tienda_retos.sql (lo verifica challenge-seed.test.ts)
// y respaldo cuando la base no tiene la migración (o en modo demo). En producción el admin edita todo desde /admin/retos.
// Cada reto trae su plan día a día. Nada de promesas exageradas: los textos describen lo que haces, no resultados garantizados.

export type Verify = "manual" | "workout" | "steps" | "protein" | "water";
export type TaskType = "reps" | "tiempo" | "pasos" | "entreno" | "habito" | "nutricion" | "descanso";
export type DayTask = { t: string; type: TaskType; target?: number };
export type Difficulty = "facil" | "media" | "dificil";
export type CoverStyle = "banana" | "ember" | "sky" | "peel" | "noche" | "selva";
export type ChallengeStatus = "borrador" | "publicado" | "oculto" | "archivado";

export type SeedChallenge = {
  slug: string; title: string; description: string; days: number; verify: Verify; icon: string; cover: CoverStyle;
  difficulty: Difficulty; minutes: number; grace: number; xp: number; stepsGoal?: number;
  badge: string; rewardTitle: string | null; priceUsd: number; featured: boolean;
  startMode: "libre" | "fecha"; startDate: string | null; comingSoon: boolean; safetyNote: string | null; sort: number;
  plan: DayTask[];
};

const nf = (n: number) => n.toLocaleString("es-419");
const secs = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}` : `${s} s`);
const lerp = (a: number, b: number, i: number, n: number) => Math.round(a + (b - a) * (n <= 1 ? 1 : i / (n - 1)));
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

// ───────────── Planes ─────────────

function banana30(): DayTask[] {
  const tips = [
    "Completa tu rutina de hoy (o un exprés de 10 min si vas con prisa)",
    "Completa cualquier entreno; si estás cansado, usa el modo suave",
    "Entrena hoy: aunque sea un exprés de 10 min cuenta",
  ];
  return range(30).map((i) => ({ t: tips[i % tips.length], type: "entreno" as const }));
}

function flexiones30(): DayTask[] {
  return range(30).map((i) => { const n = Math.round(10 + i * (90 / 29)); return { t: `${n} flexiones en total hoy (en las series que quieras)`, type: "reps" as const, target: n }; });
}

function plancha30(): DayTask[] {
  return range(30).map((i) => { const s = Math.round(20 + i * (160 / 29)); return { t: `Plancha total de ${secs(s)} (puedes partirla)`, type: "tiempo" as const, target: s }; });
}

function pasos(days: number, goal: number): DayTask[] {
  const tips = ["Camina después de comer: 10 min suman unos 1.000 pasos", "Usa escaleras en vez de ascensor", "Haz una llamada caminando", "Bájate una parada antes o estaciona más lejos", "Sal a caminar 20 min con música o un pódcast", "Camina mientras esperas el café o la comida", "Haz dos vueltas extra al súper o al parque"];
  return range(days).map((i) => ({ t: `Llega a ${nf(goal)} pasos. Idea de hoy: ${tips[i % tips.length].toLowerCase()}`, type: "pasos" as const, target: goal }));
}

function proteina21(): DayTask[] {
  const ideas = ["huevos o claras en el desayuno", "pechuga, atún o pescado en el almuerzo", "yogur griego como merienda", "frijoles con queso bajo en grasa", "un batido de proteína si no llegas", "carne magra o cerdo sin grasa en la cena", "requesón o queso cottage con fruta"];
  return range(21).map((i) => ({ t: `Llega a tu meta de proteína. Idea de hoy: ${ideas[i % ideas.length]}`, type: "nutricion" as const }));
}

function agua21(): DayTask[] {
  const ideas = ["un vaso al despertar", "una botella en el escritorio", "un vaso antes de cada comida", "agua con limón o pepino si te aburre", "un vaso al llegar del gym", "una alarma cada 2 horas", "un vaso antes de dormir"];
  return range(21).map((i) => ({ t: `Toma 8 vasos de agua. Truco: ${ideas[i % ideas.length]}`, type: "habito" as const, target: 8 }));
}

/** 21 días de abdomen: circuito que sube de volumen cada semana, con un día suave cada 7. */
function abdomen21(): DayTask[] {
  return range(21).map((i) => {
    const day = i + 1, wk = Math.floor(i / 7);
    if (day === 21) return { t: "Día final: 4 rondas del circuito completo y anota cuántos crunches seguidos haces ahora", type: "reps" as const, target: 4 };
    if (day % 7 === 0) return { t: "Día suave: 5 min de respiración diafragmática y 2 planchas de 30 s", type: "descanso" as const };
    const rounds = 2 + wk, crunch = 12 + wk * 4 + (i % 7), plank = 25 + wk * 10 + (i % 7) * 2, legs = 8 + wk * 3;
    return { t: `${rounds} rondas: ${crunch} crunches, ${legs} elevaciones de piernas, ${plank} s de plancha y 10 bichos muertos por lado`, type: "reps" as const, target: crunch };
  });
}

/** Glúteos de acero 30 días: 4 bloques que alternan fuerza y bombeo, con descanso activo cada 6 días. */
function gluteos30(): DayTask[] {
  const blocks = [
    (r: number) => `${r} puentes de glúteo, ${r} sentadillas y 10 zancadas por pierna, 3 rondas`,
    (r: number) => `${r} patadas de glúteo por pierna, ${r} sentadillas sumo y 30 s de puente sostenido, 3 rondas`,
    (r: number) => `${r} hip thrust en el piso o sofá, ${Math.round(r * 0.6)} zancadas reversas por pierna y 20 abducciones por lado, 3 rondas`,
  ];
  return range(30).map((i) => {
    const day = i + 1;
    if (day % 6 === 0) return { t: "Descanso activo: camina 20 min y estira cadera y glúteos 5 min", type: "descanso" as const };
    const reps = lerp(12, 25, i, 30);
    return { t: blocks[i % 3](reps), type: "reps" as const, target: reps };
  });
}

/**
 * Pierde 3 kg en 6 semanas: 0,5 kg por semana, un ritmo seguro con déficit moderado.
 * Semana tipo: 3 días de fuerza, 2 de caminata larga, 1 de intervalos suaves y 1 de descanso.
 */
function pierde3kg(): DayTask[] {
  const week = [
    { t: "Entreno de fuerza de tu rutina y llega a tu proteína", type: "entreno" as const },
    { t: "Caminata de 40 min a paso rápido y cena con media porción de carbohidrato", type: "pasos" as const },
    { t: "Entreno de fuerza de tu rutina y registra todas tus comidas", type: "entreno" as const },
    { t: "Intervalos suaves: 10 x (1 min rápido, 1 min lento) caminando o en bici", type: "entreno" as const },
    { t: "Entreno de fuerza de tu rutina y 2 litros de agua", type: "entreno" as const },
    { t: "Caminata de 50 min o actividad que disfrutes (bailar, nadar, bici)", type: "pasos" as const },
    { t: "Descanso: pésate al despertar, revisa la semana y planea tus comidas", type: "descanso" as const },
  ];
  return range(42).map((i) => ({ ...week[i % 7], t: i >= 35 && i % 7 === 6 ? "Último día: pésate, toma tus medidas y compara con el día 1" : week[i % 7].t }));
}

function sinAzucar7(): DayTask[] {
  return [
    { t: "Saca de casa o del escritorio los dulces y bebidas azucaradas", type: "habito" },
    { t: "Cero refrescos y jugos: agua, café o té sin azúcar", type: "habito" },
    { t: "Lee la etiqueta de 3 productos que comes seguido y busca azúcar añadida", type: "habito" },
    { t: "Postre: fruta entera o yogur natural con canela", type: "nutricion" },
    { t: "Café o té sin azúcar todo el día (puedes usar canela o vainilla)", type: "habito" },
    { t: "Prepara una merienda con proteína para no llegar con hambre a la tarde", type: "nutricion" },
    { t: "Día 7: anota cómo cambió tu energía y tu antojo de dulce", type: "habito" },
  ];
}

/** Dominadas desde cero: colgadas, remo invertido, negativas y asistidas. 4 semanas, descanso cada 3er día. */
function dominadas28(): DayTask[] {
  return range(28).map((i) => {
    const day = i + 1, wk = Math.floor(i / 7);
    if (day % 3 === 0) return { t: "Descanso: movilidad de hombros 5 min (círculos y estiramiento de dorsales)", type: "descanso" as const };
    if (wk === 0) { const s = 10 + i * 2; return { t: `4 colgadas de ${s} s en barra y 3 x 8 remos invertidos bajo una mesa`, type: "tiempo" as const, target: s }; }
    if (wk === 1) { const r = 3 + (i % 7 > 3 ? 1 : 0); return { t: `${r} x 3 dominadas negativas (bajar en 5 s) y 3 x 10 remos invertidos`, type: "reps" as const, target: r * 3 }; }
    if (wk === 2) { const r = 4 + (i % 7 > 3 ? 1 : 0); return { t: `${r} x 4 negativas de 5 s, 3 x 5 dominadas con banda o con pie de apoyo`, type: "reps" as const, target: r * 4 }; }
    return { t: day === 28 ? "Prueba final: tu máximo de dominadas estrictas (o negativas controladas). Anótalo" : `5 intentos de dominada estricta, 3 x 5 asistidas y 3 x 4 negativas`, type: "reps" as const, target: 5 };
  });
}

/** Sprint de verano: 4 semanas con fuerza, intervalos y pasos. Empieza en fecha fija para hacerlo en grupo. */
function sprint28(): DayTask[] {
  const week = [
    { t: "Fuerza tren inferior de tu rutina y 8.000 pasos", type: "entreno" as const },
    { t: "Intervalos: 8 x 30 s fuerte, 60 s suave (correr, bici o saltar cuerda)", type: "entreno" as const },
    { t: "Fuerza tren superior de tu rutina y 8.000 pasos", type: "entreno" as const },
    { t: "Caminata larga de 45 min o 10.000 pasos", type: "pasos" as const },
    { t: "Circuito de cuerpo completo: 4 rondas de 10 sentadillas, 10 flexiones, 10 zancadas y 30 s de plancha", type: "entreno" as const },
    { t: "Actividad libre al aire libre de 30 min", type: "habito" as const },
    { t: "Descanso: estira 10 min y prepara tus comidas de la semana", type: "descanso" as const },
  ];
  return range(28).map((i) => ({ ...week[i % 7], t: week[i % 7].t.replace("8 x 30", `${8 + Math.floor(i / 7)} x 30`) }));
}

function movilidad14(): DayTask[] {
  const focus = ["cadera", "hombros", "columna", "tobillos", "isquiotibiales", "pecho y espalda alta", "cuerpo completo"];
  return range(14).map((i) => ({ t: `10 min de movilidad de ${focus[i % 7]} (sigue la rutina guiada en Ejercicios)`, type: "tiempo" as const, target: 600 }));
}

// ───────────── Catálogo ─────────────

const base = { rewardTitle: null, featured: false, startMode: "libre" as const, startDate: null, comingSoon: false, safetyNote: null };

export const SEED: SeedChallenge[] = [
  { ...base, slug: "banana-30", title: "30 días Banana", days: 30, verify: "workout", icon: "banana", cover: "banana", difficulty: "media", minutes: 20, grace: 3, xp: 400, priceUsd: 0, sort: 10, featured: true,
    description: "Entrena 30 días: tu rutina, modo suave o un exprés de 10 min. Tienes 3 comodines por si un día no puedes.", badge: "Banana constante", rewardTitle: "Constante", plan: banana30() },
  { ...base, slug: "flexiones-30", title: "Reto de flexiones", days: 30, verify: "manual", icon: "barbell", cover: "ember", difficulty: "media", minutes: 10, grace: 3, xp: 300, priceUsd: 0, sort: 20,
    description: "De 10 a 100 flexiones al día en 30 días. Divídelas en las series que necesites.", badge: "Pecho de acero", plan: flexiones30() },
  { ...base, slug: "plancha-30", title: "Plancha de acero", days: 30, verify: "manual", icon: "shield", cover: "sky", difficulty: "media", minutes: 5, grace: 3, xp: 300, priceUsd: 0, sort: 30,
    description: "De 20 segundos a 3 minutos de plancha. Core de acero en un mes.", badge: "Core de acero", plan: plancha30() },
  { ...base, slug: "pasos-30", title: "10.000 pasos", days: 30, verify: "steps", icon: "sneaker", cover: "peel", difficulty: "facil", minutes: 60, grace: 3, xp: 300, stepsGoal: 10000, priceUsd: 0, sort: 40,
    description: "30 días caminando 10.000 pasos. La forma más fácil de sumar actividad todos los días.", badge: "Caminante", plan: pasos(30, 10000) },
  { ...base, slug: "proteina-21", title: "Proteína perfecta", days: 21, verify: "protein", icon: "egg", cover: "ember", difficulty: "facil", minutes: 5, grace: 2, xp: 250, priceUsd: 0, sort: 50,
    description: "21 días llegando a tu meta de proteína. El hábito que protege tu músculo mientras bajas de grasa.", badge: "Proteína al día", plan: proteina21() },
  { ...base, slug: "agua-21", title: "Hidratado", days: 21, verify: "water", icon: "drop", cover: "sky", difficulty: "facil", minutes: 2, grace: 2, xp: 200, priceUsd: 0, sort: 60,
    description: "21 días tomando 8 vasos de agua. Menos hambre y mejor energía en el gym.", badge: "Hidratado", plan: agua21() },

  { ...base, slug: "pasos-14", title: "10.000 pasos en 14 días", days: 14, verify: "steps", icon: "steps", cover: "peel", difficulty: "facil", minutes: 60, grace: 1, xp: 150, stepsGoal: 10000, priceUsd: 0, sort: 70,
    description: "Dos semanas para volver a moverte: 10.000 pasos diarios con una idea práctica cada día. Se marca solo al registrar tus pasos.", badge: "Dos semanas en marcha", plan: pasos(14, 10000) },
  { ...base, slug: "sin-azucar-7", title: "Sin azúcar 7 días", days: 7, verify: "manual", icon: "leaf", cover: "selva", difficulty: "media", minutes: 5, grace: 0, xp: 120, priceUsd: 0, sort: 80,
    description: "Una semana sin azúcar añadida ni bebidas azucaradas. Cada día un paso concreto para que el antojo baje.", badge: "Semana sin azúcar", plan: sinAzucar7() },
  { ...base, slug: "movilidad-14", title: "Movilidad diaria 14 días", days: 14, verify: "manual", icon: "sparkle", cover: "sky", difficulty: "facil", minutes: 10, grace: 2, xp: 150, priceUsd: 0, sort: 90,
    description: "10 minutos al día para moverte mejor: cadera, hombros, columna y tobillos. Ideal si pasas muchas horas sentado.", badge: "Cuerpo libre", plan: movilidad14() },

  { ...base, slug: "abdomen-21", title: "21 días de abdomen", days: 21, verify: "manual", icon: "target", cover: "noche", difficulty: "media", minutes: 12, grace: 2, xp: 300, priceUsd: 4.99, sort: 100, featured: true,
    description: "Circuito de core que sube cada semana: crunches, elevaciones de piernas, plancha y bicho muerto. Un día suave cada 7.", badge: "Abdomen de acero", rewardTitle: "Core fuerte", plan: abdomen21() },
  { ...base, slug: "gluteos-30", title: "Glúteos de acero 30 días", days: 30, verify: "manual", icon: "bolt", cover: "ember", difficulty: "media", minutes: 15, grace: 3, xp: 350, priceUsd: 6.99, sort: 110,
    description: "Tres bloques que rotan (puentes, sentadillas, zancadas, patadas e hip thrust) y suben de repeticiones, con descanso activo cada 6 días. Sin equipo.", badge: "Glúteos de acero", plan: gluteos30() },
  { ...base, slug: "pierde-3kg-6-semanas", title: "Pierde 3 kg en 6 semanas", days: 42, verify: "manual", icon: "trendDown", cover: "banana", difficulty: "media", minutes: 45, grace: 6, xp: 400, priceUsd: 9.99, sort: 120, featured: true,
    description: "Plan de 6 semanas que apunta a bajar unos 0,5 kg por semana: 3 días de fuerza, 2 caminatas largas, intervalos suaves y un día de revisión. El resultado depende de tu punto de partida y de cómo comes.", badge: "Seis semanas firmes", rewardTitle: "Disciplina",
    safetyNote: "Bajar alrededor de 0,5 kg por semana es un ritmo seguro para la mayoría de adultos. No es una garantía: cada cuerpo responde distinto. Si estás embarazada, tienes una condición médica o tomas medicamentos, consulta con tu médico antes de empezar.",
    plan: pierde3kg() },
  { ...base, slug: "dominadas-desde-cero", title: "Dominadas desde cero", days: 28, verify: "manual", icon: "barbell", cover: "noche", difficulty: "dificil", minutes: 15, grace: 3, xp: 350, priceUsd: 7.99, sort: 130,
    description: "De colgarte de la barra a intentar tu primera dominada estricta: colgadas, remo invertido, negativas y asistidas. Necesitas una barra.", badge: "Primera dominada", rewardTitle: "Espalda fuerte", plan: dominadas28() },
  { ...base, slug: "sprint-verano-28", title: "Sprint de verano 28 días", days: 28, verify: "manual", icon: "sun", cover: "selva", difficulty: "dificil", minutes: 40, grace: 3, xp: 400, priceUsd: 5.99, sort: 140,
    startMode: "fecha", startDate: "2026-12-01",
    description: "Cuatro semanas de fuerza, intervalos y pasos para llegar con energía a fin de año. Empieza en la misma fecha para todos.", badge: "Sprint de verano", plan: sprint28() },
];

export const SEED_BY_SLUG: Record<string, SeedChallenge> = Object.fromEntries(SEED.map((s) => [s.slug, s]));
