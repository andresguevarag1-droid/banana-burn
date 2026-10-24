import { buildInfo } from "@/lib/version";

export const dynamic = "force-dynamic";

/**
 * Versión desplegada ahora mismo: `v` (id del deploy, lo usa la app para avisar que hay una versión nueva), `commit`
 * (SHA corto), `builtAt` (hora del build) y `env`. Público y sin datos sensibles.
 */
export function GET() {
  return Response.json(buildInfo(), { headers: { "Cache-Control": "no-store" } });
}
