#!/usr/bin/env node
// Revisión del JavaScript que llega al navegador (.next/static) después de `next build`. Falla (código 1) si:
//   1. hay mapas de fuente (.map) o comentarios sourceMappingURL: dejarían leer el código original;
//   2. aparece el VALOR de una variable secreta del entorno actual (en CI se construye con valores "canario");
//   3. aparece el NOMBRE de una variable solo de servidor: señal de que un módulo de servidor terminó en el cliente;
//   4. aparece el prefijo de una llave secreta real (ONVO, Anthropic, Supabase, Resend);
//   5. un archivo .js grande no está minificado.
// Uso: node scripts/check-client-bundle.mjs [carpeta .next]   (por defecto ./.next)
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

/** Variables que NUNCA deben llegar al navegador (ni su valor ni su nombre). */
export const SERVER_SECRETS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "ONVO_SECRET_KEY",
  "ONVO_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
  "CRON_SECRET",
  "RESEND_API_KEY",
  "EMAIL_UNSUB_SECRET",
  "VAPID_PRIVATE_KEY",
  "REFERRAL_SECRET",
  "SENTRY_AUTH_TOKEN",
];

/** Prefijos de llaves secretas reales: si aparecen en el cliente, alguien pegó una llave en código o en NEXT_PUBLIC_. */
export const SECRET_PREFIXES = [/onvo_(?:live|test)_secret_key_/, /webhook_secret_[A-Za-z0-9]/, /sk-ant-[A-Za-z0-9]/, /sb_secret_[A-Za-z0-9]/, /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}/];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** ¿Parece minificado? Pocas líneas largas. Solo para archivos de más de 4 KB (los chicos pueden tener 1 línea igual). */
export function looksMinified(text) {
  if (text.length < 4096) return true;
  const lines = text.split("\n").length;
  return text.length / lines > 200;
}

/** Revisa una lista de archivos { path, text }. Devuelve los problemas encontrados (sin imprimir valores secretos). */
export function scan(files, env = {}) {
  const problems = [];
  const canaries = SERVER_SECRETS.map((k) => [k, (env[k] ?? "").trim()]).filter(([, v]) => v.length >= 12);
  for (const f of files) {
    if (f.path.endsWith(".map")) { problems.push(`${f.path}: mapa de fuente publicado`); continue; }
    if (!/\.(js|mjs|css|html|json|txt)$/.test(f.path)) continue;
    const t = f.text;
    if (/[#@]\s*sourceMappingURL=/.test(t)) problems.push(`${f.path}: comentario sourceMappingURL`);
    for (const [k, v] of canaries) if (t.includes(v)) problems.push(`${f.path}: contiene el valor de ${k}`);
    for (const k of SERVER_SECRETS) if (t.includes(k)) problems.push(`${f.path}: menciona ${k} (¿código de servidor en el cliente?)`);
    for (const re of SECRET_PREFIXES) if (re.test(t)) problems.push(`${f.path}: parece una llave secreta (${re.source.slice(0, 24)})`);
    if (f.path.endsWith(".js") && !looksMinified(t)) problems.push(`${f.path}: no está minificado`);
  }
  return problems;
}

function main() {
  const root = process.argv[2] || ".next";
  const staticDir = join(root, "static");
  if (!existsSync(staticDir)) { console.error(`No existe ${staticDir}: corre "next build" primero.`); process.exit(2); }
  const paths = walk(staticDir);
  const files = paths.map((p) => ({ path: relative(root, p), text: /\.(js|mjs|css|html|json|txt)$/.test(p) ? readFileSync(p, "utf8") : "" }));
  const problems = scan(files, process.env);
  const js = files.filter((f) => f.path.endsWith(".js"));
  const bytes = js.reduce((a, f) => a + Buffer.byteLength(f.text), 0);
  if (problems.length) {
    console.error(`Revisión del bundle del cliente: ${problems.length} problema(s)`);
    for (const p of problems.slice(0, 50)) console.error(`- ${p}`);
    process.exit(1);
  }
  console.log(`Bundle del cliente OK: ${js.length} archivos JS (${Math.round(bytes / 1024)} KB), sin mapas de fuente ni secretos.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
