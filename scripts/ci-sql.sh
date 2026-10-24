#!/usr/bin/env bash
# Suites SQL (RLS multiusuario y comunidad) sobre un Postgres 16 desechable, igual que en local con stub.sql.
# Uso: PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres bash scripts/ci-sql.sh <base> [beta-off]
#   beta-off: corre todo como si la beta hubiera terminado (cambia 2026-11-01 por 2026-10-01 en una copia).
# Sale con error si una migración falla o si alguna verificación da FAIL.
set -euo pipefail
DB=${1:?falta el nombre de la base}
MODE=${2:-}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cp -r "$ROOT/supabase" "$WORK/supabase"
if [ "$MODE" = "beta-off" ]; then sed -i 's/2026-11-01/2026-10-01/g' "$WORK"/supabase/migrations/*.sql "$WORK"/supabase/tests/*.sql; fi
cd "$WORK/supabase"
psql -X -q -d postgres -v ON_ERROR_STOP=1 -c "drop database if exists $DB" -c "create database $DB"
psql -X -q -d "$DB" -v ON_ERROR_STOP=1 -f tests/stub.sql > /dev/null
for f in migrations/*.sql; do
  if ! psql -X -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f" > /dev/null 2> "$WORK/err.txt"; then
    echo "FALLÓ la migración $f"; head -20 "$WORK/err.txt"; exit 1
  fi
done
status=0
for t in multiusuario comunidad; do
  out=$(psql -X -q -d "$DB" -f "tests/$t.sql" 2>&1 || true)
  echo "$out" | grep -E 'FAIL|RESUMEN' | sed 's/^psql:[^ ]* //' || true
  if echo "$out" | grep -q 'FAIL'; then status=1; fi
  if ! echo "$out" | grep -Eq 'RESUMEN.* 0 fallas'; then echo "La suite $t no terminó con 0 fallas"; status=1; fi
done
exit $status
