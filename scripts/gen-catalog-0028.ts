// Genera la sección de datos de 0028_retos_visual.sql. Uso: npx vite-node scripts/gen-catalog-0028.ts
import { catalog0028Sql } from "../src/lib/catalog-0028";
process.stdout.write(catalog0028Sql());
