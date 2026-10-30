-- 0063: Avisos de sistema para el superadmin (Admin > Avisos): un cron que falla (cobros, avisos, recordatorios) o
-- errores de la app por encima del umbral (OPS_ALERT_THRESHOLD). Los encola el servidor con admin_event_enqueue (0059)
-- y los manda el mismo despachador. Sin datos de personas: solo el nombre del cron, conteos y el umbral.
--
-- No es un tipo que se pueda apagar en las preferencias: llega siempre, como la prueba, por los canales encendidos.
-- Se puede repetir sin daño.

alter table public.admin_events drop constraint if exists admin_events_kind_check;
alter table public.admin_events add constraint admin_events_kind_check
  check (kind in ('registro', 'pago', 'tarjeta', 'cobro_fallido', 'cancelacion', 'temporada', 'reto', 'condominio', 'referidor', 'prueba', 'sistema'));

-- Verificación al aplicar: debe salir true.
select pg_get_constraintdef(oid) like '%sistema%' as acepta_avisos_de_sistema from pg_constraint where conname = 'admin_events_kind_check';
