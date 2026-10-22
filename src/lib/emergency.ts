// Números de emergencia y líneas de apoyo emocional por país (para mensajes de seguridad fijos del coach).
// Solo líneas nacionales oficiales y conocidas; si no hay una, se indica el número general de emergencias.

type Help = { emergency: string; crisis?: string };

const HELP: Record<string, Help> = {
  MX: { emergency: "911", crisis: "la **Línea de la Vida (800 911 2000)**" },
  CR: { emergency: "911", crisis: "la **Línea Aquí Estoy (1322)**" },
  CO: { emergency: "123" },
  CL: { emergency: "131", crisis: "la línea de prevención del suicidio **\\*4141**" },
  AR: { emergency: "107", crisis: "la línea **135** (o **0800 345 1435** desde todo el país)" },
  PE: { emergency: "106", crisis: "la **Línea 113, opción 5**" },
  ES: { emergency: "112", crisis: "la **Línea 024**" },
  US: { emergency: "911", crisis: "la línea **988** (también en español)" },
  PR: { emergency: "911", crisis: "la línea **988** (también en español)" },
  GT: { emergency: "1500" }, SV: { emergency: "911" }, HN: { emergency: "911" }, NI: { emergency: "118" }, PA: { emergency: "911" },
  DO: { emergency: "911" }, VE: { emergency: "911" }, EC: { emergency: "911" }, BO: { emergency: "165" }, UY: { emergency: "911" }, PY: { emergency: "911" },
};

/** Texto para "llama a emergencias" según el país del usuario. */
export function emergencyLine(country?: string | null) {
  const h = country ? HELP[country] : undefined;
  return h ? `al **${h.emergency}**` : "al número de emergencias de tu país (**911** en la mayoría de Latinoamérica, **112** en España)";
}

/** Línea de apoyo emocional del país, si la conocemos. */
export function crisisLine(country?: string | null) {
  const h = country ? HELP[country] : undefined;
  return h?.crisis ?? null;
}
