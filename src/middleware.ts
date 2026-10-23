import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/security/redirect";
import { PRIVATE_NO_STORE, WALL_PATH, gateAction, needsAccessCheck } from "@/lib/access-gate";

/** Estado de ejemplo de la tarjeta en modo demo (solo sin Supabase). */
const DEMO_CARD_COOKIE = "bb_demo_tarjeta";
/** Registro de lenguaje de ejemplo en modo demo (mismo nombre que voice-server.ts; aquí sin importar next/headers). */
const DEMO_VOICE_COOKIE = "bb_demo_lenguaje";

/** Lo privado nunca queda en cachés compartidas (CDN, proxies) ni en el disco del navegador. */
function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", PRIVATE_NO_STORE);
  return res;
}

export async function middleware(req: NextRequest) {
  if (!isSupabaseConfigured) {
    // Modo demo: ?demo=<estado> en Mi plan elige el estado de ejemplo de la tarjeta y del cobro (trial-demo.ts) para toda la app.
    // ?lenguaje=basico|intermedio|tecnico elige el registro de ejemplo ("Cómo te hablo") desde esta misma página.
    const l = req.nextUrl.searchParams.get("lenguaje");
    const voice = l === "basico" || l === "intermedio" || l === "tecnico" ? l : null;
    if (voice) req.cookies.set(DEMO_VOICE_COOKIE, voice);
    // ?programa=no|si: con o sin el programa de ejemplo activo (para revisar la rutina normal de Hoy y Entrenar).
    const progParam = req.nextUrl.searchParams.get("programa");
    if (progParam === "no" || progParam === "si") req.cookies.set("bb_demo_programa", progParam);
    const res = voice || progParam ? NextResponse.next({ request: req }) : NextResponse.next();
    const d = req.nextUrl.searchParams.get("demo");
    if (d && /^[a-z]{3,12}$/.test(d)) res.cookies.set(DEMO_CARD_COOKIE, d, { path: "/", sameSite: "lax", maxAge: 3600 });
    if (voice) res.cookies.set(DEMO_VOICE_COOKIE, voice, { path: "/", sameSite: "lax", maxAge: 3600 });
    if (progParam === "no" || progParam === "si") res.cookies.set("bb_demo_programa", progParam, { path: "/", sameSite: "lax", maxAge: 3600 });
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
  const { data: { user } } = await sb.auth.getUser();
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

export const config = { matcher: ["/app/:path*", "/admin/:path*", "/bienvenida", "/entrar", "/registro", "/pago/:path*"] };
