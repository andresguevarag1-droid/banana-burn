-- Banana Burn, Nutrición: "Mis recetas" (platos y recetas propias armadas con ingredientes de la base).
-- Idempotente: se puede correr varias veces. Solo la dueña o el dueño lee, crea, edita y borra sus recetas.
-- `ingredients` guarda cada ingrediente con sus gramos o porciones y sus macros (foto del momento);
-- kcal/protein/carbs/fat son POR PORCIÓN (lo que se registra al elegir la receta), ya calculados por el servidor.

create table if not exists public.user_recipes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  servings smallint not null default 1 check (servings between 1 and 20),
  ingredients jsonb not null default '[]'::jsonb,
  kcal int not null default 0 check (kcal between 0 and 5000),
  protein numeric(5,1) not null default 0 check (protein between 0 and 400),
  carbs numeric(5,1) not null default 0 check (carbs between 0 and 1000),
  fat numeric(5,1) not null default 0 check (fat between 0 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_recipes drop constraint if exists user_recipes_ingredients_shape;
alter table public.user_recipes add constraint user_recipes_ingredients_shape check (
  jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) between 1 and 30 and octet_length(ingredients::text) <= 16000
);
create index if not exists user_recipes_user_updated on public.user_recipes (user_id, updated_at desc);

alter table public.user_recipes enable row level security;
drop policy if exists "user_recipes: leer propias" on public.user_recipes;
drop policy if exists "user_recipes: crear propias" on public.user_recipes;
drop policy if exists "user_recipes: editar propias" on public.user_recipes;
drop policy if exists "user_recipes: borrar propias" on public.user_recipes;
create policy "user_recipes: leer propias" on public.user_recipes for select using (user_id = auth.uid());
create policy "user_recipes: crear propias" on public.user_recipes for insert with check (user_id = auth.uid());
create policy "user_recipes: editar propias" on public.user_recipes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_recipes: borrar propias" on public.user_recipes for delete using (user_id = auth.uid());
revoke all on public.user_recipes from anon;
grant select, insert, update, delete on public.user_recipes to authenticated;

-- Máximo 100 recetas por persona y 200 creaciones en 24 h. Fechas siempre del servidor.
create or replace function public.guard_user_recipes()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    if (select count(*) from public.user_recipes where user_id = new.user_id) >= 100 then
      raise exception 'Llegaste al máximo de recetas guardadas' using errcode = 'P0001';
    end if;
    if (select count(*) from public.user_recipes where user_id = new.user_id and created_at > now() - interval '24 hours') >= 200 then
      raise exception 'Demasiadas acciones seguidas. Intenta más tarde.' using errcode = 'P0001', hint = 'rate_limit';
    end if;
  else
    -- No se cambia de dueño ni la fecha de creación.
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists user_recipes_guard on public.user_recipes;
create trigger user_recipes_guard before insert or update on public.user_recipes for each row execute function public.guard_user_recipes();
