// 0033: retos gratis. Pocos y buenos: Hidratado, Detox de azúcar, Flexible como mono y Caminata de la selva, todos de
// 15 días o menos, con un plan día a día más completo. Los demás retos gratis quedan ocultos (quien ya está inscrito los
// termina). FUENTE de la sección de datos de 0033_retos_gratis.sql (lo verifica catalog-0033.test.ts) y del catálogo de
// respaldo / modo demo. La migración solo toca lo que el panel no editó.
import type { DayTask } from "./challenge-seed";

/** Máximo de días de un reto gratis publicado (la base lo exige con una restricción). */
export const FREE_MAX_DAYS = 15;

export type FreeRework = {
  /** Títulos que la migración reemplaza (el de 0018 y el de 0028), para no pisar uno editado en el panel. */
  fromTitles: string[];
  title: string; description: string; days: number; xp: number; grace: number; minutes: number; badge: string;
  stepsGoal?: number; featured?: boolean; sort: number; plan: DayTask[];
};

const nf = (n: number) => n.toLocaleString("es-419");

function hidratado(): DayTask[] {
  const t = [
    "Un vaso de agua apenas te levantas, antes del café",
    "Deja una botella llena a la vista en tu escritorio o mesa",
    "Un vaso antes de cada comida: también te ayuda a comer con calma",
    "Si te aburre el agua sola, ponle limón, pepino o hierbabuena",
    "Un vaso al llegar del gym o después de caminar",
    "Pon una alarma cada 2 horas y toma medio vaso en cada una",
    "Revisa el color de tu orina: amarillo claro es buena señal",
    "Cambia el refresco o el jugo de hoy por agua fría con fruta",
    "Si entrenas hoy, suma 1 o 2 vasos más",
    "Prepara 2 botellas de 1 litro en la mañana y termínalas antes de la noche",
    "Toma un vaso cuando sientas hambre entre comidas y espera 10 minutos",
    "Agua de coco o un té sin azúcar también cuentan",
    "Lleva una botella en el carro o en la mochila",
    "Día final: compara tu energía y tu hambre con el día 1",
  ];
  return t.map((x) => ({ t: `Toma 8 vasos de agua. ${x}.`, type: "habito" as const, target: 8 }));
}

function detox(): DayTask[] {
  return [
    { t: "Saca de casa o del escritorio los dulces y las bebidas azucaradas. Lo que no ves, no se te antoja.", type: "habito" },
    { t: "Cero refrescos ni jugos hoy: agua, café o té sin azúcar.", type: "habito" },
    { t: "Lee la etiqueta de 3 productos que comes seguido y busca azúcar añadida (sacarosa, jarabe, glucosa).", type: "habito" },
    { t: "Postre de hoy: fruta entera o yogur natural con canela.", type: "nutricion" },
    { t: "Café o té sin azúcar todo el día. Prueba con canela o vainilla.", type: "habito" },
    { t: "Prepara una merienda con proteína (huevo, yogur griego, queso) para no llegar con hambre a la tarde.", type: "nutricion" },
    { t: "Día final: anota cómo cambió tu energía y tu antojo de dulce. Decide qué hábito te quedas.", type: "habito" },
  ];
}

function flexible(): DayTask[] {
  const d: [string, string][] = [
    ["Cadera", "gato-camello, estocada baja con brazo arriba y 90/90 de cadera"],
    ["Hombros", "círculos de brazos, deslizamientos en la pared y estiramiento de pecho en el marco de una puerta"],
    ["Columna", "rotaciones en el piso, postura del niño y gato-camello lento"],
    ["Tobillos", "rodilla a la pared, círculos de tobillo y sentadilla profunda sostenida"],
    ["Femorales", "bisagra de cadera con palo, estiramiento de femoral acostado y buenos días sin peso"],
    ["Pecho y espalda alta", "aperturas en el piso, rotaciones torácicas y Y-T-W boca abajo"],
    ["Día suave", "5 minutos de caminata y 5 de respiración profunda acostado"],
    ["Cadera", "sentadilla profunda con pausa, mariposa y estiramiento de flexor de cadera"],
    ["Hombros", "dislocaciones con toalla, rotación externa y colgarte 20 segundos si tienes barra"],
    ["Columna", "puente de glúteo con pausa, cobra suave y rotaciones sentado"],
    ["Tobillos y pies", "caminar en puntas y talones, rodilla a la pared y masaje del pie con una pelota"],
    ["Femorales y glúteo", "paloma en el piso, estiramiento de figura 4 y bisagra a una pierna"],
    ["Cuerpo completo", "saludo al sol lento, 3 vueltas"],
    ["Prueba final", "repite la sentadilla profunda y el rodilla a la pared del día 4 y compara cómo te sientes"],
  ];
  return d.map(([f, m]) => ({ t: `10 min de movilidad. ${f}: ${m}.`, type: "tiempo" as const, target: 600 }));
}

