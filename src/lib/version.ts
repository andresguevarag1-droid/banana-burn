/** Id del deploy que está sirviendo (Vercel). Vacío en local: ahí no se avisa de versiones nuevas. */
export const deployId = () => process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || process.env.BB_BUILD_ID || "";

/** ¿Hay que ofrecer actualizar? Solo si ambos ids existen y son distintos. */
export const isNewer = (mine: string | null | undefined, live: string | null | undefined) => Boolean(mine && live && mine !== live);

/** Commit corto (7) del build, o null en local. */
export const commitSha = () => (process.env.VERCEL_GIT_COMMIT_SHA || process.env.BB_RELEASE || "").slice(0, 7) || null;

/** Datos públicos del build: qué commit corre, cuándo se construyó y en qué entorno. Sin secretos ni ramas. */
export function buildInfo() {
  const env = process.env.VERCEL_ENV;
  return {
    v: deployId(),
    commit: commitSha(),
    builtAt: process.env.BB_BUILD_TIME || null,
    env: env === "production" || env === "preview" || env === "development" ? env : "local",
  };
}
