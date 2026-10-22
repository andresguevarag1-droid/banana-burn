#!/usr/bin/env bash
# Banana Burn · carreras (doble clic / dos pestañas): dos sesiones simultáneas de la MISMA persona.
# Uso: PSQL="psql -h <host> -p <puerto> -U postgres -d bb" bash supabase/tests/carreras.sh
# Requiere stub.sql + migraciones 0001→0014 aplicadas. Imprime PASS/FAIL y termina con código 1 si algo falla.
set -u
PSQL=${PSQL:-psql -d bb}
Q="$PSQL -X -q -t -A -v ON_ERROR_STOP=1"
U=7a7a7a7a-0000-4000-8000-00000000007a
fails=0
check() { if [ "$2" = "$3" ]; then echo "PASS $1 ($2)"; else echo "FAIL $1 (esperado $3, obtuvo $2)"; fails=$((fails+1)); fi; }

$Q -c "delete from auth.users where id = '$U'; insert into auth.users (id, email) values ('$U', 'carrera@prueba.test');
  update public.profiles set onboarded = true where id = '$U';
  insert into public.workouts (user_id, day, template, started_at) values ('$U', current_date, 'pierna', now());
  insert into public.daily_logs (user_id, day, steps) values ('$U', current_date, 1000);" >/dev/null

# Cada sesión: entra como la persona, inserta y espera 1.5 s antes de confirmar (la otra corre en ese hueco).
session() {
  $PSQL -X -q -v ON_ERROR_STOP=0 <<SQL 2>&1 | grep -E "ERROR" | sed 's/^/    sesión: /'
begin;
select set_config('request.jwt.claims', '{"sub":"$U","role":"authenticated"}', true);
set local role authenticated;
$1;
select pg_sleep(1.5);
commit;
SQL
}
race() { session "$1" & sleep 0.3; session "$1" & wait; }

race "insert into public.xp_events (user_id, kind, xp) values ('$U', 'workout', 100)"
check "doble XP de entreno en paralelo" "$($Q -c "select count(*) from public.xp_events where user_id = '$U' and kind = 'workout'")" 1

race "insert into public.xp_events (user_id, kind, xp) values ('$U', 'checkin', 15)"
check "doble XP de registro diario en paralelo" "$($Q -c "select count(*) from public.xp_events where user_id = '$U' and kind = 'checkin'")" 1

race "insert into public.xp_events (user_id, kind, xp) values ('$U', 'onboard', 50)"
check "doble XP de bienvenida en paralelo" "$($Q -c "select count(*) from public.xp_events where user_id = '$U' and kind = 'onboard'")" 1

race "insert into public.workouts (user_id, day, template, started_at) values ('$U', current_date, 'torso', '2026-01-01 10:00+00')"
check "doble guardado del mismo entreno en paralelo" "$($Q -c "select count(*) from public.workouts where user_id = '$U' and template = 'torso'")" 1

# Retos: con 2 activos, dos "Unirme" simultáneos a retos distintos no dejan 4 activos (tope 3).
$Q -c "insert into public.user_challenges (user_id, challenge_id) values ('$U', 'banana-30'), ('$U', 'agua-21')" >/dev/null
session "insert into public.user_challenges (user_id, challenge_id) values ('$U', 'pasos-30')" & sleep 0.3
session "insert into public.user_challenges (user_id, challenge_id) values ('$U', 'plancha-30')" & wait
check "tope de 3 retos con dos uniones en paralelo" "$($Q -c "select count(*) from public.user_challenges where user_id = '$U' and status = 'activo'")" 3

$Q -c "delete from auth.users where id = '$U'" >/dev/null
[ $fails -eq 0 ] && echo "RESUMEN carreras sin fallas" || { echo "RESUMEN $fails fallas"; exit 1; }
