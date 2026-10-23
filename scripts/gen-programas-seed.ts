// Genera el bloque de siembra de 0024_programas.sql desde src/lib/program-seed.ts.
// Uso: npx vite-node scripts/gen-programas-seed.ts > /tmp/seed.sql  (y reemplazar la sección 6 de la migración)
// programs.test.ts verifica que la migración coincide con este archivo.
import { programSeedSql } from "../src/lib/program-seed";
process.stdout.write(programSeedSql());
