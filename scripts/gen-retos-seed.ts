// Genera el bloque de siembra de 0018_tienda_retos.sql desde src/lib/challenge-seed.ts.
// Uso: npx vite-node scripts/gen-retos-seed.ts > /tmp/seed.sql  (y pegar en la sección 7 de la migración)
// challenge-seed.test.ts verifica que la migración coincide con este archivo.
import { SEED } from "../src/lib/challenge-seed";
import { seedSql } from "../src/lib/challenge-seed-sql";
process.stdout.write(seedSql(SEED));
