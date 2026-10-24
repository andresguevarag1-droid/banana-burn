// 0039: frases de la siembra que asumían a un hombre pasan a ser neutras en la base (catálogo, planes de retos y sesiones
// de programas). FUENTE: NEUTRAL_WORDING en num.ts; wording-0039.test.ts verifica que la migración trae este SQL.
import { NEUTRAL_WORDING } from "./num";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function wording0039Sql() {
  const out = ["-- Datos de 0039 (generados desde NEUTRAL_WORDING en src/lib/num.ts). Solo cambia esas frases exactas."];
  for (const [a, b] of NEUTRAL_WORDING) {
    const like = q(`%${a}%`);
    out.push(`update public.challenges_catalog set description = replace(description, ${q(a)}, ${q(b)}) where description like ${like};`);
    out.push(`update public.challenges_catalog set safety_note = replace(safety_note, ${q(a)}, ${q(b)}) where safety_note like ${like};`);
    out.push(`update public.challenges_catalog set program = replace(program::text, ${q(a)}, ${q(b)})::jsonb where program is not null and program::text like ${like};`);
    out.push(`update public.challenge_plans set days = replace(days::text, ${q(a)}, ${q(b)})::jsonb, updated_at = now() where days::text like ${like};`);
    out.push(`update public.program_sessions set focus = replace(focus, ${q(a)}, ${q(b)}) where focus like ${like};`);
    out.push(`update public.program_sessions set exercises = replace(exercises::text, ${q(a)}, ${q(b)})::jsonb where exercises::text like ${like};`);
  }
  return out.join("\n") + "\n";
}
