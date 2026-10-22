import { dashboard, type Athlete } from "@/lib/athlete";
import { DAY_NAMES, weeklyTrend } from "@/lib/engine";
import type { Point } from "@/lib/progress";

/** Regla de estilo compartida por todos los prompts del coach. */
export const COACH_STYLE_RULE = "No uses emojis ni la raya larga (—). Escribe en español de Costa Rica, cálido y directo; usa **negritas** para lo importante.";

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}]/gu;
/**
 * Red de seguridad: quita emojis (y sus modificadores) del texto del modelo, trozo por trozo del stream.
 * Conserva saltos de línea y sangrías de markdown; solo colapsa los espacios dobles que deja un emoji en medio de una línea.
 */
export function stripEmoji(s: string): string {
  if (!s) return s;
  const out = s.replace(EMOJI, "");
  if (out === s) return s;
  return out.replace(/(\S)[ \t]{2,}/g, "$1 ").replace(/(\S)[ \t]+([.,;:!?])/g, "$1$2");
}

export function coachSystem(a: Athlete, weights: Point[], workouts: { d: string; tpl: string; sets: number; vol: number }[]) {
  const d = dashboard(a);
  const rate = weeklyTrend(weights.map((w) => ({ d: w.d, kg: w.v })));
  const ctx = {
    hoy: `${DAY_NAMES[d.today.dow]} ${d.today.iso}`,
    atleta: { nombre: a.name, edad_aprox: undefined, estatura_cm: a.heightCm, peso_actual: a.currentWeight, peso_inicial: a.startWeight, meta: a.goalWeight, fecha_meta: a.goalDate, modo: a.mode },
    objetivos_diarios: d.t,
    ritmo_real_kg_sem: rate, ritmo_necesario_kg_sem: d.needPerWeek, semana_programa: d.week + 1, descarga: d.deload,
    rutina_hoy: { nombre: d.plan.name, ejercicios: d.plan.exercises.map((e) => `${e.name} ${e.cfg.sets}x${e.cfg.lo}-${e.cfg.hi}`), cardio: d.plan.cardio },
    ayer: d.yesterday.name, manana: d.tomorrow.name,
    semana: d.weekPlan.map((p) => `${DAY_NAMES[p.dow]}: ${p.name}`),
    ultimos_entrenos: workouts.slice(0, 5),
    glp1: a.glp1.on ? { medicamento: a.glp1.med, dia_inyeccion: a.glp1.injectionDow, fase_hoy: d.glp1?.phase, proteina_meta_g: d.glp1?.protein, kcal_minimas: d.glp1?.kcalMin, fibra_g: d.glp1?.fiber, agua_l: d.glp1?.waterL } : null,
  };
  return `Eres "Coach Banana", el entrenador personal con IA de Banana Burn, una app de fitness para Costa Rica y LATAM.

Estilo:
- Español latino natural, cercano y motivador (puedes usar "pura vida", "mae" con moderación).
- ${COACH_STYLE_RULE}
- Respuestas cortas y accionables: máximo ~120 palabras salvo que pidan detalle. Usa viñetas cuando ayuden.
- Basa todo en los DATOS del atleta. Da números concretos (kg, reps, gramos, kcal) cuando apliquen.

Método Banana Burn (no lo contradigas):
- Recomposición: 4 días de básicos cerca del fallo (1-2 reps en reserva), tempo 3-1-1, doble progresión, descarga cada 6 semanas.
- Proteína 1,6-2,2 g/kg, carbos alrededor del entreno, 8-12k pasos, 7-9 h de sueño.
- Rutinas que no se repiten día con día. Si piden cambiar un ejercicio, ofrece una alternativa que trabaje el mismo patrón.
- Comida local: gallo pinto, casado, plátano, yuca, frijoles, pollo, tilapia, huevos, natilla, queso tierno.

Seguridad:
- No diagnosticas. Ante dolor agudo, mareo, dolor de pecho o lesión: que pare y consulte a un profesional de salud.
- Nunca recomiendes menos de 1.500 kcal (hombres) / 1.200 (mujeres), ayunos extremos, purgas, ni perder más de ~1 % del peso por semana.
- Si notas señales de trastorno de la conducta alimentaria, responde con empatía, sin números, y sugiere apoyo profesional.
- No recomiendes esteroides ni fármacos para bajar de peso.

Si "glp1" no es null (programa Banana Shield, medicamento recetado):
- Objetivo: perder grasa y NO músculo. Prioriza fuerza 3+ días, proteína a la meta (proteína primero en cada comida), comer al menos las kcal mínimas, fibra y agua.
- Nunca des indicaciones de dosis, cambios o suspensión del medicamento, ni recomiendes péptidos o compuestos no aprobados; eso es con su médico.
- Náuseas/estreñimiento: solo estrategias de alimentación (comidas pequeñas, evitar grasa y picante, jengibre, fibra gradual, agua) y consultar al médico si persisten.
- Señales de alarma (dolor abdominal fuerte y persistente, vómitos que no paran, deshidratación, cambios de ánimo o pensamientos de hacerse daño): que busque atención médica de inmediato.

DATOS DEL ATLETA (JSON):
${JSON.stringify(ctx)}`;
}

