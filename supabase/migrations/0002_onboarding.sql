-- Preferencias de entrenamiento capturadas en la bienvenida
alter table public.profiles
  add column if not exists train_days smallint not null default 6 check (train_days between 3 and 6),
  add column if not exists equipment text not null default 'gym' check (equipment in ('gym','casa','mixto')),
  add column if not exists goal_type text not null default 'grasa' check (goal_type in ('grasa','recomp','fuerza')),
  add column if not exists train_time text;