function caminata(goal: number): DayTask[] {
  const t = [
    "Camina 10 minutos después de cada comida",
    "Haz una llamada caminando",
    "Usa escaleras en vez de ascensor todo el día",
    "Bájate una parada antes o estaciona más lejos",
    "Sal a caminar con alguien de tu casa o con tu perro",
    "Camina mientras escuchas un podcast o un audiolibro",
    "Día de ruta larga: una caminata de 40 minutos sin parar",
    "Cada hora sentado, levántate y camina 2 minutos",
    "Explora una calle o un parque nuevo",
    "Camina rápido: que te cueste un poco hablar",
    "Haz los mandados a pie si puedes",
    "Divide el día en 3 caminatas de 15 minutos",
    "Sube y baja escaleras 5 minutos",
    "Ruta larga otra vez: intenta más pasos que el día 7",
    "Día final: compara tu promedio de pasos con el de la primera semana",
  ];
  return t.map((x) => ({ t: `Llega a ${nf(goal)} pasos. ${x}.`, type: "pasos" as const, target: goal }));
}

export const FREE_REWORK: Record<string, FreeRework> = {
  "agua-21": {
    fromTitles: ["Hidratado", "Hidratado 21 días"], title: "Hidratado 14 días", days: 14, xp: 180, grace: 1, minutes: 2, badge: "Hidratado", sort: 10, featured: true,
    description: "14 días tomando 8 vasos de agua, con un truco distinto cada día. Se marca solo al registrar tu agua en Hoy.", plan: hidratado(),
  },
  "sin-azucar-7": {
    fromTitles: ["Sin azúcar 7 días", "Detox de azúcar 7 días"], title: "Detox de azúcar 7 días", days: 7, xp: 140, grace: 0, minutes: 5, badge: "Semana sin azúcar", sort: 20, featured: true,
    description: "Una semana sin azúcar añadida ni bebidas azucaradas. Cada día un paso concreto para que el antojo baje.", plan: detox(),
  },
  "movilidad-14": {
    fromTitles: ["Movilidad diaria 14 días", "Flexible como mono 14 días"], title: "Flexible como mono 14 días", days: 14, xp: 180, grace: 2, minutes: 10, badge: "Cuerpo libre", sort: 30,
    description: "10 minutos al día para moverte mejor: cadera, hombros, columna y tobillos, con los movimientos de cada día. Ideal si pasas muchas horas sentado.", plan: flexible(),
  },
  "pasos-30": {
    fromTitles: ["10.000 pasos", "Caminata de la selva: 10.000 pasos"], title: "Caminata de la selva 15 días", days: 15, xp: 200, grace: 2, minutes: 60, badge: "Caminante de la selva", stepsGoal: 8000, sort: 40,
    description: "15 días llegando a 8.000 pasos, con una idea práctica cada día. Se marca solo al registrar tus pasos en Hoy.", plan: caminata(8000),
  },
};

/** Retos gratis que dejan la tienda (quien ya está inscrito los termina). */
export const FREE_HIDE = ["banana-30", "flexiones-30", "plancha-30", "proteina-21", "pasos-14"];

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const j = (v: unknown) => `$plan$${JSON.stringify(v)}$plan$::jsonb`;

export function catalog0033Sql() {
  const out = ["-- Datos de 0033 (generados desde src/lib/catalog-0033.ts). Solo cambian los retos que el panel no editó."];
  for (const slug of FREE_HIDE) out.push(`update public.challenges_catalog set status = 'oculto', featured = false where slug = ${q(slug)} and status = 'publicado' and price_usd = 0;`);
  for (const [slug, r] of Object.entries(FREE_REWORK)) {
    const cond = `slug = ${q(slug)} and price_usd = 0 and title in (${r.fromTitles.map(q).join(", ")})`;
    out.push(`update public.challenge_plans set days = ${j(r.plan)}, updated_at = now() where slug in (select slug from public.challenges_catalog where ${cond});`);
    out.push(`update public.challenges_catalog set title = ${q(r.title)}, description = ${q(r.description)}, days = ${r.days}, xp = ${r.xp}, grace = ${r.grace}, minutes = ${r.minutes}, badge = ${q(r.badge)}, sort = ${r.sort}, featured = ${!!r.featured}${r.stepsGoal ? `, steps_goal = ${r.stepsGoal}` : ""} where ${cond};`);
  }
  return out.join("\n") + "\n";
}
