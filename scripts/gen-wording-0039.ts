// Genera la sección de datos de 0039_textos_neutros.sql desde NEUTRAL_WORDING (src/lib/num.ts).
// Uso: npx vite-node scripts/gen-wording-0039.ts > /tmp/0039.sql   (wording-0039.test.ts verifica que coincide)
import { wording0039Sql } from "../src/lib/wording-0039";
process.stdout.write(wording0039Sql());
