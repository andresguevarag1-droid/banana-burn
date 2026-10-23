import { deployId } from "@/lib/version";

export const dynamic = "force-dynamic";

/** Versión desplegada ahora mismo, para que una pestaña abierta desde antes sepa que hay una nueva. Sin datos sensibles. */
export function GET() {
  return Response.json({ v: deployId() }, { headers: { "Cache-Control": "no-store" } });
}
