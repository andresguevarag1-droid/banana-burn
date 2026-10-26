-- 0058_salud.sql: energía activa del día desde Salud (HealthKit en iPhone, Health Connect en Android), leída por la app
-- nativa. Aditiva e idempotente. Requiere 0001-0057. Los pasos y el peso de Salud usan lo que ya existe
-- (daily_logs.steps y weights); la energía activa no tenía dónde ir (daily_logs.kcal es lo que se come).
alter table public.daily_logs add column if not exists active_kcal int;
alter table public.daily_logs drop constraint if exists daily_logs_active_kcal_range;
alter table public.daily_logs add constraint daily_logs_active_kcal_range check (active_kcal is null or active_kcal between 0 and 10000) not valid;
