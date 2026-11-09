// en-US: nombres de ejercicios, músculos y rutinas del motor (src/lib/engine). Los nombres de los ejercicios viven por id
// en ./workout (#295); aquí se suman al diccionario por su frase en español.
import { EX, TPL, type ExerciseId, type TemplateId } from "@/lib/engine/data";
import { EXERCISES } from "./workout";

const MUSCLES: Record<string, string> = {
  Piernas: "Legs", Pecho: "Chest", "Tríceps": "Triceps", Hombros: "Shoulders", Espalda: "Back", Femorales: "Hamstrings",
  "Bíceps": "Biceps", "Hombro posterior": "Rear delts", Core: "Core", Agarre: "Grip", "Glúteos": "Glutes",
  "Cuerpo completo": "Full body", Cardio: "Cardio",
};

const TEMPLATES: Record<TemplateId, { n: string; hook: string; nf?: string; hookF?: string }> = {
  pushA: { n: "Total strength: legs, chest and shoulders", hook: "Today you build base strength in your legs, chest and shoulders" },
  pullA: { n: "Wide back and strong biceps", hook: "Today you build a wide back and biceps that show", nf: "Strong back and toned arms", hookF: "Today you strengthen your back and tone your arms" },
  pushB: { n: "Steel legs and firm chest", hook: "Today you sculpt strong legs, chest and shoulders with more reps", nf: "Firm legs and defined shoulders", hookF: "Today you sculpt firm legs and defined shoulders with more reps" },
  pullB: { n: "Gorilla back and glutes", hook: "Today you work your whole back side, from your back to your glutes", nf: "Glutes and sculpted back", hookF: "Today you work your whole back side, from your glutes to your back" },
  core: { n: "Abs and burn", hook: "Today you tighten your core and burn fat walking uphill" },
  pump: { n: "Banana Pump: arms and shoulders", hook: "Today you pump up your arms and shoulders with short rests and a final challenge", nf: "Banana Pump: toned arms", hookF: "Today you tone your arms and shoulders with short rests and a final challenge" },
};

const pairs: [string, string][] = [
  ...(Object.keys(EXERCISES) as ExerciseId[]).map((id): [string, string] => [EX[id].n, EXERCISES[id]]),
  ...Object.entries(MUSCLES),
  ...(Object.keys(TEMPLATES) as TemplateId[]).flatMap((id) => {
    const es = TPL[id], en = TEMPLATES[id];
    return [[es.n, en.n], [es.hook, en.hook], ...(es.nf && en.nf ? [[es.nf, en.nf]] : []), ...(es.hookF && en.hookF ? [[es.hookF, en.hookF]] : [])] as [string, string][];
  }),
];

export const ENGINE: Record<string, string> = {
  ...Object.fromEntries(pairs),
  Fuerza: "Strength", Volumen: "Volume", Ligero: "Light", "Recuperación": "Recovery", "Sin equipo": "No equipment",
  "Descanso activo": "Active rest",
  "Camina 8-12k pasos y estira 10 min": "Walk 8-12k steps and stretch for 10 min",
  "Hoy tu músculo crece: camina, estira y recupérate": "Today your muscles grow: walk, stretch and recover",
  "20 min de caminata inclinada (10-12 %) a ritmo de conversación": "20 min incline walk (10-12%) at a conversational pace",
  "Cuerpo completo para empezar": "Full body to get started",
  "Hoy aprendes los movimientos básicos en casa, sin equipo y a tu ritmo": "Today you learn the basic moves at home, no equipment, at your own pace",
  "Hoy aprendes los movimientos básicos a tu ritmo, sin prisa": "Today you learn the basic moves at your own pace, no rush",
  "Hoy sudas cuerpo completo en 2 × 2 m, sin equipo, y sumas a tu racha": "Today you get a full-body sweat in a small space, no equipment, and add to your streak",
  "Exprés {m} min": "{m}-min express",
};
