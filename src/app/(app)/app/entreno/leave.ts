/**
 * ¿Se guarda solo el entreno al salir? Solo desde el resumen (la persona ya terminó o tocó Guardar lo que hice),
 * con al menos una serie hecha, si no se guardó ya y si no hay un envío en curso (nunca dos guardados).
 * En medio del entreno no se guarda: el avance queda en el teléfono y se retoma al volver.
 */
export function shouldAutoSave(s: { phase: "play" | "summary" | "saved"; doneSets: number; saved: boolean; sending: boolean }): boolean {
  return s.phase === "summary" && s.doneSets > 0 && !s.saved && !s.sending;
}
