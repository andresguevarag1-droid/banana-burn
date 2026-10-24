import { clientIp, isSameOrigin, memoryRateLimit } from "@/lib/security";
import { MAX_BODY, cleanReport, isNoise } from "@/lib/monitor/report";
import { storeReport } from "@/lib/monitor/server";
import { jsonLog } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });

/**
 * Reporte de un error que vio la persona en el navegador (src/components/error-reporter.tsx, con sendBeacon).
 * Público y sin sesión: el cuerpo se valida y se limpia de datos personales antes de guardarlo (lib/monitor/report.ts),
 * con tope por IP en memoria y por cliente y global en la base (rate_hit, 0041). Responde 204 sin cuerpo.
 * Errores: 403 otro origen, 413 cuerpo grande, 400 inválido, 429 límite. Siempre JSON { ok: false, error }.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ ok: false, error: "Origen no permitido." }, 403);
  const ip = clientIp(req);
  if (!memoryRateLimit(`errores:${ip}`, 20, 10 * 60_000)) return json({ ok: false, error: "Demasiados reportes." }, 429, { "Retry-After": "600" });
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) return json({ ok: false, error: "Reporte demasiado grande." }, 413);
  const text = await req.text().catch(() => "");
  if (!text || text.length > MAX_BODY) return json({ ok: false, error: text ? "Reporte demasiado grande." : "Reporte vacío." }, text ? 413 : 400);
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return json({ ok: false, error: "JSON inválido." }, 400); }
  const r = cleanReport(raw, req.headers.get("user-agent"));
  if (!r) return json({ ok: false, error: "Reporte inválido." }, 400);
  if (isNoise(r.message, r.kind)) return new Response(null, { status: 204 });
  // Siempre queda una línea en el log (sirve aunque no haya base); la fila en app_errors si hay service_role.
  console.warn(jsonLog("warn", "ui", "client_error", { source: r.source, kind: r.kind, route: r.route, digest: r.digest, release: r.release, browser: r.browser }));
  await storeReport(r, ip);
  return new Response(null, { status: 204 });
}
