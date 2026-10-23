export type Body = { title?: string; done?: number; total?: number; prs?: string[]; volume?: number; mins?: number; fun?: number; easy?: number; streak?: number };

/** Feedback breve del coach al terminar un entreno (IA si hay llave; si no, reglas). */
export function ruleFeedback(b: Body, coachName = "Coach Banana") {
  const parts: string[] = [];
  if (b.prs?.length) parts.push(`Récord en ${b.prs.join(" y ")}. Eso es fuerza nueva, no suerte.`);
  else if ((b.done ?? 0) >= (b.total ?? 1)) parts.push("Completaste todas las series. Así se construye el cuerpo que buscas.");
  else parts.push(`Hiciste ${b.done} de ${b.total} series. Un entreno incompleto vale mil veces más que uno que no se hizo.`);
  if ((b.easy ?? 0) >= 2) parts.push(`Marcaste varias series como muy fáciles: la próxima vez ${coachName} te sube la exigencia.`);
  if ((b.fun ?? 3) <= 2) parts.push("Si se sintió aburrido, prueba un reto o cambia un ejercicio con el botón Cambiar la próxima vez.");
  parts.push((b.streak ?? 0) >= 3 ? `Racha de ${b.streak} días. Mañana la seguimos.` : "Ahora: una comida con proteína en la próxima hora y a dormir 7-9 h.");
  return parts.join(" ");
}

