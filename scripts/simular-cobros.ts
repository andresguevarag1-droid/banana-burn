// Simulacro de cobros: corre la lógica del cron /api/cron/cobros en dryRun con una fecha fija (por defecto el 8 de
// noviembre de 2026 a las 06:20 UTC, fin de los 7 días de la beta) y lista, SIN COBRAR, a quién se cobraría, cuánto y con
// qué procesador. Nunca llama a ONVO ni a Tilopay y nunca escribe en la base: los barridos usan un cliente de solo lectura
// que lanza ante cualquier insert, update, upsert, delete o rpc. El reporte identifica a cada persona solo por su id.
//
// Uso (contra producción, solo lectura; ver el PR #47):
//   npx --yes tsx --conditions=react-server --env-file=.env.simulacro scripts/simular-cobros.ts [--fecha ISO] [--salida carpeta]
// .env.simulacro necesita NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (nunca las llaves de ONVO ni de Tilopay).
// Deja <salida>/cobros-<fecha>.json y .csv (por defecto simulacro-cobros/, ignorada por git) y un resumen en la consola.
// Corre el simulacro dos veces seguidas y sale con error si las dos corridas no coinciden, si hay un cobro duplicado
// (usuario, periodo, procesador) o si algún barrido falló.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { plannedOf, runCobros } from "../src/lib/cobros-cron";
import { SIMULACRO_AT, chargeKeyOf, duplicateKeys, summarize, summaryLines, toCsv } from "../src/lib/cobros-simulacro";
import { BETA_DATE_OVERRIDDEN, BETA_ENDS_AT, BETA_GRACE_UNTIL } from "../src/lib/plans";
import { SUPABASE_URL } from "../src/lib/env";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const at = new Date(arg("fecha") ?? SIMULACRO_AT);
  if (!Number.isFinite(at.getTime())) throw new Error("--fecha no es una fecha ISO válida");
  const dir = arg("salida") ?? "simulacro-cobros";
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (ver el encabezado de este script).");
  if (BETA_DATE_OVERRIDDEN) console.warn(`AVISO: NEXT_PUBLIC_BETA_ENDS_AT está puesta (${BETA_ENDS_AT}); producción usa la fecha fija de la base.`);
  console.log(`Base: ${new URL(SUPABASE_URL).host} · fin de la beta ${BETA_ENDS_AT} · fin de la gracia ${BETA_GRACE_UNTIL}`);

  // Dos corridas seguidas: en dryRun nada cambia entre una y otra, así que deben dar exactamente lo mismo.
  const first = plannedOf(await runCobros(at, { dryRun: true }));
  const second = plannedOf(await runCobros(at, { dryRun: true }));
  const keys = (l: typeof first.planned) => l.filter((p) => p.accion === "cobrar").map(chargeKeyOf).sort().join("\n");
  const same = keys(first.planned) === keys(second.planned);
  const dups = [...new Set([...duplicateKeys(first.planned), ...duplicateKeys(second.planned)])];
  const errors = first.errors + second.errors;

  const resumen = summarize(first.planned, at.toISOString());
  mkdirSync(dir, { recursive: true });
  const stamp = at.toISOString().replace(/[:.]/g, "-");
  const json = join(dir, `cobros-${stamp}.json`);
  const csv = join(dir, `cobros-${stamp}.csv`);
  writeFileSync(json, JSON.stringify({ resumen, segundaCorridaIgual: same, duplicados: dups, errores: errors, cobros: first.planned }, null, 2) + "\n");
  writeFileSync(csv, toCsv(first.planned));

  for (const line of summaryLines(resumen)) console.log(line);
  console.log(`Segunda corrida igual a la primera: ${same ? "sí" : "NO"}`);
  console.log(`Barridos con error: ${errors}`);
  console.log(`Reporte: ${json} y ${csv}`);
  if (!same || dups.length || errors) {
    console.error("El simulacro NO está limpio: revisa los duplicados, los errores o la diferencia entre corridas antes del 8 de noviembre.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`simular-cobros: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
