-- 0057_push_nativo.sql: avisos push de la app nativa (FCM en Android, APNs en iPhone). Aditiva e idempotente: se puede
-- pegar varias veces. Requiere 0001-0056. La web (Web Push, push_subscriptions) no cambia.
--   1. native_push_tokens: un token por teléfono con la app instalada. RLS: cada persona ve, agrega y borra solo los suyos;
--      el staff no los lee (igual que las llaves de Web Push, 0014). El cron los lee con service_role.
--   2. Tope de 10 teléfonos por persona: al agregar el 11, se borra el que lleva más tiempo sin usarse.

-- ───────────── 1. Tokens ─────────────
create table if not exists public.native_push_tokens (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  token text not null,
  app_version text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.native_push_tokens drop constraint if exists native_push_tokens_token_key;
alter table public.native_push_tokens add constraint native_push_tokens_token_key unique (token);
alter table public.native_push_tokens drop constraint if exists native_push_platform_ok;
alter table public.native_push_tokens add constraint native_push_platform_ok check (platform in ('ios', 'android'));
alter table public.native_push_tokens drop constraint if exists native_push_token_len;
alter table public.native_push_tokens add constraint native_push_token_len check (char_length(token) between 32 and 4096 and token ~ '^[A-Za-z0-9:_.-]+$');
alter table public.native_push_tokens drop constraint if exists native_push_version_len;
alter table public.native_push_tokens add constraint native_push_version_len check (app_version is null or char_length(app_version) <= 40);
create index if not exists native_push_tokens_user on public.native_push_tokens (user_id);

alter table public.native_push_tokens enable row level security;
drop policy if exists "push nativo: propios" on public.native_push_tokens;
create policy "push nativo: propios" on public.native_push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.native_push_tokens from anon;
grant select, insert, update, delete on public.native_push_tokens to authenticated;

-- ───────────── 2. Tope de 10 teléfonos por persona ─────────────
create or replace function public.native_push_tokens_cap()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.native_push_tokens
  where id in (
    select t.id from public.native_push_tokens t
    where t.user_id = new.user_id
    order by coalesce(t.last_used_at, t.created_at) desc
    offset 9
  );
  return new;
end $$;
revoke execute on function public.native_push_tokens_cap() from public, anon, authenticated;
drop trigger if exists native_push_tokens_cap on public.native_push_tokens;
create trigger native_push_tokens_cap before insert on public.native_push_tokens
  for each row execute function public.native_push_tokens_cap();
