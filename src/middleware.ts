import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/security/redirect";
import { PRIVATE_NO_STORE, WALL_PATH, gateAction, needsAccessCheck } from "@/lib/access-gate";
import { burstLimiter, clientIpFrom } from "@/lib/security/ip";

/** Estado de ejemplo de la tarjeta en modo demo (solo sin Supabase). */
const DEMO_CARD_COOKIE = "bb_demo_tarjeta";
/** Registro de lenguaje de ejemplo en modo demo (mismo nombre que voice-server.ts; aquí sin importar next/headers). */
const DEMO_VOICE_COOKIE = "bb_demo_lenguaje";

/** Parámetros del demo de persona y programa (mismos nombres de cookie que demo-persona.ts; aquí sin next/headers). */
const DEMO_PARAMS: [string, string, RegExp][] = [
  ["programa", "bb_demo_programa", /^(no|si|pilates-casa-30|banana-girl)$/],
  ["dia", "bb_demo_dia", /^([1-9]|[1-5]\d|60)$/],
  ["estado", "bb_demo_estado", /^(activo|pausado|completado)$/],
  ["persona", "bb_demo_persona", /^(chica|chico|auto)$/],
];

/**
 * Freno grueso de ráfagas por IP (memoria de cada instancia del middleware, sin consultar la base): solo corta lo que
 * ningún humano hace (por defecto más de 900 peticiones por minuto desde una IP). Holgado a propósito: en datos móviles
 * de Latinoamérica muchas personas comparten IP (CGNAT). MW_BURST_MAX=0 lo apaga. Los límites finos por persona viven
 * en cada ruta y acción (src/lib/security/limits.ts) y en la base. Webhook de pagos y cron nunca pasan por aquí.
 */
const BURST_MAX = (() => { const n = Number(process.env.MW_BURST_MAX ?? 900); return Number.isFinite(n) && n >= 0 ? n : 900; })();
const burst = burstLimiter(BURST_MAX, 60_000);
const EXEMPT = /^\/api\/(pagos\/webhook|cron\/)/;

function tooFast(retryAfter: number) {
  return new NextResponse(JSON.stringify({ ok: false, error: "Demasiadas solicitudes seguidas. Espera un momento e intenta de nuevo." }), {
    status: 429, headers: { "Content-Type": "application/json; charset=utf-8", "Retry-After": String(retryAfter), "Cache-Control": PRIVATE_NO_STORE },
  });
}

/** Lo privado nunca queda en cachés compartidas (CDN, proxies) ni en el disco del navegador. */
function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", PRIVATE_NO_STORE);
  return res;
}

export async function middleware(req: NextRequest) {
  const p0 = req.nextUrl.pathname;
  if (BURST_MAX > 0 && !EXEMPT.test(p0)) {
    const r = burst(clientIpFrom(req.headers));
    if (!r.ok) return tooFast(r.retryAfter);
  }
  // /api y /og: solo el freno de arriba (cada ruta valida su sesión y su cache; next.config pone no-store en /api).
  if (p0.startsWith("/api/") || p0 === "/og") return NextResponse.next();
  if (!isSupabaseConfigured) {
    // Modo demo: ?demo=<estado> en Mi plan elige el estado de ejemplo de la tarjeta y del cobro (trial-demo.ts) para toda la app.
    // ?lenguaje=basico|intermedio|tecnico elige el registro de ejemplo ("Cómo te hablo") desde esta misma página.
    const l = req.nextUrl.searchParams.get("lenguaje");
    const voice = l === "basico" || l === "intermedio" || l === "tecnico" ? l : null;
    if (voice) req.cookies.set(DEMO_VOICE_COOKIE, voice);
    // ?programa=no|si|pilates-casa-30|banana-girl, ?dia=N, ?estado=activo|pausado|completado y ?persona=chica|chico|auto:
    // persona y programa de ejemplo (demo-persona.ts) para revisar cada estado de Hoy, Entrenar y los programas de chicas.
    const demo: [string, string][] = [];
    for (const [param, cookie, ok] of DEMO_PARAMS) {
      const val = req.nextUrl.searchParams.get(param);
      if (val && ok.test(val)) { req.cookies.set(cookie, val); demo.push([cookie, val]); }
    }
    const res = voice || demo.length ? NextResponse.next({ request: req }) : NextResponse.next();
    const d = req.nextUrl.searchParams.get("demo");
    if (d && /^[a-z]{3,12}$/.test(d)) res.cookies.set(DEMO_CARD_COOKIE, d, { path: "/", sameSite: "lax", maxAge: 3600 });
    if (voice) res.cookies.set(DEMO_VOICE_COOKIE, voice, { path: "/", sameSite: "lax", maxAge: 3600 });
    for (const [cookie, val] of demo) res.cookies.set(cookie, val, { path: "/", sameSite: "lax", maxAge: 3600 });
    return noStore(res);
  }
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  // getClaims: con llaves de firma asimétricas (Supabase → JWT Keys) verifica el token aquí, sin una llamada a Auth en
  // cada navegación; con la llave antigua (HS256) hace lo mismo que getUser. Refresca la sesión vencida igual que antes.
  // Las páginas siguen validando con getUser (getViewer) y la RLS valida el token en cada consulta.
  const { data: claims } = await sb.auth.getClaims();
  const user = claims?.claims?.sub ? claims.claims : null;
  const path = req.nextUrl.pathname;
  const isPrivate = path.startsWith("/app") || path.startsWith("/admin") || path.startsWith("/bienvenida");
  if (isPrivate && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    url.searchParams.set("next", safeNext(`${path}${req.nextUrl.search}`, "/app"));
    return noStore(NextResponse.redirect(url));
  }
  // /entrar ya no rebota a la app: si hay sesión, la página ofrece seguir o entrar con otra cuenta.
  if (user && path === "/registro") {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return noStore(NextResponse.redirect(url));
  }
  // Muro de planes en el servidor: sin plan ni prueba (has_app_access, misma regla que entitlements.ts), una sección
  // pagada no se ejecuta; se sirve Mi plan y el muro la tapa. Solo una consulta extra y solo para páginas que piden plan.
  const req0 = { path, method: req.method, isAction: req.headers.has("next-action") };
  if (user && needsAccessCheck(req0)) {
    const { data, error } = await sb.rpc("has_app_access");
    if (error) console.warn(JSON.stringify({ scope: "acceso", msg: "has_app_access falló", code: error.code ?? null }));
    if (gateAction({ ...req0, signedIn: true, hasAccess: error ? null : data === true }) === "rewrite") {
      const url = req.nextUrl.clone();
      url.pathname = WALL_PATH;
      url.search = "";
      const rw = NextResponse.rewrite(url, { request: req });
      res.cookies.getAll().forEach((c) => rw.cookies.set(c));
      return noStore(rw);
    }
  }
  return noStore(res);
}

export const config = { matcher: ["/app/:path*", "/admin/:path*", "/bienvenida", "/entrar", "/registro", "/pago/:path*", "/api/:path*", "/og"] };
