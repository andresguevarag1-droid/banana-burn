-- Retos de 21–30 días: inscripción y días cumplidos
create table if not exists public.user_challenges (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id text not null,
  started_on date not null default current_date,
  status text not null default 'activo' check (status in ('activo','completado','abandonado')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists user_challenges_one_active on public.user_challenges (user_id, challenge_id) where status = 'activo';

create table if not exists public.challenge_checkins (
  user_challenge_id bigint not null references public.user_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  primary key (user_challenge_id, day)
);

alter table public.user_challenges enable row level security;
alter table public.challenge_checkins enable row level security;
create policy "retos: propios" on public.user_challenges for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "retos: staff lee" on public.user_challenges for select using (public.is_staff());
create policy "checkins: propios" on public.challenge_checkins for all using (user_id = auth.uid()) with check (user_id = auth.uid());
