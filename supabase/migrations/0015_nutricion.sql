-- Banana Burn, Nutrición: "Mis comidas" y XP por registrar comida con tope diario.
-- No reemplaza guard_xp_event (0012/0014): el XP de comidas lo otorga el servidor con service_role
-- (el guard general lo deja pasar) y este archivo agrega un candado propio solo para kind = 'meal'.
-- Para usuarios (authenticated/anon), 'meal' sigue siendo un tipo inválido en guard_xp_event: no pueden darse XP.

-- ───────────── 1. Mis comidas ─────────────
create table if not exists public.saved_foods (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  portion text not null default '1 porción' check (char_length(portion) <= 40),
  kcal int not null check (kcal between 0 and 5000),
  protein numeric(5,1) not null default 0 check (protein between 0 and 400),
  carbs numeric(5,1) not null default 0 check (carbs between 0 and 1000),
  fat numeric(5,1) not null default 0 check (fat between 0 and 500),
  created_at timestamptz not null default now()
);
create index if not exists saved_foods_user_created on public.saved_foods (user_id, created_at desc);

alter table public.saved_foods enable row level security;
drop policy if exists "saved_foods: leer propias" on public.saved_foods;
drop policy if exists "saved_foods: crear propias" on public.saved_foods;
drop policy if exists "saved_foods: editar propias" on public.saved_foods;
drop policy if exists "saved_foods: borrar propias" on public.saved_foods;
create policy "saved_foods: leer propias" on public.saved_foods for select using (user_id = auth.uid());
create policy "saved_foods: crear propias" on public.saved_foods for insert with check (user_id = auth.uid());
create policy "saved_foods: editar propias" on public.saved_foods for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "saved_foods: borrar propias" on public.saved_foods for delete using (user_id = auth.uid());
revoke all on public.saved_foods from anon;
grant select, insert, update, delete on public.saved_foods to authenticated;

-- Máximo 200 comidas guardadas por persona.
create or replace function public.guard_saved_foods_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  new.created_at := now();
  if (select count(*) from public.saved_foods where user_id = new.user_id) >= 200 then
    raise exception 'Llegaste al máximo de comidas guardadas' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists saved_foods_guard on public.saved_foods;
create trigger saved_foods_guard before insert on public.saved_foods for each row execute function public.guard_saved_foods_insert();

-- ───────────── 2. XP por registrar comida ─────────────
-- El servidor da 10 XP por registro, máximo 5 por día local del usuario. Segundo candado en la base:
-- como máximo 10 en 24 h (dos días locales) y nunca más eventos que comidas registradas en esas 24 h.
-- Si no se cumple, el insert se ignora en silencio (no rompe el registro de la comida).
create or replace function public.guard_meal_xp()
returns trigger language plpgsql set search_path = public as $$
declare n_xp int; n_meals int;
begin
  if new.kind is distinct from 'meal' then return new; end if;
  if new.xp is null or new.xp < 0 or new.xp > 10 then raise exception 'XP fuera de rango' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('bb:xp-meal:' || new.user_id::text, 0));
  new.created_at := now();
  select count(*) into n_xp from public.xp_events where user_id = new.user_id and kind = 'meal' and created_at > now() - interval '24 hours';
  select count(*) into n_meals from public.meals where user_id = new.user_id and created_at > now() - interval '24 hours';
  if n_xp >= 10 or n_xp >= n_meals then return null; end if;
  return new;
end $$;
-- Corre después de xp_events_guard (orden alfabético): para usuarios, el guard general ya rechazó 'meal'.
drop trigger if exists xp_events_meal_guard on public.xp_events;
create trigger xp_events_meal_guard before insert on public.xp_events for each row execute function public.guard_meal_xp();
