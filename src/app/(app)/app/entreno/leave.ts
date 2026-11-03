/**
 * ¿Se guarda solo el entreno al salir? Solo desde el resumen (la persona ya terminó o tocó Guardar lo que hice),
 * con al menos una serie hecha, si no se guardó ya y si no hay un envío en curso (nunca dos guardados).
 * En medio del entreno no se guarda: el avance queda en el teléfono y se retoma al volver.
 */
export function shouldAutoSave(s: { phase: "play" | "summary" | "saved"; doneSets: number; saved: boolean; sending: boolean }): boolean {
  return s.phase === "summary" && s.doneSets > 0 && !s.saved && !s.sending;
}

/** Primer entreno (#246): tanto tiempo con la app en segundo plano cuenta como salir. */
export const HIDDEN_SAVE_MS = 60_000;

/**
 * ¿Ya pasó el tiempo en segundo plano que cuenta como salir? Se mide al volver, porque iOS y la app (Capacitor) congelan
 * los temporizadores apenas la app se va al fondo. Sin hora de salida (nunca se ocultó) no cuenta.
 */
export function hiddenLongEnough(hiddenAt: number | undefined, now: number): boolean {
  return hiddenAt !== undefined && now - hiddenAt >= HIDDEN_SAVE_MS;
}

type PartialState = { first: boolean; phase: "play" | "summary" | "saved"; doneSets: number; saved: boolean; sending: boolean };

/**
 * ¿Se guarda a medias al salir? Solo en el primer entreno, en medio del entreno y con al menos una serie hecha: se guarda
 * solo lo que hizo. Desde el segundo entreno no (el avance queda en el teléfono y se retoma al volver).
 */
export function shouldSavePartial(s: PartialState): boolean {
  return s.first && s.phase === "play" && s.doneSets > 0 && !s.saved && !s.sending;
}

/** Envía el guardado a medias una sola vez, aunque se salga varias veces (cerrar, cambiar de app, Atrás). Devuelve si lo envió. */
export function partialSaver<H>(send: (how: H) => void) {
  let sent = false;
  return (s: PartialState, how: H): boolean => {
    if (sent || !shouldSavePartial(s)) return false;
    sent = true;
    send(how);
    return true;
  };
}
