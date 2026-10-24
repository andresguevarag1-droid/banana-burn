import type { NextConfig } from "next";
import { publicEnvProblems } from "./src/lib/security/public-env";
import { cleanUrl } from "./src/lib/env";

// Una llave secreta en una variable NEXT_PUBLIC_ terminaría en el JavaScript del navegador: el build se detiene.
const envProblems = publicEnvProblems(process.env);
if (envProblems.length) throw new Error(`Variables de entorno inseguras:\n- ${envProblems.join("\n- ")}`);

// ───────────── Cabeceras de seguridad ─────────────
// CSP pragmática: Next (App Router) inyecta scripts inline para hidratar, y las páginas de marketing son estáticas,
// así que no usamos nonces (obligarían a renderizar todo dinámico). Mitigación: no hay sinks de HTML crudo en la app
// (sin dangerouslySetInnerHTML), React escapa todo el contenido de usuarios, y todo lo demás queda restringido a
// nuestro origen + Supabase + ONVO + Meta Pixel. Si se agrega un dominio (CDN de media, analítica), agrégalo aquí.

// cleanUrl tolera valores pegados sin https:// o con espacios (un valor raro no debe romper el build ni la CSP).
const origin = (u?: string) => {
  const c = cleanUrl(u);
  try { return c ? new URL(c).origin : null; } catch { return null; }
};
const supabase = origin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseWs = supabase ? supabase.replace(/^https:/, "wss:") : null;
const media = origin(process.env.EXERCISE_MEDIA_BASE_URL);
const isDev = process.env.NODE_ENV !== "production";
const isPreview = process.env.VERCEL_ENV === "preview";
const ONVO = "https://*.onvopay.com";
// Meta Pixel (anuncios de Instagram y Facebook): script, beacon /tr y la imagen de respaldo.
const META_JS = "https://connect.facebook.net";
const META_TR = "https://www.facebook.com";

const src = (...xs: (string | null | false | undefined)[]) => xs.filter(Boolean).join(" ");

const CSP = [
  `default-src 'self'`,
  `script-src ${src("'self'", "'unsafe-inline'", isDev && "'unsafe-eval'", "https://sdk.onvopay.com", ONVO, META_JS, isPreview && "https://vercel.live")}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src ${src("'self'", "data:", "blob:", supabase, media, ONVO, META_TR, isPreview && "https://vercel.live https://vercel.com")}`,
  `media-src ${src("'self'", "blob:", media)}`,
  `font-src ${src("'self'", "data:", isPreview && "https://vercel.live")}`,
  `connect-src ${src("'self'", supabase, supabaseWs, ONVO, META_TR, META_JS, isDev && "ws:", isPreview && "https://vercel.live wss://ws-us3.pusher.com")}`,
  `frame-src ${src(ONVO, isPreview && "https://vercel.live")}`,
  `worker-src 'self' blob:`,
  `manifest-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self' ${ONVO}`,
  `frame-ancestors 'none'`,
  !isDev && `upgrade-insecure-requests`,
].filter(Boolean).join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // Cámara solo para fotos de progreso (nuestro origen); pago para el formulario de ONVO (Apple/Google Pay).
  { key: "Permissions-Policy", value: `camera=(self), microphone=(), geolocation=(), payment=(self "https://sdk.onvopay.com" "https://checkout.onvopay.com"), usb=()` },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

// Versión del build (commit corto) y hora del build: /api/version, /admin/salud y los reportes de errores.
// No son secretos. BB_BUILD_TIME solo se lee en el servidor (así no cambia el hash de los archivos del navegador).
const BUILD_ENV = {
  BB_RELEASE: (process.env.VERCEL_GIT_COMMIT_SHA || process.env.BB_BUILD_ID || "").slice(0, 7),
  BB_BUILD_TIME: new Date().toISOString(),
};

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Producción: JavaScript minificado y SIN mapas de fuente públicos (es el valor por defecto; explícito para que nadie
  // lo active sin querer). scripts/check-client-bundle.mjs lo verifica en CI.
  productionBrowserSourceMaps: false,
  env: BUILD_ENV,
  // La imagen para compartir (/og) lee fuentes y marca del disco en el servidor.
  outputFileTracingIncludes: { "/og": ["./src/app/og/*.woff", "./public/icons/logo.svg", "./public/brand/mascota.jpg"] },
  images: {
    formats: ["image/avif", "image/webp"],
    // Ilustraciones de técnica del mono (Higgsfield). Se sirven optimizadas desde /_next/image.
    remotePatterns: [{ protocol: "https", hostname: "d8j0ntlcm91z4.cloudfront.net", pathname: "/user_3KlOTMXim7g88SAyF4A03SG6JZ6/**" }],
    minimumCacheTTL: 2678400,
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Datos personales: nunca en cachés compartidas.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      // Archivos de public/ (íconos, marca, landing, imágenes de correos): sin hash en el nombre, así que el navegador
      // los guarda una semana y la CDN un mes (Vercel vacía su caché en cada despliegue). /_next/static ya es immutable.
      { source: "/:dir(icons|brand|landing|email)/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400" }] },
    ];
  },
};

export default nextConfig;
