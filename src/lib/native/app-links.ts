// Universal Links (iOS) y App Links (Android): qué enlaces de www.bananaburn.app abren la app nativa en vez del
// navegador. Puro y probado (app-links.test.ts); lo sirven src/app/.well-known/*. Sin las variables de entorno
// (APPLE_TEAM_ID, ANDROID_CERT_SHA256) no se publica nada: la web sigue igual que hoy (404).
//
// Las mismas rutas van en ios/App/App/App.entitlements (dominio) y en android/app/src/main/AndroidManifest.xml (rutas).
// - /app, /entrar y /bienvenida: la app y su login.
// - /auth/*: enlaces de los correos (confirmar cuenta, recuperar contraseña: token_hash, funcionan en otro aparato).
//   Excepción en iOS: /auth/callback?code=… es la vuelta del login con Google en la WEB (su verificador PKCE vive en el
//   navegador); si abriera la app fallaría. Android no puede filtrar por query (ver docs/app-nativa.md).
// - Landing, precios, retos públicos, referidos (/r) y condominios (/c) siguen en el navegador.
import { clean } from "@/lib/env";

export const APP_ID = "app.bananaburn";

export const APP_LINK_PATHS = ["/app", "/app/*", "/auth/*", "/entrar", "/entrar/*", "/bienvenida"] as const;

const TEAM_ID = /^[A-Z0-9]{10}$/;
const SHA256 = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/** apple-app-site-association, o null si falta APPLE_TEAM_ID (o no es válido). */
export function appleAppSiteAssociation(env: Record<string, string | undefined>) {
  const team = clean(env.APPLE_TEAM_ID).toUpperCase();
  if (!TEAM_ID.test(team)) return null;
  const appID = `${team}.${APP_ID}`;
  return {
    applinks: {
      details: [
        {
          appIDs: [appID],
          components: [
            { "/": "/auth/callback", "?": { code: "*" }, exclude: true, comment: "Vuelta del login con Google en la web" },
            ...APP_LINK_PATHS.map((p) => ({ "/": p })),
          ],
        },
      ],
    },
    // Autocompletar el correo y la contraseña guardados para bananaburn.app dentro de la app.
    webcredentials: { apps: [appID] },
  };
}

/** assetlinks.json, o null si falta ANDROID_CERT_SHA256 (huellas SHA-256 separadas por coma: debug, subida y Play). */
export function androidAssetLinks(env: Record<string, string | undefined>) {
  const prints = clean(env.ANDROID_CERT_SHA256)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => SHA256.test(s));
  if (!prints.length) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
      target: { namespace: "android_app", package_name: APP_ID, sha256_cert_fingerprints: [...new Set(prints)] },
    },
  ];
}

export function wellKnownJson(body: unknown) {
  if (!body) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600, s-maxage=3600" },
  });
}
