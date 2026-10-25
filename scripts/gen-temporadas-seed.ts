// Genera el bloque 2 (siembra) de 0048_temporadas.sql desde src/lib/season-content.ts.
// Uso: npx vite-node scripts/gen-temporadas-seed.ts > /tmp/seed.sql
//      npx vite-node scripts/gen-temporadas-seed.ts --0050 > supabase/migrations/0050_temporadas_tecnica.sql
import { seasonSeedSql, seasonTechniqueSql } from "../src/lib/season-content";
process.stdout.write(process.argv.includes("--0050") ? seasonTechniqueSql() : seasonSeedSql());
