// Sentry en el navegador, cargado DESPUÉS de que la página está lista: el SDK (~34 kB) va en un archivo aparte y no
// suma al JavaScript inicial de ninguna página (la landing carga igual de rápido en datos móviles). Los errores de antes
// de cargarlo igual llegan a /api/errores (error-reporter.tsx). Sin NEXT_PUBLIC_SENTRY_DSN no se descarga nada.
import { sentryOptions } from "./sentry";

type Sdk = typeof import("@sentry/nextjs");
let sdk: Promise<Sdk | null> | null = null;

export function loadSentry(): Promise<Sdk | null> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return Promise.resolve(null);
  sdk ??= import("@sentry/nextjs")
    .then((S) => { S.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.NEXT_PUBLIC_VERCEL_ENV)); return S; })
    .catch(() => null);
  return sdk;
}

/** Error que atrapó una pantalla de error (React no lo pasa a window.onerror): también a Sentry. Nunca lanza. */
export function captureBoundaryError(err: unknown) {
  void loadSentry().then((S) => { S?.captureException(err); }, () => {});
}
