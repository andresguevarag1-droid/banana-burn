// Kinds de los correos de regreso (#320), sin dependencias: los usan el cron (regreso.ts), /api/track (email_click) y el
// navegador, sin cargar el motor de entreno en la landing.
export const COMEBACK_STEPS = ["r1", "r2", "r3", "r4"] as const;
export type ComebackStep = (typeof COMEBACK_STEPS)[number];
/** Tipo en notification_log, en las etiquetas de Resend y en el ?e= del botón (email_click). */
export const comebackKind = (s: ComebackStep) => `regreso_${s}` as const;
export type ComebackKind = ReturnType<typeof comebackKind>;
export const COMEBACK_KINDS: ComebackKind[] = COMEBACK_STEPS.map(comebackKind);
export const isComebackKind = (k: unknown): k is ComebackKind => (COMEBACK_KINDS as unknown[]).includes(k);
