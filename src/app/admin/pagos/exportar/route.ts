// Exporta a CSV las suscripciones que coinciden con los filtros de Pagos (las mismas que muestra la tabla, sin paginar).
import { NextResponse, type NextRequest } from "next/server";
import { getAdminViewer } from "@/lib/admin-auth";
import { canSee, isStaff } from "@/lib/admin-perms";
import { exportSubscriptions } from "@/lib/admin";
import { subsCsv, subFiltersFrom } from "@/lib/admin-csv";
import { crToday } from "@/lib/today";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const v = await getAdminViewer();
  if (!v || !isStaff(v.role) || !canSee(v.role, "pagos")) return new NextResponse("Sin permiso", { status: 403 });
  const f = subFiltersFrom(Object.fromEntries(req.nextUrl.searchParams));
  const rows = await exportSubscriptions(v, f);
  return new NextResponse(subsCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="suscripciones-${crToday().iso}.csv"`,
      "cache-control": "no-store",
    },
  });
}
