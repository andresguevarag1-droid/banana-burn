import { describe, expect, it } from "vitest";
import { androidAssetLinks, appleAppSiteAssociation, wellKnownJson } from "./app-links";

const FP = "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99";
const FP2 = "11:22:33:44:55:66:77:88:99:00:AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00:AA:BB:CC:DD:EE:FF";

describe("appleAppSiteAssociation", () => {
  it("sin Team ID no se publica nada", () => {
    expect(appleAppSiteAssociation({})).toBeNull();
    expect(appleAppSiteAssociation({ APPLE_TEAM_ID: "corto" })).toBeNull();
  });
  it("con Team ID: rutas de la app y excluye la vuelta del login con Google de la web", () => {
    const a = appleAppSiteAssociation({ APPLE_TEAM_ID: " abcde12345 " })!;
    expect(a.webcredentials.apps).toEqual(["ABCDE12345.app.bananaburn"]);
    const d = a.applinks.details[0];
    expect(d.appIDs).toEqual(["ABCDE12345.app.bananaburn"]);
    expect(d.components[0]).toMatchObject({ "/": "/auth/callback", "?": { code: "*" }, exclude: true });
    const paths = d.components.slice(1).map((c) => c["/"]);
    expect(paths).toContain("/app/*");
    expect(paths).toContain("/auth/*");
    expect(paths).not.toContain("/precios");
    expect(paths).not.toContain("/r/*");
  });
});

describe("androidAssetLinks", () => {
  it("sin huellas válidas no se publica nada", () => {
    expect(androidAssetLinks({})).toBeNull();
    expect(androidAssetLinks({ ANDROID_CERT_SHA256: "no-es-huella" })).toBeNull();
  });
  it("varias huellas, sin repetir, en mayúsculas", () => {
    const a = androidAssetLinks({ ANDROID_CERT_SHA256: `${FP.toLowerCase()}, ${FP2},${FP}` })!;
    expect(a[0].target.package_name).toBe("app.bananaburn");
    expect(a[0].target.sha256_cert_fingerprints).toEqual([FP, FP2]);
    expect(a[0].relation).toContain("delegate_permission/common.handle_all_urls");
  });
});

describe("wellKnownJson", () => {
  it("404 sin contenido, JSON con caché corta con contenido", async () => {
    expect(wellKnownJson(null).status).toBe(404);
    const r = wellKnownJson({ ok: 1 });
    expect(r.headers.get("Content-Type")).toBe("application/json");
    expect(await r.json()).toEqual({ ok: 1 });
  });
});