/**
 * Revisión de seguridad ANTES de llamar al modelo: si el mensaje describe una urgencia,
 * respondemos con un mensaje fijo y verificado (no dependemos del modelo para esto).
 */
export function safetyCheck(q: string): string | null {
  const t = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/(suicid|matarme|quitarme la vida|hacerme dano|no quiero vivir|autolesi|cortarme)/.test(t))
    return "Gracias por contármelo. No estás solo/a. Si estás en peligro ahora, llama al **911**. En Costa Rica también puedes llamar gratis a la **Línea Aquí Estoy (1322)** del Colegio de Psicólogos, para hablar con alguien ya. Si quieres, también te escucho aquí.";
  if (/(dolor (de|en el) pecho|pecho apretado|me desmay|desmayo|no puedo respirar|me falta el aire|brazo izquierdo|palpitaciones fuertes)/.test(t))
    return "**Para de entrenar ahora.** Dolor de pecho, falta de aire o desmayo pueden ser una urgencia. Siéntate, no sigas y llama al **911** si no se pasa en unos minutos o empeora. Antes de volver a entrenar, consúltalo con un médico.";
  if (/(dolor abdominal fuerte|dolor de panza fuerte|vomit(o|ando) (sin parar|todo)|no retengo|ojos amarillos|piel amarilla)/.test(t))
    return "**Eso no es algo para manejar en casa.** Dolor abdominal fuerte o persistente, vómitos que no paran o piel/ojos amarillos necesitan **atención médica hoy** (si es intenso, ve a emergencias o llama al **911**). Avísale también al médico que te receta el medicamento.";
  return null;
}

export function demoReply(q: string, name = "") {
  const t = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const safe = safetyCheck(q);
  if (safe) return safe;
  if (/(cambi|reemplaz|sustitu)/.test(t)) return "¡Claro! En el entreno toca el botón **Cambiar** del ejercicio: te muestro opciones que trabajan el mismo músculo con tu equipo. Mantén las mismas series y anota el peso nuevo; el motor recalibra solo la próxima vez.";
  if (/(cen|comer|comi|prote)/.test(t)) return "Para cerrar la proteína del día, opciones ticas:\n- **Tilapia 200 g + yuca + ensalada** (~45 g P)\n- **Casado con pechuga 180 g**, mitad de arroz (~50 g P)\n- **3 huevos + 100 g de queso tierno + tortilla** (~40 g P)";
  if (/(duel|dol|lesi|molest|punz|tiron|pincha)/.test(t)) return "Si es dolor agudo, punzante o en una articulación, **para ese ejercicio hoy** y consulta a un fisio o médico. Si es solo agujeta (dolor muscular difuso de 1 a 3 días), puedes entrenar con **modo suave**. ¿Dónde lo sientes y desde cuándo?";
  if (/(estanc|no bajo|no baj)/.test(t)) return "Primero confirmemos la tendencia: pésate 4 mañanas esta semana, en ayunas. Si en 2 semanas no se mueve:\n- **−100 kcal** al día (media taza de arroz menos en la cena)\n- **+2.000 pasos** al día\n- Mantén la proteína alta para no perder músculo.";
  return `¡Pura vida${name ? `, ${name}` : ""}! Hoy te toca la rutina del día. Concéntrate en la técnica, controla la bajada y termina cada serie con 1-2 reps en reserva. Después, proteína en la próxima hora. (Vista previa: respuestas de ejemplo.)`;
}
