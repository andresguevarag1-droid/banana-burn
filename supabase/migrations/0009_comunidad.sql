-- Comunidad estilo Strava: perfiles públicos, seguir, publicaciones, bananas (kudos) y comentarios

alter table public.profiles
  add column if not exists username text unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  add column if not exists bio text check (char_length(bio) <= 160),
  add column if not exists visibility text not null default 'seguidores' check (visibility in ('publico','seguidores','privado')),
  add column if not exists share_workouts boolean not null default true;

create table if not exists public.follows (
  follower uuid not null references auth.users(id) on delete cascade,
  followee uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);

create table if not exists public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('workout','pr','challenge','text')),
  workout_id uuid references public.workouts(id) on delete set null,
  body text check (char_length(body) <= 500),
  data jsonb not null default '{}',
  visibility text not null default 'seguidores' check (visibility in ('publico','seguidores','privado')),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists posts_user_created on public.posts (user_id, created_at desc);
create index if not exists posts_created on public.posts (created_at desc);

create table if not exists public.kudos (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- ¿Puede el usuario actual ver esta publicación?
create or replace function public.can_see_post(p_user uuid, p_visibility text, p_hidden boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_user = auth.uid() then true
    when p_hidden then public.is_staff()
    when p_visibility = 'publico' then exists (select 1 from profiles where id = p_user and visibility <> 'privado')
    when p_visibility = 'seguidores' then exists (select 1 from follows where follower = auth.uid() and followee = p_user)
    else public.is_staff()
  end;
$$;

-- Perfil público mínimo (sin datos de salud) para la comunidad
create or replace view public.public_profiles with (security_invoker = false) as
  select id, username, full_name, bio, visibility from public.profiles where username is not null and (visibility <> 'privado' or id = auth.uid());
grant select on public.public_profiles to authenticated;

alter table public.follows enable row level security;
alter table public.posts enable row level security;
alter table public.kudos enable row level security;
alter table public.comments enable row level security;

create policy "follows: ver los míos" on public.follows for select using (follower = auth.uid() or followee = auth.uid() or public.is_staff());
create policy "follows: seguir" on public.follows for insert with check (follower = auth.uid() and exists (select 1 from profiles where id = followee and visibility <> 'privado'));
create policy "follows: dejar de seguir" on public.follows for delete using (follower = auth.uid());

create policy "posts: ver" on public.posts for select using (public.can_see_post(user_id, visibility, hidden));
create policy "posts: crear" on public.posts for insert with check (user_id = auth.uid());
create policy "posts: editar propio" on public.posts for update using (user_id = auth.uid() or public.is_staff());
create policy "posts: borrar propio" on public.posts for delete using (user_id = auth.uid() or public.is_admin());

create policy "kudos: ver" on public.kudos for select using (exists (select 1 from posts p where p.id = post_id and public.can_see_post(p.user_id, p.visibility, p.hidden)));
create policy "kudos: dar" on public.kudos for insert with check (user_id = auth.uid() and exists (select 1 from posts p where p.id = post_id and public.can_see_post(p.user_id, p.visibility, p.hidden)));
create policy "kudos: quitar" on public.kudos for delete using (user_id = auth.uid());

create policy "comments: ver" on public.comments for select using (not hidden and exists (select 1 from posts p where p.id = post_id and public.can_see_post(p.user_id, p.visibility, p.hidden)) or public.is_staff());
create policy "comments: crear" on public.comments for insert with check (user_id = auth.uid() and exists (select 1 from posts p where p.id = post_id and public.can_see_post(p.user_id, p.visibility, p.hidden)));
create policy "comments: borrar" on public.comments for delete using (user_id = auth.uid() or public.is_staff());
create policy "comments: moderar" on public.comments for update using (public.is_staff());

-- Ranking semanal (entrenos y XP) entre las personas que sigues + tú
create or replace function public.weekly_leaderboard()
returns table (user_id uuid, username text, full_name text, workouts bigint, xp bigint)
language sql stable security definer set search_path = public as $$
  with circle as (select auth.uid() as id union select followee from follows where follower = auth.uid())
  select p.id, p.username, p.full_name,
    (select count(*) from workouts w where w.user_id = p.id and w.day >= date_trunc('week', now())::date),
    (select coalesce(sum(x.xp), 0) from xp_events x where x.user_id = p.id and x.created_at >= date_trunc('week', now()))
  from profiles p join circle c on c.id = p.id
  order by 5 desc limit 50;
$$;
