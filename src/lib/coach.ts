import { dashboard, type Athlete } from "@/lib/athlete";
import { DAY_NAMES, weeklyTrend } from "@/lib/engine";
import type { Point } from "@/lib/progress";

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
- Español latino natural, cercano y motivador (puedes usar "pura vida", "mae" con moderación). Usa emojis con medida.
- Respuestas cortas y accionables: máximo ~120 palabras salvo que pidan detalle. Usa viñetas cuando ayuden.
- Basa todo en los DATOS del atleta. Da números concretos (kg, reps, gramos, kcal) cuando apliquen.

Método Banana Burn (no lo contradigas):
- Recomposición: 4 días de básicos cerca del fallo (1–2 reps en reserva), tempo 3-1-1, doble progresión, descarga cada 6 semanas.
- Proteína 1,6–2,2 g/kg, carbos alrededor del entreno, 8–12k pasos, 7–9 h de sueño.
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

export function demoReply(q: string) {
  const t = q.toLowerCase();
  if (/(cambi|reemplaz|sustitu)/.test(t)) return "¡Claro! 🔄 Si no hay rack libre, cambia la **sentadilla trasera** por **sentadilla goblet** o **prensa**: mismas series (4×5–8), tempo 3-1-1. Anota el peso nuevo; el motor recalibra solo la próxima vez.";
  if (/(cen|comer|com[ií]|prote)/.test(t)) return "🥩 Te faltan unos 40 g de proteína. Opciones ticas para cenar:\n- **Tilapia 200 g + yuca + ensalada** (~45 g P)\n- **Casado con pechuga 180 g**, mitad de arroz (~50 g P)\n- **3 huevos + 100 g de queso tierno + tortilla** (~40 g P)";
  if (/(dol|lesi|molest)/.test(t)) return "⚠️ Si es dolor agudo o punzante, **para ese ejercicio hoy** y consulta a un fisio o médico. Si es solo agujeta (dolor muscular difuso), entrena igual pero baja 10 % la carga. ¿Dónde lo sientes?";
  if (/(estanc|no bajo|no baj)/.test(t)) return "📉 Vas a −0,70 kg/sem y necesitas −0,80. Pequeño ajuste:\n- **−100 kcal** (quita media taza de arroz en la cena)\n- **+2.000 pasos** al día\n- Pésate 4 mañanas esta semana para confirmar la tendencia.";
  return "🍌 ¡Pura vida, Andrés! Hoy te toca la rutina del día. Concéntrate en el **tempo 3-1-1** y deja 1–2 reps en reserva. Después, proteína en la próxima hora. (Modo demo: conecta tu llave de Claude para respuestas reales.)";
}
