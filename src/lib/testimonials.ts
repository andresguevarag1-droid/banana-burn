// Testimonios reales (#238, 0065): después del tercer entreno guardado, el resumen pide una opinión con permiso
// (sin marcar) para publicarla con el nombre de pila y el país. Puro (sin datos): lo usan el entreno, la acción y /admin.

/** La tarjeta sale al guardar este entreno: el tercero de la cuenta. */
export const TESTIMONIAL_AT_WORKOUT = 3;
export const TESTIMONIAL_MAX = 200;

export const TESTIMONIAL_QUESTION = "¿Cómo te ha ido con Banana Burn?";
export const TESTIMONIAL_PUBLISH_LABEL = "Pueden publicar mi opinión con mi nombre de pila y país";

/**
 * ¿Se pide la opinión en el resumen? Solo si antes de este entreno había exactamente dos guardados (este es el tercero)
 * y la cuenta no ha dejado ya su opinión. En demo, nunca (no se guarda nada).
 */
export function asksTestimonial(s: { savedBefore: number; answered: boolean; demo: boolean }): boolean {
  return !s.demo && !s.answered && s.savedBefore === TESTIMONIAL_AT_WORKOUT - 1;
}

/** En el resumen ya guardado: solo si este guardado es nuevo (no un reintento del mismo entreno). */
export function showsTestimonialCard(s: { asked: boolean; fresh: boolean }): boolean {
  return s.asked && s.fresh;
}

export type TestimonialInput = { stars: number; text: string | null; publishOk: boolean };

/** Valida lo que manda el navegador. El permiso para publicar solo vale si viene exactamente true. */
export function parseTestimonial(raw: unknown): TestimonialInput | null {
  if (!raw || typeof raw !== "object") return null;
  const { stars, text, publishOk } = raw as { stars?: unknown; text?: unknown; publishOk?: unknown };
  if (typeof stars !== "number" || !Number.isInteger(stars) || stars < 1 || stars > 5) return null;
  if (text != null && typeof text !== "string") return null;
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if ([...t].length > TESTIMONIAL_MAX) return null;
  return { stars, text: t || null, publishOk: publishOk === true };
}
