// Genera los bloques de siembra de programas desde src/lib/program-seed.ts.
// Uso: npx vite-node scripts/gen-programas-seed.ts > /tmp/seed.sql          (sección 6 de 0024_programas.sql)
//      npx vite-node scripts/gen-programas-seed.ts --0027 > /tmp/seed.sql   (sección 3 de 0027_experiencias.sql)
//      npx vite-node scripts/gen-programas-seed.ts --0037 > /tmp/seed.sql   (sección 3 de 0037_pilates_platanita.sql)
// programs.test.ts verifica que las migraciones coinciden con este archivo.
import { program0027Sql, program0037Sql, programSeedSql } from "../src/lib/program-seed";
process.stdout.write(process.argv.includes("--0037") ? program0037Sql() : process.argv.includes("--0027") ? program0027Sql() : programSeedSql());
