// Programa "Banana Shield" para personas en tratamiento con GLP-1 (recetado y supervisado por su médico).
// Base: Mozaffarian et al., "Nutritional priorities to support GLP-1 therapy for obesity", Obesity 2025
// (ACLM · ASN · OMA · The Obesity Society) y Noronha et al., Obes Pillars 2025.
import { energy, type Sex } from "@/lib/engine";

export type Glp1Med = "semaglutida" | "tirzepatida" | "liraglutida" | "otro";
export type Glp1 = { on: boolean; med: Glp1Med; injectionDow: number | null; since: string | null };

export const MEDS: { id: Glp1Med; n: string; ex: string }[] = [
  { id: "semaglutida", n: "Semaglutida", ex: "Ozempic, Wegovy, Rybelsus" },
  { id: "tirzepatida", n: "Tirzepatida", ex: "Mounjaro, Zepbound" },
  { id: "liraglutida", n: "Liraglutida", ex: "Saxenda, Victoza" },
  { id: "otro", n: "Otro recetado", ex: "Indicado por tu médico" },
];

/**
 * Metas diarias en GLP-1: la prioridad es comer suficiente proteína y NO quedarse corto de energía
 * (el apetito baja mucho). Proteína 1,6 g/kg del peso de referencia (dentro de 1,2–1,6, sin pasar 2,0 sostenido),
 * piso de calorías, fibra 14 g/1000 kcal y 2,5–3 L de agua.
 */
export function glp1Targets(p: { kg: number; goalKg: number; heightCm: number; age: number; sex?: Sex }) {
  const { bmr, tdee } = energy({ kg: p.kg, heightCm: p.heightCm, age: p.age, sex: p.sex });
  // Peso de referencia: punto medio entre actual y meta (evita metas exageradas con mucho sobrepeso)
  const refKg = Math.round(((p.kg + p.goalKg) / 2) * 10) / 10;
  const protein = Math.min(Math.round((1.6 * refKg) / 5) * 5, Math.round(2.0 * p.kg));
  const floor = p.sex === "f" ? 1300 : 1600;
  const kcalMin = Math.max(floor, Math.round((bmr * 1.1) / 50) * 50);
  const kcal = Math.max(kcalMin, Math.round((tdee - 500) / 50) * 50);
  const fat = Math.round((kcal * 0.25) / 9); // 19–30 % de grasa (protege la vesícula)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((kcal / 1000) * 14);
  return { kcal, kcalMin, protein, perMeal: Math.round(protein / 4 / 5) * 5, fat, carbs, fiber, waterL: p.sex === "f" ? 2.5 : 3, meals: 5, bmr, tdee };
}

/** ¿Hoy o mañana después de la inyección? → modo suave sugerido (náuseas y poca energía son comunes 24–48 h). */
export function injectionPhase(injectionDow: number | null, todayDow: number): "inyeccion" | "post" | "normal" {
  if (injectionDow == null) return "normal";
  if (todayDow === injectionDow) return "inyeccion";
  if (todayDow === (injectionDow + 1) % 7) return "post";
  return "normal";
}

/** Señales de alarma: el coach y la app siempre remiten al médico. */
export const RED_FLAGS = [
  "Dolor abdominal fuerte y persistente (puede irradiar a la espalda)",
  "Vómitos que no paran o no poder retener líquidos",
  "Mareo, orina muy oscura o muy poca (deshidratación)",
  "Cambios de ánimo, tristeza intensa o pensamientos de hacerte daño",
  "Dolor en la parte alta derecha del abdomen o piel/ojos amarillos",
];

/**
 * "Músculo protegido": de lo que bajaste, qué parte fue grasa (con % de grasa por medidas)
 * y si tu fuerza se mantiene (1RM estimado). Devuelve null si faltan datos.
 */
export function muscleShield(o: { startKg: number; nowKg: number; startBf: number | null; nowBf: number | null; strengthChangePct: number | null }) {
  const lost = o.startKg - o.nowKg;
  let fatShare: number | null = null;
  if (o.startBf != null && o.nowBf != null && lost > 0.5) {
    const fatLost = o.startKg * (o.startBf / 100) - o.nowKg * (o.nowBf / 100);
    fatShare = Math.max(0, Math.min(1, fatLost / lost));
  }
  const strengthOk = o.strengthChangePct == null ? null : o.strengthChangePct >= -3;
  const grade = fatShare == null && strengthOk == null ? null : (fatShare ?? 0.75) >= 0.75 && strengthOk !== false ? "A" : (fatShare ?? 0.75) >= 0.6 ? "B" : "C";
  return { lost, fatShare, strengthOk, grade };
}
