// Genera la sección de datos de 0033_retos_gratis.sql. Uso: npx vite-node scripts/gen-catalog-0033.ts
import { catalog0033Sql } from "../src/lib/catalog-0033";
process.stdout.write(catalog0033Sql());
