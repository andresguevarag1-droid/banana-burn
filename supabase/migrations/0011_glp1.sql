-- Programa Banana Shield (GLP-1 recetado). Datos de salud: mismo RLS que profiles/daily_logs.
alter table public.profiles
  add column if not exists glp1 boolean not null default false,
  add column if not exists glp1_med text check (glp1_med in ('semaglutida','tirzepatida','liraglutida','otro')),
  add column if not exists glp1_injection_dow smallint check (glp1_injection_dow between 0 and 6),
  add column if not exists glp1_since date;

alter table public.daily_logs
  add column if not exists nausea smallint check (nausea between 0 and 3),
  add column if not exists fiber_g smallint check (fiber_g between 0 and 150);
