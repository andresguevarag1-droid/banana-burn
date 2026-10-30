/**
 * Pase de navegador. Casi todos llegan de un anuncio y se registran dentro de Instagram o Facebook: la sesión vive en
 * ese navegador. Para instalar la LinkApp hay que abrirla en Safari o Chrome, y ahí llegaban sin sesión (pantalla de
 * entrar, sin recordar la contraseña). El ayudante de instalación cambia la dirección de la página por la misma ruta con
 * `?entrar=<pase>`; "Abrir en el navegador" (o el enlace copiado) lleva el pase y el middleware lo manda a
 * /auth/correo, que pide un toque y entra (un solo uso, 30 minutos, solo clientes).
 */
export const HANDOFF_PARAM = "entrar";

/** Ruta de la app con el pase. Solo rutas de la app; cualquier otra cosa, Hoy. Quita un pase anterior. */
export function handoffPath(next: string | null, token: string): string {
  let path = "/app";
  let search = new URLSearchParams();
  if (next && next.startsWith("/app") && !next.startsWith("//") && !/[\\\s]/.test(next)) {
    try {
      const u = new URL(next, "https://x.invalid");
      if (u.origin === "https://x.invalid" && (u.pathname === "/app" || u.pathname.startsWith("/app/"))) { path = u.pathname; search = u.searchParams; }
    } catch { /* Hoy */ }
  }
  search.delete(HANDOFF_PARAM);
  search.set(HANDOFF_PARAM, token);
  return `${path}?${search.toString()}`;
}

/** Pase con forma válida (la firma se revisa en /auth/correo). */
export const looksLikeHandoff = (v: string | null): v is string => !!v && v.length <= 400 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v);

/** La ruta sin el pase (para seguir después de entrar, o para limpiar la dirección si ya hay sesión). */
export function withoutHandoff(path: string, search: string): string {
  const s = new URLSearchParams(search);
  s.delete(HANDOFF_PARAM);
  const q = s.toString();
  return q ? `${path}?${q}` : path;
}
