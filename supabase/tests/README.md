# Pruebas de seguridad multiusuario (RLS)

Corre todas las migraciones sobre un Postgres 16 local con stubs de Supabase y valida 20 escenarios
(nadie ve datos de salud ajenos, nadie se sube de plan/rol, privacidad de la comunidad, moderación, storage):

```bash
createdb bb && psql -d bb -f supabase/tests/stub.sql
for f in supabase/migrations/*.sql; do psql -d bb -v ON_ERROR_STOP=1 -f "$f"; done
psql -d bb -f supabase/tests/rls.sql   # cada "debe ERROR / debe 0" debe cumplirse
```
