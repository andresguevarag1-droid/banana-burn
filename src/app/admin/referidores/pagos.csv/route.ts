// CSV de pagos a referidores (para conciliar SINPE y transferencias). Solo superadmin.
import { NextResponse } from "next/server";
import { getAdminViewer } from "@/lib/admin-auth";
import { can } from "@/lib/admin-perms";
import { loadAdminAffiliates, payoutsCsv } from "@/lib/admin-affiliates";
import { crToday } from "@/lib/today";
import { hitLimit, tooManyText } from "@/lib/security/limits";

export const dynamic = "force-dynamic";

export async function GET() {
  const v = await getAdminViewer();
  if (!v || !can(v.role, "affiliates.manage")) return new NextResponse("Sin permiso", { status: 403 });
  if (!v.demo) { const lim = await hitLimit("admin:masivo", v.id); if (!lim.ok) return tooManyText(lim); }
  const d = await loadAdminAffiliates(v.demo);
  return new NextResponse(payoutsCsv(d.payouts), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="pagos-referidores-${crToday().iso}.csv"`,
      "cache-control": "no-store",
    },
  });
}
