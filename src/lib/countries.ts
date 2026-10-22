// Países donde vive la audiencia de Banana Burn (LATAM + hispanos en EE. UU. y España).
// La zona horaria del navegador sugiere el país; el usuario lo confirma en la bienvenida.

export const COUNTRIES = [
  ["MX", "México"], ["GT", "Guatemala"], ["SV", "El Salvador"], ["HN", "Honduras"], ["NI", "Nicaragua"], ["CR", "Costa Rica"],
  ["PA", "Panamá"], ["CU", "Cuba"], ["DO", "República Dominicana"], ["PR", "Puerto Rico"], ["CO", "Colombia"], ["VE", "Venezuela"],
  ["EC", "Ecuador"], ["PE", "Perú"], ["BO", "Bolivia"], ["CL", "Chile"], ["AR", "Argentina"], ["UY", "Uruguay"], ["PY", "Paraguay"],
  ["US", "Estados Unidos"], ["ES", "España"], ["OT", "Otro país"],
] as const;

export type CountryCode = (typeof COUNTRIES)[number][0];
export const COUNTRY_NAME: Record<string, string> = Object.fromEntries(COUNTRIES);
export const isCountry = (c: unknown): c is CountryCode => typeof c === "string" && c in COUNTRY_NAME;

const TZ_COUNTRY: Record<string, CountryCode> = {
  "America/Mexico_City": "MX", "America/Monterrey": "MX", "America/Merida": "MX", "America/Cancun": "MX", "America/Tijuana": "MX", "America/Chihuahua": "MX", "America/Hermosillo": "MX", "America/Mazatlan": "MX",
  "America/Guatemala": "GT", "America/El_Salvador": "SV", "America/Tegucigalpa": "HN", "America/Managua": "NI", "America/Costa_Rica": "CR",
  "America/Panama": "PA", "America/Havana": "CU", "America/Santo_Domingo": "DO", "America/Puerto_Rico": "PR", "America/Bogota": "CO",
  "America/Caracas": "VE", "America/Guayaquil": "EC", "America/Lima": "PE", "America/La_Paz": "BO", "America/Santiago": "CL",
  "America/Argentina/Buenos_Aires": "AR", "America/Buenos_Aires": "AR", "America/Argentina/Cordoba": "AR", "America/Montevideo": "UY", "America/Asuncion": "PY",
  "Europe/Madrid": "ES", "Atlantic/Canary": "ES",
};

/** País sugerido a partir de la zona horaria del navegador. */
export function countryFromTz(tz: string | null | undefined): CountryCode {
  if (!tz) return "OT";
  if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
  if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Indiana|Kentucky|Boise)/.test(tz) || tz.startsWith("US/")) return "US";
  return "OT";
}
