// Genera el bloque 2 (siembra) de 0046_temporadas.sql desde src/lib/season-content.ts.
// Uso: npx vite-node scripts/gen-temporadas-seed.ts > /tmp/seed.sql
import { seasonSeedSql } from "../src/lib/season-content";
process.stdout.write(seasonSeedSql());
