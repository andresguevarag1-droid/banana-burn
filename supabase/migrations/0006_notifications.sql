-- Banana Burn · comunicaciones: preferencias, suscripciones Web Push, bitácora de envíos y avisos in-app.
-- Escrituras de notification_log y notifications: solo el servidor (service_role, cron y webhooks).

-- ───────────── Preferencias ─────────────
create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_reminders boolean not null default true,     -- recordatorio de entreno, racha en peligro, reactivación
  push_reminders boolean not null default true,
  reminder_time text not null default '07:00' check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  timezone text not null default 'America/Costa_Rica',
  weekly_summary boolean not null default true,
  marketing boolean not null default false,          -- promociones: requiere opt-in explícito
  quiet_start text default '22:00' check (quiet_start is null or quiet_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  quiet_end text default '07:00' check (quiet_end is null or quiet_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists notification_prefs_touch on public.notification_prefs;
create trigger notification_prefs_touch before update on public.notification_prefs
  for each row execute function public.touch_updated_at();

-- ───────────── Suscripciones Web Push (una por navegador/dispositivo) ─────────────
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

-- ───────────── Bitácora de envíos (dedupe: un tipo por usuario por día local) ─────────────
-- local_day = '1970-01-01' marca envíos únicos en la vida (bienvenida, plan listo).
create table if not exists public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  local_day date not null,
  channels text[] not null default '{}',
  pushes smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, kind, local_day)
);
create index if not exists notification_log_day on public.notification_log (user_id, local_day desc);

-- ───────────── Avisos in-app (campanita) ─────────────
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_recent on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread on public.notifications (user_id) where read_at is null;

-- ───────────── RLS ─────────────
alter table public.notification_prefs enable row level security;
create policy "avisos prefs: propias" on public.notification_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "avisos prefs: staff lee" on public.notification_prefs for select using (public.is_staff());

alter table public.push_subscriptions enable row level security;
create policy "push: propias" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push: staff lee" on public.push_subscriptions for select using (public.is_staff());

alter table public.notification_log enable row level security;
create policy "bitácora: propia lee" on public.notification_log for select using (user_id = auth.uid() or public.is_staff());

alter table public.notifications enable row level security;
create policy "avisos: propios leen" on public.notifications for select using (user_id = auth.uid() or public.is_staff());
create policy "avisos: propios marcan" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "avisos: propios borran" on public.notifications for delete using (user_id = auth.uid());
-- El botón "Probar aviso" del perfil inserta con la sesión del usuario, solo kind = 'test'.
create policy "avisos: prueba propia" on public.notifications for insert with check (user_id = auth.uid() and kind = 'test');
-- El usuario solo puede cambiar read_at (no título, cuerpo ni URL).
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;
