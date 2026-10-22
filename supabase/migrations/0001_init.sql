-- Banana Burn · esquema inicial multiusuario con RLS
-- Ley 8968 (Costa Rica): datos de salud = datos sensibles → consentimiento separado, exportar y borrar cuenta.

create type public.app_role as enum ('free','pro','coach','support','admin','superadmin');
create type public.plan_mode as enum ('acelerada','recomp');

-- ───────────── Perfiles ─────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  dob date,
  sex text check (sex in ('m','f')),
  height_cm numeric(5,1),
  country text default 'CR',
  timezone text default 'America/Costa_Rica',
  role public.app_role not null default 'free',
  plan text not null default 'free',
  onboarded boolean not null default false,
  health_consent_at timestamptz,          -- consentimiento explícito datos de salud
  marketing_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ¿El usuario actual es staff? (security definer evita recursión de RLS)
create or replace function public.has_role(roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = any(roles));
$$;
create or replace function public.is_staff() returns boolean language sql stable as $$
  select public.has_role(array['coach','support','admin','superadmin']::public.app_role[]);
$$;
create or replace function public.is_admin() returns boolean language sql stable as $$
  select public.has_role(array['admin','superadmin']::public.app_role[]);
$$;

-- Crear perfil al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nadie puede auto-ascenderse: role/plan solo los cambia un admin (o el webhook con service_role)
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql as $$
begin
  if (new.role is distinct from old.role or new.plan is distinct from old.plan)
     and auth.uid() is not null and not public.is_admin() then  -- SQL editor / service_role no tienen auth.uid()
    raise exception 'No autorizado para cambiar rol o plan';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ───────────── Datos del usuario ─────────────
create table public.goals (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_weight numeric(5,1) not null,
  goal_weight numeric(5,1) not null,
  goal_date date not null,
  mode public.plan_mode not null default 'acelerada',
  start_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.weights (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  kg numeric(5,1) not null check (kg between 30 and 300),
  unique (user_id, day)
);

create table public.measurements (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  waist numeric(5,1), neck numeric(5,1), chest numeric(5,1), arm numeric(5,1), thigh numeric(5,1), hip numeric(5,1),
  unique (user_id, day)
);

create table public.daily_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  steps int, sleep_h numeric(3,1), water_glasses int,
  kcal int, protein_g int, energy smallint, stress smallint, hunger smallint,
  note text,
  primary key (user_id, day)
);

create table public.meals (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  name text not null, qty numeric, kcal int, protein numeric, carbs numeric, fat numeric,
  slot text, created_at timestamptz not null default now()
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  template text not null,
  started_at timestamptz, finished_at timestamptz,
  fun smallint, energy smallint, xp int default 0,
  created_at timestamptz not null default now()
);

create table public.workout_sets (
  id bigint generated always as identity primary key,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise text not null,
  set_no smallint not null,
  kg numeric(6,2), reps smallint, rir smallint, done boolean default true
);

create table public.coach_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, xp int not null, created_at timestamptz not null default now()
);

-- ───────────── Negocio ─────────────
create table public.subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'onvo',
  provider_customer_id text,
  provider_subscription_id text unique,
  status text not null,                       -- active, trialing, past_due, canceled
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.foods (
  id bigint generated always as identity primary key,
  name text not null, portion text, kcal int, protein numeric, carbs numeric, fat numeric,
  country text default 'CR', verified boolean default false
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id),
  action text not null, target text, meta jsonb,
  created_at timestamptz not null default now()
);

-- ───────────── RLS ─────────────
alter table public.profiles enable row level security;
create policy "perfil propio: leer" on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy "perfil propio: editar" on public.profiles for update using (id = auth.uid() or public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['goals','weights','measurements','daily_logs','meals','workouts','workout_sets','coach_messages','xp_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "propio: todo" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "staff: leer" on public.%I for select using (public.is_staff())', t);
  end loop;
end $$;

alter table public.subscriptions enable row level security;
create policy "suscripción propia" on public.subscriptions for select using (user_id = auth.uid() or public.is_staff());
-- escrituras solo vía webhook ONVO con service_role (bypassa RLS)

alter table public.foods enable row level security;
create policy "alimentos: leer" on public.foods for select using (true);
create policy "alimentos: admin" on public.foods for all using (public.is_admin()) with check (public.is_admin());

alter table public.audit_log enable row level security;
create policy "auditoría: admin" on public.audit_log for select using (public.is_admin());
create policy "auditoría: staff escribe" on public.audit_log for insert with check (public.is_staff() and actor = auth.uid());

create index on public.weights (user_id, day desc);
create index on public.workouts (user_id, day desc);
create index on public.workout_sets (user_id, exercise);
create index on public.meals (user_id, day);

-- Primer superadmin: después de registrarte ejecuta (una vez):
-- update public.profiles set role = 'superadmin' where id = (select id from auth.users where email = 'TU_CORREO');
