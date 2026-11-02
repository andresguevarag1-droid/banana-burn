// Hoy del primer día (#193): mientras no haya ningún entreno guardado, Hoy muestra solo el saludo y el primer entreno.
// Desde el primer entreno guardado, Hoy vuelve completo.

/** Nunca ha entrenado (sin programa activo ni entreno hoy). En demo, ?primera=1 muestra este estado. */
export function isFirstDay({ program, demo, primera, workouts, trainedToday }: { program: boolean; demo: boolean; primera?: string; workouts: number; trainedToday: boolean }) {
  return !program && (demo ? primera === "1" : workouts === 0) && !trainedToday;
}

/** El aviso de tarjeta solo aparece el primer día si faltan 2 días o menos para el cobro (día 6 o 7 de la prueba). */
export const FIRST_DAY_CARD_MIN_DAY = 6;
