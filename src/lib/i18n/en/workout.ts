// en-US: el reproductor del entreno, el Recap y "¿Entrenamos ahora?" (#300).
import type { ExerciseId } from "@/lib/engine/data";
import { PLAYER } from "./workout-player";
import { RECAP } from "./workout-recap";
import { SCREENS } from "./workout-screens";

/** Nombre en inglés de cada ejercicio del motor, por su slug (EX en src/lib/engine/data.ts). Si se agrega uno a EX sin su nombre aquí, tsc avisa. */
export const EXERCISE_NAMES: Record<ExerciseId, string> = {
  squat: "Back squat", frontsquat: "Front squat", goblet: "Goblet squat", bench: "Bench press", closebench: "Close-grip bench press",
  incline: "Incline dumbbell press", ohp: "Standing overhead press", dbpress: "Dumbbell shoulder press", dips: "Parallel bar dips",
  dipsw: "Weighted dips", deadlift: "Deadlift", rdl: "Romanian deadlift", pullup: "Pull-ups", chinup: "Neutral-grip pull-ups",
  row: "Barbell row", lat: "Lat pulldown", dbrow: "Dumbbell row", curl: "Barbell curl", hammer: "Hammer curl", curlp: "Pause curl",
  lateral: "Lateral raises", lateralc: "Cable lateral raise", laterall: "Lean-away lateral raise", facepull: "Face pull",
  facepullp: "Pause face pull", reardelt: "Dumbbell rear delt fly", pushup: "Push-ups", pushupd: "Diamond push-ups",
  pushupe: "Feet-elevated push-ups", plank: "Plank", planktap: "Plank shoulder taps", plankrkc: "RKC plank",
  kneeraise: "Hanging knee raise", legraise: "Hanging leg raise", twistraise: "Hanging knee raise with twist", carry: "Farmer's carry",
  suitcase: "Suitcase carry (one hand)", carryp: "Pause carry", floorpress: "Dumbbell floor press", dbrdl: "Dumbbell Romanian deadlift",
  invrow: "Inverted row (table or low bar)", bandpull: "Band pulldown", legraisef: "Lying leg raise", bicycle: "Bicycle crunch",
  bwsquat: "Bodyweight squat", bulgarian: "Bulgarian split squat", pikepush: "Pike push-up", slrdl: "Single-leg deadlift",
  glutebridge: "Glute bridge", towelcurl: "Isometric towel curl", ytw: "Prone Y-T-W", bearcrawl: "Bear crawl",
  jumpsquat: "Jump squat", burpee: "Burpees", mountain: "Mountain climbers", lunge: "Alternating lunges", jacks: "Jumping jacks",
};

