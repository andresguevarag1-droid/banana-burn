-- Personalización: nivel, minutos por sesión y "sin equipo"
alter table public.profiles
  add column if not exists level text not null default 'intermedio' check (level in ('principiante','intermedio','avanzado')),
  add column if not exists session_minutes smallint check (session_minutes between 10 and 120);

alter table public.profiles drop constraint if exists profiles_equipment_check;
alter table public.profiles add constraint profiles_equipment_check check (equipment in ('gym','casa','mixto','ninguno'));
