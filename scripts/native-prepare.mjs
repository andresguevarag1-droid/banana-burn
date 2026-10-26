// Prepara native/www antes de `cap sync`: la app nativa carga la web remota, pero la pantalla sin conexión vive dentro
// de la app y no puede pedir nada a internet. Copia la fuente y el logo, y escribe la URL del servidor (CAP_SERVER_URL,
// la misma que lee capacitor.config.ts). Uso: npm run native:sync
import { copyFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "native", "www");

function origin(u) {
  const raw = (u ?? "").trim().replace(/^(["'])(.*)\1$/, "$2");
  if (!raw) return null;
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin;
  } catch {
    return null;
  }
}

const server = origin(process.env.CAP_SERVER_URL) ?? "https://www.bananaburn.app";
writeFileSync(join(out, "server.js"), `window.BB_SERVER_URL = ${JSON.stringify(server)};\n`);
copyFileSync(join(root, "public", "icons", "logo.svg"), join(out, "logo.svg"));
copyFileSync(join(root, "node_modules", "@fontsource-variable", "plus-jakarta-sans", "files", "plus-jakarta-sans-latin-wght-normal.woff2"), join(out, "jakarta.woff2"));
console.log(`native/www listo (servidor: ${server})`);
