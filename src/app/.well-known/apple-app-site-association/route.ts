import { appleAppSiteAssociation, wellKnownJson } from "@/lib/native/app-links";

// Universal Links de la app de iPhone (src/lib/native/app-links.ts). Apple lo pide sin redirecciones y como JSON.
export const dynamic = "force-dynamic";

export function GET() {
  return wellKnownJson(appleAppSiteAssociation(process.env));
}
