// Tema de la app según el coach activo (decisión del dueño, oct 2026): con Coach Platanita la experiencia se vuelve
// rosada. Aplica a sus programas (experience.coach = "platanita") y a las temporadas con ella de coach
// ("platanita-running", "platanita-raquetas", "platanita-cross", que elige seasonCoachId para perfiles de mujer).
// Con Coach Banana o sin programa no hay tema: la app queda exactamente igual.
export type AppTheme = "platanita";

/** Tema para un coach (id de coaches.ts). null = el amarillo de siempre. */
export function appThemeFor(coachId: string | null | undefined): AppTheme | null {
  return typeof coachId === "string" && /^platanita(-|$)/.test(coachId) ? "platanita" : null;
}

/** Color de la barra del navegador (meta theme-color) con el tema. */
export const THEME_COLOR: Record<AppTheme, string> = { platanita: "#FF8FC8" };
