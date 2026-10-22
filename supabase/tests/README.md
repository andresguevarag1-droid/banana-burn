# Pruebas de seguridad multiusuario (RLS)

Corren todas las migraciones sobre un Postgres 16 local con stubs de Supabase (`auth.users`, `auth.uid()` leyendo
`request.jwt.claims` como PostgREST, roles `anon`/`authenticated`/`service_role` y `storage.objects`).

```bash
createdb bb && psql -d bb -f supabase/tests/stub.sql
for f in supabase/migrations/*.sql; do psql -d bb -v ON_ERROR_STOP=1 -f "$f"; done

# 1. Suite multiusuario (A, B, D, staff, soporte, prueba vencida): imprime PASS/FAIL y falla si algo no se cumple
psql -d bb -X -q -f supabase/tests/multiusuario.sql 2>&1 | grep -E 'FAIL|RESUMEN'

# 2. Carreras: dos sesiones simultáneas de la misma persona (doble XP, doble entreno, tope de retos)
PSQL="psql -d bb" bash supabase/tests/carreras.sh

# 3. Escenarios históricos de 0012 (revisión manual: cada "debe ERROR / debe N" debe cumplirse)
psql -d bb -f supabase/tests/rls.sql
```

`multiusuario.sql` cubre, para cada tabla con datos personales, que una cuenta no lee, edita, borra ni inserta a nombre
de otra; la visibilidad de la comunidad (seguidores, "Solo yo"); que nadie se sube de rol o plan ni se regala XP; que las
RPC `SECURITY DEFINER` validan `auth.uid()`; el mínimo privilegio del staff y los límites de frecuencia.
