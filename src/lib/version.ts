/** Id del deploy que está sirviendo (Vercel). Vacío en local: ahí no se avisa de versiones nuevas. */
export const deployId = () => process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || process.env.BB_BUILD_ID || "";

/** ¿Hay que ofrecer actualizar? Solo si ambos ids existen y son distintos. */
export const isNewer = (mine: string | null | undefined, live: string | null | undefined) => Boolean(mine && live && mine !== live);
