// Genera las plantillas de Supabase Auth (supabase/templates/*.html) con el mismo diseño de los correos de la app.
// Uso: npm run emails:auth  → luego pega cada archivo en Supabase → Authentication → Emails → Templates.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { authTemplates } from "../src/lib/email/templates";

const dir = join(process.cwd(), "supabase", "templates");
for (const t of authTemplates()) {
  writeFileSync(join(dir, t.file), t.html + "\n");
  console.log(`${t.file.padEnd(24)} → ${t.supabase} · asunto: ${t.subject}`);
}
