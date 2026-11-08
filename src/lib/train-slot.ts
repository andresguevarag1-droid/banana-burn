// #197: a qué hora suele entrenar la persona (pregunta de un toque en la bienvenida). Se guarda como la hora del
// recordatorio (notification_prefs.reminder_time), que el cron de avisos ya respeta en modo "hourly".
export const TRAIN_SLOTS = [
  { id: "manana", label: "Mañana", hint: "5 a 9 a. m.", reminder: "06:00" },
  { id: "mediodia", label: "Mediodía", hint: "11 a. m. a 2 p. m.", reminder: "11:00" },
  { id: "tarde", label: "Tarde", hint: "4 a 7 p. m.", reminder: "15:00" },
  { id: "noche", label: "Noche", hint: "7 a 10 p. m.", reminder: "18:00" },
] as const;

export type TrainSlot = (typeof TRAIN_SLOTS)[number]["id"];

export const isTrainSlot = (v: unknown): v is TrainSlot => TRAIN_SLOTS.some((s) => s.id === v);

/** Hora local 'HH:MM' del recordatorio para la franja: una hora antes del inicio (la mañana, a las 6). */
export const reminderTimeFor = (slot: TrainSlot): string => TRAIN_SLOTS.find((s) => s.id === slot)!.reminder;

/** Franja de una hora local (0 a 23), para recordar el próximo entreno a la misma hora en que entrenó hoy (#286). */
export function slotAt(hour: number): TrainSlot {
  if (hour >= 4 && hour < 11) return "manana";
  if (hour >= 11 && hour < 16) return "mediodia";
  if (hour >= 16 && hour < 19) return "tarde";
  return "noche";
}