/** Textos de las funciones puras del entreno (logic.ts, task.ts y sides.ts en src/components/workout). */
const CORE: Record<string, string> = {
  // Unidades y piezas sueltas
  seg: "sec", " por lado": " per side", " y ": " and ", por: "by",
  segundo: "second", segundos: "seconds", metro: "meter", metros: "meters", "repetición": "rep", repeticiones: "reps",
  "segundo por lado": "second per side", "segundos por lado": "seconds per side", "metro por lado": "meter per side",
  "metros por lado": "meters per side", "repetición por lado": "rep per side", "repeticiones por lado": "reps per side",
  serie: "set", series: "sets", ronda: "round", rondas: "rounds", minutos: "minutes",
  // Metas de la serie
  "{what} con {w}": "{what} with {w}", "{what} con {w} extra": "{what} with {w} extra",
  "con {w}": "with {w}", "con {w} extra": "with {w} extra", "Con {w}": "With {w}", "Con {w} extra": "With {w} extra",
  "{lo} a {hi}": "{lo} to {hi}", "{lo} a {hi} reps": "{lo} to {hi} reps",
  "Haz entre {lo} y {hi}. Para cuando te cueste mantener la técnica.": "Do between {lo} and {hi}. Stop when it gets hard to keep good form.",
  "Tu rango es de {lo} a {hi}. Hoy la meta es {n}.": "Your range is {lo} to {hi}. Today's goal is {n}.",
  "Elige un peso que puedas mover {n} veces con buena técnica": "Pick a weight you can move {n} times with good form",
  "Última serie": "Last set", "Serie {n} de {of}": "Set {n} of {of}",
  ", empieza con el lado derecho": ", start with your right side", ", empieza con el lado izquierdo": ", start with your left side",
  "{secs} s fuerte": "{secs} s hard", "{secs} s fuerte por lado": "{secs} s hard per side", "Intervalo {n} de {of}": "Interval {n} of {of}",
  "Intervalo {n} de {of}: {secs} segundos a buen ritmo.": "Interval {n} of {of}: {secs} seconds at a good pace.",
  "Intervalo {n} de {of}: {secs} segundos por lado a buen ritmo.": "Interval {n} of {of}: {secs} seconds per side at a good pace.",
  "{n} s de trabajo": "{n} s of work", "{n} s de descanso": "{n} s rest", "Descanso {rest}": "Rest {rest}", "Por lado": "Per side",
  "Ya casi": "Almost done", "Menos de 1 min": "Less than 1 min", "Falta 1 min": "1 min left", "Faltan unos {m} min": "About {m} min left",
  // Esfuerzo y diversión
  "Fácil": "Easy", "Sobraban 4 o más": "4 or more left", Justo: "Just right", "Sobraban 1 o 2": "1 or 2 left",
  "Al límite": "All out", "No salía otra": "Couldn't do another",
  Aburrido: "Boring", Normal: "Normal", Bien: "Good", Divertido: "Fun", "Me encantó": "Loved it",
  // Calentamiento y vuelta a la calma
  "Barra sola": "Empty bar",
  "1 serie con la barra sola ({reps} reps)": "1 set with the empty bar ({reps} reps)",
  "{n} series con la barra sola ({reps} reps)": "{n} sets with the empty bar ({reps} reps)",
  "1 de {reps} con {w}": "1 of {reps} with {w}",
  "3 min de caminata suave y 30 s de estiramiento para {list}.": "3 min of easy walking and 30 s of stretching for your {list}.",
  // Músculos en palabras simples (estiramientos y "Hoy trabajas")
  "cuádriceps": "quads", "glúteos": "glutes", femorales: "hamstrings", pecho: "chest", hombros: "shoulders", espalda: "back",
  "tríceps": "triceps", "bíceps": "biceps", cadera: "hips", piernas: "legs", muslos: "thighs",
  "parte de atrás del muslo": "back of your thighs", entrepierna: "inner thighs", pantorrillas: "calves",
  "parte alta de la espalda": "upper back", antebrazos: "forearms", cintura: "waist", abdomen: "abs", tobillos: "ankles",
  "todo el cuerpo": "whole body",
  // Voz del coach
  "{n} series": "{n} sets", "Clave: {cue}.": "Key: {cue}.", "Descanso.": "Rest.", "Vamos. Serie {set} de {sets}.": "Let's go. Set {set} of {sets}.",
  "Última serie: déjalo todo.": "Last set: give it everything.", "Ya.": "Go.", "Entreno completado. Bien hecho.": "Workout complete. Well done.",
  // Series por tiempo y por lado
  "Lado derecho": "Right side", "Lado izquierdo": "Left side", "Prepárate": "Get ready", "Cambia de lado": "Switch sides", Trabaja: "Work",
  "Saltar la preparación": "Skip the prep", "Saltar el cambio de lado": "Skip the side switch", "Terminar la serie": "Finish the set",
  "Terminar este lado": "Finish this side", "Cambia de lado.": "Switch sides.",
  "Primer lado listo. Cambia de lado: {secs} segundos": "First side done. Switch sides: {secs} seconds", "{side}: {secs} segundos": "{side}: {secs} seconds",
};

export const WORKOUT: Record<string, string> = { ...CORE, ...SCREENS, ...RECAP, ...PLAYER };
