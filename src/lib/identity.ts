// Verificación de identidad: lógica pura (sin servidor), probada en identity.test.ts.
// Privacidad primero (Ley 8968): nunca pedimos ni guardamos el número completo del documento. Solo el tipo, el país y
// los últimos 3 caracteres; las fotos van a un bucket privado y se borran al decidir (máximo 30 días). Ver 0030.

export type DocType = "cedula_cr" | "dimex" | "pasaporte" | "documento_nacional";

export const DOC_TYPES: { id: DocType; label: string; hint: string; country: "CR" | null; digits: boolean }[] = [
  { id: "cedula_cr", label: "Cédula de identidad de Costa Rica", hint: "La cédula tiene 9 dígitos.", country: "CR", digits: true },
  { id: "dimex", label: "DIMEX (Costa Rica)", hint: "El DIMEX tiene 11 o 12 dígitos.", country: "CR", digits: true },
  { id: "documento_nacional", label: "Documento nacional de otro país", hint: "Cédula, DNI, INE o el documento de identidad de tu país.", country: null, digits: false },
  { id: "pasaporte", label: "Pasaporte", hint: "De cualquier país.", country: null, digits: false },
];
export const DOC_LABEL: Record<DocType, string> = Object.fromEntries(DOC_TYPES.map((d) => [d.id, d.label])) as Record<DocType, string>;
export const isDocType = (x: unknown): x is DocType => typeof x === "string" && DOC_TYPES.some((d) => d.id === x);

/** Versión del texto de consentimiento que la persona aceptó (se guarda con la verificación). */
export const CONSENT_VERSION = "v1-2026-10";
/** Peso máximo por foto (igual que el bucket 'identidad'). */
export const ID_PHOTO_MAX = 6 * 1024 * 1024;
export const ID_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
/** Envíos por persona por día (la base también lo limita a 3). */
export const SUBMITS_PER_DAY = 3;

/** Texto del consentimiento (Ley 8968): para qué, qué guardamos, cuánto tiempo, con quién y tus derechos. */
export const CONSENT_POINTS = [
  "Para qué: confirmar que eres una persona real y mostrar el sello Verificado en tu perfil y junto a tu nombre en la comunidad. No lo usamos para nada más.",
  "Qué pedimos: una foto del frente de tu documento, una selfie sosteniéndolo y tu nombre como aparece en él. Nunca te pedimos el número completo: solo sus últimos 3 caracteres, para comparar con la foto.",
  "Quién lo ve: solo una persona de soporte de Banana Burn, con enlaces que vencen en 60 segundos. Cada vez que alguien abre tus fotos queda registrado.",
  "Cuánto tiempo: borramos las fotos y tu nombre del documento apenas decidimos. Si no alcanzamos a revisarlo, se borran a los 30 días. Guardamos solo el tipo de documento, el país, los últimos 3 caracteres y el resultado.",
  "Dónde: en Supabase (Estados Unidos), en un almacenamiento privado y cifrado.",
  "Tus derechos: puedes retirar tu verificación cuando quieras desde tu perfil y borramos todo. También puedes pedir acceso, rectificación o supresión a hola@bananaburn.app. Verificarte es voluntario.",
] as const;

/**
 * Últimos 3 caracteres del documento. Si la persona pega el número completo, solo se toman los últimos 3 en el
 * navegador y el resto nunca sale del dispositivo. En cédula y DIMEX solo dígitos.
 */
export function cleanLast3(raw: unknown, doc: DocType): { value: string; trimmed: boolean } | null {
  if (typeof raw !== "string") return null;
  const chars = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const only = doc === "cedula_cr" || doc === "dimex" ? chars.replace(/[^0-9]/g, "") : chars;
  if (only.length < 3) return null;
  return { value: only.slice(-3), trimmed: only.length > 3 };
}

/** Nombre como aparece en el documento: letras (con tildes), espacios, guion, apóstrofo y punto. Al menos 2 palabras. */
export function cleanIdName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (s.length < 4 || s.length > 120) return null;
  if (!/^[\p{L}][\p{L}\p{M} .'’-]*$/u.test(s)) return null;
  if (s.split(" ").filter((w) => /\p{L}/u.test(w)).length < 2) return null;
  return s;
}

/** Ruta de una foto del documento: dentro de la carpeta de la persona, sin subcarpetas (igual que la política del bucket). */
export function validIdPath(path: unknown, userId: string): path is string {
  return typeof path === "string" && /^[0-9a-f-]{36}\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}$/.test(path) && path.startsWith(`${userId}/`) && !path.includes("..");
}

/** Nombre de archivo seguro para subir (sin el nombre original, que puede traer datos personales). */
export function idPhotoName(kind: "frente" | "selfie", mime: string, rand: string) {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/heic" ? "heic" : "jpg";
  return `${kind}-${rand.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "x"}.${ext}`;
}

export type IdSubmission = { docType: DocType; country: string; last3: string; fullName: string; front: string; selfie: string; consent: boolean };

/** Valida un envío completo (servidor). Devuelve el valor limpio o un mensaje para la persona. */
export function validateSubmission(raw: Partial<Record<keyof IdSubmission, unknown>>, userId: string, countries: readonly string[]):
  { ok: true; value: IdSubmission } | { ok: false; error: string } {
  if (raw.consent !== true) return { ok: false, error: "Necesitamos tu consentimiento para revisar tu documento." };
  if (!isDocType(raw.docType)) return { ok: false, error: "Elige el tipo de documento." };
  const doc = DOC_TYPES.find((d) => d.id === raw.docType)!;
  const country = doc.country ?? (typeof raw.country === "string" ? raw.country.toUpperCase() : "");
  if (!/^[A-Z]{2}$/.test(country) || !countries.includes(country)) return { ok: false, error: "Elige el país que emitió tu documento." };
  // El servidor exige exactamente 3: si llegó algo más largo, no se recorta aquí (el navegador ya debió hacerlo).
  if (typeof raw.last3 !== "string" || raw.last3.length !== 3) return { ok: false, error: "Escribe solo los últimos 3 caracteres de tu documento." };
  const l3 = cleanLast3(raw.last3, doc.id);
  if (!l3 || l3.trimmed) return { ok: false, error: doc.digits ? "Escribe los últimos 3 dígitos de tu documento." : "Escribe solo los últimos 3 caracteres de tu documento." };
  const fullName = cleanIdName(raw.fullName);
  if (!fullName) return { ok: false, error: "Escribe tu nombre completo como aparece en el documento." };
  if (!validIdPath(raw.front, userId) || !validIdPath(raw.selfie, userId) || raw.front === raw.selfie) return { ok: false, error: "Sube las dos fotos de nuevo." };
  return { ok: true, value: { docType: doc.id, country, last3: l3.value, fullName, front: raw.front, selfie: raw.selfie, consent: true } };
}

/** Quita cualquier secuencia que parezca un número de documento antes de registrar un error (nunca IDs en el log). */
export function redactIds(s: string): string {
  return s.replace(/[0-9A-Z]?[\d][\d\s.-]{4,}[\d]/gi, "[oculto]");
}

export type IdStatus = "pendiente" | "aprobada" | "rechazada";
export const STATUS_TEXT: Record<IdStatus, string> = { pendiente: "En revisión", aprobada: "Verificada", rechazada: "Rechazada" };
