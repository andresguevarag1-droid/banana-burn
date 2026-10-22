import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` lanza fuera del bundle de servidor de Next; en pruebas es un no-op.
      "server-only": fileURLToPath(new URL("./src/lib/security/server-only-noop.ts", import.meta.url)),
    },
  },
  test: { environment: "node" },
});
