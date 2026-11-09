// en-US: el entreno (#295): reproductor, Recap, primer entreno y pedido de tarjeta tras la primera serie.
// Los nombres de los ejercicios van por id (el slug de EX, que no cambia): si se agrega uno nuevo a EX sin su nombre en
// inglés, tsc avisa.
import type { ExerciseId } from "@/lib/engine/data";

/** Nombre en inglés de cada ejercicio del motor, por su id. */
export const EXERCISES: Record<ExerciseId, string> = {
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

export const WORKOUT: Record<string, string> = {
};
