import { androidAssetLinks, wellKnownJson } from "@/lib/native/app-links";

// App Links de la app de Android (src/lib/native/app-links.ts).
export const dynamic = "force-dynamic";

export function GET() {
  return wellKnownJson(androidAssetLinks(process.env));
}
