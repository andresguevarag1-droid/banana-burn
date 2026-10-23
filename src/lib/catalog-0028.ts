// 0028: nombres llamativos, un color propio para cada programa y "21 días de abdomen" oculto (no compite con
// Operación Abdomen). FUENTE de la sección de datos de 0028_retos_visual.sql (lo verifica catalog-0028.test.ts) y
// del catálogo de respaldo / modo demo. La migración solo cambia lo que el panel todavía no editó.
import type { CoverStyle } from "./challenge-seed";

export type Restyle = { from: string; title?: string; cover?: CoverStyle; fromCover?: CoverStyle; hide?: true; mode?: [string, string] };

export const RESTYLE: Record<string, Restyle> = {
  // Programas Premium: cada uno con su color (las 7 portadas son distintas)
  "reconstruccion-8-semanas": { from: "Reconstrucción corporal 8 semanas", title: "Reconstrucción Total", mode: ["Modo reconstrucción", "Modo reconstrucción"] },
  "abdomen-marcado": { from: "Abdomen marcado", title: "Operación Abdomen", mode: ["Modo abdomen", "Modo operación abdomen"] },
  "brazos-definidos": { from: "Brazos definidos", title: "Brazos de Gorila", cover: "peel", fromCover: "ember", mode: ["Modo brazos", "Modo gorila"] },
  "dominadas-desde-cero": { from: "Dominadas desde cero", title: "Mi Primera Dominada", cover: "selva", fromCover: "noche" },
  "pierde-3kg-6-semanas": { from: "Pierde 3 kg en 6 semanas", title: "Quema Banana 6 semanas", mode: ["Modo quema", "Modo quema banana"] },
  "abdomen-21": { from: "21 días de abdomen", hide: true },
  // Retos de hábitos (gratis)
  "flexiones-30": { from: "Reto de flexiones", title: "Rey de las flexiones" },
  "pasos-30": { from: "10.000 pasos", title: "Caminata de la selva: 10.000 pasos" },
  "agua-21": { from: "Hidratado", title: "Hidratado 21 días" },
  "pasos-14": { from: "10.000 pasos en 14 días", title: "Sprint de pasos 14 días" },
  "sin-azucar-7": { from: "Sin azúcar 7 días", title: "Detox de azúcar 7 días" },
  "movilidad-14": { from: "Movilidad diaria 14 días", title: "Flexible como mono 14 días" },
};

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function catalog0028Sql() {
  const out = ["-- Datos de 0028 (generados desde src/lib/catalog-0028.ts). Solo cambian lo que el panel no editó."];
  for (const [slug, r] of Object.entries(RESTYLE)) {
    if (r.title) out.push(`update public.challenges_catalog set title = ${q(r.title)} where slug = ${q(slug)} and title = ${q(r.from)};`);
    if (r.cover && r.fromCover) out.push(`update public.challenges_catalog set cover = ${q(r.cover)} where slug = ${q(slug)} and cover = ${q(r.fromCover)};`);
    if (r.hide) out.push(`update public.challenges_catalog set status = 'oculto', featured = false where slug = ${q(slug)} and status = 'publicado';`);
    if (r.mode && r.mode[0] !== r.mode[1]) out.push(`update public.challenges_catalog set program = jsonb_set(program, '{experience,mode}', to_jsonb(${q(r.mode[1])}::text)) where slug = ${q(slug)} and kind = 'programa' and program->'experience'->>'mode' = ${q(r.mode[0])};`);
  }
  return out.join("\n") + "\n";
}
