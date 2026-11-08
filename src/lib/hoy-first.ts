// Hoy del primer día (#193): mientras no haya ningún entreno guardado, Hoy muestra solo el saludo y el primer entreno.
// Desde el primer entreno guardado, Hoy vuelve completo.

/** Nunca ha entrenado (sin programa activo ni entreno hoy). En demo, ?primera=1 muestra este estado. */
export function isFirstDay({ program, demo, primera, workouts, trainedToday }: { program: boolean; demo: boolean; primera?: string; workouts: number; trainedToday: boolean }) {
  return !program && (demo ? primera === "1" : workouts === 0) && !trainedToday;
}

/**
 * El aviso grande de tarjeta (TrialCardNotice) en Hoy solo sale el día 7 de la prueba: del día 1 al 6 va el banner de
 * Hoy (HoyCardBanner, #280), con o sin entrenos.
 */
export const FIRST_DAY_CARD_MIN_DAY = 7;

/**
 * Segundo entreno (#286): desde el día siguiente al primer entreno y mientras lleve uno solo, la tarjeta del entreno del
 * día se presenta como "Tu segundo entreno" (sin programa activo; el día del primer entreno, Hoy sigue igual).
 */
export function isSecondDay({ program, workouts, trainedToday }: { program: boolean; workouts: number; trainedToday: boolean }) {
  return !program && workouts === 1 && !trainedToday;
}
