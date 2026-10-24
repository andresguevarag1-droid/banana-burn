# Cómo trabajar y publicar Banana Burn

`main` es producción: cada merge a `main` se publica solo en Vercel (https://www.bananaburn.app). Por eso nada entra a
`main` sin rama, PR y CI en verde.

## Flujo diario

1. **Rama nueva desde `main`**: `git switch main && git pull && git switch -c fix/lo-que-cambias` (prefijos: `fix/`,
   `feat/`, `docs/`).
2. **Commits chicos** con mensajes claros en español ("Cobro: reintento del día 8 con tiempo límite").
3. **Push y PR** hacia `main`: `git push -u origin fix/lo-que-cambias` y abre el Pull Request en GitHub.
4. **CI en verde** (`.github/workflows/ci.yml`, corre en cada push y PR):
   - TypeScript (`tsc`), ESLint y Vitest.
   - `next build` de producción + `scripts/check-client-bundle.mjs`: falla si el JavaScript del navegador trae mapas de
     fuente, no está minificado o contiene una llave secreta (el build usa valores "canario" para comprobarlo).
   - Migraciones `0001` a la última sobre Postgres 16 + suites `multiusuario.sql` y `comunidad.sql`, normal y con la beta
     terminada (`beta-off`). Lo mismo en local: `bash scripts/ci-sql.sh bb_local` (con `PGHOST`/`PGUSER` apuntando a
     un Postgres de pruebas, nunca al de producción).
5. **Preview de Vercel**: cada PR tiene su URL de preview (comentario de Vercel en el PR). Revísala en el celular antes
   de aprobar: registro, Hoy, entreno, pago de prueba.
6. **Merge a `main`** (squash o merge normal) = **producción**. Vercel publica en 1 a 3 minutos.
7. Revisa `https://www.bananaburn.app/api/version`: `commit` debe ser el del merge. Revisa `/admin/salud` (errores en
   cero o sin cambio).

### Migraciones de base de datos

- Nunca se edita una migración ya aplicada en producción (`0001` a `0041` hoy). Todo cambio va en una migración nueva,
  idempotente (se puede correr dos veces sin daño).
- Cada migración nueva suma su fila en `supabase/revisar_migraciones.sql` y sus pruebas en `supabase/tests/multiusuario.sql`.
- Orden al publicar: **primero** la migración en Supabase (SQL Editor) y **después** el merge del código que la usa. El
  código tolera que falte (avisa en el panel), pero no al revés.

## Volver atrás (rollback)

Si algo se rompe después de un deploy:

1. **Instant Rollback en Vercel** (segundos, sin rebuild): Vercel → proyecto `banana-burn` → **Deployments** → busca el
   último deploy de producción que estaba bien → menú `...` → **Instant Rollback** (o "Promote to Production"). El
   dominio vuelve a ese deploy de inmediato. Desde la terminal: `vercel rollback <url-del-deploy-bueno>`.
2. Ojo: después de un rollback, Vercel **deja de promover solo** los siguientes merges a `main` hasta que promuevas uno
   a mano (Deployments → deploy nuevo → "Promote to Production"). Es a propósito: así no se pisa el rollback.
3. Arregla en una rama (`git revert <sha>` si es lo más rápido), PR, CI verde, merge y promueve.
4. **Base de datos**: Instant Rollback no deshace migraciones. Por eso las migraciones son aditivas (columnas y
   funciones nuevas, nada se borra en el mismo deploy): el código viejo sigue funcionando con la base nueva.
5. Las variables de entorno no cambian con un rollback: si el problema fue una variable, corrígela y haz **Redeploy**.

## Versiones (tags)

Marca cada lanzamiento importante para saber qué hay en producción y poder comparar:

```bash
git switch main && git pull
git tag -a v1.0.0 -m "Lanzamiento pago 1 nov 2026"
git push origin v1.0.0
```

- `vMAYOR.MENOR.PARCHE`: parche = arreglos (`v1.0.1`), menor = funciones nuevas (`v1.1.0`), mayor = cambios grandes.
- En GitHub → **Releases** → "Draft a new release" → elige el tag → "Generate release notes".
- Para volver a una versión: en Vercel, el deploy de ese commit (Deployments, filtra por commit) → Instant Rollback.

## Acción del dueño: proteger `main` (una sola vez)

GitHub → repo `andresguevarag1-droid/banana-burn` → **Settings** → **Branches** (o **Rules → Rulesets**) →
**Add branch ruleset**:

1. Nombre: `main protegida`. Enforcement status: **Active**. Target branches: **Add target → Include default branch**.
2. Marca **Restrict deletions** y **Block force pushes**.
3. Marca **Require a pull request before merging** (aprobaciones requeridas: 0 si trabajas solo, 1 si hay equipo).
4. Marca **Require status checks to pass** → **Add checks** y agrega (aparecen después de la primera corrida del CI):
   `Tipos, lint y pruebas`, `Build de producción y revisión del bundle`, `SQL (lanzamiento)`, `SQL (beta-off)`.
   Marca también **Require branches to be up to date before merging**.
5. **Create**. Si usas el plan gratis con repo privado y no aparece "Rulesets", usa **Branches → Add classic branch
   protection rule** con el patrón `main` y las mismas opciones.
6. En Vercel → Settings → **Git**: deja "Production Branch" = `main`. Opcional: Settings → **Deployment Protection**
   para que las previews pidan login de Vercel.
