// El coach se presenta el primer día (#198): una burbuja con respuestas de un toque en el cierre del primer entreno y,
// al día siguiente, en Hoy si todavía no entrena. Tocar una respuesta abre /app/coach con esa pregunta ya enviada.
// Puro (sin datos): lo usan la burbuja, Hoy, el entreno y la pantalla del coach.

/** La burbuja deja de salir pasados estos días desde que se creó la cuenta (profiles.created_at, que no se reinicia al editar el perfil). */
export const COACH_PROMPT_DAYS = 3;

export const COACH_PROMPT_QUESTION = "¿Cómo te fue en tu primer entreno?";

export type CoachPromptId = "bien" | "costo" | "maquina" | "tecnica";
export type CoachPromptWhere = "resumen" | "hoy";

/** Lo que dice el botón y el mensaje que se envía al coach. Solo estos ids se aceptan en /app/coach?pregunta=. */
export const COACH_PROMPTS: Record<CoachPromptId, { label: string; message: string }> = {
  bien: { label: "Bien", message: "Me fue bien en mi primer entreno. ¿Qué sigue ahora?" },
  costo: { label: "Me costó", message: "Me costó mi primer entreno. ¿Cómo hago para que el próximo sea más llevadero?" },
  maquina: { label: "No sé usar una máquina", message: "No sé usar una de las máquinas de mi entreno. ¿Me explicas cómo se usa?" },
  tecnica: { label: "No sé si lo hice bien", message: "No sé si hice bien los ejercicios de mi primer entreno. ¿Cómo reviso mi técnica?" },
};

/** Las tres respuestas: en casa no hay máquinas, así que la tercera pregunta por la técnica. */
export function coachPromptAnswers(home: boolean): CoachPromptId[] {
  return ["bien", "costo", home ? "tecnica" : "maquina"];
}

export const coachPromptHref = (id: CoachPromptId, where: CoachPromptWhere) => `/app/coach?pregunta=${id}&desde=${where}`;

/** El mensaje de un id de /app/coach?pregunta=. Cualquier otro valor se ignora: un enlace no puede mandar texto libre. */
export function coachPromptMessage(id: unknown): string | null {
  return typeof id === "string" && Object.hasOwn(COACH_PROMPTS, id) ? COACH_PROMPTS[id as CoachPromptId].message : null;
}

/** ¿Sigue dentro de los primeros días? Sin fecha de registro no se muestra (en demo, siempre). */
export function inCoachPromptWindow({ registeredAt, now, demo }: { registeredAt?: string | null; now: Date; demo: boolean }) {
  if (demo) return true;
  const t = registeredAt ? Date.parse(registeredAt) : NaN;
  if (!Number.isFinite(t)) return false;
  const age = now.getTime() - t;
  return age >= 0 && age < COACH_PROMPT_DAYS * 86_400_000;
}

/** Hoy: ya terminó su primer entreno en otro día, hoy no ha entrenado y nunca le ha escrito al coach. */
export function showHoyCoachPrompt(s: { workouts: number; trainedToday: boolean; coachMessages: number; registeredAt?: string | null; now: Date; demo: boolean }) {
  return s.workouts > 0 && !s.trainedToday && s.coachMessages === 0 && inCoachPromptWindow(s);
}

/** Al abrir el coach con una pregunta: enviarla, o dejarla escrita si no quedan preguntas (el cupo manda). */
export function autoAsk({ ask, configured, out }: { ask: string | null; configured: boolean; out: boolean }): "send" | "fill" | null {
  if (!ask || !configured) return null;
  return out ? "fill" : "send";
}
