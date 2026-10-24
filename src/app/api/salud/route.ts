import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import { integrationsFrom, missingFor } from "@/lib/health";
import { isOnvoConfigured, isOnvoOneTimeReady } from "@/lib/onvo";
import { bearerOk } from "@/lib/security";
import { getViewer, STAFF } from "@/lib/supabase/server";
import { pingSupabase } from "@/lib/health-ping";
import { buildInfo } from "@/lib/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * Salud de la app. Público: solo `{ ok }` (sin detalles). Con sesión de staff o `Authorization: Bearer CRON_SECRET`
 * (monitores externos): qué integraciones están configuradas (booleanos) y si Supabase responde.
 */
export async function GET(req: Request) {
  const db = await pingSupabase();
  const ok = isDemoMode || db.ok;
  const monitor = bearerOk(req.headers.get("authorization"), process.env.CRON_SECRET);
  const v = monitor ? null : await getViewer().catch(() => null);
  const staff = monitor || (!!v && !v.demo && STAFF.includes(v.role));
  if (!staff) return NextResponse.json({ ok }, { status: ok ? 200 : 503, headers: noStore });
  const integrations = integrationsFrom(process.env, { full: isOnvoConfigured(), oneTime: isOnvoOneTimeReady() });
  return NextResponse.json({
    ok, demo: isDemoMode, supabaseUp: db.ok, supabaseMs: db.ms, supabaseVia: db.via, integrations, missing: missingFor(integrations),
    version: buildInfo().commit, builtAt: buildInfo().builtAt, at: new Date().toISOString(),
  }, { status: ok ? 200 : 503, headers: noStore });
}
